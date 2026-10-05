export interface JessWakeListenerOptions {
  onWake: (prompt: string) => void;
  onStateChange?: (listening: boolean) => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const WAKE_PATTERN = /\b(?:hey|hi)?\s*jess\b/i;
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isJessPcWakeSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (MOBILE_UA.test(navigator.userAgent)) return false;
  if ((navigator as any).userAgentData?.mobile === true) return false;
  if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return false;
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return typeof Recognition === 'function';
}

export function extractJessWakeCommand(transcript: string): string | null {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  if (!text || !WAKE_PATTERN.test(text)) return null;

  const match = text.match(/\b(?:hey|hi)?\s*jess\b[\s,:;.!?\-]*(.*)$/i);
  let command = String(match?.[1] || '').trim();

  // "Jess, Jess" is still a wake command, not a request to send "Jess" to Gemini.
  for (let i = 0; i < 3; i++) {
    command = command.replace(/^jess[\s,:;.!?\-]*/i, '').trim();
  }
  return command;
}

export class JessPcWakeListener {
  private recognition: SpeechRecognitionLike | null = null;
  private stopped = true;
  private restarting = false;
  private wakeTriggered = false;
  private restartTimer: number | null = null;

  constructor(private readonly options: JessWakeListenerOptions) {}

  start(): boolean {
    if (!isJessPcWakeSupported()) return false;
    if (!this.stopped) return true;

    const Recognition = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as SpeechRecognitionConstructor;
    this.stopped = false;
    this.wakeTriggered = false;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.restarting = false;
      this.options.onStateChange?.(true);
    };

    recognition.onresult = (event: any) => {
      if (this.stopped || this.wakeTriggered) return;

      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0]?.transcript) continue;

        const transcript = String(result[0].transcript);
        const command = extractJessWakeCommand(transcript);
        if (command === null) continue;

        this.wakeTriggered = true;
        this.options.onStateChange?.(false);
        try { recognition.stop(); } catch {}
        this.options.onWake(command);
        return;
      }
    };

    recognition.onerror = (event: any) => {
      const error = String(event?.error || '');
      this.options.onStateChange?.(false);

      // Permission denial is terminal until the user changes the browser setting.
      // Transient network/no-speech errors are allowed to restart quietly.
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        this.stop();
        return;
      }
    };

    recognition.onend = () => {
      this.options.onStateChange?.(false);
      if (this.stopped || this.wakeTriggered || this.restarting) return;

      this.restarting = true;
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null;
        if (this.stopped || this.wakeTriggered) {
          this.restarting = false;
          return;
        }
        try {
          recognition.start();
        } catch {
          this.restarting = false;
          this.restartTimer = window.setTimeout(() => {
            this.restartTimer = null;
            if (!this.stopped && !this.wakeTriggered) this.start();
          }, 800);
        }
      }, 250);
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      this.recognition = null;
      this.stopped = true;
      this.options.onStateChange?.(false);
      return false;
    }
  }

  stop(): void {
    this.stopped = true;
    this.wakeTriggered = false;
    this.restarting = false;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try { this.recognition?.stop(); } catch {}
    this.recognition = null;
    this.options.onStateChange?.(false);
  }
}
