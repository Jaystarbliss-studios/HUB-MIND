const fs = require('fs');
const md = fs.readFileSync('src/ai/prompts/master.md', 'utf8');

// We'll split the master prompt to extract specific parts if needed, 
// or just export the whole thing as master.
const tsCode = `export const masterPrompt = \`\n${md.replace(/`/g, '\\`')}\n\`;\n`;
fs.writeFileSync('src/ai/prompts/master.ts', tsCode);
fs.unlinkSync('src/ai/prompts/master.md');
