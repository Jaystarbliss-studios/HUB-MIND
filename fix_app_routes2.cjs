const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("import { Tasks } from './pages/Tasks';", "import { Tasks } from './pages/Tasks';\nimport { TaskDetail } from './pages/TaskDetail';\nimport { MeetingDetail } from './pages/MeetingDetail';");

content = content.replace(
  /<Route path="tasks\/:id" element=\{<div className="p-6">Task Detail \(Coming Soon\)<\/div>\} \/>/,
  '<Route path="tasks/:id" element={<TaskDetail />} />'
);

content = content.replace(
  /<Route path="meetings\/:id" element=\{<div className="p-6">Meeting Detail \(Coming Soon\)<\/div>\} \/>/,
  '<Route path="meetings/:id" element={<MeetingDetail />} />'
);

fs.writeFileSync('src/App.tsx', content);
