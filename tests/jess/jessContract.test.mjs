import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('Jess floating surface uses pointer gestures and persisted position',()=>{const c=read('src/components/JessFloatingAssistant.tsx'); for(const s of ['onPointerDown','onPointerMove','onPointerUp','DOUBLE_TAP_MS','localStorage','touch-none']) assert.ok(c.includes(s)); assert.doesNotMatch(c,/wake\s*word/i);});
test('Jess live runtime uses the Voice Model audio contract',()=>{const c=read('src/services/liveAudioClient.ts'); for(const s of ['gemini-3.8-live','Kore','16000','24000','sendFunctionResponse']) assert.ok(c.includes(s));});
test('document bridge is visible and event-driven',()=>{const c=read('src/components/JessDocumentBridge.tsx'); assert.ok(c.includes('jess:document_edit')); assert.ok(c.includes('contenteditable="true"'));});
