import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash-exp",
      config: {
         systemInstruction: { parts: [{text: "Hello"}] }
      }
    });
    console.log('connected');
    
    // Set up listeners after if connect returns session
  } catch(e) {
    console.error('Failed', e);
  }
}
run();
