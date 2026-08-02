import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../lib/auth';
import { InboxItem } from '../types';
import { Loader2, Archive, CheckSquare, Users, Calendar, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function Inbox() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = profile.role === 'admin' || profile.role === 'assistant'
      ? query(
          collection(db, 'inbox'),
          where('status', '==', 'unprocessed')
        )
      : query(
          collection(db, 'inbox'),
          where('status', '==', 'unprocessed'),
          where('createdBy', '==', profile.id)
        );
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InboxItem));
      data = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [profile]);

  const handleArchive = async (item: InboxItem) => {
    setProcessingId(item.id);
    try {
      await updateDoc(doc(db, 'inbox', item.id), {
        status: 'processed',
        convertedTo: { type: 'archived', id: '' }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to archive item.');
    } finally {
      setProcessingId(null);
    }
  };

  const convertToTask = async (item: InboxItem) => {
    setProcessingId(item.id);
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        title: item.text,
        description: '',
        priority: 'medium',
        status: 'pending',
        assignedTo: profile?.id,
        createdBy: profile?.id,
        checklist: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'inbox', item.id), {
        status: 'processed',
        convertedTo: { type: 'task', id: docRef.id }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to convert to task.');
    } finally {
      setProcessingId(null);
    }
  };

  const convertToMeeting = async (item: InboxItem) => {
    setProcessingId(item.id);
    try {
      const docRef = await addDoc(collection(db, 'meetings'), {
        notesRaw: item.text,
        date: new Date().toISOString(),
        attendees: [],
        actionPoints: [],
        generatedDocs: [],
        ownerId: profile?.id,
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'inbox', item.id), {
        status: 'processed',
        convertedTo: { type: 'meeting', id: docRef.id }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to convert to meeting.');
    } finally {
      setProcessingId(null);
    }
  };

  const convertToClient = async (item: InboxItem) => {
    setProcessingId(item.id);
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        name: item.text,
        type: 'lead',
        status: 'active',
        ownerId: profile?.id,
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'inbox', item.id), {
        status: 'processed',
        convertedTo: { type: 'client', id: docRef.id }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to convert to client.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8 h-full flex flex-col min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Inbox</h1>
        <p className="text-sm text-slate-400 mt-1">Unprocessed quick captures</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-slate-800 border-dashed rounded-2xl bg-slate-900/50">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <CheckSquare className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Inbox Zero</h2>
          <p className="text-slate-400 text-center text-sm max-w-sm">
            All your captured thoughts have been processed. Tap the Quick Capture button to add more.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {items.map(item => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start gap-4">
                <p className="text-white text-lg leading-relaxed whitespace-pre-wrap flex-1">{item.text}</p>
                <span className="text-xs font-medium text-slate-500 shrink-0">
                  {format(parseISO(item.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
                <button
                  onClick={() => convertToTask(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                >
                  <CheckSquare className="w-4 h-4 text-accent" />
                  <span className="hidden sm:inline">To Task</span>
                </button>
                <button
                  onClick={() => convertToMeeting(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                >
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">To Meeting</span>
                </button>
                <button
                  onClick={() => convertToClient(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm flex-1 md:flex-none justify-center"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">To Client</span>
                </button>
                <button
                  onClick={() => handleArchive(item)}
                  disabled={processingId === item.id}
                  className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold px-3 py-2 rounded-lg transition-colors text-sm md:ml-auto justify-center w-full md:w-auto"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
