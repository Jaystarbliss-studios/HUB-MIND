import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, getDoc, limit } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // 1. Try to find the user by UID
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as User);
          } else {
            // 2. Try to find the user by email (created by admin)
            const emailDocRef = doc(db, 'users', firebaseUser.email.toLowerCase());
            const emailDocSnap = await getDoc(emailDocRef);
            let userDoc = null;
            if (emailDocSnap.exists()) {
              userDoc = emailDocSnap;
            } else {
              const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                userDoc = querySnapshot.docs[0];
              }
            }
            if (userDoc) {
              setProfile({ id: userDoc.id, ...userDoc.data() } as User);
            } else {
              // 3. Check if there are any users in the DB
              const allUsersQ = query(collection(db, 'users'), limit(1));
              const allUsersSnap = await getDocs(allUsersQ);
              
              if (allUsersSnap.empty) {
                // First user! Make them admin.
                const newProfile = {
                  name: firebaseUser.displayName || 'New User',
                  email: firebaseUser.email,
                  role: 'admin',
                  status: 'active',
                  createdAt: new Date().toISOString()
                };
                await setDoc(docRef, newProfile);
                setProfile({ id: firebaseUser.uid, ...newProfile } as User);
              } else {
                // Not the first user, and not registered by admin. Deny access.
                console.warn("User not registered in the system.");
                const { signOut } = await import('firebase/auth');
                await signOut(auth);
                window.dispatchEvent(new CustomEvent('auth-error', { detail: 'Your email is not registered. Please contact an administrator.' }));
                setProfile(null);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
