import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

console.log('🚀 Starting clean production build...');

const projectRoot = process.cwd();
const legacyFirebaseConfig = path.resolve(projectRoot, 'firebase-applet-config.json');
if (fs.existsSync(legacyFirebaseConfig)) {
  throw new Error('Legacy firebase-applet-config.json must not be committed or shipped.');
}

const sourceRoots = ['src', 'netlify', 'scripts'];
const sourceFiles = ['vite.config.ts', 'netlify.toml', 'index.html'];
const scanFiles = [
  ...sourceFiles.map((file) => path.resolve(projectRoot, file)),
  ...sourceRoots.flatMap((root) => {
    const dir = path.resolve(projectRoot, root);
    if (!fs.existsSync(dir)) return [];
    const walk = (currentDir) => fs.readdirSync(currentDir, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return /\\.(?:ts|tsx|js|mjs|cjs|json|html|css|toml)$/i.test(entry.name) ? [fullPath] : [];
    });
    return walk(dir);
  }),
];

for (const file of scanFiles) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (/AIzaSy[A-Za-z0-9_-]{20,}/.test(source)) {
    throw new Error(`Hardcoded Google API key detected in source: ${path.relative(projectRoot, file)}`);
  }
  if (source.includes('firebase-applet-config.json')) {
    throw new Error(`Legacy Firebase config reference detected: ${path.relative(projectRoot, file)}`);
  }
}

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
