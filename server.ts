import { coreIdentity, groqAdapter, ollamaAdapter, geminiAdapter } from "./src/ai/prompts/adapters";
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

      // Primary Gemini models (gemini-3.5-flash for general, gemini-3.1-pro-preview for complex, gemini-3.1-flash-lite for fast)
      const requestedModel = req.body.model;
      const candidateModels = requestedModel
        ? [requestedModel, "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"]
        : ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];
      
      let lastError: any = null;
      let response = null;

      if (!geminiApiKey) {
        return res.status(500).json({ error: "No AI provider configured. Add GROQ_API_KEY, OLLAMA_API_URL or GEMINI_API_KEY." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Prepare tools with support for function declarations, Google Search, and Google Maps grounding
      const geminiTools: any[] = [];
      const hasSearchGrounding = req.body.useSearch || req.body.searchGrounding;
      const hasMapsGrounding = req.body.useMaps || req.body.mapsGrounding;

      if (hasSearchGrounding) {
        geminiTools.push({ googleSearch: {} });
      }
      if (hasMapsGrounding) {
        geminiTools.push({ googleMaps: {} });
      }

      if (tools && tools.length > 0) {
        for (const t of tools) {
          if (t.functionDeclarations) {
            geminiTools.push({
              functionDeclarations: t.functionDeclarations.map((f: any) => ({
                ...f,
                parameters: f.parameters ? mapTypes(f.parameters, true) : undefined,
              })),
            });
          } else if (t.googleSearch) {
            if (!geminiTools.some((gt) => gt.googleSearch)) geminiTools.push(t);
          } else if (t.googleMaps) {
            if (!geminiTools.some((gt) => gt.googleMaps)) geminiTools.push(t);
          }
        }
      }

      const hasBuiltInTools = geminiTools.some((t) => t.googleSearch || t.googleMaps);
      const hasFunctionTools = geminiTools.some((t) => t.functionDeclarations);
      const toolConfig: any = {};
      if (hasBuiltInTools && hasFunctionTools) {
        toolConfig.includeServerSideToolInvocations = true;
      }
      if (req.body.location && hasMapsGrounding) {
        toolConfig.retrievalConfig = {
          latLng: {
            latitude: req.body.location.latitude || req.body.location.lat,
            longitude: req.body.location.longitude || req.body.location.lng,
          },
        };
      }

      for (const modelName of candidateModels) {
        let attempts = 0;
        while (attempts < 2) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: messages,
              config: {
                tools: geminiTools.length > 0 ? geminiTools : undefined,
                toolConfig: Object.keys(toolConfig).length > 0 ? toolConfig : undefined,
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

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      res.json({ 
        text: response.text, 
        functionCalls: response.functionCalls,
        message: response.candidates?.[0]?.content,
        groundingChunks: groundingMetadata?.groundingChunks,
        webSearchQueries: groundingMetadata?.webSearchQueries,
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

  // Heartbeat ping interval to keep connection alive through proxies
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (e) {}
    });
  }, 20000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  server.on("upgrade", (request, socket, head) => {
    socket.on("error", (err) => {
      console.warn("WebSocket socket connection error:", err.message);
    });

    try {
      const host = request.headers.host || "localhost:3000";
      const url = new URL(request.url || "", `http://${host}`);
      const cleanPath = url.pathname.replace(/\/+$/, "");

      if (
        cleanPath === "/api/live-ws" ||
        cleanPath === "/live-ws" ||
        cleanPath === "/live" ||
        cleanPath === "/api/ws" ||
        cleanPath.startsWith("/api/live-ws")
      ) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (err) {
      console.error("WebSocket upgrade parse error:", err);
    }
  });

  const LIVE_TOOLS = [
    {
      functionDeclarations: [
        {
          name: "create_calendar_event",
          description: "Schedule a Google Calendar event with an attached notification reminder. Use whenever the user asks to schedule an event, set a calendar reminder, or set a reminder alarm.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Title or summary of the event/reminder" },
              startDateTime: { type: "STRING", description: "ISO 8601 start date-time (e.g. 2026-08-17T14:30:00Z)" },
              endDateTime: { type: "STRING", description: "ISO 8601 end date-time (optional)" },
              reminderMinutes: { type: "NUMBER", description: "Minutes before event for notification (e.g. 10 or 15)" },
              description: { type: "STRING", description: "Optional description or notes" },
            },
            required: ["title", "startDateTime"],
          },
        },
        {
          name: "list_calendar_events",
          description: "List upcoming Google Calendar events.",
          parameters: {
            type: "OBJECT",
            properties: {
              timeMin: { type: "STRING", description: "ISO 8601 start boundary" },
              timeMax: { type: "STRING", description: "ISO 8601 end boundary" },
            },
          },
        },
        {
          name: "create_task",
          description: "Create a new operational task in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Task title" },
              description: { type: "STRING", description: "Task description or checklist" },
              priority: { type: "STRING", description: "Task priority: urgent, high, medium, low" },
              deadline: { type: "STRING", description: "Deadline date string" },
              assignedTo: { type: "STRING", description: "Assignee name or user ID" },
            },
            required: ["title"],
          },
        },
        {
          name: "update_task",
          description: "Update an existing operational task in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              taskId: { type: "STRING", description: "The ID of the task to update" },
              title: { type: "STRING", description: "Task title" },
              description: { type: "STRING", description: "Task description" },
              priority: { type: "STRING", description: "Task priority: urgent, high, medium, low" },
              status: { type: "STRING", description: "Task status: pending, in-progress, completed" },
              deadline: { type: "STRING", description: "Deadline date string" },
            },
            required: ["taskId"],
          },
        },
        {
          name: "list_tasks",
          description: "List operational tasks in Hub-Mind. Filter by status or priority.",
          parameters: {
            type: "OBJECT",
            properties: {
              status: { type: "STRING", description: "Filter: pending, in-progress, or completed" },
              priority: { type: "STRING", description: "Filter: urgent, high, medium, or low" },
            },
          },
        },
        {
          name: "create_document",
          description: "Create a new document in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Document title" },
              content: { type: "STRING", description: "Initial HTML or text content of the document" },
            },
            required: ["title"],
          },
        },
        {
          name: "update_document",
          description: "Update an existing document in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              documentId: { type: "STRING", description: "The ID of the document to update" },
              title: { type: "STRING", description: "New document title" },
              content: { type: "STRING", description: "Updated content" },
            },
            required: ["documentId"],
          },
        },
        {
          name: "list_documents",
          description: "List documents in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              limit: { type: "NUMBER", description: "Number of documents to return (max 20)" },
            },
          },
        },
        {
          name: "get_document_content",
          description: "Get full text content of a specific document.",
          parameters: {
            type: "OBJECT",
            properties: {
              documentId: { type: "STRING", description: "Document ID" },
            },
            required: ["documentId"],
          },
        },
        {
          name: "request_document_delete",
          description: "Request confirmation to delete a document in Hub-Mind.",
          parameters: {
            type: "OBJECT",
            properties: {
              documentId: { type: "STRING", description: "Document ID to delete" },
              documentTitle: { type: "STRING", description: "Title of the document" },
              confirmed: { type: "BOOLEAN", description: "Must be true if user explicitly confirmed" },
            },
            required: ["documentId", "documentTitle"],
          },
        },
        {
          name: "navigate_app",
          description: "Navigate user to a specific section or tab in Hub-Mind (e.g. /tasks, /calendar, /documents).",
          parameters: {
            type: "OBJECT",
            properties: {
              path: { type: "STRING", description: "Path: /, /tasks, /projects, /knowledge, /clients, /calendar, /documents, /admin" },
            },
            required: ["path"],
          },
        },
        {
          name: "get_workspace_overview",
          description: "Get an overview summary of active tasks, recent documents, and workspace state.",
          parameters: {
            type: "OBJECT",
            properties: {},
          },
        },
        {
          name: "search_workspace",
          description: "Search across tasks and documents using a keyword query.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "Search term" },
            },
            required: ["query"],
          },
        },
        {
          name: "set_preferred_name",
          description: "Update the user's preferred name so Shawn addresses them by this name.",
          parameters: {
            type: "OBJECT",
            properties: {
              preferredName: { type: "STRING", description: "The name the user wishes to be called" },
            },
            required: ["preferredName"],
          },
        },
,
        {
          name: "create_follow_up",
          description: "Create a tracked follow-up for a person, client, payment, proposal, response, promise or other pending action.",
          parameters: { type: "OBJECT", properties: { title: {type:"STRING"}, person:{type:"STRING"}, reason:{type:"STRING"}, dueAt:{type:"STRING"}, priority:{type:"STRING", enum:["urgent","high","medium","low"]}}, required:["title","dueAt"] }
        },
        {
          name: "list_follow_ups",
          description: "List active follow-ups and their due dates/statuses.",
          parameters: { type: "OBJECT", properties: { status:{type:"STRING"}, limit:{type:"NUMBER"} } }
        },
        {
          name: "open_document",
          description: "Open a document in the Hub-Mind editor.",
          parameters: { type: "OBJECT", properties: { documentId:{type:"STRING"}, documentTitle:{type:"STRING"} } }
        },
        {
          name: "edit_document_live",
          description: "Open a document and stream approved edits into the visible editor.",
          parameters: { type: "OBJECT", properties: { documentId:{type:"STRING"}, documentTitle:{type:"STRING"}, contentToInsert:{type:"STRING"}, summary:{type:"STRING"}, mode:{type:"STRING", enum:["append","prepend","replace"]} }, required:["contentToInsert"] }
        },
        {
          name: "background_edit_document",
          description: "Apply a document edit in the background while the user continues chatting.",
          parameters: { type: "OBJECT", properties: { documentId:{type:"STRING"}, documentTitle:{type:"STRING"}, contentToInsertOrUpdate:{type:"STRING"}, taskDescription:{type:"STRING"} }, required:["documentId","contentToInsertOrUpdate"] }
        },
        {
          name: "get_user_profile",
          description: "Get the active Hub-Mind user profile, role and permissions.",
          parameters: { type: "OBJECT", properties: {} }
        },
        {
          name: "request_share_document",
          description: "Request confirmation before sharing a document.",
          parameters: { type: "OBJECT", properties: { documentId:{type:"STRING"}, documentTitle:{type:"STRING"}, recipient:{type:"STRING"}, confirmed:{type:"BOOLEAN"} }, required:["documentId","documentTitle"] }
        },
        {
          name: "list_projects",
          description: "List active Hub-Mind projects.",
          parameters: { type: "OBJECT", properties: {} }
        },
        {
          name: "list_clients",
          description: "List active Hub-Mind clients.",
          parameters: { type: "OBJECT", properties: {} }
        }      ],
    },
  ];

  const SHAWN_PROMPT_INSTRUCTION = `You are Shawn, the embedded AI assistant inside Hub-Mind. You are not a
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
pending review). Use this to open naturally ("Morning! Three things
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
call returns.`;

  wss.on("connection", async (clientWs: any, request) => {
    console.log("Client connected to Live WebSocket");
    clientWs.isAlive = true;

    clientWs.on("pong", () => {
      clientWs.isAlive = true;
    });

    let liveSession: any = null;
    let isSessionActive = false;
    let isFallbackMode = false;
    let conversationalHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    const geminiApiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6JOlxQQsN_s73bCi6BDbifJ20H1v3dOptXYMNCcMhjFQA";

    // Try connecting to Gemini Live API
    if (!geminiApiKey) {
      if (clientWs.readyState === 1) {
        clientWs.send(JSON.stringify({ type: "error", message: "Shawn Live is not configured. Add GEMINI_API_KEY to the server environment." }));
      }
      return;
    }

    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      try {
        liveSession = await ai.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
            tools: LIVE_TOOLS as any,
            systemInstruction: { parts: [{ text: SHAWN_PROMPT_INSTRUCTION }] },
          },
          callbacks: {
            onmessage: (message: any) => {
              if (clientWs.readyState !== 1) return;

              // Check for tool calls
              if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls || [];
                clientWs.send(
                  JSON.stringify({
                    type: "tool_call",
                    toolCall: message.toolCall,
                    functionCalls: functionCalls,
                    functionCall: functionCalls[0],
                  })
                );
              }

              // Check for audio parts
              const parts = message.serverContent?.modelTurn?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: "audio",
                        audio: Buffer.isBuffer(part.inlineData.data)
                          ? part.inlineData.data.toString("base64")
                          : (part.inlineData.data as any) instanceof Uint8Array
                          ? Buffer.from(part.inlineData.data as any).toString("base64")
                          : part.inlineData.data,
                        mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                      })
                    );
                  }
                }
              }

              // Check for user speech transcription
              const inputTx =
                (message as any).serverContent?.inputTranscription?.text ||
                (message as any).inputTranscription?.text ||
                (message as any).serverContent?.inputAudioTranscription?.text;
              if (inputTx) {
                clientWs.send(
                  JSON.stringify({
                    type: "input_transcription",
                    text: inputTx,
                  })
                );
              }

              // Check for model speech transcription
              const outputTx =
                (message as any).serverContent?.outputTranscription?.text ||
                (message as any).outputTranscription?.text ||
                (message as any).serverContent?.outputAudioTranscription?.text;
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
              console.log("Gemini Live upstream session closed");
              if (isSessionActive && !isFallbackMode) {
                isFallbackMode = true;
                console.log("Switching to resilient fallback voice mode");
              }
            },
            onerror: (err: any) => {
              console.warn("Gemini Live session warning:", err?.message || err);
              if (!isFallbackMode) {
                isFallbackMode = true;
                console.log("Activated resilient voice bridge fallback mode");
              }
            },
          },
        });

        isSessionActive = true;
        clientWs.send(JSON.stringify({ type: "ready", message: "Connected to Live Voice" }));
      } catch (liveErr: any) {
        console.warn("Native Live API connection unavailable, activating Voice Bridge mode:", liveErr.message);
        isFallbackMode = true;
        isSessionActive = true;
        clientWs.send(JSON.stringify({ type: "ready", message: "Connected to Shawn Assistant (Voice Bridge)" }));
      }

      // Handler for client messages
      clientWs.on("message", async (data: any) => {
        try {
          const payload = JSON.parse(data.toString());

          // Handle heartbeat ping from client
          if (payload.type === "ping") {
            clientWs.isAlive = true;
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            }
            return;
          }

          // If Live API is active, pipe to liveSession
          if (!isFallbackMode && liveSession && isSessionActive) {
            if (payload.type === "audio") {
              liveSession.sendRealtimeInput({
                audio: { mimeType: "audio/pcm;rate=16000", data: payload.audio },
              });
            } else if (payload.type === "text") {
              liveSession.sendRealtimeInput({ text: payload.text });
            } else if (payload.type === "video") {
              liveSession.sendRealtimeInput({
                video: { mimeType: "image/jpeg", data: payload.image },
              });
            } else if (payload.type === "function_response" || payload.type === "tool_response") {
              const functionResponses =
                payload.functionResponses || (payload.functionResponse ? [payload.functionResponse] : []);
              if (functionResponses.length > 0) {
                liveSession.sendToolResponse({ functionResponses });
              }
            }
            return;
          }

          // Fallback Bridge Mode: Handle text/tool requests over the same WebSocket
          if (isFallbackMode && isSessionActive) {
            if (payload.type === "text" && payload.text) {
              clientWs.send(JSON.stringify({ type: "input_transcription", text: payload.text }));

              conversationalHistory.push({ role: "user", parts: [{ text: payload.text }] });

              // Generate response with Gemini
              const chatAi = new GoogleGenAI({ apiKey: geminiApiKey });
              const chatRes = await chatAi.models.generateContent({
                model: "gemini-3.7-flash",
                contents: conversationalHistory as any,
                config: {
                  systemInstruction: SHAWN_PROMPT_INSTRUCTION,
                  tools: LIVE_TOOLS as any,
                },
              });

              const replyText = chatRes.text || "";
              const fCalls = chatRes.functionCalls;

              if (fCalls && fCalls.length > 0) {
                clientWs.send(
                  JSON.stringify({
                    type: "tool_call",
                    functionCalls: fCalls,
                    functionCall: fCalls[0],
                  })
                );
              }

              if (replyText) {
                clientWs.send(JSON.stringify({ type: "output_transcription", text: replyText }));
                conversationalHistory.push({ role: "model", parts: [{ text: replyText }] });

                // Synthesize TTS audio and stream
                try {
                  const ttsRes = await chatAi.models.generateContent({
                    model: "gemini-3.1-flash-tts-preview",
                    contents: [{ parts: [{ text: replyText }] }],
                    config: {
                      responseModalities: ["AUDIO"] as any,
                      speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
                      },
                    },
                  });
                  const audioB64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                  if (audioB64 && clientWs.readyState === 1) {
                    clientWs.send(
                      JSON.stringify({
                        type: "audio",
                        audio: audioB64,
                        mimeType: "audio/pcm;rate=24000",
                      })
                    );
                  }
                } catch (ttsErr) {
                  console.warn("TTS synthesis warning in voice bridge:", ttsErr);
                }
              }

              clientWs.send(JSON.stringify({ type: "turn_complete" }));
            } else if (payload.type === "function_response" || payload.type === "tool_response") {
              const resp = payload.functionResponse || payload.functionResponses?.[0];
              if (resp) {
                conversationalHistory.push({
                  role: "user",
                  parts: [{ text: `[Tool Result for ${resp.name}]: ${JSON.stringify(resp.response)}` }],
                });
              }
            }
          }
        } catch (err: any) {
          console.error("Error processing client message:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("Client WebSocket disconnected");
        if (liveSession) {
          try {
            liveSession.close();
          } catch (e) {}
        }
        isSessionActive = false;
      });
    } catch (err: any) {
      console.error("Failed to initialize Live session:", err);
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            type: "error",
            message: err?.message || "Failed to start Live session",
          })
        );
        setTimeout(() => {
          if (clientWs.readyState === 1) clientWs.close();
        }, 500);
      }
    }
  });
}

startServer();
