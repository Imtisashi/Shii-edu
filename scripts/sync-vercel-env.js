const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const previewBranch = process.env.VERCEL_PREVIEW_GIT_BRANCH || 'main';
const targets = [
  { environment: 'production' },
  { environment: 'development' },
].concat(previewBranch && previewBranch !== 'main'
  ? [{ environment: 'preview', gitBranch: previewBranch }]
  : []);

const publicKeys = new Set([
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
]);

const privateKeys = new Set([
  'APP_ORIGIN',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CRON_SECRET',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GEMINI_API_KEY',
  'GEMINI_EMBEDDING_MODEL',
  'GEMINI_MODEL',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
]);

const parseEnv = (source) => {
  const values = new Map();
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, '\n');
    if (key && value) values.set(key, value);
  }

  return values;
};

const runVercel = (args, input) => {
  const command = `npx vercel ${args.join(' ')}`;
  return spawnSync(command, {
    cwd: root,
    encoding: 'utf8',
    input,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
};

const addEnv = ({ key, sensitive, target, value }) => {
  const targetArgs = target.gitBranch
    ? [target.environment, target.gitBranch]
    : [target.environment];

  runVercel(['env', 'remove', key, ...targetArgs, '--yes', '--non-interactive']);

  const args = ['env', 'add', key, ...targetArgs, '--yes', '--force'];
  if (sensitive && target.environment !== 'development') {
    args.push('--sensitive');
  } else {
    args.push('--no-sensitive');
  }

  const result = runVercel(args, `${value}\n`);

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || '').trim();
    const targetLabel = target.gitBranch ? `${target.environment}:${target.gitBranch}` : target.environment;
    throw new Error(`${key} failed for ${targetLabel}: ${detail || 'Vercel CLI returned an error.'}`);
  }
};

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing ${envPath}. Create it before syncing Vercel environment variables.`);
}

const values = parseEnv(fs.readFileSync(envPath, 'utf8'));

if (values.has('EXPO_PUBLIC_SUPABASE_URL') && !values.has('SUPABASE_URL')) {
  values.set('SUPABASE_URL', values.get('EXPO_PUBLIC_SUPABASE_URL'));
}

if (values.has('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') && !values.has('SUPABASE_ANON_KEY')) {
  values.set('SUPABASE_ANON_KEY', values.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
}

const synced = [];

for (const [key, value] of values.entries()) {
  if (!publicKeys.has(key) && !privateKeys.has(key)) continue;

  const sensitive = privateKeys.has(key) && !key.includes('MODEL') && key !== 'APP_ORIGIN' && key !== 'CLOUDINARY_CLOUD_NAME' && key !== 'STRIPE_PUBLISHABLE_KEY' && key !== 'SUPABASE_URL' && key !== 'SUPABASE_ANON_KEY';

  for (const target of targets) {
    addEnv({ key, sensitive, target, value });
  }

  synced.push(key);
}

if (synced.length === 0) {
  throw new Error('No supported environment keys were found in .env.');
}

const targetLabels = targets.map((target) => target.gitBranch ? `${target.environment}:${target.gitBranch}` : target.environment);
console.log(`Synced ${synced.length} Vercel environment keys across ${targetLabels.join(', ')}. Values were not printed.`);
