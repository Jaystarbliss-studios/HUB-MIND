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
}

const OFFLINE_DOCS_KEY = 'hubmind_offline_documents_v1';
const SYNC_QUEUE_KEY = 'hubmind_offline_sync_queue_v1';
const LOCAL_VERSIONS_KEY = 'hubmind_local_versions_v1';

// Helpers to access local storage safely
function getLocalDocsMap(): Record<string, OfflineDocRecord> {
  try {
    const raw = localStorage.getItem(OFFLINE_DOCS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse offline docs storage', e);
    return {};
  }
}

function setLocalDocsMap(map: Record<string, OfflineDocRecord>) {
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
 * Save document offline with automatic queueing for cloud synchronization
 */
export async function saveDocumentOffline(
  docId: string,
  data: Partial<OfflineDocRecord>,
  userProfile?: { name?: string; preferredName?: string; email?: string }
): Promise<OfflineDocRecord> {
  const now = new Date().toISOString();
  const docsMap = getLocalDocsMap();
  const existing = docsMap[docId] || {
    id: docId,
    title: 'Untitled Document',
    content: '',
    updatedAt: now,
    lastSavedAt: now,
    synced: false,
  };

  const updatedRecord: OfflineDocRecord = {
    ...existing,
    ...data,
    id: docId,
    updatedAt: data.updatedAt || now,
    lastSavedAt: now,
    lastModifiedBy: userProfile?.preferredName || userProfile?.name || 'User',
    synced: navigator.onLine,
  };

  docsMap[docId] = updatedRecord;
  setLocalDocsMap(docsMap);

  // Add to local version history snapshot
  const wordCount = typeof updatedRecord.content === 'string'
    ? updatedRecord.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
    : 0;

  const versionSnapshot: DocumentVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    documentId: docId,
    title: updatedRecord.title,
    content: updatedRecord.content,
    createdAt: now,
    authorName: updatedRecord.lastModifiedBy || 'User',
    authorEmail: userProfile?.email || '',
    summary: `Autosaved (${wordCount} words)`,
    wordCount,
  };
  saveLocalVersion(versionSnapshot);

  // Match the known-good save architecture: local snapshot first, then a
  // targeted Firestore update when online. Do not turn an editor save into a
  // document create/replace operation. Existing documents already contain the
  // ownership metadata required by Firestore rules.
  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'documents', docId);
      await updateDoc(docRef, {
        title: updatedRecord.title,
        content: updatedRecord.content,
        ...(updatedRecord.contentJson ? { contentJson: updatedRecord.contentJson } : {}),
        updatedAt: updatedRecord.updatedAt,
        lastEditedAt: updatedRecord.lastEditedAt || updatedRecord.updatedAt,
        lastSavedAt: now,
        lastModifiedBy: updatedRecord.lastModifiedBy,
        ...(updatedRecord.pageSize ? { pageSize: updatedRecord.pageSize } : {}),
        ...(updatedRecord.orientation ? { orientation: updatedRecord.orientation } : {}),
        ...(updatedRecord.marginOption ? { marginOption: updatedRecord.marginOption } : {}),
      });

      // Also persist version in Firestore subcollection for multi-device history.
      try {
        const versionsColl = collection(db, 'documents', docId, 'versions');
        await addDoc(versionsColl, versionSnapshot);
      } catch (verErr) {
        console.warn('Could not write version to Firestore subcollection:', verErr);
      }

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
      console.error('Firestore document update failed; keeping the local snapshot and queueing retry:', err);
      updatedRecord.synced = false;
      docsMap[docId] = updatedRecord;
      setLocalDocsMap(docsMap);
    }
  }

  // Offline or failed network write: keep the latest editor state locally and
  // queue the document for a later targeted update.
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
 * Retrieve document with local cache fallback for full offline editing
 */
export async function getDocumentWithOfflineFallback(docId: string): Promise<any> {
  const localDocs = getLocalDocsMap();
  const cached = localDocs[docId];

  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'documents', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const cloudData = snap.data();

        // Never let an empty/stale cloud payload erase a known-good local
        // snapshot. This is especially important after editor migrations.
        const cloudHtml = typeof cloudData.content === 'string' ? cloudData.content : '';
        const cloudJson = cloudData.contentJson;
        const localHtml = cached?.content || '';
        const localJson = cached?.contentJson;

        // If the document record itself lost its body, recover the newest
        // non-empty body from its Firestore version history. Older versions
        // are deliberately treated as recovery data, never as a replacement
        // when the current document already contains valid content.
        let recoveredHtml = cloudHtml;
        let recoveredJson = cloudJson;
        let recoveredFromHistory = false;
        if (!recoveredHtml.trim() && !recoveredJson) {
          try {
            const versionsColl = collection(db, 'documents', docId, 'versions');
            const versionQuery = query(versionsColl, orderBy('createdAt', 'desc'), limit(50));
            const versionSnap = await getDocs(versionQuery);
            const recovery = versionSnap.docs
              .map(versionDoc => versionDoc.data() as any)
              .find(version => {
                const html = typeof version.content === 'string' ? version.content.trim() : '';
                return !!html || !!version.contentJson;
              });
            if (recovery) {
              recoveredHtml = typeof recovery.content === 'string' ? recovery.content : '';
              recoveredJson = recovery.contentJson;
              recoveredFromHistory = true;
              console.warn('[HubMind] Recovered document body from version history:', docId);
            }
          } catch (recoveryErr) {
            console.warn('[HubMind] Version-history recovery failed:', recoveryErr);
          }
        }

        // If local has unsynced newer changes, keep local content and enqueue sync.
        if (cached && !cached.synced && new Date(cached.updatedAt) > new Date(cloudData.updatedAt || 0)) {
          return { ...cloudData, ...cached, isOfflineLocal: true };
        }

        // If cloud is empty but this browser has a known non-empty snapshot,
        // use the local body instead of displaying a blank document.
        if (!recoveredHtml.trim() && !recoveredJson && (localHtml.trim() || localJson)) {
          recoveredHtml = localHtml;
          recoveredJson = localJson;
        }

        // Heal the Firebase document itself when its body was blank but a
        // valid historical version exists. This is a one-time repair per
        // affected document and prevents the blank state from returning after
        // another device/browser refresh.
        if (recoveredFromHistory && (recoveredHtml.trim() || recoveredJson)) {
          try {
            await updateDoc(docRef, {
              content: recoveredHtml,
              ...(recoveredJson ? { contentJson: recoveredJson } : {}),
              lastRecoveredAt: new Date().toISOString(),
            });
            cloudData.content = recoveredHtml;
            cloudData.contentJson = recoveredJson;
          } catch (repairErr) {
            console.warn('[HubMind] Could display recovered content but could not repair Firebase:', repairErr);
          }
        }

        // Cache fresh/recovered cloud data locally for future offline sessions
        const syncedRecord: OfflineDocRecord = {
          id: docId,
          title: cloudData.title || cached?.title || 'Untitled Document',
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

        // Return the recovered canonical body as well. DocumentEditor will
        // prefer contentJson when present and otherwise render HTML.
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
