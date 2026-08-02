import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function useUsers() {
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const userMap: Record<string, string> = {};
        snapshot.docs.forEach(doc => {
          userMap[doc.id] = doc.data().name || 'Unknown';
        });
        setUsers(userMap);
      } catch (err) {
        console.error('Error fetching users for names:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return { users, loading };
}
