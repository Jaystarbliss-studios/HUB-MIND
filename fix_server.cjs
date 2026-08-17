const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const candidateModels = \["gemini-pro-latest", "gemini-3\.1-pro-preview", "gemini-3\.7-flash"\];/, 
'const candidateModels = ["gemini-3.6-flash", "gemini-3.1-flash", "gemini-3.7-flash", "gemini-3.1-pro-preview"];');

fs.writeFileSync('server.ts', code);
