const fs = require('fs');

function fixDeleteBtn(filename) {
  let content = fs.readFileSync(filename, 'utf8');
  content = content.replace(/\{\(profile\?\.role === 'admin' \|\| profile\?\.role === 'assistant'\) && \(/, "{true && (");
  fs.writeFileSync(filename, content);
}

fixDeleteBtn('src/pages/TaskDetail.tsx');
fixDeleteBtn('src/pages/MeetingDetail.tsx');

console.log('Fixed delete visibility');
