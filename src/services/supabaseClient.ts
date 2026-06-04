import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type Session } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_CLIENT_PLACEHOLDER_URL = 'https://localhost.invalid';

if ((!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) && typeof __DEV__ !== 'undefined' && __DEV__) {
  console.warn('Supabase client environment is incomplete. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient<Database>(
  SUPABASE_URL || SUPABASE_CLIENT_PLACEHOLDER_URL,
  SUPABASE_PUBLISHABLE_KEY || 'missing-supabase-publishable-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: AsyncStorage,
    },
    realtime: {
      params: {
        eventsPerSecond: 12,
      },
    },
  }
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
      return;
    }

    void supabase.auth.stopAutoRefresh();
  });
}

export type SupabaseSession = Session;
export type SupabaseProfile = Tables<'profiles'>;
export type SupabaseInstitute = Tables<'institutes'>;

export const assertSupabaseConfigured = (): void => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
};

export const requireSupabaseSession = async (): Promise<Session> => {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (!data.session) {
    throw new Error('A Supabase session is required for this operation.');
  }

  return data.session;
};

export const refreshSupabaseRealtimeAuth = async (): Promise<Session> => {
  const session = await requireSupabaseSession();
  supabase.realtime.setAuth(session.access_token);
  return session;
};
