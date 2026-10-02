import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const activeFiles = [
  'src/App.tsx', 'src/types.ts', 'src/lib/jessTools.ts', 'src/lib/jessDocumentBridge.ts',
  'src/components/JessFloatingAssistant.tsx', 'src/components/JessOrbVisualizer.tsx', 'src/components/JessDocumentBridge.tsx', 'src/services/liveAudioClient.ts',
];
const forbidden = /Shawn|shawn|WakeWord|wake-word|wake word/;
const failures = [];

for (const file of activeFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) failures.push(`${file}: required Jess integration file is missing`);
  else if (forbidden.test(readFileSync(path, 'utf8'))) failures.push(`${file}: contains a legacy assistant/wake-word reference`);
}

const requiredToolNames = ['get_user_profile', 'get_current_context', 'get_workspace_overview', 'search_workspace', 'create_task', 'update_task', 'create_document', 'get_document_content', 'update_document', 'list_projects', 'open_project', 'open_document', 'navigate_app'];
const tools = readFileSync(resolve(root, 'src/lib/jessTools.ts'), 'utf8');
for (const tool of requiredToolNames) if (!tools.includes(`name: '${tool}'`)) failures.push(`jessTools.ts: required tool ${tool} is missing`);
if (!tools.includes('queueJessDocumentEdit')) failures.push('jessTools.ts: document bridge is not connected');

for (const legacy of [
  'src/lib/shawnAuthorization.ts', 'src/lib/shawnTaskManager.ts', 'src/lib/shawnTools.ts', 'src/services/wakeWordDetector.ts',
  'src/components/Shawn.tsx', 'src/components/ShawnHistoryDrawer.tsx', 'src/components/ShawnOrbVisualizer.tsx', 'src/components/ShawnTaskStatus.tsx', 'src/components/ShawnVault.tsx',
  'src/components/LiveVoiceControls.tsx', 'src/components/VoiceAndWakeSettings.tsx', 'src/components/VoiceCalibration.tsx', 'src/components/VoiceDictation.tsx', 'src/components/TranscriptView.tsx',
  'src/components/WorldPulse.tsx', 'src/components/ChatDrawer.tsx', 'src/components/BrainstormStudio.tsx', 'src/components/documents/ShawnDocCoWriter.tsx',
]) if (existsSync(resolve(root, legacy))) failures.push(`${legacy}: legacy assistant UI/service still exists`);

if (failures.length) { console.error('Jess integration verification failed:'); failures.forEach(failure => console.error(`- ${failure}`)); process.exit(1); }
console.log('Jess integration static verification passed.');
