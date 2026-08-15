import { coreIdentity, groqAdapter, ollamaAdapter, geminiAdapter } from "./src/ai/prompts/adapters.js";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

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

  
  app.post("/api/tts", async (req, res) => {
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
      if (e.status === 429 || e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED")) {
        console.warn("TTS Quota exceeded. Using client fallback.");
      } else {
        console.warn("TTS Error. Using client fallback.", e.message);
      }
      res.status(200).json({ fallback: true });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, tools, systemInstruction } = req.body;
      
      const mapTypes = (params, toUpper) => {
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

      const groqApiKey = process.env.GROQ_API_KEY;
      const ollamaUrl = process.env.OLLAMA_API_URL;
      const geminiApiKey = process.env.GEMINI_API_KEY;

      // Prefer Groq / Ollama as requested
      if (groqApiKey || ollamaUrl) {
        try {
          const openai = new OpenAI({
            apiKey: groqApiKey || "ollama",
            baseURL: groqApiKey ? "https://api.groq.com/openai/v1" : (ollamaUrl || "http://localhost:11434/v1")
          });

          const groqTools = tools?.[0]?.functionDeclarations?.map((f: any) => ({
            type: "function",
            function: {
              name: f.name,
              description: f.description,
              parameters: mapTypes(f.parameters, false)
            }
          }));

          const groqMessages: any[] = [];
          if (systemInstruction) {
            const baseText = typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || "");
            const isOllama = !groqApiKey && !!ollamaUrl;
            const adapter = isOllama ? ollamaAdapter : groqAdapter;
            const fullSystemPrompt = coreIdentity + "\n" + adapter + "\n\n--- Context ---\n" + baseText;
            groqMessages.push({ role: 'system', content: fullSystemPrompt });
          }

          for (const msg of messages) {
            const role = msg.role === 'model' ? 'assistant' : msg.role;
            if (msg.parts[0].text) {
              groqMessages.push({ role, content: msg.parts[0].text });
            } else if (msg.parts[0].functionResponse) {
              groqMessages.push({
                role: 'tool',
                tool_call_id: msg.parts[0].functionResponse.id,
                name: msg.parts[0].functionResponse.name,
                content: JSON.stringify(msg.parts[0].functionResponse.response)
              });
            } else if (msg.parts[0].functionCall) {
              groqMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: msg.parts.map((p: any) => ({
                  id: p.functionCall.id,
                  type: 'function',
                  function: {
                    name: p.functionCall.name,
                    arguments: JSON.stringify(p.functionCall.args)
                  }
                }))
              });
            }
          }

          const modelName = groqApiKey ? "llama-3.3-70b-versatile" : "llama3.2"; // Groq or Ollama model
          
          const completion = await openai.chat.completions.create({
            model: modelName,
            messages: groqMessages,
            tools: groqTools?.length ? groqTools : undefined,
            tool_choice: groqTools?.length ? 'auto' : undefined
          });

          const choice = completion.choices[0];
          let responseText = choice.message.content || "";
          let functionCalls: any[] = [];
          let responseParts: any[] = [];

          if (choice.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
              const tcAny = tc as any;
              const args = JSON.parse(tcAny.function.arguments || "{}");
              functionCalls.push({
                name: tcAny.function.name,
                args: args,
                id: tcAny.id
              });
              responseParts.push({
                functionCall: { name: tcAny.function.name, args: args, id: tcAny.id }
              });
            }
          }

          if (responseText) {
            responseParts.push({ text: responseText });
          }
          if (responseParts.length === 0) {
            responseParts.push({ text: "Done." });
          }

          return res.json({
            text: responseText,
            functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
            message: {
              role: 'model',
              parts: responseParts
            }
          });

        } catch (err: any) {
          console.warn("Groq/Ollama failed, falling back to Gemini", err.message);
        }
      }

      // Fallback to Gemini
      if (!geminiApiKey) {
        return res.status(500).json({ error: "No AI provider configured. Add GROQ_API_KEY, OLLAMA_API_URL or GEMINI_API_KEY." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const candidateModels = ["gemini-pro-latest", "gemini-3.1-pro-preview", "gemini-3.7-flash"];
      let lastError: any = null;
      let response = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: messages,
            config: {
              tools: tools?.map((t: any) => ({
                ...t,
                functionDeclarations: t.functionDeclarations?.map((f: any) => ({
                  ...f,
                  parameters: mapTypes(f.parameters, true)
                }))
              })),
              systemInstruction: systemInstruction ? {
                role: 'system',
                parts: [{ text: coreIdentity + "\n" + geminiAdapter + "\n\n--- Context ---\n" + (typeof systemInstruction === 'string' ? systemInstruction : (systemInstruction.parts?.[0]?.text || "")) }]
              } : undefined
            }
          });
          if (response) break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error("All AI models are currently busy.");
      }

      res.json({ 
        text: response.text, 
        functionCalls: response.functionCalls,
        message: response.candidates?.[0]?.content
      });
    } catch (error: any) {
      console.error("API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });


  // Handle Web Share Target
  app.post("/share-target", (req, res) => {
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
