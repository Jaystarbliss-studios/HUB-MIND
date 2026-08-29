import { WakeWordConfig } from '../types';

export interface WakeWordMatchResult {
  detected: boolean;
  matchedPhrase: string;
  fullTranscript: string;
  remainingPrompt: string;
}

export class WakeWordDetector {
  private recognition: any = null;
  private isRunning: boolean = false;
  private config: WakeWordConfig;
  private onWakeCallback: ((result: WakeWordMatchResult) => void) | null = null;
  private onInterimCallback: ((transcript: string, matched: boolean) => void) | null = null;
  private onStatusCallback: ((listening: boolean, error?: string) => void) | null = null;
  private restartTimeout: any = null;

  constructor(config: WakeWordConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: WakeWordConfig) {
    const wasRunning = this.isRunning;
    this.config = newConfig;
    if (wasRunning && !newConfig.enabled) {
      this.stop();
    } else if (!wasRunning && newConfig.enabled) {
      this.start();
    }
  }

  public setCallbacks({
    onWake,
    onInterim,
    onStatus,
  }: {
    onWake?: (result: WakeWordMatchResult) => void;
    onInterim?: (transcript: string, matched: boolean) => void;
    onStatus?: (listening: boolean, error?: string) => void;
  }) {
    if (onWake) this.onWakeCallback = onWake;
    if (onInterim) this.onInterimCallback = onInterim;
    if (onStatus) this.onStatusCallback = onStatus;
  }

  public start(): boolean {
    if (this.isRunning) return true;
    if (!this.config.enabled) return false;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (this.onStatusCallback) {
        this.onStatusCallback(false, 'SpeechRecognition not supported in this browser');
      }
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isRunning = true;
        if (this.onStatusCallback) this.onStatusCallback(true);
      };

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          const isFinal = event.results[i].isFinal;
          const matchResult = this.checkTranscriptMatch(transcript);

          if (this.onInterimCallback) {
            this.onInterimCallback(transcript, matchResult.detected);
          }

          if (matchResult.detected) {
            // Play wake sound feedback if configured
            if (this.config.soundFeedback) {
              this.playWakeChime();
            }

            if (this.onWakeCallback) {
              this.onWakeCallback(matchResult);
            }
            break;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // Non-fatal errors like 'no-speech' or 'aborted' are normal in continuous listening
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Wake word detector error:', event.error);
          if (this.onStatusCallback) this.onStatusCallback(false, event.error);
        }
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        if (this.onStatusCallback) this.onStatusCallback(false);

        // Android/Web Speech frequently ends a session after silence. Restart
        // only when the detector was intentionally left running, with a longer
        // quiet gap so the browser does not repeatedly toggle the mic indicator.
        if (this.config.enabled) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.config.enabled && !this.isRunning) {
              try { this.recognition?.start(); } catch (e) {}
            }
          }, 1500);
        }
      };

      this.recognition.start();
      this.isRunning = true;
      return true;
    } catch (err: any) {
      console.warn('Failed to start wake word detector:', err);
      this.isRunning = false;
      if (this.onStatusCallback) this.onStatusCallback(false, err.message);
      return false;
    }
  }

  public stop() {
    this.isRunning = false;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.recognition = null;
    }
    if (this.onStatusCallback) this.onStatusCallback(false);
  }

  public getTargetPhrases(): string[] {
    switch (this.config.selectedPreset) {
      case 'hey_shawn':
        return ['hey shawn', 'hey, shawn', 'ay shawn', 'hey sean', 'hey, sean', 'shawn', 'sean'];
      case 'wake_up_shawn':
        return ['wake up shawn', 'shawn wake up', 'wake up, shawn', 'wake up'];
      case 'hello_shawn':
        return ['hello shawn', 'hello, shawn', 'hi shawn', 'hello there shawn'];
      case 'hi_shawn':
        return ['hi shawn', 'hi, shawn', 'greetings shawn'];
      case 'shawn':
        return ['shawn'];
      case 'custom':
        if (this.config.customKeyword && this.config.customKeyword.trim()) {
          const normalized = this.config.customKeyword.trim().toLowerCase();
          return [normalized];
        }
        return ['hey shawn'];
      default:
        return ['hey shawn'];
    }
  }

  public checkTranscriptMatch(rawTranscript: string): WakeWordMatchResult {
    if (!rawTranscript) {
      return { detected: false, matchedPhrase: '', fullTranscript: '', remainingPrompt: '' };
    }

    const clean = rawTranscript.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ');
    const targets = this.getTargetPhrases();
    const sensitivity = this.config.sensitivity || 'medium';

    for (const target of targets) {
      const cleanTarget = target.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ').trim();
      if (!cleanTarget) continue;

      let isMatch = false;
      let matchedIndex = -1;

      if (sensitivity === 'high') {
        // Substring anywhere or individual word match
        matchedIndex = clean.indexOf(cleanTarget);
        isMatch = matchedIndex !== -1;
      } else if (sensitivity === 'medium') {
        // Match with boundary / spaces
        const regex = new RegExp(`\\b${cleanTarget.replace(/\s+/g, '\\s+')}\\b`, 'i');
        const match = regex.exec(clean);
        if (match) {
          isMatch = true;
          matchedIndex = match.index;
        }
      } else {
        // Low sensitivity: strict starting phrase or exact match
        const trimmed = clean.trim();
        if (trimmed === cleanTarget || trimmed.startsWith(`${cleanTarget} `)) {
          isMatch = true;
          matchedIndex = clean.indexOf(cleanTarget);
        }
      }

      if (isMatch) {
        // Extract any prompt spoken immediately after wake word (e.g. "Hey Angel, what's our meeting schedule?")
        const afterWakeIndex = matchedIndex + cleanTarget.length;
        const remaining = rawTranscript.slice(afterWakeIndex).replace(/^[,\s.!?-]+/, '').trim();

        return {
          detected: true,
          matchedPhrase: target,
          fullTranscript: rawTranscript.trim(),
          remainingPrompt: remaining,
        };
      }
    }

    return {
      detected: false,
      matchedPhrase: '',
      fullTranscript: rawTranscript.trim(),
      remainingPrompt: '',
    };
  }

  public playWakeChime() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();

      const now = ctx.currentTime;
      
      // Dual resonant ascending chime tones (523.25Hz C5 -> 659.25Hz E5 -> 783.99Hz G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.32);
      });
    } catch (e) {
      console.debug('Chime playback note:', e);
    }
  }
}
