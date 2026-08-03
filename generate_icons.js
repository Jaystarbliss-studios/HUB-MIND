import fs from 'fs';
import sharp from 'sharp';

const svgBuffer = fs.readFileSync('public/favicon.svg');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const generateIcons = async () => {
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(`public/icon-${size}x${size}.png`);
    
    // Maskable icon with some padding
    await sharp(svgBuffer)
      .resize(Math.round(size * 0.8), Math.round(size * 0.8))
      .extend({
        top: Math.round(size * 0.1),
        bottom: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
        right: Math.round(size * 0.1),
        background: { r: 15, g: 23, b: 42, alpha: 1 } // bg-slate-900
      })
      .png()
      .toFile(`public/maskable-icon-${size}x${size}.png`);
  }
  
  // Apple touch icon
  await sharp(svgBuffer)
    .resize(152, 152) // Using 192 or 152, typically 180 is also good but let's do 180
    .png()
    .toFile(`public/apple-touch-icon.png`);

  await sharp(svgBuffer)
    .resize(180, 180) 
    .extend({
      top: 18,
      bottom: 18,
      left: 18,
      right: 18,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // bg-slate-900
    })
    .png()
    .toFile(`public/apple-touch-icon-180.png`);
};

generateIcons().then(() => console.log('Icons generated!')).catch(console.error);
