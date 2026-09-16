import { GoogleGenAI } from '@google/genai';
import { auth } from '../firebaseConfig';
import { SHAWN_TOOLS_DECLARATIONS } from '../lib/shawnTools';

export interface LiveAudioCallbacks {
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onShawnStateChange: (state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted') => void;
  onUserTranscript: (text: string) => void;
  onShawnTranscript: (text: string) => void;
  onTurnComplete: () => void;
  onError?: (errorMsg: string) => void;
  onAudioLevel?: (inputLevel: number, outputLevel: number) => void;
  onFunctionCall?: (functionCall: any) => void;
}

type LiveSession = {
  sendRealtimeInput: (input: any) => void;
  sendToolResponse: (response: any) => void;
  close: () => void;
};

/**
 * Production Live client.
 *
 * The old implementation depended on /api/live-ws, but the production site is
 * deployed as Netlify Functions and therefore does not run the long-lived Node
 * WebSocket server from server.ts. Shawn now obtains a short-lived Gemini Live
 * token from the authenticated Netlify function and connects directly to Gemini.
 * This removes the dead WebSocket proxy from the production voice path.
 */
export class LiveAudioClient {
  private session: LiveSession | null = null;
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

  public async resumeAudioContext(): Promise<void> {
    if (this.outputAudioCtx?.state === 'suspended') await this.outputAudioCtx.resume();
    if (this.inputAudioCtx?.state === 'suspended') await this.inputAudioCtx.resume();
  }

  private async getEphemeralToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in to use Shawn Live.');
    const idToken = await user.getIdToken(true);
    const response = await fetch('/api/live-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || `Live token request failed (${response.status}).`);
    return data.token;
  }

  public async connect(documentContext?: { documentId: string; title: string }): Promise<void> {
    this.callbacks.onStatusChange('connecting');
    this.callbacks.onShawnStateChange('thinking');

    try {
      await this.disconnect(false);

      const token = await this.getEphemeralToken();
      const ai = new GoogleGenAI({ apiKey: token });
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) throw new Error('This browser does not support Web Audio.');

      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      await this.inputAudioCtx.resume();
      await this.outputAudioCtx.resume();

      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputGainNode.gain.value = 1;
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 128;
      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.inputGainNode = this.inputAudioCtx.createGain();
      this.inputGainNode.gain.value = 1;
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 128;
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
      this.sourceNode.connect(this.inputGainNode);
      this.inputGainNode.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      const systemInstruction = [
        'You are Shawn, the embedded AI operations assistant inside Hub-Mind.',
        'You are competent, warm, concise, slightly cheeky and British in tone.',
        'You have real tools. Never claim an action succeeded until the tool response confirms it.',
        'Use tools whenever the user asks you to read, create, update, navigate, schedule or manage Hub-Mind data.',
        documentContext ? `The user is currently working in document "${documentContext.title}" with ID ${documentContext.documentId}. Use the document tools for document-specific requests.` : '',
      ].filter(Boolean).join('\n');

      const session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: ['AUDIO'] as any,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {},
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: [{ functionDeclarations: SHAWN_TOOLS_DECLARATIONS as any }],
        } as any,
        callbacks: {
          onopen: () => {
            this.connected = true;
            this.callbacks.onStatusChange('connected');
            this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening');
          },
          onmessage: (message: any) => this.handleLiveMessage(message),
          onerror: (event: any) => {
            console.error('Shawn Live API error:', event);
            this.callbacks.onError?.(event?.message || 'Shawn Live lost its connection to Gemini.');
            this.callbacks.onStatusChange('error');
          },
          onclose: (event: any) => {
            this.connected = false;
            this.callbacks.onStatusChange('disconnected');
            this.callbacks.onShawnStateChange('idle');
            if (event?.reason) console.warn('Shawn Live closed:', event.reason);
          },
        },
      });

      this.session = session as unknown as LiveSession;
      this.startLevelMonitor();

      if (this.scriptProcessor) {
        this.scriptProcessor.onaudioprocess = (event) => {
          if (!this.session || !this.connected || this.isMuted || (this.pushToTalkMode && !this.isPushToTalkActive)) return;
          const pcmBuffer = this.floatTo16BitPCM(event.inputBuffer.getChannelData(0));
          this.session.sendRealtimeInput({
            audio: { data: this.base64EncodeArrayBuffer(pcmBuffer), mimeType: 'audio/pcm;rate=16000' },
          });
        };
      }
    } catch (error: any) {
      console.error('Failed to start Shawn Live:', error);
      this.callbacks.onError?.(error?.message || 'Failed to start Shawn Live.');
      this.callbacks.onStatusChange('error');
      await this.disconnect(false);
    }
  }

  private handleLiveMessage(message: any) {
    try {
      if (message?.toolCall?.functionCalls?.length) {
        for (const fc of message.toolCall.functionCalls) this.callbacks.onFunctionCall?.(fc);
      }

      const serverContent = message?.serverContent;
      if (serverContent?.inputTranscription?.text) this.callbacks.onUserTranscript(serverContent.inputTranscription.text);
      if (serverContent?.outputTranscription?.text) this.callbacks.onShawnTranscript(serverContent.outputTranscription.text);

      const parts = serverContent?.modelTurn?.parts || [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          this.callbacks.onShawnStateChange('speaking');
          this.playAudioChunk(part.inlineData.data);
        }
      }

      if (serverContent?.interrupted) this.handleInterruption();
      if (serverContent?.turnComplete) {
        this.callbacks.onTurnComplete();
        if (this.activeSources.length === 0) this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening');
      }
    } catch (error) {
      console.error('Error handling Shawn Live message:', error);
    }
  }

  private startLevelMonitor() {
    if (this.levelIntervalId) clearInterval(this.levelIntervalId);
    const input = new Uint8Array(64);
    const output = new Uint8Array(64);
    this.levelIntervalId = window.setInterval(() => {
      let inputLevel = 0;
      let outputLevel = 0;
      if (this.inputAnalyser && !this.isMuted && (!this.pushToTalkMode || this.isPushToTalkActive)) {
        this.inputAnalyser.getByteFrequencyData(input);
        inputLevel = input.reduce((a, b) => a + b, 0) / (input.length * 255);
      }
      if (this.outputAnalyser) {
        this.outputAnalyser.getByteFrequencyData(output);
        outputLevel = output.reduce((a, b) => a + b, 0) / (output.length * 255);
      }
      this.callbacks.onAudioLevel?.(inputLevel, outputLevel);
    }, 40);
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx || !this.outputGainNode) return;
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const samples = Math.floor(bytes.byteLength / 2);
      if (!samples) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const floats = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const sample = view.getInt16(i * 2, true);
        floats[i] = sample < 0 ? sample / 32768 : sample / 32767;
      }
      const buffer = this.outputAudioCtx.createBuffer(1, samples, 24000);
      buffer.getChannelData(0).set(floats);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputGainNode);
      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) this.nextStartTime = now + 0.03;
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);
      source.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== source);
        if (!this.activeSources.length) this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening');
      };
    } catch (error) {
      console.error('Failed to play Shawn audio:', error);
    }
  }

  public handleInterruption() {
    this.callbacks.onShawnStateChange('interrupted');
    for (const source of this.activeSources) {
      try { source.stop(); source.disconnect(); } catch {}
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    window.setTimeout(() => this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening'), 250);
  }

  public sendText(text: string) {
    if (!this.session || !this.connected) return;
    this.callbacks.onShawnStateChange('thinking');
    this.session.sendRealtimeInput({ text });
  }

  public sendImageFrame(base64Jpeg: string) {
    if (!this.session || !this.connected) return;
    this.session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.mediaStream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.callbacks.onShawnStateChange(muted ? 'muted' : (this.activeSources.length ? 'speaking' : 'listening'));
  }

  public setPushToTalk(enabled: boolean) {
    this.pushToTalkMode = enabled;
    if (!enabled && !this.isMuted) this.mediaStream?.getAudioTracks().forEach(track => { track.enabled = true; });
    if (enabled && !this.isPushToTalkActive) this.mediaStream?.getAudioTracks().forEach(track => { track.enabled = false; });
  }

  public sendFunctionResponse(functionResponse: any) {
    if (!this.session || !this.connected) return;
    this.session.sendToolResponse({ functionResponses: [functionResponse] });
  }

  public setPushToTalkActive(active: boolean) {
    this.isPushToTalkActive = active;
    if (this.mediaStream && !this.isMuted) this.mediaStream.getAudioTracks().forEach(track => { track.enabled = !this.pushToTalkMode || active; });
  }

  public setMicGain(value: number) {
    if (this.inputGainNode) this.inputGainNode.gain.value = value;
  }

  public setOutputVolume(value: number) {
    if (this.outputGainNode) this.outputGainNode.gain.value = value;
  }

  public async disconnect(notify = true) {
    this.connected = false;
    if (this.levelIntervalId) { clearInterval(this.levelIntervalId); this.levelIntervalId = null; }
    for (const source of this.activeSources) { try { source.stop(); source.disconnect(); } catch {} }
    this.activeSources = [];
    this.nextStartTime = 0;
    if (this.scriptProcessor) { this.scriptProcessor.disconnect(); this.scriptProcessor.onaudioprocess = null; this.scriptProcessor = null; }
    this.sourceNode?.disconnect(); this.sourceNode = null;
    this.mediaStream?.getTracks().forEach(track => track.stop()); this.mediaStream = null;
    if (this.inputAudioCtx) { try { await this.inputAudioCtx.close(); } catch {} this.inputAudioCtx = null; }
    if (this.outputAudioCtx) { try { await this.outputAudioCtx.close(); } catch {} this.outputAudioCtx = null; }
    if (this.session) { try { this.session.close(); } catch {} this.session = null; }
    if (notify) { this.callbacks.onStatusChange('disconnected'); this.callbacks.onShawnStateChange('idle'); }
  }

  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  private base64EncodeArrayBuffer(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
}
