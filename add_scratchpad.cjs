const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Imports
content = content.replace(/import \{ CheckCircle2, Clock, Calendar as CalendarIcon, FileText, Loader2, Bell, Users, Inbox, Activity \} from 'lucide-react';/,
  "import { CheckCircle2, Clock, Calendar as CalendarIcon, FileText, Loader2, Bell, Users, Inbox, Activity, Check } from 'lucide-react';\nimport { setDoc, doc, getDoc } from 'firebase/firestore';");

// States
content = content.replace(/const \[recentActivity, setRecentActivity\] = useState<ActivityLog\[\]>\(\[\]\);/,
  `const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);`);

// Fetch notes
const fetchNotes = `
        // Fetch Quick Notes
        const notesDoc = await getDoc(doc(db, 'users', profile.id, 'private', 'quickNotes'));
        if (notesDoc.exists()) {
          setNotes(notesDoc.data().content || '');
        }
`;
content = content.replace(/\/\/ Fetch Recent Activity/, fetchNotes + '\n        // Fetch Recent Activity');

// Save notes handler
const saveNotesFunc = `
  const handleSaveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    try {
      await setDoc(doc(db, 'users', profile.id, 'private', 'quickNotes'), {
        content: notes,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };
`;
content = content.replace(/if \(loading\)/, saveNotesFunc + '\n  if (loading)');

// UI
const scratchpadUI = `
      {/* Third row: Scratchpad & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8">
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Activity
            </h3>
            
            {recentActivity.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No recent activity recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(log => (
                  <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">
                        <span className="font-medium text-white">{log.userId}</span> {log.action} <span className="font-medium text-white">{log.details}</span>
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{log.entityType}</p>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {format(parseISO(log.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="md:col-span-4">
          <section className="h-full flex flex-col min-h-[300px]">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Personal Scratchpad
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-5 relative overflow-hidden flex-1"> 
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down quick thoughts here..."
                className="flex-1 w-full bg-transparent text-sm text-slate-300 leading-relaxed resize-none focus:outline-none"
              />
              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center shrink-0">
                 <button 
                   onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs text-slate-500 hover:text-accent flex items-center gap-1 transition-colors"
                 >
                   {savingNotes ? 'Saving...' : saveSuccess ? <><Check className="w-4 h-4 text-emerald-500" /> Saved!</> : <><span className="text-lg leading-none mb-0.5">+</span> Save note</>}
                 </button>
              </div>
            </div>
          </section>
        </div>
      </div>
`;

content = content.replace(/\{\/\* Recent Activity \*\/\}.*?<\/section>/s, scratchpadUI);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
