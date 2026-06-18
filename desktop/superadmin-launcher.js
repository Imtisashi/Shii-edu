const { spawn } = require('child_process');

const targetUrl = process.env.SHII_EDU_SUPERADMIN_URL || 'http://127.0.0.1:3100/app/superadmin';

const launch = () => {
  if (process.platform === 'win32') {
    return spawn('cmd', ['/c', 'start', '""', targetUrl], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  if (process.platform === 'darwin') {
    return spawn('open', [targetUrl], {
      detached: true,
      stdio: 'ignore',
    });
  }

  return spawn('xdg-open', [targetUrl], {
    detached: true,
    stdio: 'ignore',
  });
};

try {
  const child = launch();
  child.unref();
  console.log(`Opening Shii-Edu Superadmin: ${targetUrl}`);
} catch (error) {
  console.error(`Open this URL manually: ${targetUrl}`);
  process.exitCode = 1;
}
