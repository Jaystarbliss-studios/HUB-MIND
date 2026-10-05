import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ResourceType } from '../types';
import { getLocalDocsMap } from './offlineSync';
import { getCachedCollection } from '../services/jessWorkspaceCache';


function tokenize(value: any): string[] {
  return String(value || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
}
function relevance(term: string, item: any): number {
  const q = tokenize(term);
  const title = tokenize(item.title || item.name).join(' ');
  const all = tokenize([item.title,item.name,item.description,item.content,item.category,item.notes,item.tags].join(' ')).join(' ');
  let score = title.includes(tokenize(term).join(' ')) ? 15 : 0;
  for (const t of q) {
    if (title.includes(t)) score += 7;
    else if (all.includes(t)) score += 3;
  }
  return score;
}

export interface SearchResult {
  type: ResourceType;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

const searchCollections: Partial<Record<ResourceType, string>> = {
  document: 'documents',
  task: 'tasks',
  project: 'projects',
  meeting: 'meetings',
  client: 'clients',
  followUp: 'followUps',
  knowledge: 'knowledge',
  report: 'reports',
};

const searchRoutes: Partial<Record<ResourceType, string>> = {
  document: 'documents',
  task: 'tasks',
  project: 'projects',
  meeting: 'meetings',
  client: 'clients',
  followUp: 'follow-ups',
  followup: 'follow-ups',
  knowledge: 'knowledge',
  report: 'reports',
};

async function getVisibleDocs(collectionName: string, userId: string, max: number): Promise<any[]> {
  const map = new Map<string, any>();
  const colRef = collection(db, collectionName);

  if (collectionName === 'documents') {
    try {
      const local = getLocalDocsMap();
      Object.values(local).forEach(d => {
        if (d && d.id) map.set(d.id, { id: d.id, ...d });
      });
    } catch {}
  }

  const queries = [
    query(colRef, where('ownerId', '==', userId), limit(max)),
    query(colRef, where('createdBy', '==', userId), limit(max)),
    query(colRef, where('visibility', '==', 'workspace'), limit(max)),
  ];

  await Promise.all(
    queries.map(async q => {
      try {
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          map.set(d.id, { id: d.id, ...d.data() });
        }
      } catch {
        // Continue querying safely
      }
    })
  );

  return [...map.values()];
}

export async function globalSearch(
  term: string,
  userId: string,
  maxPerType = 12,
  role: 'admin' | 'staff' = 'staff'
): Promise<SearchResult[]> {
  const needle = term.trim().toLowerCase();
  if (!needle || !userId) return [];
  const results: SearchResult[] = [];

  const types = Object.keys(searchCollections) as ResourceType[];
  for (const type of types) {
    const collName = searchCollections[type];
    if (!collName) continue;

    let docs: any[] = getCachedCollection<any>(collName);
    try {
      if (type === 'document') {
        const local = getLocalDocsMap();
        Object.values(local).forEach(d => {
          if (d && d.id && !docs.some(x => x.id === d.id)) docs.push({ id: d.id, ...d });
        });
      }

      // The warm cache is the normal path. Only query Firestore when the cache has
      // not populated this collection yet, preventing a fresh network scan on every
      // voice search.
      if (docs.length === 0) {
        if (role === 'admin') {
          const snap = await getDocs(query(collection(db, collName), limit(60)));
          docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
          docs = await getVisibleDocs(collName, userId, 60);
        }
      }
    } catch {
      if (!docs.length) continue;
    }

    let matchesForType = 0;
    for (const x of docs) {
      if (matchesForType >= maxPerType) break;
      const score = relevance(needle, x);
      if (score <= 0) continue;
      const title = String(x.title || x.name || x.description || x.id);
      const route = searchRoutes[type] || collName;
      results.push({
        type,
        id: x.id,
        title,
        subtitle: x.description ? String(x.description) : undefined,
        path: `/${route}/${x.id}`,
        relevance: score,
      } as SearchResult & { relevance: number });
      matchesForType++;
    }
  }

  return results.sort((a: any, b: any) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 50);
}
