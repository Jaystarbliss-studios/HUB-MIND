const fs = require('fs');
let content = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');

// Replace the toggleStatus function with handleStatusChange
content = content.replace(
  /const toggleStatus = async \(\) => \{[\s\S]*?\};\n/,
  `const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!id || !task) return;
    setIsUpdating(true);
    try {
      const newStatus = e.target.value as any;
      await updateDoc(doc(db, 'tasks', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setTask({ ...task, status: newStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
    } finally {
      setIsUpdating(false);
    }
  };\n`
);

// Replace the button with a select dropdown
const buttonRegex = /<button\s+onClick=\{toggleStatus\}[\s\S]*?<\/button>/;
const selectDropdown = `
          <select
            value={task.status}
            onChange={handleStatusChange}
            disabled={isUpdating}
            className={\`px-4 py-2 rounded-lg font-semibold transition-colors text-sm border focus:outline-none focus:ring-2 focus:ring-accent \${
              task.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : task.status === 'under_review'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : task.status === 'in_progress'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }\`}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="under_review">Under Review</option>
            {(profile?.role === 'admin' || profile?.role === 'assistant') && (
              <option value="completed">Completed</option>
            )}
          </select>
`;

content = content.replace(buttonRegex, selectDropdown);
fs.writeFileSync('src/pages/TaskDetail.tsx', content);
console.log('Updated TaskDetail.tsx');
