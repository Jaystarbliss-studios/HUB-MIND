/**
 * Deprecated compatibility stub.
 * Shawn no longer uses wake-word detection or background microphone listening.
 * Live audio starts only after an explicit user action.
 */
export class WakeWordDetector {
  constructor(_config?: unknown) {}
  setCallbacks(_callbacks?: unknown) {}
  async start(): Promise<void> {}
  stop(): void {}
  getStatus() {
    return { isRunning: false, enabled: false };
  }
}
