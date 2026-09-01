import { doc, updateDoc, setDoc, getDoc, deleteDoc, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface OfflineDocRecord {
  id: string;
  title: string;
  content: string;
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

  // Firestore persistence is enabled in firebaseConfig.ts, so writes should be
  // sent through Firestore even while the browser is offline. Firestore will
  // persist the mutation locally and synchronize it when connectivity returns.
  // We only fall back to our explicit queue when the SDK rejects the write.
  try {
    const docRef = doc(db, 'documents', docId);
    await updateDoc(docRef, {
      title: updatedRecord.title,
      content: updatedRecord.content,
      updatedAt: updatedRecord.updatedAt,
      lastEditedAt: updatedRecord.lastEditedAt || updatedRecord.updatedAt,
      lastSavedAt: now,
      lastModifiedBy: updatedRecord.lastModifiedBy,
      ...(updatedRecord.pageSize ? { pageSize: updatedRecord.pageSize } : {}),
      ...(updatedRecord.orientation ? { orientation: updatedRecord.orientation } : {}),
      ...(updatedRecord.marginOption ? { marginOption: updatedRecord.marginOption } : {}),
    });

    // Persist a version as a separate Firestore record. This write also benefits
    // from Firestore's persistent offline queue.
    try {
      const versionsColl = collection(db, 'documents', docId, 'versions');
      await addDoc(versionsColl, versionSnapshot);
    } catch (verErr) {
      console.warn('Could not write version to Firestore subcollection:', verErr);
    }

    updatedRecord.synced = navigator.onLine;
    docsMap[docId] = updatedRecord;
    setLocalDocsMap(docsMap);

    const queue = getSyncQueue().filter(id => id !== docId);
    setSyncQueue(queue);

    window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
      detail: {
        status: navigator.onLine ? 'synced' : 'offline-queued',
        docId,
        queueCount: queue.length
      }
    }));

    return updatedRecord;
  } catch (err) {
    // Do not silently report a failed cloud save as successful. Keep the local
    // snapshot and queue it for retry, while surfacing the original error to the
    // editor so the user sees a real Save error.
    console.error('Firestore document save failed:', err);
    updatedRecord.synced = false;
    docsMap[docId] = updatedRecord;
    setLocalDocsMap(docsMap);

    const queue = getSyncQueue();
    if (!queue.includes(docId)) queue.push(docId);
    setSyncQueue(queue);

    window.dispatchEvent(new CustomEvent('hubmind:sync-status', {
      detail: { status: 'save-error', docId, queueCount: queue.length }
    }));

    throw err;
  }
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
        // If local has unsynced newer changes, keep local content and enqueue sync
        if (cached && !cached.synced && new Date(cached.updatedAt) > new Date(cloudData.updatedAt || 0)) {
          return { ...cloudData, ...cached, isOfflineLocal: true };
        }

        // Cache fresh cloud data locally for future offline sessions
        const syncedRecord: OfflineDocRecord = {
          id: docId,
          title: cloudData.title || 'Untitled Document',
          content: cloudData.content || '',
          updatedAt: cloudData.updatedAt || new Date().toISOString(),
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
        return cloudData;
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
