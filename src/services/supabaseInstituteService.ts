import { supabase } from './supabaseClient';
import type { SupabaseInstitute, SupabaseProfile } from './supabaseClient';

export type SupabaseBranding = {
  darkPrimaryColor: string;
  darkSecondaryColor: string;
  instituteId: string;
  logoUrl: string | null;
  name: string;
  primaryColor: string;
  secondaryColor: string;
};

export const getSupabaseProfile = async (): Promise<SupabaseProfile> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('A Supabase user session is required.');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (error) throw error;
  return data;
};

export const getSupabaseInstitute = async (
  instituteId: string
): Promise<SupabaseInstitute> => {
  const { data, error } = await supabase
    .from('institutes')
    .select('*')
    .eq('id', instituteId)
    .single();

  if (error) throw error;
  return data;
};

export const getActiveSupabaseBranding = async (): Promise<SupabaseBranding> => {
  const profile = await getSupabaseProfile();
  if (!profile.institute_id) {
    throw new Error('This Supabase profile is not linked to an institute.');
  }

  const institute = await getSupabaseInstitute(profile.institute_id);
  return {
    darkPrimaryColor: institute.dark_primary_color,
    darkSecondaryColor: institute.dark_secondary_color,
    instituteId: institute.id,
    logoUrl: institute.logo_url,
    name: institute.name,
    primaryColor: institute.primary_color,
    secondaryColor: institute.secondary_color,
  };
};
