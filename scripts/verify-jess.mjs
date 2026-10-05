import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const forbidden = /Shawn|shawn|Angel|angel|WakeWord|wake-word|wake word/;
const textExtensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.html','.css','.yml','.yaml','.rules']);

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (textExtensions.has(extname(entry.name)) || entry.name === 'firestore.rules') {
      let text = '';
      try { text = readFileSync(path, 'utf8'); } catch { return; }
      if (forbidden.test(text)) failures.push(`${path.replace(root + '/', '')}: legacy assistant/wake-word reference remains`);
    }
  }
}
for (const path of ['src','netlify']) walk(resolve(root,path));
for (const file of ['server.ts']) { const path=resolve(root,file); if(existsSync(path)) { const text=readFileSync(path,'utf8'); if(forbidden.test(text)) failures.push(`${file}: legacy assistant/wake-word reference remains`); } }

const requiredFiles = [
  'src/App.tsx',
  'src/types.ts',
  'src/lib/rbac.ts',
  'src/lib/hubMindArchitecture.ts',
  'src/lib/jessTools.ts',
  'src/lib/jessDocumentBridge.ts',
  'src/components/JessFloatingAssistant.tsx',
  'src/components/JessOrbVisualizer.tsx',
  'src/components/JessDocumentBridge.tsx',
  'src/services/liveAudioClient.ts',
  'netlify/functions/live-token.mjs',
];
for (const file of requiredFiles) if (!existsSync(resolve(root, file))) failures.push(`${file}: required Jess integration file is missing`);

const tools = readFileSync(resolve(root, 'src/lib/jessTools.ts'), 'utf8');
for (const tool of ['send_email','get_user_profile','get_current_context','get_workspace_overview','search_workspace','create_task','update_task','create_document','get_document_content','update_document','list_projects','open_project','open_document','navigate_app','list_meetings','list_follow_ups','list_knowledge']) {
  if (!tools.includes(`name: '${tool}'`)) failures.push(`jessTools.ts: required tool ${tool} is missing`);
}
if (!tools.includes('queueJessDocumentEdit')) failures.push('jessTools.ts: document bridge is not connected');
const bridge = readFileSync(resolve(root, 'src/lib/jessDocumentBridge.ts'), 'utf8');
if (!bridge.includes('registerJessDocumentEditor') || !bridge.includes('applyJessDocumentEdit')) failures.push('jessDocumentBridge.ts: direct editor bridge is incomplete');

const liveToken = readFileSync(resolve(root, 'netlify/functions/live-token.mjs'), 'utf8');
for (const contract of ['https://generativelanguage.googleapis.com/v1beta/auth_tokens']) {
  if (!liveToken.includes(contract)) failures.push(`live-token.mjs: Gemini ephemeral-token contract ${contract} is missing`);
}
if (liveToken.includes('liveConnectConstraints')) failures.push('live-token.mjs: obsolete REST field liveConnectConstraints remains');
if (liveToken.includes('bidiGenerateContentSetup')) failures.push('live-token.mjs: token provisioning must not override browser Live setup');

const live = readFileSync(resolve(root, 'src/services/liveAudioClient.ts'), 'utf8');
for (const contract of ['gemini-3.8-live','Kore','16000','24000','sendFunctionResponse','sessionResumption','MANDATORY UI NAVIGATION RULE']) {
  if (!live.includes(contract)) failures.push(`liveAudioClient.ts: Live API contract ${contract} is missing`);
}
if (live.includes('ENABLE_SERVER_WS_BRIDGE') || live.includes('connectFallbackWebSocket') || live.includes('/api/live-ws')) failures.push('liveAudioClient.ts: unsupported server WebSocket fallback must remain removed');
if (!live.includes('connectPromise') || !live.includes('connectInternal')) failures.push('liveAudioClient.ts: connect race guard is missing');
if (!live.includes('AudioWorkletNode') || !live.includes("/jess-capture-processor.js")) failures.push('liveAudioClient.ts: AudioWorklet microphone pipeline is missing');
if (live.includes('ScriptProcessorNode') || live.includes('createScriptProcessor') || live.includes('audioprocess')) failures.push('liveAudioClient.ts: deprecated ScriptProcessor audio pipeline remains');
if (!existsSync(resolve(root, 'public/jess-capture-processor.js'))) failures.push('public/jess-capture-processor.js: AudioWorklet processor is missing');

const floating = readFileSync(resolve(root, 'src/components/JessFloatingAssistant.tsx'), 'utf8');
for (const contract of ['sessionEndingRef', 'JSON.parse(toolArgs)', 'sendFunctionResponse({ name: fc.name']) {
  if (!floating.includes(contract)) failures.push(`JessFloatingAssistant.tsx: runtime contract ${contract} is missing`);
}
if (!floating.includes('}, 100);')) failures.push('JessFloatingAssistant.tsx: end_session does not immediately terminate the Live session');
if (!floating.includes('startJessWorkspaceCache')) failures.push('JessFloatingAssistant.tsx: workspace cache is not started with the signed-in user');
if (!floating.includes('screen_control') || !floating.includes('getJessScrollTarget')) failures.push('JessFloatingAssistant.tsx: direct screen control bridge is missing');
if (!tools.includes('scroll_screen') || !tools.includes('click_screen') || !tools.includes('type_screen')) failures.push('jessTools.ts: direct screen control tools are missing');
if (!tools.includes('save_activity_report')) failures.push('jessTools.ts: activity report tool is missing');
if (!tools.includes('markdownToTiptapHtml')) failures.push('jessTools.ts: Tiptap HTML formatter is missing');
if (!tools.includes("name: 'send_email'")) failures.push('jessTools.ts: email tool declaration is missing');
if (!tools.includes('steps') || !tools.includes('Progress must reflect completed executable steps')) failures.push('jessTools.ts: executable background workflow contract is missing');
if (!tools.includes("behavior: 'NON_BLOCKING'") || !tools.includes('start_background_operation')) failures.push('jessTools.ts: background workflow is not declared NON_BLOCKING');
const queue = readFileSync(resolve(root, 'src/services/jessBackgroundTasks.ts'), 'utf8');
if (!queue.includes('executeWithRetries') || !queue.includes('currentStep') || !queue.includes('executionLog')) failures.push('jessBackgroundTasks.ts: persistent retry/progress execution state is incomplete');
if (!queue.includes('getTasksForUser') || !queue.includes('getActiveTasksForUser')) failures.push('jessBackgroundTasks.ts: user-scoped task visibility is missing');
const search = readFileSync(resolve(root, 'src/lib/globalSearch.ts'), 'utf8');
if (!search.includes('editSimilarity') || !search.includes('tokenize')) failures.push('globalSearch.ts: conversational fuzzy relevance matching is missing');
const calendarAuth = readFileSync(resolve(root, 'src/lib/googleAuthToken.ts'), 'utf8');
for (const file of [
  'netlify/functions/lib/googleOAuth.mjs',
  'netlify/functions/google-oauth-start.mjs',
  'netlify/functions/google-oauth-callback.mjs',
  'netlify/functions/google-oauth-exchange.mjs',
  'netlify/functions/google-token.mjs',
]) {
  if (!existsSync(resolve(root, file))) failures.push(file + ': persistent Google OAuth endpoint is missing');
  else {
    const check = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
    if (check.status !== 0) failures.push(file + ': Node syntax check failed: ' + (check.stderr || check.stdout || '').trim());
  }
}
if (!calendarAuth.includes('/api/google-token') || !calendarAuth.includes('/api/google-oauth-start')) failures.push('googleAuthToken.ts: persistent server OAuth flow is missing');
if (!calendarAuth.includes('userStorageKey') || !calendarAuth.includes('STORAGE_CALENDAR_TOKEN')) failures.push('googleAuthToken.ts: Calendar credential storage is not user-scoped');
const calendar = readFileSync(resolve(root, 'src/lib/googleCalendar.ts'), 'utf8');
if (!calendar.includes('hydrateGoogleCalendarConnection') || !calendar.includes('googleCalendarConnected') || !calendar.includes('getCachedGoogleCalendarEvents')) failures.push('googleCalendar.ts: persistent connection hydration is missing');
const prompt = readFileSync(resolve(root, 'src/ai/prompts/adapters.ts'), 'utf8');
if (/sharp, quick-witted young boy/i.test(prompt)) failures.push('adapters.ts: outdated male-child Jess persona remains');
if (!/professor-partner/i.test(prompt)) failures.push('adapters.ts: professor-partner persona contract is missing');

for (const contract of ['onPointerDown','onPointerMove','onPointerUp','localStorage','DOUBLE_TAP_MS','touch-none']) {
  if (!floating.includes(contract)) failures.push(`JessFloatingAssistant.tsx: interaction contract ${contract} is missing`);
}
if (/wake\s*word/i.test(floating)) failures.push('JessFloatingAssistant.tsx: wake-word behavior is present');

const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');
for (const rule of ['match /users/{userId}','match /invitations/{id}','match /tasks/{id}','match /documents/{id}','match /projects/{id}','match /recurringTaskTemplates/{id}']) {
  if (!rules.includes(rule)) failures.push(`firestore.rules: required boundary ${rule} is missing`);
}

if (failures.length) {
  console.error('Jess integration verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Jess integration repository contract verification passed.');
