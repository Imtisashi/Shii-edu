const getSupabaseTenantDataUrl = () => {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!supabaseUrl) {
    const error = new Error('SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL must be configured for Supabase workspace sync.');
    error.statusCode = 503;
    throw error;
  }

  return `${supabaseUrl}/functions/v1/tenant-data`;
};

const callSupabaseTenantBridge = async ({ action, authorization, payload = {} }) => {
  if (!authorization) {
    const error = new Error('Missing Firebase ID token for Supabase workspace sync.');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(getSupabaseTenantDataUrl(), {
    body: JSON.stringify({ action, payload }),
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { error: text };
  }

  if (!response.ok || data.success === false) {
    const error = new Error(data.error || `Supabase workspace sync failed with status ${response.status}.`);
    error.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
    throw error;
  }

  return data;
};

const stripInstituteIdForTenantActor = (profile) => {
  const { instituteId: _instituteId, ...safeProfile } = profile;
  return safeProfile;
};

module.exports = {
  callSupabaseTenantBridge,
  stripInstituteIdForTenantActor,
};
