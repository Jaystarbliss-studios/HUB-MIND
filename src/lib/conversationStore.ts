import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ChatMessage, StoredConversation } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'hubmind_conv_';

export function getActiveBranchMessages(
  messages: ChatMessage[],
  activeLeafId?: string | null
): ChatMessage[] {
  if (!messages || messages.length === 0) return [];

  // If no parentMessageId exists across messages (flat legacy list), return as is
  const hasTreeLinks = messages.some((m) => m.parentMessageId !== undefined);
  if (!hasTreeLinks) {
    return messages;
  }

  const msgMap = new Map<string, ChatMessage>();
  messages.forEach((m) => msgMap.set(m.id, m));

  // Determine target leaf
  let currentId: string | null = activeLeafId || null;
  if (!currentId || !msgMap.has(currentId)) {
    // Pick the most recent message as leaf
    currentId = messages[messages.length - 1]?.id || null;
  }

  const path: ChatMessage[] = [];
  const visited = new Set<string>();

  while (currentId && msgMap.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const msg = msgMap.get(currentId)!;
    path.unshift(msg);
    currentId = msg.parentMessageId || null;
  }

  return path;
}

export function getSiblingsInfo(
  allMessages: ChatMessage[],
  messageId: string
): { siblings: ChatMessage[]; currentIndex: number; total: number } {
  const currentMsg = allMessages.find((m) => m.id === messageId);
  if (!currentMsg) {
    return { siblings: [], currentIndex: 0, total: 1 };
  }

  const parentId = currentMsg.parentMessageId || null;
  const siblings = allMessages.filter((m) => (m.parentMessageId || null) === parentId && m.sender === currentMsg.sender);

  const currentIndex = siblings.findIndex((m) => m.id === messageId);
  return {
    siblings,
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
    total: Math.max(siblings.length, 1),
  };
}

export async function saveConversationToFirestore(
  userId: string,
  conversation: StoredConversation
): Promise<void> {
  // Always update local fallback
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}_${conversation.id}`, JSON.stringify(conversation));
  } catch (e) {
    // Ignore storage quota limits
  }

  if (!userId) return;

  try {
    const convRef = doc(db, 'users', userId, 'conversations', conversation.id);
    await setDoc(convRef, {
      ...conversation,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving conversation to Firestore, stored locally:', err);
  }
}

export async function loadUserConversations(userId: string): Promise<StoredConversation[]> {
  const conversations: StoredConversation[] = [];

  // Try Firestore first
  if (userId) {
    try {
      const convCollection = collection(db, 'users', userId, 'conversations');
      const q = query(convCollection, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        conversations.push(docSnap.data() as StoredConversation);
      });
    } catch (err) {
      console.warn('Could not load Firestore conversations, checking local fallback:', err);
    }
  }

  // Fallback / merge with local storage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${LOCAL_STORAGE_KEY_PREFIX}${userId}_`)) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item) as StoredConversation;
          if (!conversations.some((c) => c.id === parsed.id)) {
            conversations.push(parsed);
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Sort by updatedAt desc
  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return conversations;
}

export async function deleteUserConversation(userId: string, conversationId: string): Promise<void> {
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}_${conversationId}`);
  } catch (e) {}

  if (userId) {
    try {
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await deleteDoc(convRef);
    } catch (err) {
      console.warn('Error deleting conversation from Firestore:', err);
    }
  }
}
