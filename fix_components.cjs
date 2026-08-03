const fs = require('fs');

let tasksStr = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');
tasksStr = tasksStr.replace(/waiting_review/g, 'under_review');
fs.writeFileSync('src/pages/Tasks.tsx', tasksStr);

let taskDetailStr = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');
taskDetailStr = taskDetailStr.replace(/waiting_review/g, 'under_review');
fs.writeFileSync('src/pages/TaskDetail.tsx', taskDetailStr);

console.log('Fixed under_review');
