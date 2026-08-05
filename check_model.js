const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "hello"
    });
    console.log("flash success");
  } catch (e) {
    console.error("flash error:", e.message);
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: "hello"
    });
    console.log("pro success");
  } catch (e) {
    console.error("pro error:", e.message);
  }
}
run();
