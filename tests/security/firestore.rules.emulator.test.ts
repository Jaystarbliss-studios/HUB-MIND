import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const rules=fs.readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'hubmind-rules-test',firestore:{rules}});

async function seed() {
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await db.collection('users').doc('owner').set({id:'owner',email:'owner@example.com',role:'staff',status:'active'});
    await db.collection('users').doc('reader').set({id:'reader',email:'reader@example.com',role:'staff',status:'active'});
    await db.collection('users').doc('writer').set({id:'writer',email:'writer@example.com',role:'staff',status:'active'});
    await db.collection('users').doc('suspended').set({id:'suspended',email:'suspended@example.com',role:'staff',status:'suspended'});
    await db.collection('documents').doc('doc1').set({ownerId:'owner',visibility:'shared',sharedWith:{reader:'read',writer:'write'},title:'Shared'});
  });
}
test.before(async()=>{await seed();});
test.after(async()=>{await env.cleanup();});
test('owner can read private/shared resource',async()=>{const db=env.authenticatedContext('owner',{email:'owner@example.com'}).firestore();await assertSucceeds(db.collection('documents').doc('doc1').get());});
test('shared reader can read but cannot write',async()=>{const db=env.authenticatedContext('reader',{email:'reader@example.com'}).firestore();await assertSucceeds(db.collection('documents').doc('doc1').get());await assertFails(db.collection('documents').doc('doc1').update({title:'nope'}));});
test('shared writer can update',async()=>{const db=env.authenticatedContext('writer',{email:'writer@example.com'}).firestore();await assertSucceeds(db.collection('documents').doc('doc1').update({title:'updated'}));});
test('suspended users cannot read resources',async()=>{const db=env.authenticatedContext('suspended',{email:'suspended@example.com'}).firestore();await assertFails(db.collection('documents').doc('doc1').get());});
test('unauthenticated users cannot read resources',async()=>{const db=env.unauthenticatedContext().firestore();await assertFails(db.collection('documents').doc('doc1').get());});
