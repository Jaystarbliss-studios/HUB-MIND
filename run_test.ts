import { GoogleGenAI } from "@google/genai";
import { SHAWN_TOOLS_DECLARATIONS } from './src/lib/shawnTools';

async function test() {
  const mapTypes = (params: any, toUpper: boolean) => {
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

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const tools = [{ functionDeclarations: SHAWN_TOOLS_DECLARATIONS }];
  
  try {
    const contents: any[] = [
      { role: 'user', parts: [{text: 'What is overdue right now?'}] }
    ];
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        tools: tools?.map((t: any) => ({
          ...t,
          functionDeclarations: t.functionDeclarations?.map((f: any) => ({
            ...f,
            parameters: f.parameters ? mapTypes(f.parameters, true) : undefined
          }))
        }))
      }
    });
    
    console.log("Model response:", JSON.stringify(response.candidates?.[0]?.content, null, 2));
    
    const nextContents = [
        ...contents,
        response.candidates?.[0]?.content,
        { role: 'user', parts: [{ functionResponse: { name: 'list_tasks', id: response.functionCalls?.[0]?.id, response: { tasks: [] } } }] }
    ];
    
    const response2 = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: nextContents,
      config: {
        tools: tools?.map((t: any) => ({
          ...t,
          functionDeclarations: t.functionDeclarations?.map((f: any) => ({
            ...f,
            parameters: f.parameters ? mapTypes(f.parameters, true) : undefined
          }))
        }))
      }
    });
    console.log("Success with gemini-3.6-flash", response2.text);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
test();
