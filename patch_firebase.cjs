const fs = require('fs');
let code = fs.readFileSync('src/firebaseConfig.ts', 'utf8');

code = code.replace(
  /\(firebaseConfig as any\)\.firestoreDatabaseId \|\| 'ai-studio-hubmind[^']*'/g,
  "(firebaseConfig as any).firestoreDatabaseId"
);

fs.writeFileSync('src/firebaseConfig.ts', code);
