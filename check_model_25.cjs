const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: "hello"
    });
    console.log("gemini-2.5-pro success");
  } catch (e) {
    console.error("gemini-2.5-pro error:", e.message);
  }
}
run();
