# Jess Windows desktop capability gap report

Audit basis: repository sources reviewed for the native Windows work in this branch. This report separates code present from behavior that still needs a real Windows smoke test.

## Feature audit

| Requested feature | Existing / changed implementation | Status and limits |
|---|---|---|
| Launch installed Windows apps | `electron/jess-agent.ps1` `launch_app`; Start Menu AppID and PATH lookup | Implemented as a first pass; exact app resolution/window matching must be smoke-tested. |
| Enumerate windows, foreground focus | `electron/jess-agent.ps1` `Get-Windows`, `focus_window` | Implemented for visible titled top-level windows; hidden/untitled windows are omitted. |
| Close/minimize/maximize/restore | `electron/jess-agent.ps1` window action switch | Implemented with Win32 messages/show states; each action must be tested against real applications. |
| Move/resize/snap windows | `electron/jess-agent.ps1` `MoveWindow` and snap positions | Basic positions supported. Snap currently targets the primary monitor only; exact bounds and monitor selection are not complete. |
| Mouse move/click/double/right-click/scroll/drag | `electron/jess-agent.ps1` Win32 cursor and mouse events | Input injection exists. A sent click/drag is deliberately not reported as verified application success without follow-up evidence. |
| Type text / press key combinations | `electron/jess-agent.ps1` Unicode SendInput and `Send-Key` | Basic Unicode typing and named/letter combinations exist; unusual layouts, dead keys, held keys and target-field verification need testing. |
| Read text from screen | `electron/jess-agent.ps1` UI Automation tree traversal | UIA names are available when apps expose accessible text. OCR fallback is not implemented, so canvas/remote/unsupported controls may return little or no text. |
| Screenshot / click coordinates | `electron/jess-agent.ps1` GDI capture per monitor | Returns each monitor's physical bounds and image data, so offsets are preserved. DPI scaling and coordinate mapping need Windows/multi-monitor tests; screenshots are not yet passed to Gemini as image parts automatically. |
| Find/invoke UI elements | `find_ui_element`, `invoke_ui_element` in the native helper | UIA find/invoke first pass exists; invoke results remain unverified until a follow-up screen read/screenshot confirms the outcome. |
| Run system commands | `run_command` in the native helper | Bounded PowerShell runs as the current user. It is **not administrator by default**; common destructive commands are blocked. No elevation/scheduled-task bypass has been added. |
| Local time / system info | `get_time`, `system_info` | Implemented; Windows runtime still needs testing. |
| Jess capability honesty | `src/services/liveAudioClient.ts` system instructions and desktop-only tool filtering | Tool descriptions and results now distinguish injected input from verified outcomes. A runtime smoke test must confirm the model follows this reliably. |
| Full Control Session | `electron/main.cjs`, `electron/preload.cjs`, `src/lib/jessTools.ts` | Session is opt-in, auditable, and stoppable by voice/tool, tray, app exit, or Ctrl+Alt+Shift+J. The indicator is a small colored dot on the orb. |
| Audit log | Electron main writes `jess-native-audit.jsonl` under the app user-data directory | Append-only JSONL entries are implemented; disk-full/permission failures are logged to console, not surfaced as a dedicated alert. |
| Strict origin protection | `electron/main.cjs` `assertTrustedSender` | Validates the hosted Hub-Mind origin. Per-call verification of the signed-in Firebase UID is **not yet implemented**; this remains a hardening gap before granting admin-level capabilities. |
| Voice session while hidden/minimized | `electron/main.cjs` sets `backgroundThrottling: false` for the voice windows | Mitigates Chromium background throttling; does not prove microphone/session survival across Windows sleep, device changes, or network interruption. |
| Jess orb | `public/jess-orb.svg`, `src/pages/CompanionPage.tsx`, `src/pages/companion.css` | Dedicated orb asset; workspace is not rendered in the companion window. Close/open controls appear on hover; window is focusable and draggable. |
| Dark workspace theme | `src/index.css` | Root dark color scheme and dark body/root backgrounds are explicit. Keep workspace palette unchanged; public-home styles are scoped under `.hm-public`. |
| Screen sharing | `src/components/JessFloatingAssistant.tsx`, `electron/main.cjs` display-media handler and permission handler | Desktop bridge detection is present and the chooser is explicit. Actual capture in the packaged installer is not verified here; use the checklist below. |
| Chrome in the real logged-in profile | Current main process + browser renderer | **Not implemented** as an extension/native-messaging connection. Do not claim tab/DOM control of the real Chrome profile. |
| OCR fallback | Native helper | **Not implemented**. |
| Native “Hey Jess” wake word | `src/services/jessWakeListener.ts` | Still uses browser Web Speech recognition. No offline native wake-word engine is included; continuous wake detection in Electron is unverified. |
| Elevated commands / no UAC at normal launch | `electron-builder.yml` and native helper | **Not implemented**. No highest-privilege scheduled task is silently registered. This is intentionally not enabled before per-UID IPC authorization and isolated privileged-sidecar hardening. |
| Signed installer / SmartScreen | `.github/workflows/windows-release.yml`, `electron-builder.yml` | Windows installer build/release automation exists; signing certificate/publisher and SmartScreen reputation are not configured. |
| Installer contains sidecar | `electron-builder.yml` includes `electron/**` | The PowerShell helper is included by the file glob. It is not a .NET 8 self-contained signed executable yet. |

## Files audited

- `electron/main.cjs`: Electron window lifecycle, display capture chooser/permissions, tray, IPC trust boundary, session/audit controls, global kill hotkey, background throttling.
- `electron/preload.cjs`: narrow `contextBridge` APIs for native actions.
- `electron/agentBridge.cjs`: persistent PowerShell child process and JSON-lines RPC.
- `electron/jess-agent.ps1`: Win32 windows/input/screenshot, UI Automation, app launching, command execution.
- `electron-builder.yml`: NSIS packaging configuration; per-machine install, elevation, code signing and scheduled task remain incomplete.
- `src/lib/jessTools.ts`: native tool declarations and dispatch; legacy dialog-gated native actions are no longer offered in the tool registry.
- `src/services/liveAudioClient.ts`: live tool declaration list filtered for desktop, dynamic capability honesty instructions, Jess identity and web research guidance.
- `src/services/jessWakeListener.ts`: browser SpeechRecognition fallback; no native wake-word engine.
- `src/components/JessFloatingAssistant.tsx`: desktop detection and screen-sharing capture flow; screen stream still samples down to 960x540 for model frames.
- `src/pages/CompanionPage.tsx`, `src/pages/companion.css`, `public/jess-orb.svg`: dedicated icon-only overlay, drag and hover controls.
- `public/icon.svg`: workspace/application icon, no longer used as the orb artwork.
- `.github/workflows/windows-release.yml`: Windows installer workflow, PowerShell syntax parse, typecheck, tests, build and release artifact.
- `server.ts`: server-side live token/search integration; not a Windows native automation layer.
- `docs/windows-desktop-native-agent.md`: operational notes and explicit limits.

## Acceptance test checklist (packaged Windows build)

1. Install the new installer, sign in, minimize the workspace. Confirm only the orb remains at the bottom-right. Drag it to another visible location, click the orb to reopen the workspace, then close the workspace again and verify the orb returns.
2. Hover the orb, click X, verify it hides. Use the tray to show it again.
3. Say “Jess, full control”. Verify the small active indicator appears. Say “Jess, stop”; verify it disappears. Repeat with Ctrl+Alt+Shift+J and the tray stop action.
4. Say “list my windows”; verify titles, process names, bounds and foreground status are returned.
5. Say “open Notepad and snap it to the left half”. Verify the new window appears and its bounds change; Jess must report failure if it cannot verify the target.
6. Test minimize, maximize, restore, move, resize and close on Notepad. Test clicking, scrolling, dragging, typing and Ctrl+S in a disposable text document; confirm the actual UI result.
7. Say “read what is on my screen” and “find the Save button”. Confirm accessible text is read; note that OCR fallback is not yet available.
8. Say “take a screenshot”. Check each monitor's reported bounds against Windows Display Settings; verify a click at a known coordinate maps to the intended physical location. Repeat with mixed-DPI and multiple monitors.
9. Say “open Chrome, navigate to example.com, scroll and close the tab”. The native helper in this build does not provide real Chrome tab APIs, so Jess must not claim the whole browser workflow succeeded; this test documents the remaining extension integration.
10. Say “run ipconfig and read the IP”. Confirm output and exit status are returned; confirm the command is not elevated and does not claim administrator execution.
11. Use the web app/PWA and compare with the Windows app: workspace backgrounds must remain dark; only the public homepage may use its own scoped styling.
12. Start screen sharing from the installed desktop app. Confirm the chooser lists screens/windows, select one, verify frames arrive, stop sharing, then repeat after minimizing/restoring the workspace.

## Validation boundary

GitHub Actions can parse the PowerShell source, typecheck TypeScript, run repository tests, build the web bundle, and package an NSIS installer. It cannot prove the native input actions work correctly on your specific laptop. Before calling this complete, the Windows installer must be downloaded and exercised using the checklist above. This branch does not claim OCR, real Chrome control, native wake-word detection, elevated execution, or successful Windows runtime smoke tests.
