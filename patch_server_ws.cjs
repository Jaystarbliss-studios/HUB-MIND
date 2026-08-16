const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('WebSocketServer')) {
  code = code.replace('import OpenAI from "openai";', 'import OpenAI from "openai";\nimport { WebSocketServer } from "ws";');
}

const listenReplacement = `  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", \`http://\${request.headers.host || "localhost"}\`);
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
          systemInstruction: {
            parts: [{ text: "You are Shawn, an intelligent business partner. You are cheerful, helpful, and concise." }]
          },
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
                      audio: part.inlineData.data,
                      mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    })
                  );
                }
              }
            }

            // Check for user speech transcription
            const inputTx = message.serverContent?.inputAudioTranscription?.text || message.inputAudioTranscription?.text;
            if (inputTx) {
              clientWs.send(
                JSON.stringify({
                  type: "input_transcription",
                  text: inputTx,
                })
              );
            }

            // Check for model speech transcription
            const outputTx = message.serverContent?.outputAudioTranscription?.text || message.outputAudioTranscription?.text;
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
            console.log("Gemini Live session closed");
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
            liveSession.send({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{
                    inlineData: {
                      mimeType: "audio/pcm;rate=16000",
                      data: payload.audio,
                    },
                  }],
                }],
                turnComplete: true,
              },
            });
          } else if (payload.type === "text") {
            liveSession.send({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{
                    text: payload.text,
                  }],
                }],
                turnComplete: true,
              },
            });
          } else if (payload.type === "video") {
            liveSession.send({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: payload.image,
                    },
                  }],
                }],
                turnComplete: true,
              },
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
        clientWs.close();
      }
    }
  });`;

code = code.replace(/app\.listen\(PORT, "0\.0\.0\.0", \(\) => {[\s\S]*?}\);/, listenReplacement);

fs.writeFileSync('server.ts', code);
