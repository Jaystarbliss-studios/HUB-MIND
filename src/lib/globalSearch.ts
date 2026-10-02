import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ResourceType } from '../types';

export interface SearchResult {
  type: ResourceType;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

const collections: Record<ResourceType, string> = {
  document: 'documents', task: 'tasks', project: 'projects', meeting: 'meetings',
  client: 'clients', followUp: 'followUps', knowledge: 'knowledge', report: 'reports',
};

const routes: Record<ResourceType, string> = {
  document: 'documents', task: 'tasks', project: 'projects', meeting: 'meetings',
  client: 'clients', followUp: 'follow-ups', knowledge: 'knowledge', report: 'reports',
};

export async function globalSearch(term: string, ownerId: string, maxPerType = 8): Promise<SearchResult[]> {
  const needle = term.trim().toLowerCase();
  if (!needle || !ownerId) return [];
  const results: SearchResult[] = [];

  for (const type of Object.keys(collections) as ResourceType[]) {
    const snap = await getDocs(query(collection(db, collections[type]), where('ownerId', '==', ownerId), limit(maxPerType)));
    for (const d of snap.docs) {
      const x = d.data();
      const searchable = [x.title, x.name, x.description, x.content, x.email, x.phone].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(needle)) continue;
      const title = String(x.title || x.name || x.description || d.id);
      results.push({ type, id: d.id, title, subtitle: x.description ? String(x.description) : undefined, path: `/${routes[type]}/${d.id}` });
    }
  }

  return results.slice(0, 50);
}
