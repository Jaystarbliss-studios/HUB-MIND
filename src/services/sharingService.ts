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
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { 
  ResourceShare, 
  ResourceType, 
  SharePermission, 
  User 
} from '../types';
import { getUserByUsername, getUserProfile } from './userService';

function getCollectionName(resourceType: ResourceType): string {
  switch (resourceType) {
    case 'document': return 'documents';
    case 'task': return 'tasks';
    case 'meeting': return 'meetings';
    case 'project': return 'projects';
    case 'client': return 'clients';
    case 'followup': return 'followUps';
    default: return 'documents';
  }
}

export async function shareResourceWithUser(params: {
  resourceType: ResourceType;
  resourceId: string;
  resourceTitle?: string;
  ownerId: string;
  recipientUsernameOrId: string;
  permission: SharePermission;
}): Promise<ResourceShare> {
  let recipient: User | null = null;
  if (params.recipientUsernameOrId.includes('@') || !params.recipientUsernameOrId.startsWith('user_')) {
    recipient = await getUserByUsername(params.recipientUsernameOrId);
  }
  if (!recipient) {
    recipient = await getUserProfile(params.recipientUsernameOrId);
  }

  if (!recipient) {
    throw new Error(`User "${params.recipientUsernameOrId}" not found.`);
  }

  if (recipient.id === params.ownerId) {
    throw new Error('Cannot share resource with yourself as the owner.');
  }

  const shareId = `share_${params.resourceType}_${params.resourceId}_${recipient.id}`;
  const now = new Date().toISOString();

  const share: ResourceShare = {
    id: shareId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    resourceTitle: params.resourceTitle || 'Untitled Resource',
    ownerId: params.ownerId,
    recipientUserId: recipient.id,
    recipientUsername: recipient.username,
    permission: params.permission,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'shares', shareId), share);

  // Update target resource's sharedWith array and permissions map for fast querying & security rules
  const collName = getCollectionName(params.resourceType);
  const resourceRef = doc(db, collName, params.resourceId);
  const snap = await getDoc(resourceRef);

  if (snap.exists()) {
    const data = snap.data();
    const currentSharedWith: string[] = Array.isArray(data.sharedWith) ? data.sharedWith : [];
    const currentPermissions: Record<string, SharePermission> = data.permissions || {};

    if (!currentSharedWith.includes(recipient.id)) {
      currentSharedWith.push(recipient.id);
    }
    currentPermissions[recipient.id] = params.permission;

    await updateDoc(resourceRef, {
      sharedWith: currentSharedWith,
      permissions: currentPermissions,
      visibility: 'shared',
      updatedAt: now,
    });
  }

  return share;
}

export async function revokeResourceShare(shareId: string): Promise<void> {
  const shareRef = doc(db, 'shares', shareId);
  const snap = await getDoc(shareRef);
  if (!snap.exists()) return;

  const share = snap.data() as ResourceShare;
  await updateDoc(shareRef, { status: 'revoked', updatedAt: new Date().toISOString() });

  // Update parent resource permissions
  const collName = getCollectionName(share.resourceType);
  const resourceRef = doc(db, collName, share.resourceId);
  const resSnap = await getDoc(resourceRef);

  if (resSnap.exists()) {
    const data = resSnap.data();
    const currentSharedWith: string[] = (data.sharedWith || []).filter((uid: string) => uid !== share.recipientUserId);
    const currentPermissions = { ...(data.permissions || {}) };
    delete currentPermissions[share.recipientUserId];

    await updateDoc(resourceRef, {
      sharedWith: currentSharedWith,
      permissions: currentPermissions,
      visibility: currentSharedWith.length === 0 && data.visibility === 'shared' ? 'private' : data.visibility,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function subscribeToResourceShares(resourceId: string, callback: (shares: ResourceShare[]) => void): () => void {
  const q = query(
    collection(db, 'shares'),
    where('resourceId', '==', resourceId),
    where('status', '==', 'active')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceShare)));
  }, (err) => {
    console.warn('Shares subscription warning:', err);
  });
}

export function subscribeToSharesForUser(userId: string, callback: (shares: ResourceShare[]) => void): () => void {
  const q = query(
    collection(db, 'shares'),
    where('recipientUserId', '==', userId),
    where('status', '==', 'active')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceShare)));
  }, (err) => {
    console.warn('User shares subscription warning:', err);
  });
}
