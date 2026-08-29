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
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeoutId);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userEmail = (firebaseUser.email || '').toLowerCase().trim();
          const isAppAdmin = userEmail === 'johnrufai242@gmail.com' || userEmail.includes('admin');
          const defaultName = firebaseUser.displayName || (userEmail ? userEmail.split('@')[0] : 'User');

          // 1. Try to find the user by UID
          const docRef = doc(db, 'users', firebaseUser.uid);
          let docSnap = null;
          try {
            docSnap = await getDoc(docRef);
          } catch (e) {
            console.warn('Error reading user by UID from Firestore:', e);
          }

          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            const role = isAppAdmin ? 'admin' : (data.role || 'staff');
            const updatedProfile: User = {
              id: docSnap.id,
              name: data.name || defaultName,
              email: firebaseUser.email || data.email || '',
              role: role,
              status: data.status || 'active',
              photoUrl: firebaseUser.photoURL || data.photoUrl,
              preferredName: data.preferredName || undefined,
              createdAt: data.createdAt || new Date().toISOString(),
              ...data,
            };

            // Sync photo or role if needed in background
            if ((firebaseUser.photoURL && data.photoUrl !== firebaseUser.photoURL) || (isAppAdmin && data.role !== 'admin')) {
              setDoc(docRef, { photoUrl: firebaseUser.photoURL, role: role }, { merge: true }).catch(() => {});
            }

            setProfile(updatedProfile);
            checkAndSeedWorkspaceData(firebaseUser.uid, userEmail);
          } else {
            // 2. Try to find by email
            let existingDocData: any = null;
            let existingDocId: string | null = null;

            if (userEmail) {
              try {
                const emailDocRef = doc(db, 'users', userEmail);
                const emailSnap = await getDoc(emailDocRef);
                if (emailSnap.exists()) {
                  existingDocData = emailSnap.data();
                  existingDocId = emailSnap.id;
                } else {
                  const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                    existingDocData = querySnapshot.docs[0].data();
                    existingDocId = querySnapshot.docs[0].id;
                  }
                }
              } catch (e) {
                console.warn('Error querying user by email:', e);
              }
            }

            if (existingDocData) {
              const role = isAppAdmin ? 'admin' : (existingDocData.role || 'staff');
              const resolvedProfile: User = {
                id: firebaseUser.uid,
                name: existingDocData.name || defaultName,
                email: firebaseUser.email || existingDocData.email,
                role: role,
                status: existingDocData.status || 'active',
                photoUrl: firebaseUser.photoURL || existingDocData.photoUrl,
                preferredName: existingDocData.preferredName || undefined,
                createdAt: existingDocData.createdAt || new Date().toISOString(),
                ...existingDocData,
              };

              // Link to UID doc for fast lookups
              setDoc(docRef, resolvedProfile, { merge: true }).catch(() => {});
              setProfile(resolvedProfile);
            } else {
              // 3. New user profile creation
              const newProfile: User = {
                id: firebaseUser.uid,
                name: defaultName,
                email: firebaseUser.email || '',
                role: isAppAdmin ? 'admin' : 'staff',
                status: 'active',
                photoUrl: firebaseUser.photoURL || undefined,
                createdAt: new Date().toISOString(),
              };

              try {
                await setDoc(docRef, newProfile);
              } catch (err) {
                console.warn('Could not write new user doc immediately:', err);
              }
              setProfile(newProfile);
            }
          }
        } catch (error) {
          console.error("Error in auth state handling:", error);
          // Fallback so user is not locked out
          const email = firebaseUser.email || '';
          setProfile({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || (email ? email.split('@')[0] : 'User'),
            email: email,
            role: (email === 'johnrufai242@gmail.com' || email.includes('admin')) ? 'admin' : 'staff',
            status: 'active',
            photoUrl: firebaseUser.photoURL || undefined,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
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

