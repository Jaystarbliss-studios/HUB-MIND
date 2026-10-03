import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserMemory, MemoryCategory } from '../types';

const LOCAL_MEMORY_PREFIX = 'hubmind_memories_';

function getLocalMemories(userId: string): UserMemory[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MEMORY_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function setLocalMemories(userId: string, memories: UserMemory[]) {
  try {
    localStorage.setItem(`${LOCAL_MEMORY_PREFIX}${userId}`, JSON.stringify(memories));
  } catch {}
}

export async function saveUserMemory(
  userId: string, 
  data: {
    key?: string;
    content: string;
    category?: MemoryCategory;
    importance?: number | 'high' | 'medium' | 'low';
    source?: 'voice' | 'chat' | 'system' | 'explicit';
  }
): Promise<UserMemory> {
  if (!userId || !data.content?.trim()) {
    throw new Error('User ID and memory content are required.');
  }

  const now = new Date().toISOString();
  const cleanContent = data.content.trim();
  const cleanKey = (data.key || cleanContent.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '_')).trim();
  const category: MemoryCategory = data.category || 'preference';
  
  // Deterministic memory ID based on key or generate unique ID
  const memoryId = data.key 
    ? `mem_${userId}_${cleanKey}` 
    : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const memory: UserMemory = {
    id: memoryId,
    userId,
    key: cleanKey,
    content: cleanContent,
    category,
    importance: data.importance || 'medium',
    source: data.source || 'explicit',
    createdAt: now,
    updatedAt: now,
    lastReferencedAt: now,
  };

  try {
    const memRef = doc(db, 'users', userId, 'memories', memoryId);
    await setDoc(memRef, memory, { merge: true });
  } catch (err) {
    console.warn('[MemoryService] Firestore save error, saving to local cache:', err);
  }

  // Update local cache
  const local = getLocalMemories(userId);
  const existingIdx = local.findIndex(m => m.id === memoryId || (m.key && m.key === cleanKey));
  if (existingIdx >= 0) {
    local[existingIdx] = memory;
  } else {
    local.unshift(memory);
  }
  setLocalMemories(userId, local);

  return memory;
}

export async function getUserMemories(userId: string): Promise<UserMemory[]> {
  if (!userId) return [];

  const local = getLocalMemories(userId);

  try {
    const colRef = collection(db, 'users', userId, 'memories');
    const snap = await getDocs(query(colRef, limit(60)));
    if (!snap.empty) {
      const firestoreMemories = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserMemory));
      // Merge and update local cache
      const map = new Map<string, UserMemory>();
      local.forEach(m => map.set(m.id, m));
      firestoreMemories.forEach(m => map.set(m.id, m));
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
      setLocalMemories(userId, merged);
      return merged;
    }
  } catch (err) {
    console.warn('[MemoryService] Failed to load remote memories, returning local cache:', err);
  }

  return local;
}

export async function deleteUserMemory(userId: string, memoryIdOrKey: string): Promise<boolean> {
  if (!userId || !memoryIdOrKey) return false;

  try {
    // Check if direct ID
    const memRef = doc(db, 'users', userId, 'memories', memoryIdOrKey);
    await deleteDoc(memRef).catch(() => {});
  } catch (err) {
    console.warn('[MemoryService] Delete error:', err);
  }

  const local = getLocalMemories(userId).filter(
    m => m.id !== memoryIdOrKey && m.key !== memoryIdOrKey
  );
  setLocalMemories(userId, local);
  return true;
}

export function subscribeToUserMemories(
  userId: string, 
  callback: (memories: UserMemory[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  // Initial local emit
  callback(getLocalMemories(userId));

  const colRef = collection(db, 'users', userId, 'memories');
  return onSnapshot(colRef, (snap) => {
    const memories = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserMemory));
    memories.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    setLocalMemories(userId, memories);
    callback(memories);
  }, (err) => {
    console.warn('[MemoryService] Memory subscription fallback:', err);
    callback(getLocalMemories(userId));
  });
}

export function formatMemoriesForPrompt(memories: UserMemory[]): string {
  if (!memories || memories.length === 0) {
    return 'No specific past user memories stored yet.';
  }

  const grouped: Record<string, string[]> = {};

  memories.slice(0, 20).forEach(m => {
    const cat = m.category || 'preference';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(`• ${m.content}${m.key ? ` (${m.key})` : ''}`);
  });

  const sections = Object.entries(grouped).map(([category, items]) => {
    const title = category.toUpperCase();
    return `[${title}]\n${items.join('\n')}`;
  });

  return sections.join('\n\n');
}

/**
 * Extracts and saves automatic user preference memories from statements like:
 * "Remember that I prefer...", "Always format my documents as A4", "My preferred name is X"
 */
export async function autoExtractMemory(userId: string, userMessage: string): Promise<UserMemory | null> {
  if (!userId || !userMessage) return null;
  const msg = userMessage.trim();

  // Pattern: "Remember that...", "Please remember...", "Keep in mind that..."
  const rememberMatch = msg.match(/(?:remember(?:\s+that)?|keep in mind(?:\s+that)?|don't forget(?:\s+that)?)\s+(.+)/i);
  if (rememberMatch && rememberMatch[1]) {
    const fact = rememberMatch[1].trim().replace(/[.!?]+$/, '');
    if (fact.length > 5) {
      return saveUserMemory(userId, {
        content: fact,
        category: 'instruction',
        source: 'chat',
        importance: 'high',
      });
    }
  }

  // Pattern: "I prefer...", "I like to..."
  const preferMatch = msg.match(/(?:i prefer|i always want|my preference is)\s+(.+)/i);
  if (preferMatch && preferMatch[1]) {
    const pref = preferMatch[1].trim().replace(/[.!?]+$/, '');
    if (pref.length > 5) {
      return saveUserMemory(userId, {
        content: `User preference: ${pref}`,
        category: 'preference',
        source: 'chat',
        importance: 'medium',
      });
    }
  }

  return null;
}
