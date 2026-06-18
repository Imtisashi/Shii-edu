const {
  callSupabaseTenantBridge,
  stripInstituteIdForTenantActor,
} = require('./supabaseTenantBridge');
const {
  mirrorInstituteWithProfilesToSupabase,
  mirrorProfilesToSupabase,
} = require('./supabaseProfileMirror');

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const serializeSyncError = (error) => ({
  code: error?.code || null,
  message: error?.message || 'Supabase workspace sync failed.',
  statusCode: error?.statusCode || null,
});

const logSyncWarning = ({ error, mode, requestId }) => {
  console.warn(JSON.stringify({
    level: 'warn',
    mode,
    requestId,
    message: error?.message || 'Supabase workspace sync failed.',
    statusCode: error?.statusCode || null,
    code: error?.code || null,
  }));
};

const buildBridgePayload = ({ action, actor, profiles }) => {
  const profileList = Array.isArray(profiles) ? profiles : [profiles].filter(Boolean);
  const isSuperadmin = normalizeRole(actor?.role || actor?.profile?.role) === 'superadmin';
  const bridgeProfiles = profileList.map((profile) => (
    isSuperadmin ? profile : stripInstituteIdForTenantActor(profile)
  ));

  if (action === 'createProfiles') {
    return { profiles: bridgeProfiles };
  }

  return bridgeProfiles[0] || {};
};

const toResponseState = (result) => {
  if (result.ok) {
    return {
      mode: result.mode,
      status: 'mirrored',
    };
  }

  return {
    mode: result.mode || null,
    status: 'needs_review',
  };
};

const toFirestoreSyncState = (result) => {
  const base = {
    mode: result.mode || null,
    status: result.ok ? 'mirrored' : 'needs_review',
    updatedAt: new Date().toISOString(),
  };

  if (result.ok) return base;

  return {
    ...base,
    lastError: result.error?.message || 'Supabase workspace sync failed.',
    lastStatusCode: result.error?.statusCode || null,
  };
};

const syncProfilesToSupabaseResilient = async ({
  action = 'createProfile',
  actor,
  authorization = '',
  institute = null,
  profiles,
  requestId,
}) => {
  const profileList = Array.isArray(profiles) ? profiles : [profiles].filter(Boolean);
  if (profileList.length === 0) {
    return { mode: 'none', ok: true, result: { count: 0, profiles: [] } };
  }

  let bridgeError = null;
  if (authorization) {
    try {
      const bridgeResult = await callSupabaseTenantBridge({
        action,
        authorization,
        payload: buildBridgePayload({ action, actor, profiles: profileList }),
      });
      return {
        mode: 'tenant-bridge',
        ok: true,
        result: bridgeResult,
      };
    } catch (error) {
      bridgeError = error;
      logSyncWarning({ error, mode: 'tenant-bridge', requestId });
    }
  }

  try {
    const mirrorResult = institute
      ? await mirrorInstituteWithProfilesToSupabase({ actor, institute, profiles: profileList })
      : await mirrorProfilesToSupabase({ actor, profiles: profileList });

    return {
      bridgeError: bridgeError ? serializeSyncError(bridgeError) : null,
      mode: 'server-mirror',
      ok: true,
      result: mirrorResult,
    };
  } catch (error) {
    logSyncWarning({ error, mode: 'server-mirror', requestId });
    return {
      bridgeError: bridgeError ? serializeSyncError(bridgeError) : null,
      error: serializeSyncError(error),
      mode: 'server-mirror',
      ok: false,
    };
  }
};

module.exports = {
  syncProfilesToSupabaseResilient,
  toFirestoreSyncState,
  toResponseState,
};
