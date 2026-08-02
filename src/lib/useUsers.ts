import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface UserBasic {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
}

export function useUsers() {
  const [users, setUsers] = useState<Record<string, UserBasic>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const userMap: Record<string, UserBasic> = {};
        snapshot.docs.forEach(doc => {
          userMap[doc.id] = { id: doc.id, ...doc.data() } as UserBasic;
        });
        setUsers(userMap);
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return { users, loading };
}
