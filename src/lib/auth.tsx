import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';
import { checkAndSeedWorkspaceData } from './dbSeed';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to guarantee the loading screen NEVER hangs indefinitely
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2000);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if any
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userEmail = (firebaseUser.email || '').toLowerCase().trim();
        const isAppAdmin = userEmail === 'johnrufai242@gmail.com' || userEmail.includes('admin');
        const defaultName = firebaseUser.displayName || (userEmail ? userEmail.split('@')[0] : 'User');

        // Immediately populate optimistic profile so the workspace renders with ZERO delay
        const baseProfile: User = {
          id: firebaseUser.uid,
          name: defaultName,
          email: firebaseUser.email || userEmail,
          role: isAppAdmin ? 'admin' : 'staff',
          status: 'active',
          photoUrl: firebaseUser.photoURL || undefined,
          createdAt: new Date().toISOString(),
        };

        setProfile((prev) => prev || baseProfile);
        setLoading(false);
        clearTimeout(timeoutId);

        try {
          const docRef = doc(db, 'users', firebaseUser.uid);

          // Real-time listener for user profile changes in Firestore
          unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const role = isAppAdmin ? 'admin' : (data.role || 'staff');
              const updatedProfile: User = {
                ...data,
                id: firebaseUser.uid,
                name: data.name || defaultName,
                email: firebaseUser.email || data.email || userEmail,
                role,
                status: data.status || 'active',
                photoUrl: firebaseUser.photoURL || data.photoUrl,
                preferredName: data.preferredName || undefined,
                createdAt: data.createdAt || new Date().toISOString(),
              };

              // Sync photo or role if needed in background
              if ((firebaseUser.photoURL && data.photoUrl !== firebaseUser.photoURL) || (isAppAdmin && data.role !== 'admin')) {
                setDoc(docRef, { photoUrl: firebaseUser.photoURL, role: role }, { merge: true }).catch(() => {});
              }

              setProfile(updatedProfile);
              checkAndSeedWorkspaceData(firebaseUser.uid, userEmail).catch(() => {});
            } else {
              // Persist initial user profile in Firestore
              setDoc(docRef, baseProfile, { merge: true })
                .then(() => {
                  checkAndSeedWorkspaceData(firebaseUser.uid, userEmail).catch(() => {});
                })
                .catch((err) => {
                  console.warn('Initial user profile write warning:', err);
                });
            }
          }, (err) => {
            console.warn('Real-time profile listener warning (using optimistic base profile):', err);
          });
        } catch (error) {
          console.error("Non-blocking error in auth setup:", error);
        }
      } else {
        setProfile(null);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
      unsubscribeAuth();
    };
  }, []);

  const updatePreferredName = async (preferredName: string) => {
    if (!profile) return;
    const cleanName = preferredName.trim();
    try {
      const docRef = doc(db, 'users', profile.id);
      await setDoc(docRef, { preferredName: cleanName }, { merge: true });
      setProfile((prev) => (prev ? { ...prev, preferredName: cleanName } : null));
    } catch (err) {
      console.error('Failed to update preferredName:', err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, updatePreferredName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

