# Jess offline desktop companion

## Goal

The Windows desktop companion must render without loading the remote Hub-Mind website. The character's visible layer must still start when the network is unavailable, while the main Hub-Mind workspace and cloud-backed intelligence may remain unavailable until connectivity returns.

## Implementation boundary

- **electron/main.cjs** owns the native transparent window and its lifecycle.
- **electron/companion-preload.cjs** exposes only the companion actions needed by the local renderer.
- **electron/jess-companion/** contains a self-contained HTML/CSS/JavaScript animation player that is packaged with the Electron app.
- **electron/preload.cjs** and **src/components/JessFloatingAssistant.tsx** relay verified assistant state into the local companion and receive bounded activation commands.
- Browser/file/Windows operations remain behind Hub-Mind's existing authenticated tool and native-action layers. The local character renderer does not receive shell or filesystem access.

## Offline behaviour

The companion is created immediately after Electron is ready, before the remote workspace finishes loading. Its initial fallback image is **dist/icon.svg**, which is already included in the desktop package. If the network is down, the icon, transparent window, drag behaviour, tray controls, and available local animation frames still work. Cloud conversation, account authentication, and online search are not claimed to be offline-capable by this change.

## Animation asset workflow

Add generated transparent PNG frames to folders beneath:

    electron/jess-companion/assets/animations/

Suggested folder names:

- **idle/** — breathing, blinking, small gaze changes
- **listening/** — attention shift and head movement
- **thinking/** — thoughtful pose
- **speaking/** — speech and mouth frames
- **working/** — task-focused poses
- **waiting_approval/** — request for permission
- **success/** — confirmation gesture
- **error/** — error acknowledgement

List each filename in chronological playback order in **animation-manifest.js**, using paths relative to that manifest. Keep the frames transparent, with consistent canvas dimensions, framing, scale, lighting, and alignment. Update the canvas width, height, and hitArea after a full-body Jess frame pack replaces the temporary orb. Empty or missing sequences fall back to the bundled icon.

The manifest deliberately starts with empty frame arrays because the approved Jess art pack has not yet been committed to this repository. Do not commit generated art unless the intended frames have been reviewed for identity consistency and usage rights.

## Interaction and click-through

The local preload only exposes state subscription, show/hide/listening actions, movement, validated window sizing, and pointer-interaction toggling. Main-process handlers validate the sender window and clamp all positions and sizes. The companion normally passes pointer input through transparent areas, and temporarily accepts input over its declared character hit area or hide control.

Single-click toggles the live session when the signed-in workspace is ready; double-click opens the workspace. When the workspace is unavailable, the visual companion remains present and reports that state instead of pretending that online task execution succeeded.

## Acceptance tests

1. Start the packaged app with the network disconnected. Jess must appear before the remote workspace becomes available.
2. Confirm no remote URL is loaded by the companion window.
3. Drag the character, move the pointer through transparent margins, and verify underlying windows/icons remain clickable outside the hit area.
4. Close or minimize the workspace and confirm the companion stays visible.
5. Connect the workspace and confirm listening/thinking/speaking/error state changes reach the local renderer.
6. Double-click Jess and verify the workspace opens; single-click toggles the authenticated live session when the assistant is mounted.
7. Add a tiny test animation to the manifest, rebuild, and confirm playback continues without network access.
8. Test high-DPI and multi-monitor positioning before releasing the installer.

## Explicit limitations

This is the offline visual companion and event-bridge milestone, not a claim that all of Jess works offline. Gemini Live, cloud APIs, online search, account authentication, and remote application pages still require their respective services. Full-body animation frames are not included yet; until the approved art pack is added, the existing local icon is the fallback.
