import {
  collection,
  onSnapshot,
  query,
  where,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types';

const STORAGE_PREFIX = 'hubmind_jess_workspace_cache_v2_';
const MAX_PER_COLLECTION = 150;

type CachedRecord = { id: string; [key: string]: any };
type CacheState = Record<string, CachedRecord[]>;

let activeUserId = '';
let activeUnsubs: Unsubscribe[] = [];
let memoryCache: CacheState = {};
let lastSyncAt = 0;

const COLLECTIONS = [
  'documents',
  'tasks',
  'projects',
  'meetings',
  'clients',
  'followUps',
  'knowledge',
  'reports',
  'recurringMeetingTemplates',
];

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function loadLocal(userId: string): CacheState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistLocal() {
  if (!activeUserId) return;
  try {
    localStorage.setItem(storageKey(activeUserId), JSON.stringify(memoryCache));
  } catch {}
}

function replaceCollection(name: string, records: CachedRecord[]) {
  memoryCache[name] = records.slice(0, MAX_PER_COLLECTION);
  lastSyncAt = Date.now();
  persistLocal();
}

function startListener(name: string, q: any) {
  const unsub = onSnapshot(
    q,
    snapshot => {
      replaceCollection(
        name,
        snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      );
    },
    error => {
      console.warn(`[JessCache] ${name} listener unavailable; retaining cached data:`, error?.message || error);
    }
  );
  activeUnsubs.push(unsub);
}

export function startJessWorkspaceCache(user: User): () => void {
  stopJessWorkspaceCache();

  if (!user?.id) return () => {};
  activeUserId = user.id;
  memoryCache = loadLocal(user.id);
  lastSyncAt = Date.now();

  const isAdmin = user.role === 'admin';

  // Each listener immediately receives the SDK's locally persisted snapshot when
  // available, then updates from the server. Jess therefore has a warm local index
  // without waiting for a network round-trip during a voice session.
  startListener('documents', isAdmin
    ? query(collection(db, 'documents'), limit(MAX_PER_COLLECTION))
    : query(collection(db, 'documents'), where('visibility', '==', 'workspace'), limit(MAX_PER_COLLECTION)));

  startListener('tasks', isAdmin
    ? query(collection(db, 'tasks'), limit(MAX_PER_COLLECTION))
    : query(collection(db, 'tasks'), where('assignedTo', '==', user.id), limit(MAX_PER_COLLECTION)));

  startListener('projects', query(collection(db, 'projects'), limit(MAX_PER_COLLECTION)));
  startListener('meetings', query(collection(db, 'meetings'), limit(MAX_PER_COLLECTION)));
  startListener('clients', query(collection(db, 'clients'), limit(MAX_PER_COLLECTION)));
  startListener('followUps', query(collection(db, 'followUps'), limit(MAX_PER_COLLECTION)));
  startListener('knowledge', query(collection(db, 'knowledge'), limit(MAX_PER_COLLECTION)));
  startListener('reports', query(collection(db, 'reports'), limit(MAX_PER_COLLECTION)));
  startListener('recurringMeetingTemplates', isAdmin
    ? query(collection(db, 'recurringMeetingTemplates'), limit(MAX_PER_COLLECTION))
    : query(collection(db, 'recurringMeetingTemplates'), where('ownerId', '==', user.id), limit(MAX_PER_COLLECTION)));

  return () => stopJessWorkspaceCache();
}

export function stopJessWorkspaceCache() {
  activeUnsubs.forEach(unsub => {
    try { unsub(); } catch {}
  });
  activeUnsubs = [];
  activeUserId = '';
  memoryCache = {};
  lastSyncAt = 0;
}

export function getCachedCollection<T = CachedRecord>(name: string): T[] {
  return ((memoryCache[name] || []) as T[]).slice();
}

export function getCachedRecord(name: string, id: string): CachedRecord | null {
  return getCachedCollection<CachedRecord>(name).find(item => item.id === id) || null;
}

export function getJessWorkspaceCacheStatus() {
  return {
    userId: activeUserId,
    lastSyncAt,
    collections: Object.fromEntries(COLLECTIONS.map(name => [name, (memoryCache[name] || []).length])),
  };
}

export function searchJessWorkspaceCache(term: string, max = 25): CachedRecord[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const results: CachedRecord[] = [];
  const seen = new Set<string>();

  for (const collectionName of COLLECTIONS) {
    for (const item of getCachedCollection<CachedRecord>(collectionName)) {
      const haystack = JSON.stringify(item).toLowerCase();
      if (!haystack.includes(q)) continue;
      const key = `${collectionName}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ ...item, _collection: collectionName });
      if (results.length >= max) return results;
    }
  }

  return results;
}
