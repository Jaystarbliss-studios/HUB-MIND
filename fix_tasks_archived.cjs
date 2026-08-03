const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  /const filteredTasks = tasks\.filter\(t => \{[\s\S]*?return true;\n  \}\);/,
  `const filteredTasks = tasks.filter(t => {
    if (filter === 'active' && (t.status === 'completed' || t.status === 'archived')) return false;
    if (filter === 'completed' && t.status !== 'completed') return false;
    if (filter === 'archived' && t.status !== 'archived') return false;
    if (filter === 'all' && t.status === 'archived') return false; // Hide archived from 'All Tasks' by default
    
    if (searchQuery && !(t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) && !(t.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });`
);

content = content.replace(
  /<option value="completed">Completed<\/option>/,
  '<option value="completed">Completed</option>\n            <option value="archived">Archived</option>'
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks.tsx filter');
