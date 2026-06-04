const { createClient } = require('@supabase/supabase-js');

class SupabaseAdminConfigurationError extends Error {
  constructor(message, code = 'SUPABASE_ADMIN_CONFIG_MISSING') {
    super(message);
    this.name = 'SupabaseAdminConfigurationError';
    this.code = code;
    this.statusCode = 503;
  }
}

const readValue = (value) => String(value || '').trim();

const looksLikeSecretKey = (value) => {
  const key = readValue(value);
  return Boolean(key) && (
    key.startsWith('sb_secret_') ||
    key.startsWith('sb_service_role_') ||
    key.split('.').length === 3
  );
};

const readSecretFromBundle = (bundle) => {
  const value = readValue(bundle);
  if (!value) return '';

  try {
    const parsed = JSON.parse(value);
    const candidates = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed || {});

    return candidates.find(looksLikeSecretKey) || '';
  } catch (_error) {
    return value
      .split(',')
      .map((item) => item.trim())
      .find(looksLikeSecretKey) || '';
  }
};

const getSupabaseAdminConfig = () => {
  const url = readValue(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL);
  const secretKey = readValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    readSecretFromBundle(process.env.SUPABASE_SECRET_KEYS)
  );

  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL must be configured with the Supabase project URL.',
      'SUPABASE_URL_MISSING'
    );
  }

  if (!looksLikeSecretKey(secretKey)) {
    throw new SupabaseAdminConfigurationError(
      'SUPABASE_SERVICE_ROLE_KEY is required for secure Supabase Storage upload signing.',
      'SUPABASE_SERVICE_ROLE_KEY_MISSING'
    );
  }

  return { secretKey, url };
};

let cachedClient = null;

const getSupabaseAdmin = () => {
  if (cachedClient) return cachedClient;

  const { secretKey, url } = getSupabaseAdminConfig();
  cachedClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
};

module.exports = {
  SupabaseAdminConfigurationError,
  getSupabaseAdmin,
  getSupabaseAdminConfig,
};
