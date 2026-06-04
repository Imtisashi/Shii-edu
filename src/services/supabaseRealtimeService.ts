import type { RealtimeChannel } from '@supabase/supabase-js';
import { refreshSupabaseRealtimeAuth, supabase } from './supabaseClient';

export type BusLocationPayload = {
  accuracy?: number | null;
  heading?: number | null;
  latitude: number;
  longitude: number;
  routeId: string;
  speed?: number | null;
  timestamp: string;
  vehicleNumber?: string | null;
};

export type BusTrackingSubscription = {
  channel: RealtimeChannel;
  unsubscribe: () => Promise<void>;
};

const assertUuid = (value: string, label: string): string => {
  const text = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${label} must be a valid Supabase UUID.`);
  }
  return text;
};

const cleanTopicPart = (value: string, label: string): string => {
  const text = String(value || '').trim();
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(text)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return text;
};

export const busTrackingTopic = (instituteId: string, routeId: string): string => (
  `bus_tracking:${assertUuid(instituteId, 'Institute ID')}:${cleanTopicPart(routeId, 'Route ID')}`
);

export const subscribeToSupabaseBusTracking = async ({
  instituteId,
  onLocation,
  routeId,
}: {
  instituteId: string;
  onLocation: (payload: BusLocationPayload) => void;
  routeId: string;
}): Promise<BusTrackingSubscription> => {
  await refreshSupabaseRealtimeAuth();
  const channel = supabase.channel(busTrackingTopic(instituteId, routeId), {
    config: {
      broadcast: {
        ack: true,
        self: false,
      },
      private: true,
    },
  });

  channel.on('broadcast', { event: 'location_update' }, ({ payload }) => {
    const location = payload as BusLocationPayload;
    if (
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      onLocation(location);
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Realtime channel subscription timed out.'));
    }, 12000);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        reject(new Error(`Realtime channel did not subscribe: ${status}`));
      }
    });
  });

  return {
    channel,
    unsubscribe: async () => {
      await supabase.removeChannel(channel);
    },
  };
};

export const sendSupabaseBusLocation = async ({
  instituteId,
  payload,
  routeId,
}: {
  instituteId: string;
  payload: BusLocationPayload;
  routeId: string;
}): Promise<void> => {
  await refreshSupabaseRealtimeAuth();
  const channel = supabase.channel(busTrackingTopic(instituteId, routeId), {
    config: {
      broadcast: {
        ack: true,
        self: false,
      },
      private: true,
    },
  });

  const response = await channel.send({
    event: 'location_update',
    payload,
    type: 'broadcast',
  });

  if (response !== 'ok') {
    throw new Error(`Supabase realtime broadcast failed: ${response}`);
  }
};
