import { GoogleGenAI } from '@google/genai';
import { auth } from '../firebaseConfig';
import { JESS_TOOLS_DECLARATIONS } from '../lib/jessTools';
import { jessBackgroundTasks } from './jessBackgroundTasks';
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

export class LiveAudioClient {
  private session: LiveSession | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputGainNode: GainNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private outputGainNode: GainNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioProcessingWorker: Worker | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveAudioCallbacks;
  private isMuted = false;
  private micPermissionDenied = false;
  private isPushToTalkActive = false;
  private pushToTalkMode = false;
  private levelIntervalId: number | null = null;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private connectionGeneration = 0;

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

    this.inputAudioCtx = new AudioCtx({ sampleRate: 16000, latencyHint: 'interactive' });
    this.outputAudioCtx = new AudioCtx({ sampleRate: 24000, latencyHint: 'interactive' });

    if (this.inputAudioCtx.state === 'suspended') await this.inputAudioCtx.resume();
    if (this.outputAudioCtx.state === 'suspended') await this.outputAudioCtx.resume();

    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputGainNode = this.inputAudioCtx.createGain();
    this.inputGainNode.gain.value = 1.0;

    this.highpassFilter = this.inputAudioCtx.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 85;
    this.highpassFilter.Q.value = 0.7;

    this.lowpassFilter = this.inputAudioCtx.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 7000;
    this.lowpassFilter.Q.value = 0.7;

    this.outputAnalyser = this.outputAudioCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputGainNode = this.outputAudioCtx.createGain();
    this.outputGainNode.gain.value = 1.0;
    // Keep the assistant's mono Gemini response duplicated across both speaker
    // channels. The browser/OS still chooses the actual output device.
    this.outputGainNode.channelCount = 2;
    this.outputGainNode.channelCountMode = 'explicit';
    this.outputGainNode.channelInterpretation = 'speakers';
    this.outputGainNode.connect(this.outputAudioCtx.destination);

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.micPermissionDenied = false;
      } else {
        throw new Error('Microphone audio input is not supported in this browser context.');
      }
    } catch (micErr: any) {
      console.warn('[Jess Live] Microphone access unavailable or permission denied, using silent input stream fallback:', micErr?.message || micErr);
      this.micPermissionDenied = true;
      const silentDestination = this.inputAudioCtx.createMediaStreamDestination();
      this.mediaStream = silentDestination.stream;
    }

    if (!this.inputAudioCtx || !this.mediaStream) {
      throw new Error('Jess microphone audio context became unavailable during initialization.');
    }
    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.highpassFilter);
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.inputGainNode);
    this.inputGainNode.connect(this.inputAnalyser);

    if (!this.inputAudioCtx.audioWorklet) {
      throw new Error('AudioWorklet is not supported in this browser.');
    }

    await this.inputAudioCtx.audioWorklet.addModule('/jess-capture-processor.js');
    this.audioWorkletNode = new AudioWorkletNode(this.inputAudioCtx, 'jess-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      processorOptions: { targetFrames: 1024 },
    });

    this.inputAnalyser.connect(this.audioWorkletNode);
    // The processor outputs silence; connecting it keeps the worklet active without
    // routing microphone audio back to the user's speakers.
    this.audioWorkletNode.connect(this.inputAudioCtx.destination);

    try {
      this.audioProcessingWorker = new Worker('/jess-audio-worker.js');
    } catch {
      throw new Error('Jess audio processing worker could not be started.');
    }

    this.audioProcessingWorker.onmessage = (event: MessageEvent) => {
      if (this.isMuted || this.micPermissionDenied || (this.pushToTalkMode && !this.isPushToTalkActive)) return;
      if (!this.session || !this.connected) return;
      const message = event.data;
      if (message?.type === 'error') {
        console.warn('[Jess AudioWorker]', message.message);
        return;
      }
      if (message?.type !== 'audio' || !message.data) return;
      try {
        // GoogleGenAI Live already uses its real-time WebSocket transport.
        // Send one canonical audio payload rather than duplicating the same PCM.
        this.session.sendRealtimeInput({
          audio: { data: message.data, mimeType: message.mimeType || 'audio/pcm;rate=16000' },
        });
      } catch (error) {
        console.warn('Live input error:', error);
      }
    };

    this.audioWorkletNode.port.onmessage = (event: MessageEvent<Float32Array | ArrayBuffer>) => {
      if (this.isMuted || this.micPermissionDenied || (this.pushToTalkMode && !this.isPushToTalkActive)) return;
      const input = event.data instanceof Float32Array ? event.data : new Float32Array(event.data);
      const buffer = input.buffer;
      try {
        this.audioProcessingWorker?.postMessage(
          { type: 'process', buffer, sampleRate: this.inputAudioCtx?.sampleRate || 16000 },
          [buffer],
        );
      } catch (error) {
        console.warn('[Jess AudioWorker] Could not enqueue audio frame:', error);
      }
    };
  }

  public async connect(context?: {
    page?: string;
    documentId?: string;
    documentTitle?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
  }) {
    if (this.connectPromise) return this.connectPromise;
    const generation = ++this.connectionGeneration;
    this.connectPromise = this.connectInternal(context, generation).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async connectInternal(context?: {
    page?: string;
    documentId?: string;
    documentTitle?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
  }, generation = this.connectionGeneration) {
    this.callbacks.onStatusChange('connecting');
    this.callbacks.onJessStateChange('thinking');
    try {
      await this.disconnect(false);
      if (generation !== this.connectionGeneration) return;
      await this.setupAudioNodes();
      if (generation !== this.connectionGeneration) return;

      const firstName = context?.userName || 'there';
      const bgTasksSummary = jessBackgroundTasks.getQueueSummaryForPrompt(context?.userId || '');
      
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
        'You are Jess, the users intelligent professional partner inside Hub-Mind: warm, observant, capable, calm, and human-like without pretending to be human.',
        'Speak like a trusted professor-partner: conversational, thoughtful, precise, naturally curious, and confident. Explain reasoning briefly when useful, ask a focused clarification only when genuinely necessary, and do not sound robotic or overly scripted.',
        'Do not narrate tool mechanics to the user. Speak naturally about what you are doing and what you found. Use short acknowledgements, varied phrasing, and context-aware follow-ups instead of repeating canned confirmations.',
        'When a task is genuinely running, stay aware of it across turns and sessions. For multi-step work, create a real background operation with concrete executable tool steps. When asked for progress, call get_background_tasks_status and report the persisted percentage, current step, retry state, and actual stage; never invent progress. If a step fails transiently, the background executor retries it automatically. If a task ultimately fails, say exactly which step failed and why.',
        'Treat the Hub-Mind workspace as an operating environment you can inspect and control through authorized tools. Prefer fast local workspace context and only wait on remote data when the local index does not contain enough information.',
        'You speak naturally, professionally and confidently in live voice conversation. Sound like a capable professor-partner rather than a scripted assistant: vary acknowledgements, remember what was just said, use context from earlier turns, and occasionally volunteer a useful observation when it materially helps.',
        `Address the signed-in user as ${firstName}.`,
        'USER RECOGNITION & IDENTITY (CRITICAL RULE):',
        `- You know exactly who is speaking with you: The signed-in user's name is "${context?.userName || firstName}".`,
        `- Always address them by their name ("${firstName}").`,
        `- If the user asks "Who am I?", "What is my name?", "Do you know who I am?", "Do you remember me?", or asks about their identity, immediately and confidently identify them by name: "${context?.userName || firstName}".`,
        `- If you need to re-verify or check full profile details, you can use \`get_user_profile\` or \`get_current_user_profile\`.`,
        'PERSONA INITIALIZATION & IDENTITY RULE:',
        '- Greet the user with a neutral, professional assistant greeting (e.g. "Hello ' + firstName + ', how may I help you today?").',
        '- Do NOT proactively introduce yourself by name or say "I am Jess" or "My name is Jess" unless the user explicitly asks for your name, identity, or who you are.',
        '- Only reveal your name ("Jess") when the user specifically asks "What is your name?" or "Who are you?".',
        'SESSION DEACTIVATION & SLEEP COMMAND:',
        '- If the user says "end this session", "go to sleep", "sleep", "deactivate", "stop session", "that will be all", or asks to conclude, politely bid them goodbye (e.g. "Ending session now. Have a great day!") and call the `end_session` tool immediately to put the assistant into sleep mode.',
        'NOISE SUPPRESSION & DOMINANT SPEAKER FOCUS:',
        '- You only listen to the primary/highest voice speaking directly to you and ignore background noises, room murmur, TV/music audio, typing, and ambient sounds.',
        '- If there are faint background voices or chatter in the room, strictly prioritize the dominant voice closest to the microphone.',
        'LANGUAGE POLICY & DYNAMIC USER PREFERENCE:',
        '- Default Language: Listen and answer in English for 90%+ of all standard conversations and operations.',
        '- Dynamic Language Switching: If the user explicitly asks you to speak in another language (e.g. Spanish, French, Yoruba, German, Japanese, etc.), immediately switch to that language, respond naturally in that language, and save their language preference using `set_language_preference` or `save_user_memory`.',
        '- If the user asks to switch back to English or change languages again, seamlessly adapt and update their preference.',
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
        'SCHEDULES & RECURRING CALENDAR (CRITICAL RULE):',
        '- RECURRING SCHEDULES ARE PART OF SCHEDULES: In Hub-Mind, recurring classes, weekly meetings, daily routines, and appointments are full schedules.',
        '- Whenever the user asks for their schedule, calendar, meetings, or agenda for a particular date, time range, or period (e.g. "what\'s my schedule today?", "what are my schedules for this week?", "what do I have on Tuesday?", "what\'s between 9 AM and 2 PM?"):',
        '  1. Call `get_schedule` or `list_meetings` with the period / date range.',
        '  2. `get_schedule` returns BOTH one-time meetings AND all active recurring schedules and classes falling in that time range.',
        '  3. List ALL of them chronologically with their exact times, titles, and recurring labels so the user never misses a recurring class or meeting.',
        '- When the user asks to create or schedule recurring events (like classes, weekly meetings, appointments, routines), use `create_recurring_schedule` with title, frequency, daysOfWeek, and times.',
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
        'Use tools whenever the user asks to search, find, list, read, create, update, email, schedule, navigate, scroll, click, type, or otherwise control Hub-Mind. Never claim an action succeeded unless confirmed by tool response.',
        'MANDATORY UI NAVIGATION RULE: Any request to open, go to, show, bring up, switch to, enter, or navigate to a Hub-Mind tab, section, page, screen, directory, or workspace view MUST trigger a navigation tool call. Use the most specific open_* tool when one exists; otherwise use navigate_app with the correct internal path. Do not merely say that you are opening or navigating to it. Do not claim it is open until the navigation tool has returned success.',
        'When asked to open the colleagues, people, or team directory tab, call `open_colleagues` or `navigate_app` with path "/colleagues".',
        'When asked to find or open a document, use find_document or open_document. Search by meaning, phrases, content, topic, project, person, and likely wording—not only exact titles. If the user says "the document about...", infer and rank the closest relevant records.',
        'For schedules, interpret conversational clues such as day, date, time, activity, person, project, topic, location, or phrase. Never require an exact event title. Use get_schedule/list_meetings and workspace search as needed, then rank the most relevant matches. If the user says "the schedule about the school class" or "what do I have Tuesday afternoon", infer the likely records from the words they actually used.',
        'For visible UI control, use scroll_screen, click_screen, type_screen, and stop_screen_control. If the user says scroll down/up, use continuous scrolling and keep it running until they say stop or another screen-control command changes it. "Faster", "slower", "much faster", and "slow it down" are speed-control requests. Use visible text/labels/context to locate a target and only report a click/type as successful after the browser tool result confirms it. Do not claim to control pixels outside the Hub-Mind page.',
        'SESSION SLEEP RULE: When the user asks to end the session, sleep, deactivate, or stop Jess, MUST call end_session immediately. Do not only acknowledge the request conversationally. After the tool succeeds, do not continue the conversation or request more input; the client will terminate the Live session.'
      ].filter(Boolean).join('\n');

      let token = '';
      try {
        token = await this.getEphemeralToken();
      } catch (tokenErr) {
        throw tokenErr;
      }

      if (token) {
        try {
          const ai = new GoogleGenAI({
            apiKey: token,
            httpOptions: { apiVersion: 'v1alpha' },
          });
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
                this.callbacks.onStatusChange('connected');
                this.callbacks.onJessStateChange(this.isMuted || this.micPermissionDenied ? 'muted' : 'listening');
                if (this.micPermissionDenied) {
                  this.callbacks.onJessTranscript?.('Microphone access is unavailable or denied. Jess is active in text and suggested actions mode.');
                }
              },
              onmessage: (message: any) => this.handleLiveMessage(message),
              onerror: (event: any) => {
                console.warn('Live API event warning:', event);
                // Treat provider/network errors as recoverable. Tear down the broken
                // session cleanly so the floating assistant remains activatable.
                this.connected = false;
                this.session = null;
                this.stopPlayback();
                this.callbacks.onError?.('Jess encountered a temporary Live connection error. Jess is ready to reconnect.');
                this.callbacks.onStatusChange('error');
                this.callbacks.onJessStateChange('error');
                try { this.session?.close(); } catch {}
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

          return;
        } catch (directErr: any) {
          throw directErr;
        }
      }

      throw new Error('Jess Live could not establish the secure Gemini Live session.');
    } catch (error: any) {
      const msg = error?.message || 'Failed to start Jess Live.';
      if (error?.name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('permission')) {
        console.warn('Jess Live notice:', msg);
      } else {
        console.error('Failed to start Jess Live:', error);
      }
      this.callbacks.onError?.(msg);
      this.callbacks.onStatusChange('error');
      this.callbacks.onJessStateChange('error');
      await this.disconnect(false);
    }
  }

  private handleLiveMessage(message: any) {
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

      const audioBuffer = this.outputAudioCtx.createBuffer(2, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);
      audioBuffer.copyToChannel(float32, 1);

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
    }, 100);
  }

  public sendFunctionResponse(response: { name: string; id: string; response: any }) {
    if (!this.session) return;
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
  }

  public sendText(text: string) {
    if (!text.trim() || !this.session) return;
    try {
      if (typeof this.session.sendClientContent === 'function') {
        this.session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
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

    if (this.audioWorkletNode) {
      try { this.audioWorkletNode.port.onmessage = null; } catch {}
      try { this.audioWorkletNode.disconnect(); } catch {}
      this.audioWorkletNode = null;
    }

    if (this.audioProcessingWorker) {
      this.audioProcessingWorker.onmessage = null;
      this.audioProcessingWorker.terminate();
      this.audioProcessingWorker = null;
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

    this.connected = false;

    if (notify) {
      this.callbacks.onStatusChange('disconnected');
      this.callbacks.onJessStateChange('idle');
    }
  }

}
