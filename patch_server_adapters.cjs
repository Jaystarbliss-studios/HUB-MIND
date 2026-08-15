const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importsToAdd = `import { coreIdentity, groqAdapter, ollamaAdapter, geminiAdapter } from "./src/ai/prompts/adapters.js";\n`;
if (!code.includes('adapters.js')) {
    code = importsToAdd + code;
}

// In the chat endpoint, we combine the systemInstruction
const originalSysInstr = `          if (systemInstruction) {
            groqMessages.push({ role: 'system', content: systemInstruction.parts[0].text });
          }`;
          
const groqSysInstr = `          if (systemInstruction) {
            const baseText = systemInstruction.parts[0].text;
            const isOllama = !groqApiKey && !!ollamaUrl;
            const adapter = isOllama ? ollamaAdapter : groqAdapter;
            const fullSystemPrompt = coreIdentity + "\\n" + adapter + "\\n\\n--- Context ---\\n" + baseText;
            groqMessages.push({ role: 'system', content: fullSystemPrompt });
          }`;
          
code = code.replace(originalSysInstr, groqSysInstr);

const originalGeminiSysInstr = `              systemInstruction: systemInstruction`;
const geminiSysInstr = `              systemInstruction: systemInstruction ? {
                role: 'system',
                parts: [{ text: coreIdentity + "\\n" + geminiAdapter + "\\n\\n--- Context ---\\n" + systemInstruction.parts[0].text }]
              } : undefined`;

code = code.replace(originalGeminiSysInstr, geminiSysInstr);

fs.writeFileSync('server.ts', code);
