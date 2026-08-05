import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/config", (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { messages, tools, systemInstruction } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: messages,
        config: {
          tools: tools,
          systemInstruction: systemInstruction
        }
      });

      res.json({ 
        text: response.text, 
        functionCalls: response.functionCalls,
        message: response.candidates?.[0]?.content
      });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });


  // Handle Web Share Target
  app.post("/share-target", (req, res) => {
    // In a real app we'd parse the multipart/form-data here using multer
    // and store it temporarily or upload to cloud storage.
    // For now, redirect to inbox where the user can see it
    res.redirect(303, '/inbox?shared=true');
  });

  // Vite middleware for development

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
