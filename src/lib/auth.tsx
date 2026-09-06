import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  updatePreferredName: (preferredName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  updatePreferredName: async () => {},
  logout: async () => {},
});

const ADMIN_EMAILS = new Set(['johnrufai242@gmail.com']);
const ASSISTANT_EMAILS = new Set<string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let disposed = false;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userEmail = (firebaseUser.email || '').toLowerCase().trim();
      const isAppAdmin = ADMIN_EMAILS.has(userEmail);
      const isKnownAssistant = ASSISTANT_EMAILS.has(userEmail);
      const defaultName = firebaseUser.displayName || (userEmail ? userEmail.split('@')[0] : 'User');

      // Optimistic identity is used only until the authoritative Firestore profile arrives.
      const baseProfile: User = {
        id: firebaseUser.uid,
        name: defaultName,
        email: firebaseUser.email || userEmail,
        role: isAppAdmin ? 'admin' : isKnownAssistant ? 'assistant' : 'staff',
        status: 'active',
        photoUrl: firebaseUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
      };
      setProfile(baseProfile);
      setLoading(false);

      const docRef = doc(db, 'users', firebaseUser.uid);
      unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
        if (disposed) return;

        if (!docSnap.exists()) {
          // Create only the user's own profile. Never seed workspace/business records here.
          setDoc(docRef, baseProfile, { merge: true }).catch((err) => {
            console.warn('Initial user profile write warning:', err);
          });
          return;
        }

        const data = docSnap.data();
        // Security-sensitive role overrides are applied LAST so stale Firestore role data
        // cannot accidentally downgrade the owner/admin account.
        const authoritativeRole = isAppAdmin ? 'admin' : isKnownAssistant ? 'assistant' : (data.role || baseProfile.role);
        const updatedProfile: User = {
          ...data,
          id: firebaseUser.uid,
          name: data.name || defaultName,
          email: firebaseUser.email || data.email || userEmail,
          role: authoritativeRole,
          status: data.status || 'active',
          photoUrl: firebaseUser.photoURL || data.photoUrl,
          preferredName: data.preferredName || undefined,
          createdAt: data.createdAt || baseProfile.createdAt,
        } as User;

        setProfile(updatedProfile);

        if ((firebaseUser.photoURL && data.photoUrl !== firebaseUser.photoURL) ||
            (isAppAdmin && data.role !== 'admin') ||
            (isKnownAssistant && data.role !== 'assistant')) {
          setDoc(docRef, {
            ...(firebaseUser.photoURL ? { photoUrl: firebaseUser.photoURL } : {}),
            role: authoritativeRole,
          }, { merge: true }).catch(() => {});
        }
      }, (err) => {
        console.warn('Real-time profile listener warning; retaining authenticated profile:', err);
      });
    });

    return () => {
      disposed = true;
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const updatePreferredName = async (preferredName: string) => {
    if (!profile) return;
    const cleanName = preferredName.trim();
    if (!cleanName) return;
    try {
      const docRef = doc(db, 'users', profile.id);
      await setDoc(docRef, { preferredName: cleanName }, { merge: true });
      setProfile((prev) => (prev ? { ...prev, preferredName: cleanName } : null));
    } catch (err) {
      console.error('Failed to update preferredName:', err);
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, updatePreferredName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
