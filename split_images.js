const sharp = require('sharp');
const path = require('path');

async function splitImage() {
  try {
    const inputFile = path.join(__dirname, 'public', 'assets', 'images', 'applogos-source.png');
    const image = sharp(inputFile);
    const metadata = await image.metadata();

    const halfWidth = Math.floor(metadata.width / 2);
    const halfHeight = Math.floor(metadata.height / 2);

    const quadrants = [
      { name: 'driver-logo.png', left: 0, top: 0 },
      { name: 'parent-logo.png', left: halfWidth, top: 0 },
      { name: 'institute-logo.png', left: 0, top: halfHeight },
      { name: 'superadmin-logo.png', left: halfWidth, top: halfHeight }
    ];

    for (const q of quadrants) {
      const outputPath = path.join(__dirname, 'public', 'assets', 'images', q.name);
      await sharp(inputFile)
        .extract({ left: q.left, top: q.top, width: halfWidth, height: halfHeight })
        .toFile(outputPath);
      console.log(`Successfully extracted ${q.name}`);
    }
  } catch (error) {
    console.error('Error splitting image:', error);
  }
}

splitImage();
