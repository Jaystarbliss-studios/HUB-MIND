const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Add Book to lucide-react imports
content = content.replace(/LayoutDashboard, Inbox, CheckSquare, Users, Calendar, Folder, Bell, Plus, Loader2, X/,
  "LayoutDashboard, Inbox, CheckSquare, Users, Calendar, Folder, Bell, Plus, Loader2, X, Book, Briefcase");

// Update navItems
content = content.replace(/const navItems = \[[\s\S]*?\];/,
  `const navItems = [
  { to: '/', label: 'Today', icon: LayoutDashboard },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/documents', label: 'Documents', icon: Folder },
  { to: '/knowledge', label: 'Knowledge', icon: Book },
];`);

// Mobile nav bar should show the first 5... actually I should update it to slice(0, 5) but maybe it's fine
fs.writeFileSync('src/components/Layout.tsx', content);
