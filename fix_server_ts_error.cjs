const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /audio: Buffer\.isBuffer\(part\.inlineData\.data\) \? part\.inlineData\.data\.toString\('base64'\) : \(part\.inlineData\.data instanceof Uint8Array \? Buffer\.from\(part\.inlineData\.data\)\.toString\('base64'\) : part\.inlineData\.data\)/g,
  "audio: Buffer.isBuffer(part.inlineData.data) ? part.inlineData.data.toString('base64') : ((part.inlineData.data as any) instanceof Uint8Array ? Buffer.from((part.inlineData.data as any)).toString('base64') : part.inlineData.data)"
);

fs.writeFileSync('server.ts', code);
