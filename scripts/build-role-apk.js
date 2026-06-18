/* global __dirname */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roles = {
  driver: {
    envRole: 'driver',
    profile: 'preview-driver',
  },
  institute: {
    envRole: 'institute',
    profile: 'preview-institute',
  },
  parents: {
    envRole: 'parent',
    profile: 'preview-parents',
  },
  superadmin: {
    envRole: 'superadmin',
    profile: 'preview-superadmin',
  },
};

const requestedRole = String(process.argv[2] || '').trim().toLowerCase();
const targets = requestedRole === 'all'
  ? Object.keys(roles)
  : [requestedRole || 'institute'];

const artifactDir = path.resolve(__dirname, '..', 'dist', 'apk');
fs.mkdirSync(artifactDir, { recursive: true });

for (const role of targets) {
  const config = roles[role];
  if (!config) {
    console.error(`Unknown role "${role}". Use institute, parents, driver, superadmin, or all.`);
    process.exitCode = 1;
    break;
  }

  const result = spawnSync('npx', [
    'eas-cli',
    'build',
    '--platform',
    'android',
    '--profile',
    config.profile,
    '--non-interactive',
  ], {
    env: {
      ...process.env,
      EAS_LOCAL_BUILD_ARTIFACTS_DIR: artifactDir,
      EXPO_PUBLIC_LOCKED_ROLE: config.envRole,
      SHII_EDU_APP_ROLE: role,
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
