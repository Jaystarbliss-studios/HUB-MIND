import { GoogleGenAI } from '@google/genai';
import { auth } from '../firebaseConfig';
import { JESS_TOOLS_DECLARATIONS } from '../lib/jessTools';
import { jessBackgroundTasks } from './jessBackgroundTasks';
import { getUserMemories, formatMemoriesForPrompt } from './memoryService';
import { getCurrentUserMoodGuidance } from './sentimentService';
import { getUserMemories, formatMemoriesForPrompt } from './memoryService';
import { getCurrentUserMoodGuidance } from './sentimentService';

export type JessState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted' | 'error';
export interface LiveAudioCallbacks {
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onJessStateChange: (state: JessState) => void;
  onUserTranscript: (text: string) => void;
  onJessTranscript: (text: string) => void;
  onTurnComplete: () => void;
  onError?: (errorMsg: string) => void;
  onAudioLevel?: (inputLevel: number, outputLevel: number) => void;
  onFunctionCall?: (functionCall: any) => void;
}

type LiveSession = {
  sendRealtimeInput: (input: any) => void;
  sendClientContent?: (input: any) => void;
  sendToolResponse: (response: any) => void;
  close: () => void;
};

const ENABLE_SERVER_WS_BRIDGE = import.meta.env.VITE_ENABLE_LIVE_WS_BRIDGE === 'true';

export class LiveAudioClient {
  private session: LiveSession | null = null;
  private fallbackWs: WebSocket | null = null;
  private isUsingFallbackWs = false;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveAudioCallbacks;
  private isMuted = false;
  private isPushToTalkActive = false;
  private pushToTalkMode = false;
  private levelIntervalId: number | null = null;
  private connected = false;

  constructor(callbacks: LiveAudioCallbacks) {
    this.callbacks = callbacks;
  }

  private async getEphemeralToken(): Promise<string> {
    const user = auth.currentUser;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (user) {
      try {
        const idToken = await user.getIdToken(true);
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch (e) {
        console.warn('Could not refresh Firebase ID token:', e);
      }
    }

    const response = await fetch('/api/live-token', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to mint ephemeral token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.token;
  }

  private async setupAudioNodes() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API is not supported in this browser.');

    this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
    this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });

    if (this.inputAudioCtx.state === 'suspended') await this.inputAudioCtx.resume();
    if (this.outputAudioCtx.state === 'suspended') await this.outputAudioCtx.resume();

    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputGainNode = this.inputAudioCtx.createGain();
    this.inputGainNode.gain.value = 1.0;

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputGainNode = this.outputAudioCtx.createGain();
    this.outputGainNode.gain.value = 1.0;
    this.outputGainNode.connect(this.outputAudioCtx.destination);

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.inputGainNode);
    this.inputGainNode.connect(this.inputAnalyser);

    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
    this.inputAnalyser.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioCtx.destination);
  }

  public async connect(context?: {
    page?: string;
    documentId?: string;
    documentTitle?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
  }) {
    this.callbacks.onStatusChange('connecting');
    this.callbacks.onJessStateChange('thinking');
    try {
      await this.disconnect(false);
      await this.setupAudioNodes();

      const firstName = context?.userName || 'there';
      const bgTasksSummary = jessBackgroundTasks.getQueueSummaryForPrompt();
      
      let userMemoriesSummary = 'No stored memories yet.';
      if (context?.userId) {
        try {
          const memories = await getUserMemories(context.userId);
          userMemoriesSummary = formatMemoriesForPrompt(memories);
        } catch (memErr) {
          console.warn('[LiveClient] Failed to load user memories:', memErr);
        }
      }

      const systemInstruction = [
        'You are an intelligent, warm, concise, and capable operations assistant inside Hub-Mind.',
        'You speak naturally, professionally and confidently in live voice conversation.',
        `Address the signed-in user as ${firstName}.`,
        'PERSONA INITIALIZATION & IDENTITY RULE:',
        '- Greet the user with a neutral, professional assistant greeting (e.g. "Hello ' + firstName + ', how may I help you today?").',
        '- Do NOT proactively introduce yourself by name or say "I am Jess" or "My name is Jess" unless the user explicitly asks for your name, identity, or who you are.',
        '- Only reveal your name ("Jess") when the user specifically asks "What is your name?" or "Who are you?".',
        'SESSION DEACTIVATION & SLEEP COMMAND:',
        '- If the user says "end this session", "go to sleep", "sleep", "deactivate", "stop session", "that will be all", or asks to conclude, politely bid them goodbye (e.g. "Ending session now. Have a great day!") and call the `end_session` tool immediately to put the assistant into sleep mode.',
        'PERSONALIZED USER MEMORY & REMEMBERED CHOICES:',
        `- You remember this specific user's preferences, habits, instructions, and past choices across every session:`,
        userMemoriesSummary,
        'PERSONAL OPINIONS & TRUSTED FRIEND SOUNDING BOARD:',
        '- You are a smart, genuine friend and trusted partner to the user — not a stiff, robotic answering machine.',
        '- When the user asks "What do you think?", "What should we do?", "How does this look?", or asks for your advice, share a genuine, thoughtful personal point of view.',
        '- Speak naturally with opinionated phrasing: "If you ask me, I would have done it this way...", "Why don\'t we try this method instead?", "Personally, I think...", "To be honest, mate, here is a sharper angle...".',
        '- Suggest smarter shortcuts, offer creative improvements, and brainstorm alternatives like a reliable colleague sitting right beside them.',
        'EMOTIONAL STATE & REAL-TIME TONE ADAPTATION:',
        getCurrentUserMoodGuidance(),
        '- Naturally modulate your energy, empathy, and speed to match the user\'s current state without explicitly announcing the mood.',
        'RECURRING SCHEDULES & CALENDAR:',
        '- When the user asks to add or schedule repeating events (like classes, weekly meetings, appointments, routines), use `create_recurring_schedule` with title, frequency (daily, weekly, monthly), daysOfWeek, and times.',
        '- When the user asks for single meetings or calendar items, use `create_meeting` or `create_calendar_event`.',
        'SHARING DATA, SCHEDULES, MEETINGS & RESOURCES:',
        '- You have powerful tools to share any data across Hub-Mind with colleagues or clients:',
        '- Use `share_data` or `share_resource` to share schedules, meetings, documents, tasks, projects, client info, notes, and texts with any teammate by username (@username), email, or name.',
        '- Use `share_schedule` to format and share the upcoming calendar schedule and recurring routines.',
        '- Use `send_direct_information` to deliver direct text messages and briefings to teammates.',
        '- Use `get_share_link` to generate direct URLs and WhatsApp share links.',
        '- Use `list_workspace_users` to look up teammates in the directory.',
        'CONCURRENT BACKGROUND WORK & REAL-TIME STATUS:',
        '- You maintain ongoing conversation and responsiveness even while running multi-step background processing tasks.',
        '- When the user gives you a task that takes time (like drafting documents, audits, or batch operations), initiate it with `start_background_operation` so it processes asynchronously in the background queue.',
        '- When the user asks about the progress of what you were asked to do (e.g., "Have you done it?", "What is the status?"), check `get_background_tasks_status` or review your active background tasks, and give them the exact percentage (e.g., 50% complete, 75% complete, 100% complete) and stage update.',
        `CURRENT BACKGROUND PROCESSING QUEUE:\n${bgTasksSummary}`,
        'AUTHORIZATION & ACCESS:',
        context?.userRole ? `Current user role: ${context.userRole}. You have full operational authorization within the user's role scope.` : '',
        context?.page ? `Current Hub-Mind view: ${context.page}.` : '',
        context?.documentId ? `Active document on screen: "${context.documentTitle || 'Untitled'}" (ID: ${context.documentId}).` : '',
        'TOOLS & ACCURACY:',
        'Use tools whenever the user asks to search, find, list, read, create, update, or navigate Hub-Mind data. Never claim an action succeeded unless confirmed by tool response.',
        'When asked to find or open a document, use find_document or open_document.',
      ].filter(Boolean).join('\n');

      let token = '';
      try {
        token = await this.getEphemeralToken();
      } catch (tokenErr) {
        console.warn('Ephemeral token error, attempting WebSocket bridge:', tokenErr);
      }

      if (token) {
        try {
          const ai = new GoogleGenAI({ apiKey: token });
          const session = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: ['AUDIO'] as any,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              sessionResumption: {},
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              systemInstruction: { parts: [{ text: systemInstruction }] },
              tools: [{ functionDeclarations: JESS_TOOLS_DECLARATIONS as any }],
            } as any,
            callbacks: {
              onopen: () => {
                this.connected = true;
                this.isUsingFallbackWs = false;
                this.callbacks.onStatusChange('connected');
                this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
              },
              onmessage: (message: any) => this.handleLiveMessage(message),
              onerror: (event: any) => {
                console.warn('Live API event warning:', event);
                if (!this.connected) {
                  if (ENABLE_SERVER_WS_BRIDGE) {
                    void this.connectFallbackWebSocket(context);
                  } else {
                    this.callbacks.onError?.('Gemini Live connection failed. The hosted WebSocket bridge is disabled in production.');
                    this.callbacks.onStatusChange('error');
                    this.callbacks.onJessStateChange('error');
                  }
                }
              },
              onclose: (event: any) => {
                if (this.connected) {
                  this.connected = false;
                  this.callbacks.onStatusChange('disconnected');
                  this.callbacks.onJessStateChange('idle');
                }
              },
            },
          });

          this.session = session as unknown as LiveSession;
          this.startLevelMonitor();

          if (this.scriptProcessor) {
            this.scriptProcessor.onaudioprocess = event => {
              if (this.isMuted || (this.pushToTalkMode && !this.isPushToTalkActive)) return;
              const pcmBuffer = this.floatTo16BitPCM(event.inputBuffer.getChannelData(0));
              const base64Data = this.base64EncodeArrayBuffer(pcmBuffer);
              if (this.session && this.connected && !this.isUsingFallbackWs) {
                try {
                  this.session.sendRealtimeInput({
                    audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
                    media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
                  });
                } catch (e) {
                  console.warn('Live input error:', e);
                }
              } else if (this.fallbackWs && this.fallbackWs.readyState === WebSocket.OPEN) {
                try {
                  this.fallbackWs.send(JSON.stringify({ type: 'audio', audio: base64Data }));
                } catch (e) {}
              }
            };
          }
          return;
        } catch (directErr: any) {
          console.warn('Direct Live API connect failed, switching to bridge fallback:', directErr?.message || directErr);
        }
      }

      // Fallback: connect via server WebSocket bridge
      await this.connectFallbackWebSocket(context);
    } catch (error: any) {
      console.error('Failed to start Jess Live:', error);
      this.callbacks.onError?.(error?.message || 'Failed to start Jess Live.');
      this.callbacks.onStatusChange('error');
      this.callbacks.onJessStateChange('error');
      await this.disconnect(false);
    }
  }

  private async connectFallbackWebSocket(context?: { documentId?: string; documentTitle?: string }) {
    try {
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      const docQuery = context?.documentId
        ? `?documentId=${encodeURIComponent(context.documentId)}&documentTitle=${encodeURIComponent(context.documentTitle || '')}`
        : '';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live-ws${docQuery}`;

      const ws = new WebSocket(wsUrl);
      this.fallbackWs = ws;

      ws.onopen = () => {
        this.connected = true;
        this.isUsingFallbackWs = true;
        this.callbacks.onStatusChange('connected');
        this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
        this.startLevelMonitor();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'tool_call') {
            const fcs = data.functionCalls || (data.functionCall ? [data.functionCall] : []);
            fcs.forEach((fc: any) => this.callbacks.onFunctionCall?.(fc));
          } else if (data.type === 'audio' && data.audio) {
            this.callbacks.onJessStateChange('speaking');
            this.playAudioChunk(data.audio);
          } else if (data.type === 'input_transcription' && data.text) {
            this.callbacks.onUserTranscript(data.text);
          } else if (data.type === 'output_transcription' && data.text) {
            this.callbacks.onJessTranscript(data.text);
          } else if (data.type === 'interrupted') {
            this.handleInterruption();
          } else if (data.type === 'turn_complete') {
            this.callbacks.onTurnComplete();
            if (!this.activeSources.length) {
              this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
            }
          }
        } catch (e) {
          console.warn('Error parsing WS message:', e);
        }
      };

      ws.onerror = () => {
        if (!this.connected) {
          this.callbacks.onStatusChange('error');
          this.callbacks.onJessStateChange('error');
        }
      };

      ws.onclose = () => {
        if (this.connected) {
          this.connected = false;
          this.callbacks.onStatusChange('disconnected');
          this.callbacks.onJessStateChange('idle');
        }
      };
    } catch (wsErr: any) {
      console.error('Fallback WebSocket error:', wsErr);
      this.callbacks.onStatusChange('error');
    }
  }

  private handleLiveMessage(message: any) {
    // Extract real-time user voice transcription from server content
    const inputTx =
      (message.serverContent as any)?.inputTranscription?.text ||
      (message as any).inputTranscription?.text ||
      (message.serverContent as any)?.inputAudioTranscription?.text ||
      (message as any).serverContent?.interleavedUserAudioTranscription?.text;
    if (inputTx) {
      this.callbacks.onUserTranscript(inputTx);
    }

    const outputTx =
      (message.serverContent as any)?.outputTranscription?.text ||
      (message as any).outputTranscription?.text ||
      (message.serverContent as any)?.outputAudioTranscription?.text;
    if (outputTx) {
      this.callbacks.onJessTranscript(outputTx);
    }

    if (message.serverContent) {
      const { modelTurn, interrupted, turnComplete } = message.serverContent;
      if (interrupted) {
        this.handleInterruption();
        return;
      }

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.executableCode || part.codeExecutionResult) continue;

          if (part.inlineData?.data) {
            this.callbacks.onJessStateChange('speaking');
            this.playAudioChunk(part.inlineData.data);
          }
          if (part.text) {
            this.callbacks.onJessTranscript(part.text);
          }
        }
      }

      if (turnComplete) {
        this.callbacks.onTurnComplete();
        if (this.activeSources.length === 0) {
          this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
        }
      }
    }

    if (message.toolCall) {
      this.callbacks.onJessStateChange('thinking');
      const calls = message.toolCall.functionCalls;
      if (calls && Array.isArray(calls)) {
        calls.forEach(call => {
          this.callbacks.onFunctionCall?.(call);
        });
      }
    }
  }

  private handleInterruption() {
    this.stopPlayback();
    this.callbacks.onJessStateChange('interrupted');
    setTimeout(() => {
      if (this.connected) this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
    }, 200);
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx || !this.outputGainNode) return;
    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputGainNode);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) this.nextStartTime = now + 0.03;

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== source);
        if (this.activeSources.length === 0 && this.connected) {
          this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
        }
      };
    } catch (err) {
      console.warn('Audio decoding playback warning:', err);
    }
  }

  private stopPlayback() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    });
    this.activeSources = [];
    if (this.outputAudioCtx) this.nextStartTime = this.outputAudioCtx.currentTime;
  }

  private startLevelMonitor() {
    if (this.levelIntervalId) clearInterval(this.levelIntervalId);
    const inData = new Uint8Array(128);
    const outData = new Uint8Array(128);

    this.levelIntervalId = window.setInterval(() => {
      let inAvg = 0;
      let outAvg = 0;

      if (this.inputAnalyser && !this.isMuted) {
        this.inputAnalyser.getByteFrequencyData(inData);
        const sum = inData.reduce((acc, val) => acc + val, 0);
        inAvg = sum / inData.length / 255;
      }

      if (this.outputAnalyser && this.activeSources.length > 0) {
        this.outputAnalyser.getByteFrequencyData(outData);
        const sum = outData.reduce((acc, val) => acc + val, 0);
        outAvg = sum / outData.length / 255;
      }

      this.callbacks.onAudioLevel?.(inAvg, outAvg);
    }, 50);
  }

  public sendFunctionResponse(response: { name: string; id: string; response: any }) {
    if (this.session && !this.isUsingFallbackWs) {
      try {
        this.session.sendToolResponse({
          functionResponses: [
            {
              name: response.name,
              id: response.id,
              response: response.response,
            },
          ],
        });
      } catch (err) {
        console.warn('Failed to send tool response to Live API:', err);
      }
    } else if (this.fallbackWs && this.fallbackWs.readyState === WebSocket.OPEN) {
      try {
        this.fallbackWs.send(
          JSON.stringify({
            type: 'function_response',
            name: response.name,
            id: response.id,
            response: response.response,
          })
        );
      } catch (err) {
        console.warn('Failed to send tool response to WS bridge:', err);
      }
    }
  }

  public sendText(text: string) {
    if (!text.trim()) return;
    if (this.session && !this.isUsingFallbackWs) {
      try {
        if (typeof this.session.sendClientContent === 'function') {
          this.session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
            turnComplete: true,
          });
        } else {
          this.session.sendRealtimeInput({
            clientContent: {
              turns: [{ role: 'user', parts: [{ text }] }],
              turnComplete: true,
            },
          });
        }
      } catch (e) {
        console.warn('Error sending text to Live session:', e);
      }
    } else if (this.fallbackWs && this.fallbackWs.readyState === WebSocket.OPEN) {
      try {
        this.fallbackWs.send(JSON.stringify({ type: 'text', text }));
      } catch (e) {}
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.callbacks.onJessStateChange(this.isMuted ? 'muted' : 'listening');
    return this.isMuted;
  }

  public setPushToTalk(enabled: boolean) {
    this.pushToTalkMode = enabled;
  }

  public setPushToTalkActive(active: boolean) {
    this.isPushToTalkActive = active;
  }

  public async disconnect(notify = true) {
    if (this.levelIntervalId) {
      clearInterval(this.levelIntervalId);
      this.levelIntervalId = null;
    }

    this.stopPlayback();

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state !== 'closed') {
      try { await this.inputAudioCtx.close(); } catch {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx && this.outputAudioCtx.state !== 'closed') {
      try { await this.outputAudioCtx.close(); } catch {}
      this.outputAudioCtx = null;
    }

    if (this.session) {
      try { this.session.close(); } catch {}
      this.session = null;
    }

    if (this.fallbackWs) {
      try { this.fallbackWs.close(); } catch {}
      this.fallbackWs = null;
    }

    this.connected = false;
    this.isUsingFallbackWs = false;

    if (notify) {
      this.callbacks.onStatusChange('disconnected');
      this.callbacks.onJessStateChange('idle');
    }
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new DataView(new ArrayBuffer(input.length * 2));
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return output.buffer;
  }

  private base64EncodeArrayBuffer(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
