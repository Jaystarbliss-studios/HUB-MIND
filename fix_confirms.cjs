const fs = require('fs');

function removeConfirm(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/if \(!.*?confirm\(.*?\) return;/g, '');
  content = content.replace(/alert\(.*?\);/g, 'console.log("alert removed");');
  fs.writeFileSync(file, content);
}

removeConfirm('src/pages/TaskDetail.tsx');
removeConfirm('src/pages/MeetingDetail.tsx');
removeConfirm('src/pages/AdminUsers.tsx');
