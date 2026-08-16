const fs = require('fs');
let code = fs.readFileSync('src/firebaseConfig.ts', 'utf8');

code = code.replace(
  /\(firebaseConfig as any\)\.firestoreDatabaseId\);/g,
  "(firebaseConfig as any).firestoreDatabaseId || 'ai-studio-hubmind-4cac2024-c6eb-4208-80cf-928714dfd430');"
);

fs.writeFileSync('src/firebaseConfig.ts', code);
