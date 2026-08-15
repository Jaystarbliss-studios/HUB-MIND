const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldGroq = `          if (systemInstruction) {
            const baseText = systemInstruction.parts[0].text;
            const isOllama = !groqApiKey && !!ollamaUrl;
            const adapter = isOllama ? ollamaAdapter : groqAdapter;
            const fullSystemPrompt = coreIdentity + "\\n" + adapter + "\\n\\n--- Context ---\\n" + baseText;
            groqMessages.push({ role: 'system', content: fullSystemPrompt });
          }`;

const newGroq = `          if (systemInstruction) {
            const baseText = typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || "");
            const isOllama = !groqApiKey && !!ollamaUrl;
            const adapter = isOllama ? ollamaAdapter : groqAdapter;
            const fullSystemPrompt = coreIdentity + "\\n" + adapter + "\\n\\n--- Context ---\\n" + baseText;
            groqMessages.push({ role: 'system', content: fullSystemPrompt });
          }`;

const oldGemini = `              systemInstruction: systemInstruction ? {
                role: 'system',
                parts: [{ text: coreIdentity + "\\n" + geminiAdapter + "\\n\\n--- Context ---\\n" + systemInstruction.parts[0].text }]
              } : undefined`;

const newGemini = `              systemInstruction: systemInstruction ? {
                role: 'system',
                parts: [{ text: coreIdentity + "\\n" + geminiAdapter + "\\n\\n--- Context ---\\n" + (typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || "")) }]
              } : undefined`;

code = code.replace(oldGroq, newGroq);
code = code.replace(oldGemini, newGemini);

fs.writeFileSync('server.ts', code);
