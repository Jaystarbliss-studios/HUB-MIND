# Jess Unified Voice Control Integration

## Goal

Make Jess the single user-facing voice-control system for Hub-Mind: reliable dictation, direct voice commands, accessible Windows control, browser automation, clear listening states, and verified actions. Reuse compatible Wheelhouse ideas and Windows accessibility APIs without embedding a second full assistant or duplicating microphones, command routers, permission checks, or UI.

## Existing building blocks (audit baseline)

- `src/services/liveAudioClient.ts`: primary real-time conversational audio, audio worklet/worker processing, transcript and tool-call flow.
- `native/JessOfflineWake`: consent-gated local Windows wake-word listener using `System.Speech`; Electron stops it when it emits a wake event.
- `src/components/VoiceDictation.tsx`: separate, user-triggered browser speech-recognition control for text fields.
- `electron/agentBridge.cjs` + `electron/jess-agent.ps1`: Windows native desktop actions and UI Automation.
- `electron/chromeBridge.cjs` + `native/JessChromeNativeHost` + `chrome-extension`: authenticated native-messaging bridge to Chrome.
- `src/shared/jessNativeToolNames.ts` and `src/lib/jessTools.ts`: shared tool contract and orchestration.
- `electron/main.cjs` / `electron/preload.cjs`: desktop IPC authority, consent and permission enforcement.

## Target architecture

1. **One voice session coordinator in Jess.** Model the states as `idle`, `wake-listening`, `connecting`, `live-conversation`, `dictation`, `command-execution`, `muted`, and `error`. Only one primary microphone consumer may own capture at a time. The local wake listener must stop before live conversation or explicit dictation begins and may resume after the live session ends if consent remains granted.
2. **One intent router.** Route user speech into either literal dictation, a direct deterministic command, or an AI-planned request. Never infer an executable command from text currently being dictated. Support a literal-dictation escape and a visible transcript/command preview.
3. **One action registry.** Keep `JESS_NATIVE_TOOL_NAMES` as the canonical capability list. Reuse existing tools for Windows UI Automation, keyboard/mouse, OCR, window management and Chrome. Do not create parallel tool names that call the same implementation.
4. **Layered Windows targeting.** Prefer UI Automation names, roles and supported control patterns; then use keyboard/native APIs; use visual/coordinate targeting only as a bounded fallback. Revalidate the foreground window and target before acting.
5. **One permission authority.** Electron main-process IPC remains the enforcement boundary for Full Control, user/session scope, confirmations, cancellation and audit. Speech engines and model output never authorize actions by themselves.
6. **Local-first speech service.** Evaluate Wheelhouse's speech pipeline and licenses; benchmark a compatible local STT engine on the actual target PC before selecting a runtime. Keep cloud recognition explicitly opt-in. Do not ship an unreviewed Python environment or model download in the installer.
7. **Verified execution.** Each action reports `ok`, `verified`, evidence and a safe error. Unknown outcomes must not trigger blind retries for non-idempotent actions.

## Implementation sequence

### Phase A — restore and diagnose the native bridges

- Make the Chrome named-pipe server recover after transient listener errors.
- Surface native-host startup/handshake failures through stderr without leaking tokens.
- Add integration diagnostics that distinguish: server not listening, native host not installed, extension not loaded, pipe not connected, token/handshake rejected, and Full Control disabled.
- Verify the Electron native-action sidecar and Chrome bridge independently before connecting them to new voice features.
- Add tests for protocol contracts, restart behavior, error reporting and safe failure.
- Manually validate on Windows: install/repair bridge, launch Chrome, inspect extension errors, check status, list tabs, open a tab, read a page, stop Full Control, and confirm requests are rejected.

### Phase B — unify microphone ownership

- Add a small voice-session coordinator and use it in the live audio client, offline wake lifecycle and explicit dictation control.
- Preserve consent and make microphone ownership visible.
- Ensure wake listening pauses during a live session and resumes only after a clean stop/disconnect.
- Make device changes, permission denial and worker failure release capture before retrying.
- Do not run a second speech recognizer in parallel to the active owner.

### Phase C — Windows Voice Access-style interaction

- Add deterministic voice commands for help, sleep/wake, mute, app/window switching, scrolling, keyboard shortcuts and named UI controls.
- Add numbered UI Automation labels and clear disambiguation when names are duplicated.
- Improve dictation editing: punctuation, new line, select/correct last phrase, undo and literal-dictation mode.
- Preserve a visible transcript, current mode, microphone state and cancellable action progress.
- Keep Windows secure desktop/UAC boundaries intact.

### Phase D — Wheelhouse-inspired local speech

- Audit Wheelhouse source, dependency licenses, model licenses, CPU/RAM use and packaging.
- Benchmark at least one CPU-friendly local model on target hardware for latency, accuracy, memory and cold-start.
- Implement the chosen engine behind a small adapter, not directly inside UI components.
- Support offline dictation and direct commands only after quality and resource tests pass.
- Keep the existing real-time conversational audio path as a deliberate mode, not a duplicate always-on recognizer.

### Phase E — unified browser/desktop execution

- Reuse the current Chrome extension for web-page DOM interactions and the native UI Automation helper for desktop controls.
- Route both through the same tool registry, execution IDs, permission policy and audit format.
- Add status/help for bridge readiness and actionable repair instructions.
- Verify results after actions; never treat a sent click or keypress as proof that the requested task succeeded.

### Phase F — packaging and release

- Include only selected, license-reviewed runtime binaries and models.
- Ensure clean install, upgrade, repair and uninstall behavior.
- Run unit/contract/security tests, TypeScript checks, production build, native helper builds and Windows installer packaging.
- Perform real Windows acceptance tests before publishing a release.

## Release gates

- [ ] Chrome native host connects and authenticates reliably after fresh install and app restart.
- [ ] Native desktop helper receives and returns a correlated request through the current bridge.
- [ ] No two microphone consumers are active at once.
- [ ] Dictation does not accidentally execute commands.
- [ ] Local speech works without network access when configured for offline mode.
- [ ] UI Automation is preferred over raw coordinates and ambiguous controls are disambiguated.
- [ ] High-risk actions require explicit confirmation and stop/cancel works.
- [ ] All automated checks pass and Windows manual acceptance is recorded.

## Current status

The first implementation slice adds retry/recovery for transient Chrome named-pipe server failures and diagnostic stderr messages from the native host. This is not yet proof of end-to-end operation: the bridge must still be exercised on a real Windows machine with the installed app and Chrome extension.