# Jess Full-Control Parity — Engineering Checklist

This document is a live checklist for the work requested in the October 2026 desktop-control pass. It is not a declaration that the work is complete.

## Implemented in this work branch

- Electron main-process preferences now model `ask`, `allow-routine`, and `allow-everything`.
- Preferences persist under Electron `userData`, including Full Control, launch-on-start, and the high-impact spoken-confirmation preference.
- First-time activation of Allow everything presents a native confirmation and stores the accepted consent.
- An internal main-process session secret is created for an active Full Control session; privileged IPC still validates the trusted top-level sender frame.
- Allow everything suppresses per-call MCP approval only when the active main-process session and mode both confirm it. Other modes keep per-call approval.
- Jess Settings has automatic save, a Full Control master switch, three permission modes, launch preference, high-impact preference, and live mode/session feedback.
- Jess's system prompt no longer insists on the spoken phrase when the main process already says the session is active.
- The NSIS installer is configured for per-machine installation.

## Not complete / must be verified before merge

- [ ] Typecheck, unit tests, app build, Windows packaging, and native Windows smoke tests.
- [ ] Prevent duplicate concurrent first-consent prompts and verify cancellation/retry behavior under slow Firestore snapshots.
- [ ] Complete and test the spoken yes/no confirmation flow for delete, format, shutdown, and sending. The preference UI exists; the voice-confirmation protocol is not complete.
- [ ] Remove stale “say Jess, full control” wording from every tool declaration and make the live session state the sole activation truth.
- [x] Sidecar scroll now reinterprets signed wheel deltas correctly and supports horizontal wheel input.
- [ ] Sidecar: C#-built INPUT events; full key map, hold timing; Notepad type/key verification.
- [ ] Clipboard get/set/paste and readback; show desktop, minimize all, Start menu, switch window by handle/z-order.
- [ ] Unified application resolver for Start Menu, AppUserModelID, App Paths, PATH and URI schemes; verify resulting window.
- [ ] Multi-monitor snapping/moving, thirds, z-order, monitor metadata, DPI-aware coordinate mapping.
- [ ] Safe file list/read/write/copy/move/rename/search and Recycle Bin deletion; bounded command execution and robust command safety.
- [ ] Sidecar crash logging/restart/request timeouts; diagnose maximize-triggered agent exit from audit logs and restore handlers.
- [ ] Evaluate .NET/FlaUI or Windows-MCP through McpBridge, with telemetry disabled and text snapshots available to Jess.
- [ ] Correct success contract and postcondition verification for input, click, and keyboard actions.
- [ ] Keep the orb visible through minimize/restore, hide the in-app duplicate in desktop mode, and finish custom screen-share overlay/auto-primary behavior.
- [ ] Chrome native host: authentication, installer registration, Settings setup/connection status, browser navigation/scroll/screenshots and non-managed-PC test.
- [x] Jess prompt now receives the bundled package version and official workspace URL, and is instructed to verify older releases through official GitHub releases/tags rather than inventing them.
- [ ] Confirm the installed executable version independently and verify historical release/tag retrieval works through the actual live internet tools.
- [ ] Memory policy audit: always load relevant saved memories; remove capability-claim memories; build capabilities from the live tool registry.
- [ ] Voice-only acceptance run on a real Windows desktop for every user-provided utterance.

## Windows elevation boundary

Per-machine installation is configured. This branch does **not** configure a highest-privilege logon task to silently elevate the app or its child processes. That would turn the installer into a persistent UAC-consent bypass. If elevated operation is needed, use an explicit, documented Windows administrator setup with visible consent and least privilege. Windows secure-desktop/UAC prompts cannot be automated by Jess.

## Acceptance commands

Run `npm run verify:jess`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm run desktop:package:win` in CI. Then run the voice-only acceptance list on Windows and record evidence in `jess-native-audit.jsonl`. Do not mark an action verified solely because input injection returned.
