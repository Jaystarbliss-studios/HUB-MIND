# Jess Windows Desktop Agent — Gap Report

Audit date: 2026-10-12. This is a repository audit, not proof that the packaged Windows executable was run.

## Verified architecture

- `electron/main.cjs` creates the Electron workspace and companion window, sets `backgroundThrottling: false`, maintains Full Control Session state, appends action/session events to `jess-native-audit.jsonl`, and exposes an allowlisted native-action IPC handler.
- `electron/preload.cjs` exposes a limited `hubMindDesktop` bridge through context-isolated IPC.
- `electron/agentBridge.cjs` starts `electron/jess-agent.ps1` on Windows and exchanges newline-delimited JSON over stdio with per-call timeouts.
- `electron/jess-agent.ps1` contains Win32 interop and UI Automation support. This is a PowerShell sidecar, not the requested .NET 8 self-contained helper.
- `src/lib/jessTools.ts` declares native window, mouse, screenshot, UI Automation, text, keyboard, app-launch, path and command tools. Its main native wrapper previously considered `ok: true` sufficient for success; this branch now requires both `ok: true` and `verified: true`.
- `src/pages/CompanionPage.tsx` uses the orb-only `/jess-orb.svg` asset and supports dragging the companion.
- `src/services/jessWakeListener.ts` uses browser `SpeechRecognition`/`webkitSpeechRecognition`. That does not establish that always-on wake detection works in packaged Electron.
- `electron-builder.yml` configures an NSIS installer with `perMachine: false`; it does not configure the requested signed installer or elevated scheduled-task setup.
- `server.ts` provisions a Gemini Live token; `src/services/liveAudioClient.ts` uses browser/Web Audio APIs. A native wake-word engine is not implemented in those files.

## Feature audit

| Requested feature | Current repository evidence | Status |
|---|---|---|
| Window enumeration/focus/close/minimize/maximize/restore/move/resize/snap | Native declarations, IPC allowlist and PowerShell sidecar | Partially implemented; real postconditions need Windows tests |
| Mouse move/click/double/right-click/scroll/drag | Native declarations and sidecar | Partially implemented; input delivery is not proof of target effect |
| Type text / arbitrary key combinations | Sidecar and native declarations | Partially implemented; focus and postcondition checks need testing |
| Screenshot and screen text | Sidecar screenshot/UIA support and tool declarations | Partially implemented; DPI/multi-monitor mapping needs validation |
| UI Automation find/invoke | Sidecar and tool declarations | Partially implemented; app-specific reliability unknown |
| Installed app resolution/launch | Native launch tool claims Start Menu/PATH resolution | Needs Windows acceptance tests |
| Run arbitrary commands as administrator | Legacy command path explicitly runs with current-user permissions; native runner is not proven elevated | Missing for requested admin behavior |
| Real Chrome tab/DOM control | No Chrome extension/native-messaging implementation in inspected paths | Missing |
| “Show me X” brings workspace forward and verifies visible target | `showMain()` creates/shows/focuses the main window; no complete `show_in_app` tool found in inspected registry | Partial; route and visible-target confirmation remain |
| Honest verified results | Native sidecar returns `ok`, `verified`, `evidence`; renderer wrapper previously checked only `ok` | Primary native wrapper fixed on this branch; audit legacy wrappers next |
| Full Control Session and audit log | Main-process session state and JSONL log exist | Partial; signed-in identity is passed from renderer and needs stronger binding |
| Emergency stop hotkey | Advertised in tool copy but not registered in main | Registration added on this branch; runtime test required |
| Tray stop and orb reset | Previously absent | Added on this branch |
| Orb position | Previously inferred display from existing companion bounds | Changed to primary display work area on this branch |
| Single orb in desktop shell | In-app orb hidden when `isDesktopShell` | Present in inspected component; package behavior untested |
| Native offline wake word | Browser SpeechRecognition only | Missing |
| Elevated installer/autostart/scheduled task/signing | Current builder config is per-user NSIS | Missing |
| Chrome native messaging and extension install | No implementation found in inspected paths | Missing |
| Release workflow producing downloadable installer | Package script targets Windows NSIS; workflow was not fully verified in this audit | Not verified |
| UAC secure desktop/password prompts/DRM | Platform restrictions | Cannot promise automation or capture |

## Changes in this branch

1. Native tool execution reports success only when both `ok` and `verified` are true; evidence and error fields remain available to Jess.
2. Registers Ctrl+Alt+Shift+J as a global emergency stop; logs a warning if Electron cannot register it.
3. Adds tray actions to stop the Full Control Session and reset/show the orb at the primary display's bottom-right work-area corner.
4. Uses the primary display's work area for orb placement instead of inferring the display from stale companion bounds.
5. Adds a desktop-only `show_hub_mind_workspace` tool and fixes workspace restoration to hide the companion even when the main window must be recreated.

## Windows smoke tests (not yet run)

- Launch the packaged app; confirm only one orb is visible and it starts at the primary display's bottom-right corner.
- Minimize Hub-Mind; confirm the orb remains. Restore Hub-Mind; confirm the orb hides.
- Start Full Control Session by voice; confirm the visible indicator and audit-log start entry.
- Press Ctrl+Alt+Shift+J; confirm native control stops immediately and the audit log records the stop.
- Use tray → Stop Jess; confirm the same behavior.
- Drag the orb, then use tray → Reset Jess orb to bottom-right; confirm its position.
- Ask Jess to list windows, snap Notepad, read screen text, type into Notepad and capture a screenshot. Confirm she reports “done” only when the result contains `verified: true`.
- Confirm `verified: false` is described as unverified/failure, not success.

## Remaining phases

- **P1 (in progress):** dynamic capability manifest/system prompt; remove misleading DOM-only OS controls; add a `show_in_app` flow that focuses the workspace and verifies visibility; audit every legacy wrapper.
- **P2:** harden sidecar postconditions, DPI/per-monitor coordinates, UIA/OCR and window enumeration; test actual Windows interactions.
- **P3:** installer-time elevation and secure logon task; do not claim it is done until install/uninstall and privilege boundaries are tested.
- **P4:** Chrome MV3 extension plus Native Messaging host; verify real-profile tabs and DOM operations.
- **P5:** native offline wake word, robust session lifetime, startup behavior and packaging/signing.
