import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Meeting } from '../types';
import { Loader2, ArrowLeft, Trash2, Calendar as CalendarIcon, Clock, Users, AlignLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUsers } from '../lib/useUsers';

export function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { users } = useUsers();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchMeeting = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'meetings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMeeting({ id: docSnap.id, ...docSnap.data() } as Meeting);
        } else {
          console.error("Meeting not found");
        }
      } catch (error) {
        console.error("Error fetching meeting:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm("Are you sure you want to delete this meeting?")) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'meetings', id));
      navigate(-1);
    } catch (error) {
      console.error("Error deleting meeting:", error);
      alert("Failed to delete meeting.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  if (!meeting) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-slate-200 font-bold mb-4">Meeting not found</h2>
        <button onClick={() => navigate(-1)} className="text-accent hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 flex flex-col h-full min-h-0 pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          {(profile?.role === 'admin' || profile?.role === 'assistant') && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-semibold transition-colors text-sm"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">{meeting.notesRaw?.split('\n')[0] || 'Untitled Meeting'}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-slate-800">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Date</p>
              <p className="text-sm text-slate-200">
                {meeting.date ? format(parseISO(meeting.date), 'EEEE, MMMM d, yyyy') : 'No date'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Time</p>
              <p className="text-sm text-slate-200">
                {meeting.date ? format(parseISO(meeting.date), 'h:mm a') : 'No time'}
              </p>
            </div>
          </div>
        </div>

        {meeting.attendees && meeting.attendees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
              <Users className="w-5 h-5 text-slate-500" />
              <h3>Attendees</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {meeting.attendees.map(attendeeId => (
                <div key={attendeeId} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full">
                  {users[attendeeId]?.photoUrl ? (
                    <img src={users[attendeeId].photoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white font-bold">
                      {users[attendeeId]?.name?.charAt(0) || '?'}
                    </span>
                  )}
                  <span className="text-sm text-slate-300 font-medium">{users[attendeeId]?.name || attendeeId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
            <AlignLeft className="w-5 h-5 text-slate-500" />
            <h3>Notes</h3>
          </div>
          <div className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 min-h-[100px]">
            {meeting.notesRaw || <span className="text-slate-500 italic">No notes provided.</span>}
          </div>
        </div>

        {meeting.actionPoints && meeting.actionPoints.length > 0 && (
          <div>
            <h3 className="text-slate-200 font-semibold mb-3">Action Points</h3>
            <ul className="list-disc pl-5 space-y-1">
              {meeting.actionPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-slate-300">{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
