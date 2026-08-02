const fs = require('fs');

let taskDetail = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');
taskDetail = taskDetail.replace(/navigate\(-1\)/g, "navigate('/tasks')");
fs.writeFileSync('src/pages/TaskDetail.tsx', taskDetail);

let meetingDetail = fs.readFileSync('src/pages/MeetingDetail.tsx', 'utf8');
meetingDetail = meetingDetail.replace(/navigate\(-1\)/g, "navigate('/calendar')");
fs.writeFileSync('src/pages/MeetingDetail.tsx', meetingDetail);

console.log('Fixed navigate');
