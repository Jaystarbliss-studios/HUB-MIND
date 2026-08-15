const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ttsRoute = `  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is required for voice model." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        res.json({ audio: base64Audio });
      } else {
        res.status(500).json({ error: "No audio generated." });
      }
    } catch (e: any) {
      console.error("TTS Error:", e);
      res.status(500).json({ error: e.message || "Failed to generate speech." });
    }
  });`;

// We need to replace the old TTS route with the new one.
// Let's just find where it starts and ends
const oldStart = '  app.post("/api/tts", async (req, res) => {';
const oldEnd = '  app.post("/api/chat", async (req, res) => {';

const prefix = code.substring(0, code.indexOf(oldStart));
const suffix = code.substring(code.indexOf(oldEnd));

code = prefix + ttsRoute + '\n\n' + suffix;

fs.writeFileSync('server.ts', code);
