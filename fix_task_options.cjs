const fs = require('fs');
let content = fs.readFileSync('src/pages/TaskDetail.tsx', 'utf8');

content = content.replace(
  /<option value="completed">Completed<\/option>\s*<option value="archived">Archived<\/option>/,
  `<>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </>`
);
fs.writeFileSync('src/pages/TaskDetail.tsx', content);
