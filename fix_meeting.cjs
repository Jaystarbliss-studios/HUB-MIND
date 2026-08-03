const fs = require('fs');
let code = fs.readFileSync('src/pages/MeetingDetail.tsx', 'utf8');

code = code.replace(
  /<li key=\{idx\} className="text-sm text-slate-300">\{point\}<\/li>/,
  '<li key={idx} className="text-sm text-slate-300">{typeof point === "string" ? point : point.text}</li>'
);

fs.writeFileSync('src/pages/MeetingDetail.tsx', code);
