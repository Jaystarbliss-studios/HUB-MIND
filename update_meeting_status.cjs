const fs = require('fs');
let content = fs.readFileSync('src/pages/MeetingDetail.tsx', 'utf8');

// Ensure updateDoc is imported
if (!content.includes('updateDoc')) {
  content = content.replace(/getDoc,\s*deleteDoc/, 'getDoc, deleteDoc, updateDoc');
}

// Add state for isUpdating
content = content.replace(
  /const \[isDeleting, setIsDeleting\] = useState\(false\);/,
  "const [isDeleting, setIsDeleting] = useState(false);\n  const [isUpdating, setIsUpdating] = useState(false);"
);

// Add handleStatusChange
const handleStatusStr = `
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!id || !meeting) return;
    setIsUpdating(true);
    try {
      const newStatus = e.target.value as any;
      await updateDoc(doc(db, 'meetings', id), {
        status: newStatus
      });
      setMeeting({ ...meeting, status: newStatus });
    } catch (error) {
      console.error("Error updating meeting status:", error);
    } finally {
      setIsUpdating(false);
    }
  };
`;

content = content.replace(
  /const handleDelete = async \(\) => \{/,
  handleStatusStr + '\n  const handleDelete = async () => {'
);

// Add dropdown UI
const selectDropdown = `
          <select
            value={meeting.status || 'scheduled'}
            onChange={handleStatusChange}
            disabled={isUpdating}
            className={\`px-4 py-2 rounded-lg font-semibold transition-colors text-sm border focus:outline-none focus:ring-2 focus:ring-accent \${
              meeting.status === 'in_session'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : meeting.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : meeting.status === 'canceled'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : meeting.status === 'rescheduled'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }\`}
          >
            <option value="scheduled">Scheduled</option>
            <option value="in_session">In Session</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
`;

content = content.replace(
  /\{true && \(/,
  selectDropdown + '\n          {true && ('
);

// Add status label below title
const statusBadge = `
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={\`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider \${
              meeting.status === 'in_session' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              meeting.status === 'canceled' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              meeting.status === 'rescheduled' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }\`}>
              {(meeting.status || 'scheduled').replace('_', ' ')}
            </span>
          </div>
`;

content = content.replace(
  /<h1 className="text-3xl font-bold text-white tracking-tight">\{meeting.notesRaw\?\.split\('([^']+)'\)\[0\] \|\| 'Untitled Meeting'\}<\/h1>/,
  statusBadge + '\n          <h1 className="text-3xl font-bold text-white tracking-tight">{meeting.notesRaw?.split(\'\\n\')[0] || \'Untitled Meeting\'}</h1>'
);


fs.writeFileSync('src/pages/MeetingDetail.tsx', content);
console.log('Updated MeetingDetail.tsx');
