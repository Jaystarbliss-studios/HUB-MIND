import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

console.log('🚀 Starting clean production build...');

// 1. Run Vite build with all plugins (including Tailwind and VitePWA)
await build();

const distDir = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
  throw new Error('Build output directory "dist" was not produced!');
}

// 2. Mirror complete build artifacts to 'build' and 'out' directories
const targets = ['build', 'out'];
for (const target of targets) {
  const targetDir = path.resolve(process.cwd(), target);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(distDir, targetDir, { recursive: true });
  console.log(`✅ Mirrored build artifacts to /${target} (${fs.readdirSync(targetDir).length} items)`);
}

console.log(`🎉 Production build finished successfully with ${fs.readdirSync(distDir).length} items in dist.`);
