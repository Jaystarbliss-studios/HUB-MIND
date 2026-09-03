import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
          // 1. Try to find the user by UID with 2.5s timeout
          const docRef = doc(db, 'users', firebaseUser.uid);
          let docSnap: any = null;
          try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
            docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);
          } catch (e) {
            console.warn('User UID lookup completed or timed out:', e);
          }

          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            const role = isAppAdmin ? 'admin' : (data.role || 'staff');
            const updatedProfile: User = {
              ...data,
              id: firebaseUser.uid,
              name: data.name || defaultName,
              email: firebaseUser.email || data.email || userEmail,
              // Authenticated identity takes precedence over stale Firestore role data.
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
            // 2. Try to find by email if userEmail exists
            let existingDocData: any = null;

            if (userEmail) {
              try {
                const emailDocRef = doc(db, 'users', userEmail);
                const emailSnap = await Promise.race([
                  getDoc(emailDocRef),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                ]) as any;

                if (emailSnap && emailSnap.exists()) {
                  existingDocData = emailSnap.data();
                }
              } catch (e) {
                console.warn('User email doc lookup skipped:', e);
              }
            }

            if (existingDocData) {
              const role = isAppAdmin ? 'admin' : (existingDocData.role || 'staff');
              const resolvedProfile: User = {
                ...existingDocData,
                id: firebaseUser.uid,
                name: existingDocData.name || defaultName,
                email: firebaseUser.email || existingDocData.email,
                role,
                status: existingDocData.status || 'active',
                photoUrl: firebaseUser.photoURL || existingDocData.photoUrl,
                preferredName: existingDocData.preferredName || undefined,
                createdAt: existingDocData.createdAt || new Date().toISOString(),
              };

              setDoc(docRef, resolvedProfile, { merge: true }).catch(() => {});
              setProfile(resolvedProfile);
            } else {
              // 3. Persist new user profile in background
              setDoc(docRef, baseProfile, { merge: true }).catch(() => {});
            }
          }
        } catch (error) {
          console.error("Non-blocking error in auth background sync:", error);
        }
      } else {
        setProfile(null);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
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

