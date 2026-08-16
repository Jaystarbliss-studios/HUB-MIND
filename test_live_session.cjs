const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6JOlxQQsN_s73bCi6BDbifJ20H1v3dOptXYMNCcMhjFQA" });
(async () => {
  try {
    const liveSession = await ai.live.connect({ model: "gemini-3.1-flash-live-preview" });
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(liveSession));
    console.log(methods);
  } catch (e) {
    console.error(e);
  }
})();
