import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const activeFiles = [
  'src/App.tsx',
  'src/types.ts',
  'src/lib/jessTools.ts',
  'src/components/JessFloatingAssistant.tsx',
  'src/components/JessOrbVisualizer.tsx',
  'src/services/liveAudioClient.ts',
];
const forbidden = /Shawn|shawn|WakeWord|wake-word|wake word/;
const failures = [];

for (const file of activeFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) failures.push(`${file}: required Jess integration file is missing`);
  else if (forbidden.test(readFileSync(path, 'utf8'))) failures.push(`${file}: contains a legacy assistant/wake-word reference`);
}

for (const legacy of [
  'src/lib/shawnAuthorization.ts',
  'src/lib/shawnTaskManager.ts',
  'src/lib/shawnTools.ts',
  'src/services/wakeWordDetector.ts',
  'src/components/Shawn.tsx',
  'src/components/ShawnHistoryDrawer.tsx',
  'src/components/ShawnOrbVisualizer.tsx',
  'src/components/ShawnTaskStatus.tsx',
  'src/components/ShawnVault.tsx',
  'src/components/LiveVoiceControls.tsx',
  'src/components/VoiceAndWakeSettings.tsx',
  'src/components/documents/ShawnDocCoWriter.tsx',
]) {
  if (existsSync(resolve(root, legacy))) failures.push(`${legacy}: legacy Jess-replaced component still exists`);
}

if (failures.length) {
  console.error('Jess integration verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Jess integration static verification passed.');
