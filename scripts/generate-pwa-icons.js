const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets', 'images');
const publicDir = path.join(root, 'public');
const androidResDir = path.join(root, 'android-role-shells', 'app', 'src');

const background = { r: 250, g: 249, b: 242, alpha: 1 };
const brandSource = path.join(assetsDir, 'source-shii-edu.png');
const roleSheetSource = path.join(assetsDir, 'source-app-logos.png');

const roles = [
  { androidFlavor: 'driver', fileBase: 'icon-driver', quadrant: 'top-left' },
  { androidFlavor: 'parents', fileBase: 'icon-parents', quadrant: 'top-right' },
  { androidFlavor: 'institute', fileBase: 'icon-institute', quadrant: 'bottom-left' },
  { androidFlavor: 'superadmin', fileBase: 'icon-superadmin', quadrant: 'bottom-right' },
];

const ensureSource = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing at ${filePath}. Copy the supplied logo file there before generating icons.`);
  }
};

const trimLogo = async (input) => sharp(input)
  .trim({ background, threshold: 18 })
  .png()
  .toBuffer();

const writeContainedPng = async (input, target, size) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(input)
    .resize(size, size, {
      background,
      fit: 'contain',
      kernel: 'lanczos3',
      position: 'center',
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(target);
};

const writeRoleIcon = async ({ fileBase, androidFlavor, source }) => {
  const trimmed = await trimLogo(source);
  const variants = [
    { name: `${fileBase}.png`, size: 512 },
    { name: `${fileBase}-512.png`, size: 512 },
    { name: `${fileBase}-192.png`, size: 192 },
  ];

  for (const variant of variants) {
    await writeContainedPng(trimmed, path.join(publicDir, variant.name), variant.size);
  }

  await writeContainedPng(trimmed, path.join(assetsDir, `${fileBase}.png`), 512);
  await writeContainedPng(
    trimmed,
    path.join(androidResDir, androidFlavor, 'res', 'drawable-nodpi', 'ic_launcher.png'),
    512
  );
};

const getQuadrant = (metadata, quadrant) => {
  const halfWidth = Math.floor(metadata.width / 2);
  const halfHeight = Math.floor(metadata.height / 2);
  const left = quadrant.endsWith('right') ? halfWidth : 0;
  const top = quadrant.startsWith('bottom') ? halfHeight : 0;

  return {
    left,
    top,
    width: quadrant.endsWith('right') ? metadata.width - halfWidth : halfWidth,
    height: quadrant.startsWith('bottom') ? metadata.height - halfHeight : halfHeight,
  };
};

const writeBrandAssets = async () => {
  const fullLogo = await trimLogo(brandSource);
  const fullLogoMeta = await sharp(fullLogo).metadata();
  const markHeight = Math.max(1, Math.round(fullLogoMeta.height * 0.70));
  const mark = await sharp(fullLogo)
    .extract({ left: 0, top: 0, width: fullLogoMeta.width, height: markHeight })
    .trim({ background, threshold: 18 })
    .png()
    .toBuffer();

  await sharp(fullLogo)
    .resize(1200, 520, { background, fit: 'contain' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'shii-edu-logo.png'));
  await sharp(fullLogo)
    .resize(1200, 520, { background, fit: 'contain' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(assetsDir, 'logo.png'));

  await writeContainedPng(mark, path.join(publicDir, 'icon.png'), 512);
  await writeContainedPng(mark, path.join(publicDir, 'icon-512.png'), 512);
  await writeContainedPng(mark, path.join(publicDir, 'icon-192.png'), 192);
  await writeContainedPng(mark, path.join(publicDir, 'favicon.png'), 64);
  await writeContainedPng(mark, path.join(assetsDir, 'icon.png'), 512);
};

const main = async () => {
  ensureSource(brandSource, 'Main SHII EDU logo');
  ensureSource(roleSheetSource, 'Role app logo sheet');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  await writeBrandAssets();

  const sheetMeta = await sharp(roleSheetSource).metadata();
  for (const role of roles) {
    const source = await sharp(roleSheetSource)
      .extract(getQuadrant(sheetMeta, role.quadrant))
      .png()
      .toBuffer();
    await writeRoleIcon({ ...role, source });
  }

  console.log('Generated SHII EDU brand, role PWA, and Android shell icons.');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
