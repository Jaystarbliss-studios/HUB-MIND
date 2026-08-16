/**
 * Live Audio Client for Gemini Multimodal Live API
 * Provides low-latency 16kHz PCM streaming capture and 24kHz gapless playback
 */

export interface LiveAudioCallbacks {
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onShawnStateChange: (state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'muted') => void;
  onUserTranscript: (text: string) => void;
  onShawnTranscript: (text: string) => void;
  onTurnComplete: () => void;
  onError?: (errorMsg: string) => void;
  onAudioLevel?: (inputLevel: number, outputLevel: number) => void;
}

export class LiveAudioClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveAudioCallbacks;
  
  private isMuted: boolean = false;
  private isPushToTalkActive: boolean = false;
  private pushToTalkMode: boolean = false;
  private levelIntervalId: number | null = null;

  constructor(callbacks: LiveAudioCallbacks) {
    this.callbacks = callbacks;
  }

  public async resumeAudioContext(): Promise<void> {
    if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume();
      console.log('AudioContext resumed via user gesture');
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume();
    }
  }

  public async connect(): Promise<void> {
    this.callbacks.onStatusChange('connecting');
    this.callbacks.onShawnStateChange('thinking');

    try {
      // 1. Setup AudioContexts
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      // Resume AudioContexts if suspended
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      // Output chain
      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputGainNode.gain.value = 1.0;
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 128;
      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);

      // 2. Setup Mic Stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!this.inputAudioCtx) return; // aborted by disconnect

      if (!this.inputAudioCtx) throw new Error('inputAudioCtx is null after getUserMedia');
      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.inputGainNode = this.inputAudioCtx.createGain();
      this.inputGainNode.gain.value = 1.0;

      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 128;

      // 4096 buffer size at 16000Hz gives ~256ms chunk duration
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.sourceNode.connect(this.inputGainNode);
      this.inputGainNode.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      // 3. Connect WebSocket to backend Live proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to Shawn Live WebSocket');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ready') {
            this.callbacks.onStatusChange('connected');
            this.callbacks.onShawnStateChange('listening');
          } else if (data.type === 'audio' && data.audio) {
            this.callbacks.onShawnStateChange('speaking');
            console.log('Received audio chunk from server, length:', data.audio.length);
            this.playAudioChunk(data.audio);
          } else if (data.type === 'input_transcription') {
            this.callbacks.onUserTranscript(data.text);
          } else if (data.type === 'output_transcription') {
            this.callbacks.onShawnTranscript(data.text);
          } else if (data.type === 'turn_complete') {
            this.callbacks.onTurnComplete();
            if (this.activeSources.length === 0) {
              this.callbacks.onShawnStateChange('listening');
            }
          } else if (data.type === 'interrupted') {
            this.handleInterruption();
          } else if (data.type === 'error') {
            if (this.callbacks.onError) this.callbacks.onError(data.message || 'Live session error');
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        if (this.callbacks.onError) this.callbacks.onError('WebSocket connection error');
        this.callbacks.onStatusChange('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.callbacks.onStatusChange('disconnected');
        this.callbacks.onShawnStateChange('idle');
      };

      // 4. Capture Mic Audio & Stream PCM 16kHz
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Push to talk check
        if (this.pushToTalkMode && !this.isPushToTalkActive) {
          return;
        }

        if (this.isMuted) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBuffer = this.floatTo16BitPCM(inputData);
        const base64 = this.base64EncodeArrayBuffer(pcmBuffer);

        this.ws.send(
          JSON.stringify({
            type: 'audio',
            audio: base64,
          })
        );
      };

      // Start Level Monitor for Visualizers
      this.startLevelMonitor();

    } catch (error: any) {
      console.error('Failed to start Live Audio Client:', error);
      if (this.callbacks.onError) this.callbacks.onError(error.message || 'Failed to initialize audio or mic');
      this.callbacks.onStatusChange('error');
      this.disconnect();
    }
  }

  private startLevelMonitor() {
    if (this.levelIntervalId) clearInterval(this.levelIntervalId);

    const inputDataArray = new Uint8Array(64);
    const outputDataArray = new Uint8Array(64);

    this.levelIntervalId = window.setInterval(() => {
      let inputLevel = 0;
      let outputLevel = 0;

      if (this.inputAnalyser && !this.isMuted && (!this.pushToTalkMode || this.isPushToTalkActive)) {
        this.inputAnalyser.getByteFrequencyData(inputDataArray);
        let sum = 0;
        for (let i = 0; i < inputDataArray.length; i++) {
          sum += inputDataArray[i];
        }
        inputLevel = sum / (inputDataArray.length * 255);
      }

      if (this.outputAnalyser) {
        this.outputAnalyser.getByteFrequencyData(outputDataArray);
        let sum = 0;
        for (let i = 0; i < outputDataArray.length; i++) {
          sum += outputDataArray[i];
        }
        outputLevel = sum / (outputDataArray.length * 255);

        // If Shawn is speaking, keep state active
        if (outputLevel > 0.05 && this.activeSources.length > 0) {
          this.callbacks.onShawnStateChange('speaking');
        } else if (this.activeSources.length === 0 && !this.isMuted) {
          if (inputLevel > 0.08) {
            this.callbacks.onShawnStateChange('listening');
          }
        }
      }

      if (this.callbacks.onAudioLevel) this.callbacks.onAudioLevel(inputLevel, outputLevel);
    }, 40);
  }

  private playAudioChunk(base64Audio: string): void {
    if (!this.outputAudioCtx || !this.outputGainNode) { console.warn('Cannot play audio: outputAudioCtx or outputGainNode missing'); return; }
    if (this.outputAudioCtx.state === 'suspended') { console.warn('AudioContext is suspended! Audio will not play unless resumed by a user gesture.'); }

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        const sample = int16Array[i];
        float32Array[i] = sample < 0 ? sample / 32768 : sample / 32767;
      }

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputGainNode);

      const currentTime = this.outputAudioCtx.currentTime;
      // Add slight jitter buffer (40ms) if scheduling first chunk or fallen behind
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.04;
      }

      sourceNode.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.push(sourceNode);

      sourceNode.onended = () => {
        const index = this.activeSources.indexOf(sourceNode);
        if (index !== -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening');
        }
      };
    } catch (e) {
      console.error('Error decoding/playing audio chunk:', e);
    }
  }

  public handleInterruption(): void {
    this.callbacks.onShawnStateChange('interrupted');
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    setTimeout(() => {
      if (this.activeSources.length === 0) {
        this.callbacks.onShawnStateChange(this.isMuted ? 'muted' : 'listening');
      }
    }, 400);
  }

  public sendText(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.callbacks.onShawnStateChange('thinking');
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  public sendImageFrame(base64Jpeg: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'video', image: base64Jpeg }));
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.callbacks.onShawnStateChange('muted');
    } else {
      this.callbacks.onShawnStateChange(this.activeSources.length > 0 ? 'speaking' : 'listening');
    }
  }

  public setPushToTalk(enabled: boolean): void {
    this.pushToTalkMode = enabled;
  }

  public setPushToTalkActive(active: boolean): void {
    this.isPushToTalkActive = active;
  }

  public setMicGain(value: number): void {
    if (this.inputGainNode) {
      this.inputGainNode.gain.value = value;
    }
  }

  public setOutputVolume(value: number): void {
    if (this.outputGainNode) {
      this.outputGainNode.gain.value = value;
    }
  }

  public disconnect(): void {
    if (this.levelIntervalId) {
      clearInterval(this.levelIntervalId);
      this.levelIntervalId = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeSources = [];

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.callbacks.onStatusChange('disconnected');
    this.callbacks.onShawnStateChange('idle');
  }

  // Utilities
  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // Little-endian
    }
    return buffer;
  }

  private base64EncodeArrayBuffer(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
