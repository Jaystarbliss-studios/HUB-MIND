import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const checks = [];

async function file(path) {
  return readFile(path, 'utf8');
}

function pass(name, detail) { checks.push({ name, ok: true, detail }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); }

const dbSeed = await file('src/lib/dbSeed.ts');
if (/addDoc\(|setDoc\(|seed/i.test(dbSeed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
  fail('No runtime demo seeding', 'dbSeed.ts contains an active write/seed path.');
} else {
  pass('No runtime demo seeding', 'dbSeed.ts is a no-op compatibility shim.');
}

const localStore = await file('src/lib/localWorkspaceStore.ts');
if (/getDefaultTasks[\s\S]*?return \[\]/.test(localStore) && /getDefaultProjects[\s\S]*?return \[\]/.test(localStore)) {
  pass('No fabricated default workspace records', 'Default task/project helpers return empty collections.');
} else {
  fail('No fabricated default workspace records', 'Default workspace helpers should never manufacture business data.');
}

const offlineSync = await file('src/lib/offlineSync.ts');
if (/DELETED_DOCS_KEY/.test(offlineSync) && /markDocumentDeleted\(docId\)/.test(offlineSync) && /getDocFromServer/.test(offlineSync)) {
  pass('Document deletion tombstone + verification', 'Delete flow marks the document deleted and verifies the server state.');
} else {
  fail('Document deletion tombstone + verification', 'Deletion protection/verification is missing.');
}

const documents = await file('src/pages/Documents.tsx');
if (/isLegacyDemoDocumentId/.test(documents) && /pendingLocalDocs/.test(documents) && /cloudIds/.test(documents)) {
  pass('Firebase-authoritative document reconciliation', 'Documents reconcile cloud state and only retain explicit pending offline drafts.');
} else {
  fail('Firebase-authoritative document reconciliation', 'Document reconciliation is incomplete.');
}

const recurringMeetings = await file('src/lib/recurringMeetings.ts');
if (/recurringMeetingTemplates/.test(recurringMeetings) && /recurring-meeting-\$\{templateId\}/.test(recurringMeetings) && /setDoc\(/.test(recurringMeetings)) {
  pass('Idempotent recurring meeting materialization', 'Recurring occurrences use deterministic IDs and merge writes.');
} else {
  fail('Idempotent recurring meeting materialization', 'Recurring meeting generation is incomplete.');
}

const recurringTasks = await file('src/lib/recurringTasks.ts');
if (/recurringTaskTemplates/.test(recurringTasks) && /lastGeneratedDate/.test(recurringTasks)) {
  pass('Recurring task generation guard', 'Recurring task processing tracks generated dates.');
} else {
  fail('Recurring task generation guard', 'Recurring task processing guard is missing.');
}

const rules = await file('firestore.rules');
for (const collection of ['documents', 'tasks', 'meetings', 'clients', 'projects', 'followUps', 'recurringMeetingTemplates', 'recurringTaskTemplates']) {
  if (new RegExp(`match \\/${collection}\\/\\{`).test(rules)) pass(`Firestore rule: ${collection}`, 'Collection has an explicit rule.');
  else fail(`Firestore rule: ${collection}`, 'Collection has no explicit Firestore rule.');
}

if (!existsSync('public/icon-144x144.png')) fail('PWA icon 144', 'public/icon-144x144.png is missing.');
else pass('PWA icon 144', 'Referenced 144x144 icon exists.');

const failed = checks.filter(x => !x.ok);
console.log('\nHUB-MIND SYSTEM INTEGRITY AUDIT\n');
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name} — ${check.detail}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exit(1);
