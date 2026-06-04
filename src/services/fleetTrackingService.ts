import * as Location from 'expo-location';
import type { User } from 'firebase/auth';
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { realtimeDb } from '../../firebaseConfig';
import { ensureInstituteClaims } from './instituteClaimsService';

export type FleetLocation = {
  accuracy: number | null;
  driverName: string;
  driverUid: string;
  heading: number | null;
  instituteId: string;
  latitude: number;
  longitude: number;
  routeName: string | null;
  speed: number | null;
  status: 'active' | 'offline';
  updatedAt: number | null;
  vehicleId: string;
};

type DriverProfile = {
  instituteId?: string | null;
  name?: string | null;
  routeName?: string | null;
  vehicleId?: string | null;
};

export type DriverBroadcastSession = {
  stop: () => Promise<void>;
};

const cleanPathPart = (value: string, label: string): string => {
  const clean = String(value || '').trim();
  if (!clean || /[.#$/\[\]]/.test(clean)) {
    throw new Error(`${label} is missing or contains unsupported characters.`);
  }
  return clean;
};

const locationRef = (instituteId: string, vehicleId: string) => (
  ref(realtimeDb, `fleetLocations/${cleanPathPart(instituteId, 'Institute ID')}/${cleanPathPart(vehicleId, 'Vehicle ID')}`)
);

export const startDriverLocationBroadcast = async ({
  currentUser,
  profile,
  onLocation,
}: {
  currentUser: User;
  profile: DriverProfile;
  onLocation?: (location: FleetLocation) => void;
}): Promise<DriverBroadcastSession> => {
  const instituteId = cleanPathPart(profile.instituteId || '', 'Institute ID');
  const vehicleId = cleanPathPart(profile.vehicleId || '', 'Vehicle ID');
  await ensureInstituteClaims(currentUser);

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required to broadcast the vehicle position.');
  }

  const targetRef = locationRef(instituteId, vehicleId);
  await onDisconnect(targetRef).set({
    instituteId,
    vehicleId,
    driverUid: currentUser.uid,
    driverName: profile.name || 'Driver',
    routeName: profile.routeName || null,
    status: 'offline',
    updatedAt: serverTimestamp(),
  });

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 8,
      timeInterval: 5000,
    },
    async ({ coords }) => {
      const nextLocation: FleetLocation = {
        accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
        driverName: profile.name || 'Driver',
        driverUid: currentUser.uid,
        heading: Number.isFinite(coords.heading) ? coords.heading : null,
        instituteId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        routeName: profile.routeName || null,
        speed: Number.isFinite(coords.speed) ? coords.speed : null,
        status: 'active',
        updatedAt: Date.now(),
        vehicleId,
      };

      await set(targetRef, {
        ...nextLocation,
        updatedAt: serverTimestamp(),
      });
      onLocation?.(nextLocation);
    }
  );

  return {
    stop: async () => {
      subscription.remove();
      await set(targetRef, {
        instituteId,
        vehicleId,
        driverUid: currentUser.uid,
        driverName: profile.name || 'Driver',
        routeName: profile.routeName || null,
        status: 'offline',
        updatedAt: serverTimestamp(),
      });
    },
  };
};

export const subscribeToFleetLocations = ({
  instituteId,
  onChange,
  onError,
}: {
  instituteId: string;
  onChange: (locations: FleetLocation[]) => void;
  onError?: (error: Error) => void;
}): Unsubscribe => {
  const fleetRef = ref(realtimeDb, `fleetLocations/${cleanPathPart(instituteId, 'Institute ID')}`);
  return onValue(
    fleetRef,
    (snapshot) => {
      const value = snapshot.val() || {};
      const locations = Object.values(value)
        .filter((item): item is FleetLocation => (
          Boolean(item) &&
          typeof item === 'object' &&
          Number.isFinite((item as FleetLocation).latitude) &&
          Number.isFinite((item as FleetLocation).longitude)
        ))
        .sort((left, right) => String(left.vehicleId).localeCompare(String(right.vehicleId)));
      onChange(locations);
    },
    (error) => onError?.(error)
  );
};
