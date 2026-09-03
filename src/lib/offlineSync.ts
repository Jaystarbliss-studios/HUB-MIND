import { doc, updateDoc, getDoc, deleteDoc, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface OfflineDocRecord {
  id: string;
  title: string;
  content: string;
  /** Canonical Tiptap/ProseMirror document state for lossless restoration. */
  contentJson?: any;
  updatedAt: string;
  lastSavedAt: string;
  lastEditedAt?: string;
  lastModifiedBy?: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  marginOption?: 'normal' | 'narrow' | 'moderate' | 'wide' | 'custom';
  synced: boolean;
  allowEmpty?: boolean;
  allowUntitled?: boolean;
  forceAllowEmptyOverwrite?: boolean;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorEmail?: string;
  summary?: string;
  wordCount?: number;
  isCheckpoint?: boolean;
  checkpointName?: string;
  contentJson?: any;
}

const OFFLINE_DOCS_KEY = 'hubmind_offline_documents_v1';
const SYNC_QUEUE_KEY = 'hubmind_offline_sync_queue_v1';
const LOCAL_VERSIONS_KEY = 'hubmind_local_versions_v1';

/**
 * Accurately check if a document's content (HTML or JSON) is effectively empty.
 * Detects empty tags like <p></p>, <p><br></p>, whitespace, and TipTap empty doc nodes.
 */
export function isContentEffectivelyEmpty(content: any, contentJson?: any): boolean {
  // Check JSON representation
  const jsonToCheck = contentJson || (typeof content === 'object' && content !== null ? content : null);
  if (jsonToCheck && typeof jsonToCheck === 'object') {
    if (jsonToCheck.type === 'doc') {
      if (!Array.isArray(jsonToCheck.content) || jsonToCheck.content.length === 0) {
        return true;
      }
      if (jsonToCheck.content.length === 1) {
        const first = jsonToCheck.content[0];
        if (first.type === 'paragraph' && (!Array.isArray(first.content) || first.content.length === 0)) {
          return true;
        }
      }
      return false;
    }
  }

  // Check string representation
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) return true;
    if (trimmed === '<p></p>' || trimmed === '<p><br></p>' || trimmed === '<p><br/></p>') return true;
    const stripped = trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (stripped.length === 0 && !/<(img|table|hr|iframe|figure)/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Safely extract both HTML string and TipTap JSON from whatever payload
 * Firestore or local storage returns, handling legacy or mixed formats.
 */
export function extractDocumentBody(data: any): { html: string; json: any | null } {
  if (!data) return { html: '', json: null };

  let json: any = null;
  let html: string = '';

  // 1. Check contentJson
  if (data.contentJson && typeof data.contentJson === 'object' && data.contentJson.type === 'doc') {
    json = data.contentJson;
  }

  // 2. Check content (could be string or object)
  if (data.content) {
    if (typeof data.content === 'object' && data.content.type === 'doc') {
      json = json || data.content;
    } else if (typeof data.content === 'string') {
      const trimmed = data.content.trim();
      if (trimmed.startsWith('{') && trimmed.includes('"type":"doc"')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && parsed.type === 'doc') json = json || parsed;
        } catch {}
      }
      html = trimmed;
    }
  }

  return { html, json };
}

// Helpers to access local storage safely
export function getLocalDocsMap(): Record<string, OfflineDocRecord> {
  try {
    const raw = localStorage.getItem(OFFLINE_DOCS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse offline docs storage', e);
    return {};
  }
}

export function setLocalDocsMap(map: Record<string, OfflineDocRecord>) {
  try {
    localStorage.setItem(OFFLINE_DOCS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to write offline docs storage', e);
  }
}

function getSyncQueue(): string[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setSyncQueue(queue: string[]) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(Array.from(new Set(queue))));
  } catch (e) {
    console.warn('Failed to write sync queue', e);
  }
}

function getLocalVersions(documentId: string): DocumentVersion[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_VERSIONS_KEY}_${documentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalVersion(version: DocumentVersion) {
  try {
    const list = getLocalVersions(version.documentId);
    // Add to beginning, limit to last 50 versions locally
    const updated = [version, ...list.filter(v => v.id !== version.id)].slice(0, 50);
    localStorage.setItem(`${LOCAL_VERSIONS_KEY}_${version.documentId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save local version snapshot', e);
  }
}

/**
 * Save document offline with automatic queueing for cloud synchronization.
 * Protects existing content and title from accidental overwrite by blank initialization states.
 */
export async function saveDocumentOffline(
  docId: string,
  data: Partial<OfflineDocRecord>,
  userProfile?: { name?: string; preferredName?: string; email?: string }
): Promise<OfflineDocRecord> {
  const now = new Date().toISOString();
  const docsMap = getLocalDocsMap();
  const existing = docsMap[docId];

  // Determine title safely: never overwrite a real title with 'Untitled Document' unless explicitly requested
  let safeTitle = existing?.title || 'Untitled Document';
  if (data.title !== undefined) {
    const trimmedTitle = data.title.trim();
    if (trimmedTitle) {
      if (trimmedTitle === 'Untitled Document') {
        // Only accept 'Untitled Document' if existing was also untitled or allowUntitled is true
        if (data.allowUntitled || !existing?.title || existing.title === 'Untitled Document') {
          safeTitle = 'Untitled Document';
        }
      } else {
        safeTitle = trimmedTitle;
      }
    }
  }

  // Determine content safely: never overwrite valid content with blank content unless allowEmpty is true
  let safeContent = existing?.content || '';
  let safeContentJson = existing?.contentJson;

  if (data.content !== undefined) {
    const isTargetEmpty = isContentEffectivelyEmpty(data.content, data.contentJson);
    const isExistingEmpty = existing ? isContentEffectivelyEmpty(existing.content, existing.contentJson) : false;

    if (isTargetEmpty && !isExistingEmpty && !data.forceAllowEmptyOverwrite) {
      console.warn(`[HubMind] Blocked accidental blank content overwrite for document: ${docId}. Retaining existing non-empty content.`);
      safeContent = existing.content;
      safeContentJson = existing.contentJson;
    } else if (!isTargetEmpty || data.forceAllowEmptyOverwrite || isExistingEmpty) {
      safeContent = data.content;
      safeContentJson = data.contentJson;
    } else {
      console.warn(`[HubMind] Blocked accidental empty content overwrite for document: ${docId}`);
      if (existing) {
        safeContent = existing.content;
        safeContentJson = existing.contentJson;
      }
    }
  }

  const updatedRecord: OfflineDocRecord = {
    ...(existing || {
      id: docId,
      title: safeTitle,
      content: safeContent,
      updatedAt: now,
      lastSavedAt: now,
      synced: false,
    }),
    ...data,
    id: docId,
    title: safeTitle,
    content: safeContent,
    ...(safeContentJson !== undefined ? { contentJson: safeContentJson } : {}),
    updatedAt: data.updatedAt || now,
    lastSavedAt: now,
    lastModifiedBy: userProfile?.preferredName || userProfile?.name || 'User',
    synced: navigator.onLine,
  };

  docsMap[docId] = updatedRecord;
  setLocalDocsMap(docsMap);

  // Add to local version history snapshot ONLY if content is not empty
  if (!isContentEffectivelyEmpty(updatedRecord.content, updatedRecord.contentJson)) {
    const wordCount = typeof updatedRecord.content === 'string'
      ? updatedRecord.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
      : 0;

    const versionSnapshot: DocumentVersion = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      documentId: docId,
      title: updatedRecord.title,
      content: updatedRecord.content,
      ...(updatedRecord.contentJson ? { contentJson: updatedRecord.contentJson } : {}),
      createdAt: now,
      authorName: updatedRecord.lastModifiedBy || 'User',
      authorEmail: userProfile?.email || '',
      summary: `Autosaved (${wordCount} words)`,
      wordCount,
    };
    saveLocalVersion(versionSnapshot);

    // Save version in Firestore subcollection when online
    if (navigator.onLine) {
      try {
        const versionsColl = collection(db, 'documents', docId, 'versions');
        await addDoc(versionsColl, versionSnapshot);
      } catch (verErr) {
        console.warn('Could not write version to Firestore subcollection:', verErr);
      }
    }
  }

  // Persist targeted updates to Firestore when online
  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'documents', docId);

      // Build safe update payload with ONLY fields intended to change
      const updatePayload: Record<string, any> = {
        updatedAt: updatedRecord.updatedAt,
        lastSavedAt: now,
        lastModifiedBy: updatedRecord.lastModifiedBy,
      };

      if (data.title !== undefined) {
        updatePayload.title = safeTitle;
      }
      if (data.content !== undefined) {
        updatePayload.content = safeContent;
        if (safeContentJson !== undefined) {
          updatePayload.contentJson = safeContentJson;
        }
      }
      if (data.lastEditedAt !== undefined) {
        updatePayload.lastEditedAt = data.lastEditedAt;
      }
      if (data.pageSize !== undefined) {
        updatePayload.pageSize = data.pageSize;
      }
      if (data.orientation !== undefined) {
        updatePayload.orientation = data.orientation;
      }
      if (data.marginOption !== undefined) {
        updatePayload.marginOption = data.marginOption;
      }

      await updateDoc(docRef, updatePayload);

      updatedRecord.synced = true;
      docsMap[docId] = updatedRecord;
      setLocalDocsMap(docsMap);

      const queue = getSyncQueue().filter(id => id !== docId);
      setSyncQueue(queue);

      window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
        detail: { status: 'synced', docId, queueCount: queue.length }
      }));

      return updatedRecord;
    } catch (err) {
      console.error('Firestore document update failed; keeping local snapshot and queueing retry:', err);
      updatedRecord.synced = false;
      docsMap[docId] = updatedRecord;
      setLocalDocsMap(docsMap);
    }
  }

  // Offline or failed network write: keep latest editor state locally and queue
  const queue = getSyncQueue();
  if (!queue.includes(docId)) queue.push(docId);
  setSyncQueue(queue);

  window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
    detail: { status: 'offline-queued', docId, queueCount: queue.length }
  }));

  return updatedRecord;
}

/**
 * Permanently delete a document from Firestore and local persistence.
 * Deletion is never queued for offline sync, preventing stale edits from
 * recreating a document after it has been deleted.
 */
export async function deleteDocumentOffline(docId: string): Promise<void> {
  if (!docId) throw new Error('Document ID is required');
  if (!navigator.onLine) throw new Error('You must be online to permanently delete a document.');
  await deleteDoc(doc(db, 'documents', docId));
  const docsMap = getLocalDocsMap();
  delete docsMap[docId];
  setLocalDocsMap(docsMap);
  setSyncQueue(getSyncQueue().filter(id => id !== docId));
  try { localStorage.removeItem(`${LOCAL_VERSIONS_KEY}_${docId}`); } catch {}
  const verify = await getDoc(doc(db, 'documents', docId));
  if (verify.exists()) throw new Error('Firestore did not confirm document deletion.');
}
/**
 * Repair all blank document bodies that still have a valid saved version.
 * This is deliberately conservative: it ONLY writes to a document when the
 * current body is empty and a non-empty historical/local snapshot exists.
 */
export async function repairBlankDocumentsFromHistory(): Promise<{ repaired: number; checked: number }> {
  if (!navigator.onLine) return { repaired: 0, checked: 0 };

  const docsSnap = await getDocs(collection(db, 'documents'));
  const localDocs = getLocalDocsMap();
  let repaired = 0;

  for (const docSnap of docsSnap.docs) {
    const data = docSnap.data() as any;
    const { html: currentHtml, json: currentJson } = extractDocumentBody(data);
    
    // Only attempt repair if the current document is actually blank
    if (!isContentEffectivelyEmpty(currentHtml, currentJson)) continue;

    const docId = docSnap.id;
    let recovery: any = null;

    // Prefer Firestore history because it is device-independent.
    try {
      const versionsSnap = await getDocs(
        query(collection(db, 'documents', docId, 'versions'), orderBy('createdAt', 'desc'), limit(100))
      );
      recovery = versionsSnap.docs
        .map(v => v.data() as any)
        .find(v => !isContentEffectivelyEmpty(v.content, v.contentJson));
    } catch (err) {
      console.warn('[HubMind recovery] Could not inspect version history for', docId, err);
    }

    // If Firestore history is unavailable, check local versions then local snapshot.
    if (!recovery) {
      const localVersions = getLocalVersions(docId);
      recovery = localVersions.find(v => !isContentEffectivelyEmpty(v.content, v.contentJson));
    }

    if (!recovery) {
      const local = localDocs[docId];
      if (local && !isContentEffectivelyEmpty(local.content, local.contentJson)) {
        recovery = local;
      }
    }

    if (!recovery) continue;

    const restoredContent = typeof recovery.content === 'string' ? recovery.content : '';
    const restoredJson = recovery.contentJson || (typeof recovery.content === 'object' ? recovery.content : null);
    const restoredTitle = (data.title === 'Untitled Document' || !data.title) && recovery.title && recovery.title !== 'Untitled Document'
      ? recovery.title
      : data.title || 'Untitled Document';

    try {
      const repairUpdate: Record<string, any> = {
        content: restoredContent,
        lastRecoveredAt: new Date().toISOString(),
      };
      if (restoredJson) repairUpdate.contentJson = restoredJson;
      if (restoredTitle && restoredTitle !== data.title) repairUpdate.title = restoredTitle;

      await updateDoc(doc(db, 'documents', docId), repairUpdate);

      localDocs[docId] = {
        ...(localDocs[docId] || {
          id: docId,
          title: restoredTitle,
          updatedAt: data.updatedAt || new Date().toISOString(),
          lastSavedAt: data.lastSavedAt || new Date().toISOString(),
          synced: true,
          content: '',
        }),
        title: restoredTitle,
        content: restoredContent,
        ...(restoredJson ? { contentJson: restoredJson } : {}),
        synced: true,
      };

      repaired++;
      console.log(`[HubMind recovery] Repaired blank document ${docId} with title: "${restoredTitle}"`);
    } catch (err) {
      console.error('[HubMind recovery] Failed to repair', docId, err);
    }
  }

  setLocalDocsMap(localDocs);
  return { repaired, checked: docsSnap.size };
}

/**
 * Retrieve document with local cache fallback for full offline editing
 */
export async function getDocumentWithOfflineFallback(docId: string): Promise<any> {
  const localDocs = getLocalDocsMap();
  const cached = localDocs[docId];

  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'documents', docId);
      const snap = await Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore fetch timeout')), 3500))
      ]);
      if (snap.exists()) {
        const cloudData = snap.data();

        // Safely extract canonical HTML and TipTap JSON from cloud payload
        const { html: cloudHtml, json: cloudJson } = extractDocumentBody(cloudData);
        const { html: localHtml, json: localJson } = extractDocumentBody(cached);

        let recoveredHtml = cloudHtml;
        let recoveredJson = cloudJson;
        let recoveredTitle = cloudData.title || cached?.title || 'Untitled Document';
        let recoveredFromHistory = false;

        // If cloud payload is blank, check version history or local snapshot
        if (isContentEffectivelyEmpty(recoveredHtml, recoveredJson)) {
          try {
            const versionsColl = collection(db, 'documents', docId, 'versions');
            const versionQuery = query(versionsColl, orderBy('createdAt', 'desc'), limit(50));
            const versionSnap = await getDocs(versionQuery);
            const recovery = versionSnap.docs
              .map(versionDoc => versionDoc.data() as any)
              .find(version => !isContentEffectivelyEmpty(version.content, version.contentJson));

            if (recovery) {
              recoveredHtml = typeof recovery.content === 'string' ? recovery.content : '';
              recoveredJson = recovery.contentJson || (typeof recovery.content === 'object' ? recovery.content : null);
              if ((recoveredTitle === 'Untitled Document' || !recoveredTitle) && recovery.title && recovery.title !== 'Untitled Document') {
                recoveredTitle = recovery.title;
              }
              recoveredFromHistory = true;
              console.warn('[HubMind] Recovered document body from version history for doc:', docId);
            }
          } catch (recoveryErr) {
            console.warn('[HubMind] Version-history recovery failed:', recoveryErr);
          }

          // If history didn't have it, check local versions history
          if (isContentEffectivelyEmpty(recoveredHtml, recoveredJson)) {
            const localVersions = getLocalVersions(docId);
            const localRecovery = localVersions.find(v => !isContentEffectivelyEmpty(v.content, v.contentJson));
            if (localRecovery) {
              recoveredHtml = typeof localRecovery.content === 'string' ? localRecovery.content : '';
              recoveredJson = localRecovery.contentJson || (typeof localRecovery.content === 'object' ? localRecovery.content : null);
              if ((recoveredTitle === 'Untitled Document' || !recoveredTitle) && localRecovery.title && localRecovery.title !== 'Untitled Document') {
                recoveredTitle = localRecovery.title;
              }
              recoveredFromHistory = true;
              console.warn('[HubMind] Recovered document body from local version history for doc:', docId);
            }
          }

          // If local versions didn't have it, try local cache
          if (isContentEffectivelyEmpty(recoveredHtml, recoveredJson) && !isContentEffectivelyEmpty(localHtml, localJson)) {
            recoveredHtml = localHtml;
            recoveredJson = localJson;
            if (cached?.title && (recoveredTitle === 'Untitled Document' || !recoveredTitle)) {
              recoveredTitle = cached.title;
            }
            recoveredFromHistory = true;
          }
        }

        // If local has unsynced newer changes, keep local content and enqueue sync,
        // BUT NEVER let a blank local cache overwrite non-empty cloud content!
        const isLocalEmpty = isContentEffectivelyEmpty(localHtml, localJson);
        const isCloudEffectivelyEmpty = isContentEffectivelyEmpty(recoveredHtml, recoveredJson);

        if (cached && !cached.synced && new Date(cached.updatedAt) > new Date(cloudData.updatedAt || 0)) {
          if (!isLocalEmpty || isCloudEffectivelyEmpty) {
            return { ...cloudData, ...cached, isOfflineLocal: true };
          } else {
            console.warn('[HubMind] Discarded invalid blank local cache in favor of valid non-empty cloud content for doc:', docId);
          }
        }

        // Heal the Firebase document itself when its body was blank but a
        // valid historical version exists. This is a one-time repair per
        // affected document and prevents the blank state from returning.
        if (recoveredFromHistory && !isContentEffectivelyEmpty(recoveredHtml, recoveredJson)) {
          try {
            const repairData: Record<string, any> = {
              content: recoveredHtml,
              lastRecoveredAt: new Date().toISOString(),
            };
            if (recoveredJson) repairData.contentJson = recoveredJson;
            if (recoveredTitle && recoveredTitle !== cloudData.title) repairData.title = recoveredTitle;

            await updateDoc(docRef, repairData);
            cloudData.content = recoveredHtml;
            cloudData.contentJson = recoveredJson;
            cloudData.title = recoveredTitle;
          } catch (repairErr) {
            console.warn('[HubMind] Could display recovered content but could not repair Firebase:', repairErr);
          }
        }

        // Cache fresh/recovered cloud data locally for future offline sessions
        const syncedRecord: OfflineDocRecord = {
          id: docId,
          title: recoveredTitle,
          content: recoveredHtml,
          contentJson: recoveredJson,
          updatedAt: cloudData.updatedAt || cached?.updatedAt || new Date().toISOString(),
          lastSavedAt: cloudData.lastSavedAt || cloudData.updatedAt || new Date().toISOString(),
          lastEditedAt: cloudData.lastEditedAt || cloudData.updatedAt,
          lastModifiedBy: cloudData.lastModifiedBy || 'User',
          pageSize: cloudData.pageSize,
          orientation: cloudData.orientation,
          marginOption: cloudData.marginOption,
          synced: true,
        };
        localDocs[docId] = syncedRecord;
        setLocalDocsMap(localDocs);

        return {
          ...cloudData,
          content: recoveredHtml,
          contentJson: recoveredJson,
          title: syncedRecord.title,
        };
      }
    } catch (err) {
      console.warn('Firestore fetch failed, relying on offline cache:', err);
    }
  }

  // Fallback to local offline cache
  if (cached) {
    return { ...cached, isOfflineLocal: true };
  }

  return null;
}

/**
 * Process all queued offline edits and push them to Firestore
 */
export async function processOfflineSyncQueue(): Promise<{ syncedCount: number; errors: number }> {
  if (!navigator.onLine) return { syncedCount: 0, errors: 0 };

  const queue = getSyncQueue();
  if (queue.length === 0) return { syncedCount: 0, errors: 0 };

  const docsMap = getLocalDocsMap();
  let syncedCount = 0;
  let errors = 0;
  const remainingQueue: string[] = [];

  for (const docId of queue) {
    const record = docsMap[docId];
    if (!record) continue;

    // Safety guard: do not push empty content to Firestore unless allowEmpty was explicitly permitted
    if (isContentEffectivelyEmpty(record.content, record.contentJson) && !record.allowEmpty) {
      console.warn(`[HubMind] Skipping offline sync of empty content for document: ${docId}`);
      continue;
    }

    try {
      const docRef = doc(db, 'documents', docId);
      await updateDoc(docRef, {
        title: record.title,
        content: record.content,
        ...(record.contentJson ? { contentJson: record.contentJson } : {}),
        updatedAt: record.updatedAt,
        lastEditedAt: record.lastEditedAt || record.updatedAt,
        lastSavedAt: new Date().toISOString(),
        lastModifiedBy: record.lastModifiedBy || 'User (Offline Synced)',
        ...(record.pageSize ? { pageSize: record.pageSize } : {}),
        ...(record.orientation ? { orientation: record.orientation } : {}),
        ...(record.marginOption ? { marginOption: record.marginOption } : {}),
      });

      // Save version to Firestore
      try {
        const versionsColl = collection(db, 'documents', docId, 'versions');
        await addDoc(versionsColl, {
          id: `sync_${Date.now()}`,
          documentId: docId,
          title: record.title,
          content: record.content,
          ...(record.contentJson ? { contentJson: record.contentJson } : {}),
          createdAt: record.updatedAt,
          authorName: record.lastModifiedBy || 'User',
          summary: 'Synced from offline edit',
        });
      } catch (vErr) {
        console.warn('Version sync failed', vErr);
      }

      record.synced = true;
      docsMap[docId] = record;
      syncedCount++;
    } catch (err) {
      console.error(`Failed to sync document ${docId}:`, err);
      remainingQueue.push(docId);
      errors++;
    }
  }

  setLocalDocsMap(docsMap);
  setSyncQueue(remainingQueue);

  window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
    detail: { status: 'synced', syncedCount, queueCount: remainingQueue.length }
  }));

  return { syncedCount, errors };
}

/**
 * Fetch all versions (combining Firestore subcollection and local cache snapshots)
 */
export async function fetchDocumentVersionHistory(docId: string): Promise<DocumentVersion[]> {
  const localVersions = getLocalVersions(docId);
  const versionMap = new Map<string, DocumentVersion>();

  localVersions.forEach(v => versionMap.set(v.id, v));

  if (navigator.onLine) {
    try {
      const versionsColl = collection(db, 'documents', docId, 'versions');
      const q = query(versionsColl, orderBy('createdAt', 'desc'), limit(40));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        const data = docSnap.data() as DocumentVersion;
        const id = docSnap.id || data.id;
        versionMap.set(id, { ...data, id });
      });
    } catch (err) {
      console.warn('Could not query Firestore versions, relying on local versions:', err);
    }
  }

  // Convert to sorted array
  const allVersions = Array.from(versionMap.values()).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return allVersions;
}

/**
 * Create a manual named checkpoint in version history
 */
export async function createNamedCheckpoint(
  docId: string,
  checkpointName: string,
  title: string,
  content: string,
  authorName: string,
  authorEmail?: string
): Promise<DocumentVersion> {
  const now = new Date().toISOString();
  const wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

  const version: DocumentVersion = {
    id: `checkpoint_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    documentId: docId,
    title,
    content,
    createdAt: now,
    authorName,
    authorEmail,
    summary: `Checkpoint: ${checkpointName}`,
    wordCount,
    isCheckpoint: true,
    checkpointName,
  };

  saveLocalVersion(version);

  if (navigator.onLine) {
    try {
      const versionsColl = collection(db, 'documents', docId, 'versions');
      await addDoc(versionsColl, version);
    } catch (err) {
      console.warn('Failed to save checkpoint to Firestore', err);
    }
  }

  return version;
}

// Global online/offline listener setup
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[HubMind Sync Engine] Online connection restored. Triggering offline queue sync...');
    processOfflineSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[HubMind Sync Engine] Network went offline. Offline mode active.');
    window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
      detail: { status: 'offline', queueCount: getSyncQueue().length }
    }));
  });
}
