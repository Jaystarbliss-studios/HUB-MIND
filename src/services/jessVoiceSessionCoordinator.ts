/**
 * Single-owner coordinator for Jess microphone consumers in the renderer.
 * This coordinates capture ownership only; Electron remains the authority for
 * native actions and wake-listener process lifecycle.
 */
export type JessAudioOwner = 'live-conversation' | 'dictation';

type Listener = (owner: JessAudioOwner | null) => void;
let activeOwner: JessAudioOwner | null = null;
const listeners = new Set<Listener>();

function publish() {
  for (const listener of listeners) {
    try { listener(activeOwner); } catch (error) { console.warn('[Jess audio session] Listener failed:', error); }
  }
}

export function claimJessAudio(owner: JessAudioOwner): boolean {
  if (activeOwner && activeOwner !== owner) return false;
  if (activeOwner !== owner) {
    activeOwner = owner;
    publish();
  }
  return true;
}

export function releaseJessAudio(owner: JessAudioOwner): void {
  if (activeOwner !== owner) return;
  activeOwner = null;
  publish();
}

export function getJessAudioOwner(): JessAudioOwner | null {
  return activeOwner;
}

export function subscribeJessAudioOwner(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeOwner);
  return () => listeners.delete(listener);
}
