import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
async function run() {
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash-exp",
    });
    console.log('connected');
    
  } catch(e) {
    console.error('Failed', e);
  }
}
run();
