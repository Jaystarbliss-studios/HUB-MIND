export interface JessWakeListenerOptions {
  onWake: (prompt: string) => void;
  onStateChange?: (listening: boolean) => void;
}

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: {
    isFinal: boolean;
    [index: number]: { transcript: string };
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const WAKE_PATTERN = /\bjess\b/i;
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return typeof Recognition === 'function' ? Recognition as SpeechRecognitionConstructor : null;
}

export function isJessPcWakeSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (MOBILE_UA.test(navigator.userAgent)) return false;
  if ((navigator as any).userAgentData?.mobile === true) return false;
  if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return false;
  return getSpeechRecognition() !== null;
}

export function extractJessWakeCommand(transcript: string): string | null {
  const text = String(transcript || '').replace(/\s+/g, ' ').trim();
  const wakeMatch = text.match(WAKE_PATTERN);
  if (!wakeMatch || wakeMatch.index === undefined) return null;

  let command = text.slice(wakeMatch.index + wakeMatch[0].length)
    .replace(/^[\s,:;.!?\-]+/, '')
    .trim();

  for (let i = 0; i < 3; i++) {
    command = command.replace(/^jess[\s,:;.!?\-]*/i, '').trim();
  }
  return command;
}

export class JessPcWakeListener {
  private recognition: SpeechRecognitionLike | null = null;
  private running = false;
  private restarting = false;
  private restartTimer: number | null = null;

  constructor(private readonly options: JessWakeListenerOptions) {}

  start(): void {
    if (this.running || !isJessPcWakeSupported()) return;
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    this.running = true;
    this.restarting = false;
    this.createRecognition(Recognition);
    this.beginRecognition();
  }

  stop(): void {
    this.running = false;
    this.restarting = false;

    if (this.restartTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const recognition = this.recognition;
    this.recognition = null;

    if (recognition) {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort?.();
        recognition.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }
    }

    this.options.onStateChange?.(false);
  }

  private createRecognition(Recognition: SpeechRecognitionConstructor): void {
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-NG';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.restarting = false;
      this.options.onStateChange?.(true);
    };

    recognition.onresult = (event) => {
      if (!this.running) return;

      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (!result?.isFinal) continue;

        const transcript = String(result[0]?.transcript || '').trim();
        const command = extractJessWakeCommand(transcript);
        if (!command && !/\bjess\b/i.test(transcript)) continue;

        this.running = false;
        try {
          recognition.abort?.();
          recognition.stop();
        } catch {
          // Ignore browser race conditions during shutdown.
        }

        this.options.onStateChange?.(false);
        this.options.onWake(command || '');
        return;
      }
    };

    recognition.onerror = (event) => {
      this.options.onStateChange?.(false);
      if (!this.running) return;

      const error = String(event?.error || '');
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        this.running = false;
        return;
      }

      this.scheduleRestart();
    };

    recognition.onend = () => {
      this.options.onStateChange?.(false);
      if (this.running) this.scheduleRestart();
    };

    this.recognition = recognition;
  }

  private beginRecognition(): void {
    const recognition = this.recognition;
    if (!recognition || !this.running) return;

    try {
      recognition.start();
    } catch {
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    if (!this.running || this.restarting || typeof window === 'undefined') return;

    this.restarting = true;
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      this.restarting = false;

      if (!this.running || !isJessPcWakeSupported()) return;

      const Recognition = getSpeechRecognition();
      if (!Recognition) return;

      this.createRecognition(Recognition);
      this.beginRecognition();
    }, 700);
  }
}
