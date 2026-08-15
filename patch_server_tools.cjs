const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const mapTypeCode = `
      const mapTypes = (params, toUpper) => {
        if (!params) return params;
        const newParams = { ...params };
        if (newParams.type) {
           newParams.type = toUpper ? newParams.type.toUpperCase() : newParams.type.toLowerCase();
        }
        if (newParams.properties) {
           newParams.properties = {};
           for (const k in params.properties) {
              newParams.properties[k] = mapTypes(params.properties[k], toUpper);
           }
        }
        if (newParams.items) {
           newParams.items = mapTypes(params.items, toUpper);
        }
        return newParams;
      };
`;

const oldGroqTools = `          const groqTools = tools?.[0]?.functionDeclarations?.map((f: any) => ({
            type: "function",
            function: {
              name: f.name,
              description: f.description,
              parameters: f.parameters
            }
          }));`;

const newGroqTools = `          const groqTools = tools?.[0]?.functionDeclarations?.map((f: any) => ({
            type: "function",
            function: {
              name: f.name,
              description: f.description,
              parameters: mapTypes(f.parameters, false)
            }
          }));`;

const oldGeminiTools = `              tools: tools,`;

const newGeminiTools = `              tools: tools?.map((t: any) => ({
                ...t,
                functionDeclarations: t.functionDeclarations?.map((f: any) => ({
                  ...f,
                  parameters: mapTypes(f.parameters, true)
                }))
              })),`;

code = code.replace("const groqApiKey = process.env.GROQ_API_KEY;", mapTypeCode + "\n      const groqApiKey = process.env.GROQ_API_KEY;");
code = code.replace(oldGroqTools, newGroqTools);
code = code.replace(oldGeminiTools, newGeminiTools);

fs.writeFileSync('server.ts', code);
