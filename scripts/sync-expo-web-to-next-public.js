const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webBuild = path.join(root, 'web-build');
const publicDir = path.join(root, 'public');

const ensureDirectory = (target) => {
  fs.mkdirSync(target, { recursive: true });
};

const copyDirectory = (source, target) => {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { force: true, recursive: true });
  fs.cpSync(source, target, { recursive: true });
};

if (!fs.existsSync(path.join(webBuild, 'index.html'))) {
  throw new Error('web-build/index.html was not found. Run the Expo web export before syncing.');
}

ensureDirectory(publicDir);
copyDirectory(path.join(webBuild, '_expo'), path.join(publicDir, '_expo'));
copyDirectory(path.join(webBuild, 'assets'), path.join(publicDir, 'assets'));

for (const fileName of ['favicon.ico', 'metadata.json']) {
  const source = path.join(webBuild, fileName);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(publicDir, fileName));
  }
}

fs.copyFileSync(path.join(webBuild, 'index.html'), path.join(publicDir, 'expo-index.html'));

const iconSource = path.join(root, 'assets', 'images', 'icon.png');
const iconTarget = path.join(publicDir, 'assets', 'images', 'icon.png');
if (fs.existsSync(iconSource) && !fs.existsSync(iconTarget)) {
  ensureDirectory(path.dirname(iconTarget));
  fs.copyFileSync(iconSource, iconTarget);
}

const heroVideoSource = path.join(root, 'assets', 'videos', 'cosmic-campus.mp4');
const heroVideoTarget = path.join(publicDir, 'assets', 'videos', 'cosmic-campus.mp4');
if (fs.existsSync(heroVideoSource)) {
  ensureDirectory(path.dirname(heroVideoTarget));
  fs.copyFileSync(heroVideoSource, heroVideoTarget);
}

console.log('Synced Expo web export into Next public assets.');
