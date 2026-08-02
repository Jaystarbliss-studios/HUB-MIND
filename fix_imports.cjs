const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');
content = content.replace(/import \{ LayoutDashboard, CheckSquare, Users, Calendar, Folder, Bell, LogOut, Settings, Inbox, Plus, X, Brain \} from 'lucide-react';/,
  "import { LayoutDashboard, CheckSquare, Users, Calendar, Folder, Bell, LogOut, Settings, Inbox, Plus, X, Brain, Book, Briefcase } from 'lucide-react';");

fs.writeFileSync('src/components/Layout.tsx', content);
