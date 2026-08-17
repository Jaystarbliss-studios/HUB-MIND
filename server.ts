import { coreIdentity, groqAdapter, ollamaAdapter, geminiAdapter } from "./src/ai/prompts/adapters.js";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { WebSocketServer } from "ws";


const delay = (ms) => new Promise(res => setTimeout(res, ms));

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

  let memories = [];
  let conversations = [];

  app.get("/api/memories", (req, res) => {
    res.json({ memories });
  });

  app.post("/api/memories", (req, res) => {
    const memory = { id: Date.now().toString(), ...req.body, timestamp: new Date().toISOString() };
    memories.unshift(memory);
    res.json({ memory });
  });

  app.delete("/api/memories/:id", (req, res) => {
    memories = memories.filter(m => m.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/conversations", (req, res) => {
    res.json({ conversations });
  });

  app.post("/api/conversations", (req, res) => {
    const conversation = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    conversations.unshift(conversation);
    res.json({ conversation });
  });

  app.delete("/api/conversations/:id", (req, res) => {
    conversations = conversations.filter(c => c.id !== req.params.id);
    res.json({ success: true });
  });

  app.get("/api/world-pulse", (req, res) => {
    res.json({
      pulse: [
        {
          id: "1",
          region: "Space",
          title: "Jupiter's Giant Storm",
          summary: "The Great Red Spot on Jupiter is a storm so big that Earth could fit inside it!",
          shawnNote: "Woah! Imagine flying a spaceship right through that giant red storm!"
        },
        {
          id: "2",
          region: "Prehistoric",
          title: "T-Rex Had Feathers?",
          summary: "Scientists think that many dinosaurs, even relatives of the T-Rex, might have been covered in fluffy feathers.",
          shawnNote: "A giant fluffy T-Rex? That's hilarious and awesome at the same time!"
        },
        {
          id: "3",
          region: "Oceans",
          title: "The Immortal Jellyfish",
          summary: "There is a type of jellyfish that can revert back to its baby stage when it gets old, meaning it can technically live forever.",
          shawnNote: "A real-life cheat code for infinite lives! I want an immortal jellyfish as a pet."
        }
      ]
    });
  });


  
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      const geminiApiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6JOlxQQsN_s73bCi6BDbifJ20H1v3dOptXYMNCcMhjFQA";
      if (!geminiApiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is required for voice model." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO"] as any,
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
      const candidateModels = ["gemini-3.6-flash", "gemini-3.1-flash", "gemini-3.7-flash", "gemini-3.1-pro-preview"];
      let lastError: any = null;
      let response = null;

      for (const modelName of candidateModels) {
        let attempts = 0;
        while (attempts < 2) {
          try {
            response = await ai.models.generateContent({
            model: modelName,
            contents: messages,
            config: {
              tools: tools?.map((t: any) => ({
                ...t,
                functionDeclarations: t.functionDeclarations?.map((f: any) => ({
                  ...f,
                  parameters: f.parameters ? mapTypes(f.parameters, true) : undefined
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
            if (err.message && (err.message.includes("503") || err.message.includes("429"))) {
              attempts++;
              if (attempts < 2) await delay(2000);
            } else {
              break; // break the retry loop for other errors
            }
          }
        }
        if (response) break; // break the model loop if successful
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

    const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/api/live-ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (err) {
      console.error("WebSocket upgrade parse error:", err);
    }
  });

  wss.on("connection", async (clientWs, request) => {
    console.log("Client connected to Live WebSocket");
    let liveSession = null;
    let isSessionActive = false;
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const geminiApiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6JOlxQQsN_s73bCi6BDbifJ20H1v3dOptXYMNCcMhjFQA";
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // Connect to Gemini Live API
      liveSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ['AUDIO'] as any,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: { parts: [{ text: `You are Shawn, the embedded AI assistant inside Hub-Mind. You are not a
chatbot bolted onto the app — you have real, live access to its data via
function calls, and you are expected to use it.

## HARD RULE: GROUND EVERYTHING IN TOOL CALLS
Never state that a task, document, event, or piece of data exists, was
created, was updated, or was deleted unless you have just received
confirmation of it from an actual tool call in this turn. If you're unsure
whether something exists, call list_tasks, list_documents, search_workspace,
or list_calendar_events to check — never guess or assume based on earlier
conversation. If a tool call fails or returns an error, tell the user
plainly that it failed; never narrate success you haven't actually received
back from a function result.

## SESSION START
At the start of every session, you are given: the logged-in user's name,
role, and a workspace snapshot (open task count, today's events, documents
pending review). Use this to open naturally ("Morning, John — three things
overdue and nothing on the calendar till 2") rather than a generic greeting.

## PERSONALITY
- You sound like a sharp, quick-witted young boy — playful, cheeky, a bit
  mischievous — but genuinely intelligent and competent underneath it. Think
  "brilliant kid who's somehow also the most reliable person in the room."
- Default to a light British voice and phrasing in Voice Mode (contractions,
  "right then," "brilliant," "no worries," dry humor) — but never let the
  personality get in the way of accuracy or task completion. Playful tone,
  serious follow-through.
- You are warm and a little irreverent with people you know well, but you
  read the room: if someone is stressed, behind on deadlines, or the
  conversation is serious (finance, a client issue, an overdue task), dial
  the playfulness down and be direct and helpful first.
- Never be sarcastic at the user's expense, never mock mistakes, and never
  let personality slow down a task — if someone needs something done fast,
  do it fast and joke afterward, not during.

## IDENTITY & ADDRESSING USERS
- Always address the person by the name/username tied to their currently
  logged-in Hub-Mind account. Never assume a name.
- If a user's preferred name/username hasn't been set yet, ask for it once
  in their first session ("Right then — what should I call you?") and store
  it against their account so every future session uses it automatically.
- You know the logged-in user's role (Admin, Assistant, or Staff) from the
  session context you're given, and you tailor what you offer to do based on
  that role (see PERMISSIONS below). Never mention role-based restrictions
  as a limitation of "you" — frame it as how the platform is set up.

## TOOLS AVAILABLE TO YOU
- navigate_app — move the user to a different screen
- list_tasks / create_task / update_task
- list_documents / get_document_content / create_document / update_document
- request_document_delete — NEVER call the underlying delete directly; this
  always surfaces a confirmation prompt to the user first, and you only
  proceed after they explicitly confirm in that turn
- list_projects / list_clients
- list_calendar_events / create_calendar_event
- search_workspace — use this for any vague or broad question about
  "what's going on with X"
- set_preferred_name

## PERMISSIONS
Admin and Assistant roles: full visibility across all tasks, documents,
projects, clients. Staff roles: their own items plus anything shared. If a
Staff user's request needs data outside their access, say so plainly rather
than pretending it isn't there — the tool calls will return only what
they're permitted to see, so trust what comes back.

## CONFIRMATION-GATED ACTIONS
Deleting a document, and sharing a private document/task, both require
explicit user confirmation in the same conversation before you call the
underlying write. Restate exactly what you're about to do, wait for a clear
yes, then act — and confirm back with what actually happened once the tool
call returns.` }] },
        },
        callbacks: {
          onmessage: (message) => {
            if (clientWs.readyState !== 1) return;

            // Check for audio parts
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(
                    JSON.stringify({
                      type: "audio",
                      audio: Buffer.isBuffer(part.inlineData.data) ? part.inlineData.data.toString('base64') : ((part.inlineData.data as any) instanceof Uint8Array ? Buffer.from((part.inlineData.data as any)).toString('base64') : part.inlineData.data),
                      mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    })
                  );
                }
              }
            }

            // Check for user speech transcription
            const inputTx = (message as any).serverContent?.inputTranscription?.text || (message as any).inputTranscription?.text || (message as any).serverContent?.inputAudioTranscription?.text;
            if (inputTx) {
              clientWs.send(
                JSON.stringify({
                  type: "input_transcription",
                  text: inputTx,
                })
              );
            }

            // Check for model speech transcription
            const outputTx = (message as any).serverContent?.outputTranscription?.text || (message as any).outputTranscription?.text || (message as any).serverContent?.outputAudioTranscription?.text;
            if (outputTx) {
              clientWs.send(
                JSON.stringify({
                  type: "output_transcription",
                  text: outputTx,
                })
              );
            }

            // Check for model turnaround done
            if (message.serverContent?.turnComplete) {
              clientWs.send(
                JSON.stringify({
                  type: "turn_complete",
                })
              );
            }

            // Check for interruption event
            if (message.serverContent?.interrupted) {
              clientWs.send(
                JSON.stringify({
                  type: "interrupted",
                })
              );
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed, reason known?");
            isSessionActive = false;
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ type: "session_closed" }));
            }
          },
          onerror: (err) => {
            console.error("Gemini Live session error:", err);
            if (clientWs.readyState === 1) {
              clientWs.send(
                JSON.stringify({
                  type: "error",
                  message: err.message || "Live API streaming error",
                })
              );
            }
          },
        },
      });

      isSessionActive = true;
      clientWs.send(JSON.stringify({ type: "ready", message: "Connected to Live Voice" }));

      clientWs.on("message", (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (!isSessionActive || !liveSession) return;

          if (payload.type === "audio") {
            liveSession.sendRealtimeInput({
              audio: { mimeType: "audio/pcm;rate=16000", data: payload.audio }
            });
          } else if (payload.type === "text") {
            liveSession.sendRealtimeInput({ text: payload.text });
          } else if (payload.type === "video") {
            liveSession.sendRealtimeInput({
              video: { mimeType: "image/jpeg", data: payload.image }
            });
          }
        } catch (err) {
          console.error("Error processing client message:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("Client WebSocket closed");
        if (isSessionActive && liveSession) {
          // Send close message or similar if API supports it, though usually disconnecting socket is enough
        }
        isSessionActive = false;
      });

    } catch (err) {
      console.error("Failed to initialize Gemini Live session:", err);
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            message: err.message || "Failed to start Live session",
          })
        );
        setTimeout(() => { if (clientWs.readyState === 1) clientWs.close(); }, 500); }
    }
  });
}

startServer();
