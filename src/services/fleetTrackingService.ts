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
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, realtimeDb } from '../../firebaseConfig';
import { ensureInstituteClaims } from './instituteClaimsService';

export type FleetLocation = {
  accuracy: number | null;
  driverName: string;
  driverUid: string;
  heading: number | null;
  instituteId: string;
  latitude: number;
  longitude: number;
  routeDestination: string | null;
  routeDestinationLatitude: number | null;
  routeDestinationLongitude: number | null;
  routeOrigin: string | null;
  routeOriginLatitude: number | null;
  routeOriginLongitude: number | null;
  routeName: string | null;
  speed: number | null;
  status: 'active' | 'assigned' | 'offline';
  updatedAt: number | null;
  vehicleId: string;
};

type DriverProfile = {
  driverName?: string | null;
  driverUid?: string | null;
  instituteId?: string | null;
  name?: string | null;
  role?: string | null;
  routeDestinationLatitude?: number | string | null;
  routeDestinationLongitude?: number | string | null;
  routeOrigin?: string | null;
  routeOriginLatitude?: number | string | null;
  routeOriginLongitude?: number | string | null;
  routeDestination?: string | null;
  routeName?: string | null;
  routeStatus?: string | null;
  transportControl?: {
    routeMap?: {
      destination?: { latitude?: number | string | null; longitude?: number | string | null } | null;
      origin?: { latitude?: number | string | null; longitude?: number | string | null } | null;
    } | null;
  } | null;
  vehicleId?: string | null;
};

export type DriverBroadcastSession = {
  mode?: 'live' | 'preview';
  stop: () => Promise<void>;
};

type FleetLocationCoords = {
  accuracy?: number | null;
  heading?: number | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
};

type DriverRouteContext = {
  currentUser: User;
  instituteId: string;
  profile: DriverProfile;
  vehicleId: string;
};

const LIVE_BROADCAST_TIMEOUT_MS = 6500;
const LOCATION_TIMEOUT_MS = 8000;
const PREVIEW_START_COORDS = {
  latitude: 25.6751,
  longitude: 94.1086,
};

export const isFleetLiveLocationBackendEnabled = (): boolean => (
  process.env.EXPO_PUBLIC_ENABLE_FIREBASE_REALTIME_DB === 'true'
);

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

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const normalizeNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeText = (value: unknown): string | null => {
  const clean = String(value || '').trim();
  return clean || null;
};

const routeCoordinate = (
  profile: DriverProfile,
  field: 'routeOriginLatitude' | 'routeOriginLongitude' | 'routeDestinationLatitude' | 'routeDestinationLongitude'
): number | null => {
  const routeMap = profile.transportControl?.routeMap;
  if (field === 'routeOriginLatitude') return normalizeNumber(profile.routeOriginLatitude ?? routeMap?.origin?.latitude);
  if (field === 'routeOriginLongitude') return normalizeNumber(profile.routeOriginLongitude ?? routeMap?.origin?.longitude);
  if (field === 'routeDestinationLatitude') return normalizeNumber(profile.routeDestinationLatitude ?? routeMap?.destination?.latitude);
  return normalizeNumber(profile.routeDestinationLongitude ?? routeMap?.destination?.longitude);
};

const routeFields = (profile: DriverProfile) => ({
  routeDestination: normalizeText(profile.routeDestination),
  routeDestinationLatitude: routeCoordinate(profile, 'routeDestinationLatitude'),
  routeDestinationLongitude: routeCoordinate(profile, 'routeDestinationLongitude'),
  routeOrigin: normalizeText(profile.routeOrigin),
  routeOriginLatitude: routeCoordinate(profile, 'routeOriginLatitude'),
  routeOriginLongitude: routeCoordinate(profile, 'routeOriginLongitude'),
});

const createFleetLocation = (
  coords: FleetLocationCoords,
  context: DriverRouteContext
): FleetLocation => ({
  accuracy: normalizeNumber(coords.accuracy),
  driverName: context.profile.name || 'Driver',
  driverUid: context.currentUser.uid,
  heading: normalizeNumber(coords.heading),
  instituteId: context.instituteId,
  latitude: coords.latitude,
  longitude: coords.longitude,
  ...routeFields(context.profile),
  routeName: context.profile.routeName || null,
  speed: normalizeNumber(coords.speed),
  status: 'active',
  updatedAt: Date.now(),
  vehicleId: context.vehicleId,
});

const readBrowserPosition = (): Promise<FleetLocationCoords> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Browser location is not available.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: position.coords.speed,
      }),
      () => reject(new Error('Location permission is unavailable on this device.')),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: LOCATION_TIMEOUT_MS,
      }
    );
  });
};

const getInitialCoords = async (): Promise<FleetLocationCoords> => {
  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_TIMEOUT_MS,
      'Location timed out.'
    );

    return {
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed,
    };
  } catch (expoError) {
    try {
      return await withTimeout(
        readBrowserPosition(),
        LOCATION_TIMEOUT_MS,
        'Browser location timed out.'
      );
    } catch {
      console.warn('Driver location fell back to preview coordinates:', expoError);
      return {
        accuracy: null,
        heading: null,
        latitude: PREVIEW_START_COORDS.latitude,
        longitude: PREVIEW_START_COORDS.longitude,
        speed: null,
      };
    }
  }
};

const writeFleetLocation = async (
  context: DriverRouteContext,
  location: FleetLocation
): Promise<void> => {
  const targetRef = locationRef(context.instituteId, context.vehicleId);
  await withTimeout(
    set(targetRef, {
      ...location,
      updatedAt: serverTimestamp(),
    }),
    LIVE_BROADCAST_TIMEOUT_MS,
    'Live route sharing timed out while saving the vehicle position.'
  );
};

const createOfflineLocation = (context: DriverRouteContext) => ({
  instituteId: context.instituteId,
  vehicleId: context.vehicleId,
  driverUid: context.currentUser.uid,
  driverName: context.profile.name || 'Driver',
  ...routeFields(context.profile),
  routeName: context.profile.routeName || null,
  status: 'offline',
  updatedAt: serverTimestamp(),
});

const hasUsableCoordinatePair = (latitude: number | null, longitude: number | null): boolean => (
  Number.isFinite(latitude) && Number.isFinite(longitude)
);

const routeAssignmentLocation = (id: string, profile: DriverProfile & Record<string, unknown>): FleetLocation | null => {
  const vehicleId = normalizeText(profile.vehicleId);
  const instituteId = normalizeText(profile.instituteId);
  const routeName = normalizeText(profile.routeName);
  const fields = routeFields(profile);
  const latitude = fields.routeOriginLatitude ?? fields.routeDestinationLatitude;
  const longitude = fields.routeOriginLongitude ?? fields.routeDestinationLongitude;

  if (!instituteId || !vehicleId || !routeName || !hasUsableCoordinatePair(latitude, longitude)) return null;

  return {
    accuracy: null,
    driverName: normalizeText(profile.name ?? profile.driverName) || 'Driver',
    driverUid: normalizeText(profile.driverUid) || id,
    heading: null,
    instituteId,
    latitude: latitude as number,
    longitude: longitude as number,
    ...fields,
    routeName,
    speed: null,
    status: String(profile.routeStatus || 'active').trim().toLowerCase() === 'active' ? 'assigned' : 'offline',
    updatedAt: null,
    vehicleId,
  };
};

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
  const context = { currentUser, instituteId, profile, vehicleId };
  await ensureInstituteClaims(currentUser);

  const permission = await withTimeout(
    Location.requestForegroundPermissionsAsync(),
    LOCATION_TIMEOUT_MS,
    'Location permission request timed out.'
  );
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required to broadcast the vehicle position.');
  }

  const targetRef = locationRef(instituteId, vehicleId);
  await withTimeout(
    onDisconnect(targetRef).set(createOfflineLocation(context)),
    LIVE_BROADCAST_TIMEOUT_MS,
    'Live route sharing is not responding. Showing the driver map locally instead.'
  );

  const initialLocation = createFleetLocation(await getInitialCoords(), context);
  onLocation?.(initialLocation);
  await writeFleetLocation(context, initialLocation);

  const subscription = await withTimeout(
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 8,
        timeInterval: 5000,
      },
      async ({ coords }) => {
        const nextLocation = createFleetLocation(coords, context);
        onLocation?.(nextLocation);
        writeFleetLocation(context, nextLocation).catch((error) => {
          console.warn('Fleet live location write failed:', error);
        });
      }
    ),
    LOCATION_TIMEOUT_MS,
    'Location updates could not be started.'
  );

  return {
    mode: 'live',
    stop: async () => {
      subscription.remove();
      await withTimeout(
        set(targetRef, createOfflineLocation(context)),
        LIVE_BROADCAST_TIMEOUT_MS,
        'Live route sharing timed out while ending the route.'
      ).catch((error) => {
        console.warn('Fleet live route stop write failed:', error);
      });
    },
  };
};

export const startDriverLocationPreview = async ({
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
  const context = { currentUser, instituteId, profile, vehicleId };
  const initialCoords = await getInitialCoords();
  let latestLocation = createFleetLocation(initialCoords, context);
  onLocation?.(latestLocation);

  const intervalId = setInterval(() => {
    latestLocation = createFleetLocation({
      accuracy: latestLocation.accuracy,
      heading: latestLocation.heading,
      latitude: latestLocation.latitude + 0.00008,
      longitude: latestLocation.longitude + 0.00006,
      speed: 4.2,
    }, context);
    onLocation?.(latestLocation);
  }, 5000);

  return {
    mode: 'preview',
    stop: async () => {
      clearInterval(intervalId);
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

export const subscribeToFleetRouteAssignments = ({
  instituteId,
  onChange,
  onError,
}: {
  instituteId: string;
  onChange: (locations: FleetLocation[]) => void;
  onError?: (error: Error) => void;
}): (() => void) => {
  const assignmentsQuery = query(
    collection(db, 'fleetRouteAssignments'),
    where('instituteId', '==', cleanPathPart(instituteId, 'Institute ID'))
  );

  return onSnapshot(
    assignmentsQuery,
    (snapshot) => {
      const routes = snapshot.docs
        .map((document) => {
          const profile = document.data() as DriverProfile & Record<string, unknown>;
          return { id: document.id, ...profile };
        })
        .map((profile) => routeAssignmentLocation(profile.id, profile))
        .filter((location): location is FleetLocation => Boolean(location))
        .sort((left, right) => String(left.vehicleId).localeCompare(String(right.vehicleId)));
      onChange(routes);
    },
    (error) => onError?.(error)
  );
};
