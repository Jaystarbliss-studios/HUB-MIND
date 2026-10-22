/*
 * Offline Jess animation manifest.
 *
 * Add generated transparent PNG frames beneath:
 *   electron/jess-companion/assets/animations/<animation-name>/
 *
 * Then list their relative paths below, in playback order. Paths are relative
 * to this manifest file. A missing/empty sequence intentionally falls back to
 * the bundled Hub-Mind icon until Jess's approved image pack is installed.
 */
window.JESS_ANIMATION_MANIFEST = Object.freeze({
  version: 1,
  width: 96,
  height: 96,
  fps: 8,
  fallback: "../../dist/icon.svg",
  // Normalized rectangular hit area for the visible default orb.
  // Tighten or expand this after Jess's full-body animation frames are added.
  hitArea: { x: 0.14, y: 0.14, width: 0.72, height: 0.72 },
  animations: {
    idle: { fps: 8, loop: true, frames: [] },
    listening: { fps: 8, loop: true, frames: [] },
    thinking: { fps: 8, loop: true, frames: [] },
    speaking: { fps: 10, loop: true, frames: [] },
    working: { fps: 8, loop: true, frames: [] },
    waiting_approval: { fps: 6, loop: true, frames: [] },
    success: { fps: 8, loop: false, frames: [] },
    error: { fps: 6, loop: false, frames: [] },
    muted: { fps: 6, loop: true, frames: [] }
  }
});
