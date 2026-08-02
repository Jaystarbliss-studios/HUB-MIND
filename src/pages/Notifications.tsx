import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Notification } from '../types';
import { Loader2, Bell, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        setNotifications(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifs();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const notif of unread) {
      await markAsRead(notif.id);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Notifications</h1>
        </div>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllAsRead} className="text-sm font-bold text-accent hover:text-accent-hover transition-colors">
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <Bell className="w-12 h-12 mb-4 opacity-20" />
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className={`p-5 flex gap-4 transition-colors ${!n.read ? 'bg-slate-800/30' : ''}`}>
                  <div className="mt-1 shrink-0">
                    {!n.read ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-accent mt-2" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-slate-600 mt-0.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(parseISO(n.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {!n.read && (
                    <button 
                      onClick={() => markAsRead(n.id)}
                      className="shrink-0 text-xs font-bold text-slate-500 hover:text-accent transition-colors self-start mt-1"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
