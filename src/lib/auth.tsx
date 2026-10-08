import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, limit, query, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { acceptInvitation } from './invitations';
import { isAdminEmail, extractHandleFromEmail, generateAvailableUsername } from '../services/userService';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  authorizationError: string | null;
  updatePreferredName: (preferredName: string) => Promise<void>;
  updateProfileData: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authorizationError: null,
  updatePreferredName: async () => {},
  updateProfileData: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);

  useEffect(() => {
    let stopProfile: (() => void) | null = null;
    let disposed = false;

    const stopAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      stopProfile?.();
      stopProfile = null;
      setUser(firebaseUser);
      setProfile(null);
      setAuthorizationError(null);

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const profileRef = doc(db, 'users', firebaseUser.uid);

      let existingSnap;
      try {
        existingSnap = await getDoc(profileRef);
      } catch (err) {
        console.error('[AuthProvider] Error fetching user profile doc:', err);
        handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
      }

      if (existingSnap && existingSnap.exists()) {
        const data = existingSnap.data();
        if (data.status === 'inactive' || data.status === 'suspended') {
          setAuthorizationError('Your Hub-Mind account is currently inactive. Please contact an administrator.');
          setLoading(false);
          return;
        }

        const activeProfile: User = {
          ...data,
          id: firebaseUser.uid,
          email: firebaseUser.email || data.email,
          photoUrl: firebaseUser.photoURL || data.photoUrl,
        } as User;

        setProfile(activeProfile);
        setLoading(false);

        stopProfile = onSnapshot(profileRef, (snap) => {
          if (!disposed && snap.exists()) {
            setProfile({
              ...snap.data(),
              id: firebaseUser.uid,
              email: firebaseUser.email || snap.data().email,
              photoUrl: firebaseUser.photoURL || snap.data().photoUrl,
            } as User);
          }
        }, (err) => {
          console.warn('[AuthProvider] onSnapshot profile error:', err);
        });
        return;
      }

      // Profile does not exist yet in Firestore: Check if user is admin or if database is empty
      const userEmail = (firebaseUser.email || '').trim().toLowerCase();
      const isAdminByEmail = isAdminEmail(userEmail);

      let isWorkspaceEmpty = false;
      if (!isAdminByEmail) {
        try {
          const userCheckSnap = await getDocs(query(collection(db, 'users'), limit(1)));
          isWorkspaceEmpty = userCheckSnap.empty;
        } catch {
          // If query fails due to permissions, default to false
          isWorkspaceEmpty = false;
        }
      }

      if (isAdminByEmail || isWorkspaceEmpty) {
        const now = new Date().toISOString();
        const handle = extractHandleFromEmail(userEmail, firebaseUser.displayName || undefined);
        const username = await generateAvailableUsername(handle, firebaseUser.uid);

        const newAdminProfile: User = {
          id: firebaseUser.uid,
          username,
          name: firebaseUser.displayName || 'Administrator',
          displayName: firebaseUser.displayName || 'Administrator',
          email: userEmail,
          role: 'admin',
          status: 'active',
          photoUrl: firebaseUser.photoURL || undefined,
          createdAt: now,
          approvedAt: now,
          defaultVisibility: 'workspace',
        };

        try {
          await setDoc(profileRef, newAdminProfile);
          setProfile(newAdminProfile);
          setLoading(false);
          return;
        } catch (err: any) {
          console.error('[AuthProvider] Failed to auto-bootstrap admin profile:', err);
          setAuthorizationError(`Failed to initialize admin profile: ${err?.message || 'Database permission error'}`);
          setLoading(false);
          return;
        }
      }

      const inviteId = new URLSearchParams(window.location.search).get('invite');

      // Existing Firebase Auth accounts are allowed to sign in without a
      // fresh invitation. The login screen marks a successful, pre-existing
      // Auth account before we reach this branch. A genuinely new Google
      // account is rejected by Login.tsx unless it has an invitation.
      const existingAuthLogin = typeof window !== 'undefined'
        && window.sessionStorage.getItem('hubmind_existing_auth_login') === firebaseUser.uid;

      if (!inviteId && existingAuthLogin) {
        const now = new Date().toISOString();
        const emailLocal = extractHandleFromEmail(userEmail, firebaseUser.displayName || undefined);
        const safeSuffix = firebaseUser.uid.slice(0, 6).toLowerCase();
        const usernameBase = `${emailLocal}_${safeSuffix}`.slice(0, 30);

        const existingAuthProfile: User = {
          id: firebaseUser.uid,
          username: usernameBase,
          name: firebaseUser.displayName || emailLocal,
          displayName: firebaseUser.displayName || emailLocal,
          email: userEmail,
          role: 'staff',
          status: 'active',
          photoUrl: firebaseUser.photoURL || undefined,
          createdAt: now,
          approvedAt: now,
          defaultVisibility: 'workspace',
          registrationSource: 'existing-auth',
        } as User;

        try {
          await setDoc(profileRef, existingAuthProfile);
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('hubmind_existing_auth_login');
          }
          setProfile(existingAuthProfile);
          setLoading(false);
          return;
        } catch (err: any) {
          console.error('[AuthProvider] Failed to provision existing Firebase Auth profile:', err);
          setAuthorizationError(`Your Firebase account is registered, but Hub-Mind could not initialize its workspace profile: ${err?.message || 'database permission error'}`);
          setLoading(false);
          return;
        }
      }

      // Check for invitation link
      if (!inviteId) {
        setAuthorizationError('This Google account has not been authorized for Hub-Mind. Ask an administrator for an invitation.');
        setLoading(false);
        return;
      }

      try {
        const invitation = await acceptInvitation(inviteId, firebaseUser.uid, userEmail);
        const now = new Date().toISOString();
        const newStaffProfile: User = {
          id: firebaseUser.uid,
          username: invitation.username,
          name: invitation.displayName,
          displayName: invitation.displayName,
          email: userEmail || invitation.email,
          role: 'staff',
          status: 'active',
          phone: invitation.phone,
          photoUrl: firebaseUser.photoURL || undefined,
          createdAt: now,
          approvedAt: now,
          approvedBy: invitation.invitedBy,
          invitationId: inviteId,
        };

        await setDoc(profileRef, newStaffProfile);
        setProfile(newStaffProfile);
        setLoading(false);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (error: any) {
        setAuthorizationError(error?.message || 'Unable to validate your Hub-Mind invitation.');
        setLoading(false);
      }

    });
  }, []);

  const updatePreferredName = async (preferredName: string) => {
    const clean = preferredName.trim();
    if (!profile || !clean) return;
    try {
      await setDoc(doc(db, 'users', profile.id), { preferredName: clean }, { merge: true });
      setProfile((p) => (p ? { ...p, preferredName: clean } : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${profile.id}`);
    }
  };

  const updateProfileData = async (data: Partial<User>) => {
    if (!profile) return;
    try {
      await setDoc(doc(db, 'users', profile.id), data, { merge: true });
      setProfile((p) => (p ? ({ ...p, ...data } as User) : null));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${profile.id}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    setAuthorizationError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authorizationError,
        updatePreferredName,
        updateProfileData,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
