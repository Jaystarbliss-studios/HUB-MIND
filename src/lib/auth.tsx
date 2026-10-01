import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { checkActiveInvitation, markInvitationAccepted } from '../services/invitationService';
import { normalizeUsername, extractHandleFromEmail, generateAvailableUsername, isUsernameAvailable } from '../services/userService';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  authError: string | null;
  updatePreferredName: (preferredName: string) => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
  updateProfileData: (data: Partial<Pick<User, 'displayName' | 'username' | 'photoUrl' | 'phone' | 'preferredName' | 'defaultVisibility'>>) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  updatePreferredName: async () => {},
  updateUsername: async () => {},
  updateProfileData: async () => {},
  logout: async () => {},
  clearAuthError: () => {},
});

export const ADMIN_EMAIL = 'johnrufai242@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let disposed = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const userEmail = (firebaseUser.email || '').toLowerCase().trim();
      const isOwnerAdmin = userEmail === ADMIN_EMAIL;
      const docRef = doc(db, 'users', firebaseUser.uid);

      try {
        const userDocSnap = await getDoc(docRef);

        if (isOwnerAdmin) {
          // Admin account always has guaranteed access
          const initialHandle = extractHandleFromEmail(userEmail, firebaseUser.displayName || undefined);
          const defaultAdminProfile: User = {
            id: firebaseUser.uid,
            email: userEmail,
            username: userDocSnap.exists() && userDocSnap.data().username ? userDocSnap.data().username : initialHandle,
            displayName: userDocSnap.exists() && userDocSnap.data().displayName ? userDocSnap.data().displayName : (firebaseUser.displayName || 'John Rufai'),
            role: 'admin',
            status: 'active',
            photoUrl: userDocSnap.exists() && userDocSnap.data().photoUrl ? userDocSnap.data().photoUrl : (firebaseUser.photoURL || undefined),
            createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : new Date().toISOString(),
          };

          if (!userDocSnap.exists() || userDocSnap.data().role !== 'admin' || !userDocSnap.data().username) {
            await setDoc(docRef, defaultAdminProfile, { merge: true });
          }

          setUser(firebaseUser);
          setProfile(userDocSnap.exists() ? ({ id: firebaseUser.uid, ...userDocSnap.data() } as User) : defaultAdminProfile);
          setLoading(false);
        } else if (userDocSnap.exists()) {
          // Existing registered user
          const existingData = userDocSnap.data() as User;
          if (existingData.status === 'suspended') {
            setAuthError('Your Hub-Mind access has been suspended. Please contact your administrator.');
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // If existing profile lacks a username or photo from Google, backfill gracefully
          if (!existingData.username || (!existingData.photoUrl && firebaseUser.photoURL)) {
            const initialHandle = existingData.username || await generateAvailableUsername(extractHandleFromEmail(userEmail, firebaseUser.displayName || undefined), firebaseUser.uid);
            const updates: Partial<User> = {
              username: initialHandle,
              photoUrl: existingData.photoUrl || firebaseUser.photoURL || undefined,
            };
            await setDoc(docRef, updates, { merge: true });
            existingData.username = initialHandle;
            if (updates.photoUrl) existingData.photoUrl = updates.photoUrl;
          }

          setUser(firebaseUser);
          setProfile({ id: firebaseUser.uid, ...existingData });
          setLoading(false);
        } else {
          // New user: verify active invitation
          const invitation = await checkActiveInvitation(userEmail);

          if (!invitation) {
            setAuthError('This Google account has not been authorized for Hub-Mind. Please contact your administrator for an invitation.');
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // Valid invitation found: assign handle from Gmail first name or invitation
          const baseHandle = invitation.username || extractHandleFromEmail(userEmail, firebaseUser.displayName || undefined);
          const finalUsername = await generateAvailableUsername(baseHandle, firebaseUser.uid);

          const initialProfile: User = {
            id: firebaseUser.uid,
            email: userEmail,
            username: finalUsername,
            displayName: invitation.displayName || firebaseUser.displayName || (finalUsername.charAt(0).toUpperCase() + finalUsername.slice(1)),
            role: 'staff',
            status: 'active',
            phone: invitation.phone,
            photoUrl: firebaseUser.photoURL || undefined,
            approvedAt: new Date().toISOString(),
            approvedBy: invitation.invitedBy,
            createdAt: new Date().toISOString(),
          };

          await setDoc(docRef, initialProfile);
          await markInvitationAccepted(invitation.id, firebaseUser.uid);

          setUser(firebaseUser);
          setProfile(initialProfile);
          setLoading(false);
        }

        // Setup real-time listener for profile updates (e.g. status changes, role, etc.)
        unsubscribeProfile = onSnapshot(docRef, (snap) => {
          if (disposed) return;
          if (snap.exists()) {
            const data = snap.data() as User;
            if (data.status === 'suspended') {
              setAuthError('Your Hub-Mind account has been suspended.');
              signOut(auth);
              setUser(null);
              setProfile(null);
            } else {
              setProfile({ id: snap.id, ...data });
            }
          }
        }, (err) => {
          console.warn('Profile listener error:', err);
        });

      } catch (err: any) {
        console.error('Auth verification error:', err);
        setAuthError(err.message || 'Authentication error.');
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const updatePreferredName = async (preferredName: string) => {
    if (!profile) return;
    const clean = preferredName.trim();
    const docRef = doc(db, 'users', profile.id);
    await setDoc(docRef, { preferredName: clean }, { merge: true });
    setProfile(prev => prev ? { ...prev, preferredName: clean } : null);
  };

  const updateUsername = async (newUsername: string) => {
    if (!profile) return;
    const normalized = normalizeUsername(newUsername);
    if (normalized.length < 3) throw new Error('Username must be at least 3 characters.');
    const docRef = doc(db, 'users', profile.id);
    await setDoc(docRef, { username: normalized }, { merge: true });
    setProfile(prev => prev ? { ...prev, username: normalized } : null);
  };

  const updateProfileData = async (data: Partial<Pick<User, 'displayName' | 'username' | 'photoUrl' | 'phone' | 'preferredName' | 'defaultVisibility'>>) => {
    if (!profile) return;
    const docRef = doc(db, 'users', profile.id);
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (data.displayName !== undefined) updates.displayName = data.displayName.trim();
    if (data.preferredName !== undefined) updates.preferredName = data.preferredName.trim();
    if (data.phone !== undefined) updates.phone = data.phone.trim();
    if (data.photoUrl !== undefined) updates.photoUrl = data.photoUrl.trim();
    if (data.defaultVisibility !== undefined) updates.defaultVisibility = data.defaultVisibility;

    if (data.username !== undefined) {
      const normalized = normalizeUsername(data.username);
      if (normalized.length < 3) {
        throw new Error('Username must be at least 3 characters.');
      }
      const available = await isUsernameAvailable(normalized, profile.id);
      if (!available) {
        throw new Error(`@${normalized} is already taken by another user.`);
      }
      updates.username = normalized;
    }

    await setDoc(docRef, updates, { merge: true });
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setAuthError(null);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authError,
      updatePreferredName,
      updateUsername,
      updateProfileData,
      logout,
      clearAuthError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
