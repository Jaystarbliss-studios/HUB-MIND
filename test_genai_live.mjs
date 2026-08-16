import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AQ.Ab8RN6JOlxQQsN_s73bCi6BDbifJ20H1v3dOptXYMNCcMhjFQA" });
async function run() {
  try {
    const session = await ai.live.connect({
      model: "gemini-2.0-flash-exp",
      callbacks: {
        onmessage: (msg) => console.log('msg'),
        onclose: () => console.log('closed'),
        onerror: (err) => console.error('error', err)
      }
    });
    console.log('connected');
  } catch(e) {
    console.error('Failed', e);
  }
}
run();
