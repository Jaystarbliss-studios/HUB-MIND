# Hub-Mind × Open Cowork: Engineering Audit and Execution Plan

**Status:** In progress — integration branch based on current main; no production deployment  
**Hub-Mind branch:** `feat/jess-core-runtime-overlay-integration`  
**Reference project:** OpenCoworkAI/open-cowork, inspected at source revision `083130349b1a83362eae31dd1705edc0b73782a7`  
**Scope:** Evidence-led audit of agent/tool execution, native Windows control, MCP/agent-runner compatibility, and test coverage.

## Executive findings

1. **Hub-Mind already has a real native Windows execution path.** Jess tool dispatch in `src/lib/jessTools.ts` routes desktop tools through `window.hubMindDesktop.nativeAction`; `electron/preload.cjs` exposes a narrow IPC API; `electron/main.cjs` validates methods, checks the Full Control session, requests approval for mutations when configured to ask, audits results, and calls `electron/agentBridge.cjs`; that bridge uses a persistent PowerShell process in `electron/jess-agent.ps1`. The helper reports state evidence for window actions.
2. **The tool catalogue is partly duplicated.** `src/lib/jessTools.ts` and server-side `LIVE_TOOLS` still maintain provider-specific argument schemas, but the 31 native tool names and desktop-runtime filter now live in the dependency-free `src/shared/jessNativeToolNames.ts`. The regression test checks the frontend/server property types, required fields and enums against each other. A later phase should generate provider schemas from one canonical definition.
3. **The server-side Live registry previously omitted the native Windows/Chrome tools.** They are now registered in the authorized branch, including the `chrome_scroll` schema correction (`delta`, not `deltaX/deltaY`). A regression contract test checks all 31 names and compares native argument property names, types, required fields and enums across the frontend and server declarations. The server bridge now strips native declarations by default and includes them only when its URL explicitly identifies `runtime=desktop`; the Electron IPC remains the authorization boundary.
4. **The Voice Bridge fallback previously stalled after executing a tool.** It appended a plain-text tool result to history but never invoked Gemini again. The fallback now retains Gemini-style function-call/function-response content and generates a follow-up turn after a tool response, with TTS and a completion signal only when the model is not waiting for another tool. Failed turns now emit an error and completion event instead of leaving the voice UI waiting indefinitely. Both fallback and direct Live execution now stop after a bounded number of tool calls or repeated identical calls.
5. **The desktop path is not yet end-to-end proven.** GitHub Actions reported no workflow runs/statuses for the current PR head when checked. The current environment cannot launch a Windows desktop or execute the native PowerShell helper, so window minimize/maximize remains a required physical Windows smoke test, not a claimed pass.
6. **Full Control confirmation is serialized.** The main process refuses a second concurrent start while the desktop confirmation dialog is pending and clears that lock on cancellation or dialog failure.
7. **Window targeting now rejects ambiguous titles.** The PowerShell helper prefers a unique exact title, accepts a unique case-insensitive partial title, and refuses ambiguous matches instead of silently selecting the first window. The main-process IPC validates positive numeric handles and bounded title strings.
8. **Open Cowork should be adapted, not copied wholesale.** Its current source includes an agent runner (`src/main/agent/agent-runner.ts`), a tool executor with path containment (`src/main/tools/tool-executor.ts`), an MCP lifecycle manager (`src/main/mcp/mcp-manager.ts`), a path resolver (`src/main/sandbox/path-resolver.ts`), and permission rules (`src/main/config/permission-rules-store.ts`). Those are useful architectural references, but they depend on Electron, a separate renderer/session model, the Pi coding-agent SDK, sandbox adapters, and Open Cowork-specific configuration. Directly importing them into Hub-Mind would create high coupling.

### Dependency and licensing compatibility

- Hub-Mind's manifest uses React 19, Electron 37, TypeScript 5.8, and `@google/genai` 2.15. Open Cowork's inspected manifest uses React 18, Electron 41, TypeScript 5.3, `@google/genai` 1.44, and adds `@mariozechner/pi-coding-agent`, MCP SDK packages, SQLite, sandbox adapters and bundled runtime tooling. These versions/runtime assumptions should not be merged directly into Hub-Mind's dependency tree without a dedicated compatibility and packaging review.
- Open Cowork's package manifest identifies the project as MIT-licensed, and its root `LICENSE` file contains the MIT permission/notice terms. **No Open Cowork source files or dependencies have been copied into Hub-Mind in this pass**; only architectural patterns are documented. If code is reused later, preserve the copyright and license notice and inspect file-level/transitive dependency notices before distribution.
- The current Hub-Mind lockfile is not synchronized with its manifest; this is a Hub-Mind repository hygiene issue, not a reason to import Open Cowork's package lock.

## Current code-level compatibility matrix

| Capability | Hub-Mind current implementation | Open Cowork reference | Action |
|---|---|---|---|
| Agent orchestration | Jess uses Google Live voice plus a server Voice Bridge fallback; standard chat uses `/api/chat` | `src/main/agent/agent-runner.ts` wraps `@mariozechner/pi-coding-agent`, routes providers and emits trace events | Preserve Jess paths; adopt lifecycle/trace patterns selectively |
| Tool registry | `JESS_TOOLS_DECLARATIONS` in `src/lib/jessTools.ts`; server `LIVE_TOOLS` has provider-facing declarations; direct Live filters native tools by desktop environment and server bridge defaults to web-only unless `runtime=desktop` is present | Agent runner converts internal and MCP tools to SDK definitions | Next: shared neutral native-tool schema source plus provider adapters |
| Tool-call result lifecycle | Direct Live sends function responses through the client; server Live relays responses; Voice Bridge fallback now resumes after tool result | Agent runner has explicit tool-use/result content blocks and trace steps | Add focused lifecycle tests for success, failure, multiple calls, and bounded recovery |
| Windows windows/input | `electron/main.cjs`, `electron/agentBridge.cjs`, `electron/jess-agent.ps1`; state evidence is returned for window operations | Desktop integrations are mediated by main process and agent tools; not a drop-in replacement for Hub-Mind's native helper | Keep current native helper; validate actual Windows behavior |
| Browser automation | Chrome extension ↔ native messaging pipe ↔ `electron/chromeBridge.cjs` and IPC allowlist | MCP manager supports stdio, SSE, and Streamable HTTP; MCP tools are discovered dynamically | Keep Chrome extension path; consider MCP as an additional integration layer |
| MCP lifecycle | No verified unified MCP manager in the audited Hub-Mind path | `src/main/mcp/mcp-manager.ts` owns config, lifecycle, health, and tool discovery | Defer integration until basic tool lifecycle and permission contract are stable |
| Filesystem boundaries | Hub-Mind has explicit path opening and bounded native command routes; no proof yet of a general agent filesystem sandbox | `src/main/tools/tool-executor.ts` resolves file access through `PathResolver` and mount boundaries | Design scoped workspace file tools separately; never import Open Cowork's paths unchanged |
| Permissions | Main-process Full Control ownership/session checks, allowlist, user confirmation in ask mode, audit events | `src/main/config/permission-rules-store.ts` defaults unknown/malformed rules to ask | Strengthen authorization boundaries; do not let model output stand in for user consent |
| Progress/cancellation | Native bridge has per-call timeouts and can stop its child; voice fallback has no durable operation ledger | Agent runner has loop guard, abort signal, trace events and MCP timeouts | Add normalized execution events/cancellation after lifecycle tests |
| Data/auth | Firebase remains Hub-Mind's data/auth system | Open Cowork uses its own config/session/SQLite and auth storage | Preserve Firebase and Hub-Mind ownership contracts |
| Desktop distribution | Existing Electron package scripts and Windows native helpers | Open Cowork has separate packaging, bundled Node/Python, WSL/Lima sandbox assumptions | Preserve Hub-Mind distribution; no wholesale runtime replacement |

## Branch and pull-request topology

The repository already has related work on the current default branch; this matters for safe integration:

- PR #22 (`feat/jess-agentic-operations-v2`) is merged and contains the prior Jess persistent-operation/workspace-control work.
- PR #61 (`feat/jess-native-desktop-agent`) is merged and introduced the audited native Windows sidecar, IPC, Chrome bridge and related tests.
- PR #70 (`fix/jess-desktop-control-and-dark-theme`) is merged and includes additional packaging, overlay, screen-share and native-control safeguards.
- PR #66 is recorded in the main-branch Windows gap report as merged, including native helper CI/package work.
- PR #58 is still open and overlaps companion/homepage/desktop-control files.
- PR #69, this working branch, remains open and GitHub currently reports `mergeable: false`. Its base SHA predates the merged desktop-control PRs above, so the branch must not be merged as-is. Reconcile its changes against current `main` before any merge; do not overwrite the newer packaging/overlay/security work.

The current main-branch CI already runs `npm install`, Jess verification, TypeScript validation, unit/contract tests, Firestore rules tests, production build and Windows-native validation. The targeted workflow added on this branch is supplementary; its own run status must still be checked rather than inferred from source presence.

## Native window-control call path

`model declaration → Jess tool call → executeJessTool() → hubMindDesktop.nativeAction() → preload IPC → main-process allowlist/session/approval/audit → agentBridge.call() → jess-agent.ps1 → Win32 APIs → post-action window enumeration/state evidence → tool result → model continuation`

Key source files:
- `src/lib/jessTools.ts`: declarations and dispatcher, including `manage_windows` mapping and the requirement for an active Full Control session.
- `src/services/liveAudioClient.ts`: environment-aware tool declaration setup for direct Live.
- `src/components/JessFloatingAssistant.tsx`: calls `executeJessTool` and returns the result under the original tool name and call ID.
- `electron/preload.cjs`: narrow context-isolated IPC bridge.
- `electron/main.cjs`: IPC authorization, method allowlist, confirmation, audit and result normalization.
- `electron/agentBridge.cjs`: persistent PowerShell request/response bridge with per-action timeout.
- `electron/jess-agent.ps1`: window enumeration, state lookup and Win32 minimize/maximize/restore/focus implementation.

### Required Windows acceptance test

1. Launch the packaged Windows app and sign in.
2. Say “Jess, full control” and accept the explicit OS confirmation.
3. Ask Jess to list windows; ensure the Hub-Mind window is identifiable by title/process/handle.
4. Ask Jess to minimize Hub-Mind; verify the same handle reports `state: minimized`.
5. Ask Jess to maximize Hub-Mind; verify that handle reports `state: maximized`.
6. Test a nonexistent title and a stale handle; both must return explicit failure without selecting an unrelated window.
7. Stop Full Control and confirm further mutating calls are rejected.
8. Save sanitized logs/audit entries and the exact build SHA with the test result.

Do not mark this test passed until it is performed on Windows.

## New integration work on the current branch

- Added a separate Electron transcript-caption window with fixed bottom-center positioning, transparent blur styling, click-through mouse handling, no focus, and no movement. The draggable companion window stays 96×96 and icon-only.
- Added /companion-transcript as a dedicated renderer route; transcript updates are read from the existing cross-window transcript store. The caption hides after a quiet period and does not reopen from stale cached text.
- Kept the signed-in Jess assistant mounted across authenticated route transitions and moved route context into a ref, so navigating between workspace sections does not recreate the Live client or restart the wake-listener effect solely because the path changed.
- Added account-level Jess settings for permission mode, memory, workspace context, personalization, web research and visual verification. Memory/context/web-research settings are enforced in the active assistant/tool dispatcher; native permissions remain checked in Electron.
- Added explicit desktop confirmation before Full Control begins, a pending-confirmation lock, and a separate approval prompt for native mutations unless the current user's settings allow routine actions. High-risk close-window, command, and path-opening actions still prompt.
- Ported the 31 native Windows/Chrome tool declarations into the server Live registry, with desktop-runtime filtering and fallback continuation after tool results. Added repeated-call/round limits to direct Live and fallback dispatch.
- Added a public setup guide for web, Chrome app, Chrome extension, Windows desktop and Jess settings; the PWA splash, installed-app icon and Windows installer icon now use the official Hub-Mind logo.
- Added source-contract regression coverage for the native registry, tool result lifecycle, Full Control confirmation, window targeting, transcript overlay and route-persistent assistant.
- Added a shared execution-trace runtime for foreground and queued tools. It emits start/result events with correlation IDs, duration, safe argument-key summaries, normalized verified/unverified/failed states, and a conservative retry-safety flag without logging argument values. Thrown tool failures are normalized into tool results rather than escaping the Live callback.

## Implementation changes recorded on this branch

- Added native Windows and Chrome declarations to server-side `LIVE_TOOLS`.
- Corrected the server `chrome_scroll` argument to match the executor (`delta`).
- Added `tests/jess/native-tool-registry-contract.test.mjs` to check native names, property/type parity, required fields, enum parity, tool-result continuation, and desktop consent/targeting safeguards.
- Fixed Voice Bridge fallback continuation after a tool response; the result is retained in Gemini function-response form and a new model turn is generated. Failed turns now emit an error plus completion event.
- Added bounded/repetition-based tool-call loop guards to both the Voice Bridge fallback and the direct Live tool dispatcher.
- Added `src/shared/jessNativeToolNames.ts` as the shared source of native tool names and runtime filtering, used by both the server bridge and direct Live client.
- Added an executable unit test for web-versus-desktop tool filtering.
- Added regression assertions for fallback continuation.
- Added a dedicated GitHub Actions regression workflow for typecheck, the native-tool contract test, and the existing unit suite.
- Added a main-process confirmation gate before Full Control can be enabled, including a pending-confirmation lock to prevent duplicate concurrent prompts.
- Added positive-handle/title validation in native IPC and made the PowerShell window resolver reject ambiguous title matches.

## Outstanding risks and next steps

1. Run the actual typecheck and full unit suite in GitHub Actions and resolve any failures.
2. Add behavioral tests for the native IPC allowlist, session ownership, cancellation, and normalized result handling; source-contract checks alone are not sufficient.
3. Exercise minimize/maximize/restore on a packaged Windows build and validate stale/ambiguous target behavior.
4. Regenerate `package-lock.json` from the actual `hub-mind@0.1.0` manifest and verify a clean `npm ci` install.
5. Generate provider-specific native tool schemas from a dependency-free canonical definition, rather than only parity-testing duplicated declarations.
6. Extend the new normalized execution event/result contract with cancellation propagation and main-process audit correlation IDs; behavioral tests should cover session cancellation and stale-result suppression.
7. Evaluate MCP integration only after the base execution path is stable; keep MCP credentials, server configuration, and tool permissions isolated from Firebase workspace permissions.
8. Validate homepage, authentication, workspace operations, documents/tasks, chat/voice, installer startup, and update workflow before requesting merge.

## Validation record

- Source inspection: completed for the files listed above; the current integration branch is based on main and carries the transcript/session and settings changes without replacing the newer main-branch packaging/overlay work.
- Server registry and fallback continuation: source-level changes committed. The six earlier regression cases were replayed against fetched repository sources in a source harness; the current branch now has 12 contract tests across native registry, transcript overlay, and execution runtime. The expanded source harness passed the 9 native/overlay checks; the actual Node test runner and TypeScript checks still need CI. This is not a substitute for running the actual Node test runner, TypeScript typecheck, production build or Windows runtime tests; those remain pending in CI.
- CI status at audit time: no statuses/workflow runs returned for the current PR head. The newly added workflow must be checked again after GitHub schedules it.
- Native Windows smoke test: **not run in this environment**.
- PR #69 remains a conflicted legacy branch; this integration branch ports the intended changes onto current main without merging the stale branch wholesale.
- Merge/deployment: not performed; the integration PR and CI results must be reviewed before merge.
