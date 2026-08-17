const fs = require('fs');
let code = fs.readFileSync('src/lib/shawnTools.ts', 'utf8');

code = code.replace(/tasksSnap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\)/g, 'tasksSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))');
code = code.replace(/docsSnap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\)/g, 'docsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))');

fs.writeFileSync('src/lib/shawnTools.ts', code);
