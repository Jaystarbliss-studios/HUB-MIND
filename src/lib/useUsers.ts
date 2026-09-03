import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './auth';

export interface UserBasic {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
}

// Module-level cache to prevent flicker across page navigations
let cachedUserMap: Record<string, UserBasic> = {};

export function useUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Record<string, UserBasic>>(() => {
    const initial = { ...cachedUserMap };
    if (profile?.id) {
      initial[profile.id] = {
        id: profile.id,
        name: profile.preferredName || profile.name || 'User',
        email: profile.email,
        photoUrl: profile.photoUrl,
        role: profile.role,
      };
    }
    return initial;
  });
  const [loading, setLoading] = useState(() => Object.keys(cachedUserMap).length === 0);

  useEffect(() => {
    // If profile is available, ensure it's in the state immediately
    if (profile?.id) {
      setUsers(prev => ({
        ...prev,
        [profile.id]: {
          id: profile.id,
          name: profile.preferredName || profile.name || 'User',
          email: profile.email,
          photoUrl: profile.photoUrl,
          role: profile.role,
        }
      }));
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userMap: Record<string, UserBasic> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        userMap[doc.id] = {
          id: doc.id,
          name: data.preferredName || data.name || doc.id,
          email: data.email || '',
          photoUrl: data.photoUrl,
          role: data.role,
        };
      });

      // Ensure current authenticated user is included even if doc is keyed differently
      if (profile?.id && !userMap[profile.id]) {
        userMap[profile.id] = {
          id: profile.id,
          name: profile.preferredName || profile.name || 'User',
          email: profile.email,
          photoUrl: profile.photoUrl,
          role: profile.role,
        };
      }

      cachedUserMap = userMap;
      setUsers(userMap);
      setLoading(false);
    }, (err) => {
      console.warn('Real-time users directory notice (using cached or current user profile):', err);
      if (profile?.id) {
        setUsers(prev => ({
          ...prev,
          [profile.id]: {
            id: profile.id,
            name: profile.preferredName || profile.name || 'User',
            email: profile.email,
            photoUrl: profile.photoUrl,
            role: profile.role,
          }
        }));
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [profile?.id, profile?.name, profile?.preferredName, profile?.email, profile?.photoUrl, profile?.role]);

  return { users, loading };
}
