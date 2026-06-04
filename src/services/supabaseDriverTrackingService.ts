import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import {
  busTrackingTopic,
  sendSupabaseBusLocation,
  type BusLocationPayload,
} from './supabaseRealtimeService';
import { refreshSupabaseRealtimeAuth, supabase } from './supabaseClient';

export const BACKGROUND_BUS_TRACKING = 'BACKGROUND_BUS_TRACKING';

type DriverRouteContext = {
  instituteId: string;
  routeId: string;
  vehicleNumber: string | null;
};

type BackgroundLocationTaskData = {
  locations?: LocationObject[];
};

type SupabaseDriverTrackingSession = {
  stop: () => Promise<void>;
};

const ROUTE_CONTEXT_KEY = 'edu-shii.supabase.active-driver-route.v1';

const readRouteContext = async (): Promise<DriverRouteContext | null> => {
  const raw = await AsyncStorage.getItem(ROUTE_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DriverRouteContext;
    if (!parsed.instituteId || !parsed.routeId) return null;
    return parsed;
  } catch {
    await AsyncStorage.removeItem(ROUTE_CONTEXT_KEY);
    return null;
  }
};

const writeRouteContext = async (context: DriverRouteContext): Promise<void> => {
  await AsyncStorage.setItem(ROUTE_CONTEXT_KEY, JSON.stringify(context));
};

const clearRouteContext = async (): Promise<void> => {
  await AsyncStorage.removeItem(ROUTE_CONTEXT_KEY);
};

const locationToPayload = (
  location: LocationObject,
  context: DriverRouteContext
): BusLocationPayload => ({
  accuracy: Number.isFinite(location.coords.accuracy) ? location.coords.accuracy : null,
  heading: Number.isFinite(location.coords.heading) ? location.coords.heading : null,
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  routeId: context.routeId,
  speed: Number.isFinite(location.coords.speed) ? location.coords.speed : null,
  timestamp: new Date(location.timestamp || Date.now()).toISOString(),
  vehicleNumber: context.vehicleNumber,
});

const publishLocation = async (
  location: LocationObject,
  context: DriverRouteContext
): Promise<void> => {
  await sendSupabaseBusLocation({
    instituteId: context.instituteId,
    payload: locationToPayload(location, context),
    routeId: context.routeId,
  });
};

if (!TaskManager.isTaskDefined(BACKGROUND_BUS_TRACKING)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(BACKGROUND_BUS_TRACKING, async ({ data, error }) => {
    if (error) {
      console.warn('Supabase background bus tracking failed:', error);
      return;
    }

    const context = await readRouteContext();
    const locations = data?.locations || [];
    if (!context || locations.length === 0) return;

    const latestLocation = locations[locations.length - 1];
    await publishLocation(latestLocation, context).catch((publishError) => {
      console.warn('Supabase background location broadcast failed:', publishError);
    });
  });
}

export const startSupabaseDriverRouteTracking = async ({
  instituteId,
  onLocation,
  routeId,
  vehicleNumber,
}: {
  instituteId: string;
  onLocation?: (payload: BusLocationPayload) => void;
  routeId: string;
  vehicleNumber?: string | null;
}): Promise<SupabaseDriverTrackingSession> => {
  const context: DriverRouteContext = {
    instituteId,
    routeId,
    vehicleNumber: vehicleNumber || null,
  };

  await refreshSupabaseRealtimeAuth();
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (foregroundPermission.status !== 'granted') {
    throw new Error('Foreground location permission is required to start this route.');
  }

  if (Platform.OS !== 'web') {
    const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
    if (backgroundPermission.status !== 'granted') {
      throw new Error('Background location permission is required for live route tracking.');
    }
  }

  await writeRouteContext(context);

  const channel = supabase.channel(busTrackingTopic(instituteId, routeId), {
    config: {
      broadcast: {
        ack: true,
        self: false,
      },
      private: true,
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Driver realtime channel timed out.')), 12000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        reject(new Error(`Driver realtime channel failed: ${status}`));
      }
    });
  });

  const foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
    },
    async (location) => {
      const payload = locationToPayload(location, context);
      const response = await channel.send({
        event: 'location_update',
        payload,
        type: 'broadcast',
      });

      if (response !== 'ok') {
        console.warn('Supabase foreground bus broadcast returned:', response);
      }
      onLocation?.(payload);
    }
  );

  if (Platform.OS !== 'web') {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_BUS_TRACKING);
    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(BACKGROUND_BUS_TRACKING, {
        accuracy: Location.Accuracy.Balanced,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesDistance: 25,
        distanceInterval: 15,
        foregroundService: {
          killServiceOnDestroy: false,
          notificationBody: 'Edu-shii is actively tracking this route live.',
          notificationColor: '#16A34A',
          notificationTitle: 'Edu-shii Driver Tracker',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        timeInterval: 8000,
      });
    }
  }

  return {
    stop: async () => {
      foregroundSubscription.remove();
      if (Platform.OS !== 'web') {
        const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_BUS_TRACKING);
        if (started) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_BUS_TRACKING);
        }
      }
      await clearRouteContext();
      await supabase.removeChannel(channel);
    },
  };
};
