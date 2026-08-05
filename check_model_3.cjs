const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: "hello"
    });
    console.log("gemini-3-pro-preview success");
  } catch (e) {
    console.error("gemini-3-pro-preview error:", e.message);
  }
}
run();
