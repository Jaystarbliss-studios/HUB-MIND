const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

// Add projectId to Meeting
content = content.replace(/export interface Meeting \{/, 'export interface Meeting {\n  projectId?: string;\n  decisions?: string[];\n  openQuestions?: string[];');

fs.writeFileSync('src/types.ts', content);
