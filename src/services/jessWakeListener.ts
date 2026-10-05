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
  const text = String(transcript || '').replace(/\\s+/g, ' ').trim();
  const wakeMatch = text.match(WAKE_PATTERN);
  if (!wakeMatch || wakeMatch.index === undefined) return null;

  // Jess may appear anywhere in the spoken phrase. Everything after the
  // wake word becomes the first command sent to the newly opened Live session.
  let command = text.slice(wakeMatch.index + wakeMatch[0].length)
    .replace(/^[\\s,:;.!?\\-]+/, '')
    .trim();

  // "Jess, Jess" is still a wake command, not a request to send "Jess" to Gemini.
  for (let i = 0; i < 3; i++) {
    command = command.replace(/^jess[\\s,:;.!?\\-]*/i, '').trim();
  }
  return command;
}
