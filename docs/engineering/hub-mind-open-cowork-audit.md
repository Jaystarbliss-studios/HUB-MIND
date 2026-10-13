# Hub-Mind × Open Cowork: Engineering Audit and Execution Plan

**Status:** PR #69 is merged; PR #75 adds the first optional MCP runtime and is awaiting CI. No production deployment was performed by this work.
**Current follow-up branch:** feat/jess-mcp-runtime-sandbox
**Reference project:** OpenCoworkAI/open-cowork, inspected at source revision 083130349b1a83362eae31dd1705edc0b73782a7
**Scope:** Evidence-led comparison of Jess agent/tool execution, native Windows control, transcript overlay, MCP integration, workspace boundaries and verification.

## Executive findings

1. Hub-Mind already has a native Windows execution path. Jess tool dispatch routes desktop tools through the preload bridge; Electron main validates methods and Full Control ownership, asks for approval where required, records audit events, and calls the persistent PowerShell agent. Window operations return state evidence.
2. PR #69 has been merged into main at merge commit e52566c34acf5c16a81decf1b0d1e529b04e4a91. Its verified checks passed: Jess Native Tool Regression, full HUB-MIND CI including Firestore rules and production build, Windows-native validation, and Windows installer packaging. The generated installer and Chrome extension artifacts were uploaded by the Windows installer workflow.
3. The desktop transcript is a separate transparent, fixed, bottom-centred Electron window. It is click-through and non-movable; only the compact Jess orb window is draggable. The signed-in Jess assistant stays mounted across authenticated workspace route changes to avoid restarting Live audio solely because the user navigates between sections.
4. Native tool declarations are available in the server Live registry, and the Voice Bridge fallback continues after tool results rather than stalling. Tool-call loops are bounded. A shared execution trace records correlation IDs, duration, status, safe argument-key summaries and retry-safety without storing argument values.
5. PR #75 introduces a lightweight MCP runtime without importing Open Cowork's dependency tree. It supports local stdio and HTTPS Streamable HTTP, tool discovery, provider-safe tool declarations, per-account configuration encrypted through Electron safeStorage, explicit confirmation before server setup, and approval before every tool call. MCP server processes do not use a shell and inherit only an allowlist of environment variables.
6. MCP is intentionally not treated as a sandbox. A server runs with the operating-system account's permissions. MCP tools, descriptions, metadata and results are untrusted. The main process resolves model-requested tools against the connected, account-scoped tool index and prompts before executing each call.
7. The Windows installer workflow passed for PR #69, but no one has yet performed the physical packaged-app acceptance test that verifies Jess minimizing and maximizing the actual Hub-Mind window on a real Windows desktop. CI packaging is not proof of interactive end-to-end behavior.
8. Open Cowork should be adapted, not copied wholesale. Its agent runner, MCP manager, path resolver, tool executor and permission rules provide useful patterns, but the project uses a different renderer/session model, SDK versions, storage and sandbox assumptions. No Open Cowork source files or dependencies were copied in these changes.

## Compatibility matrix

| Capability | Hub-Mind status | Open Cowork reference | Remaining work |
|---|---|---|---|
| Jess orchestration | Google Live voice plus Voice Bridge fallback; standard chat remains on Hub-Mind's existing path | Agent runner with provider abstraction and trace events | Consider a durable operation ledger and explicit cancellation propagation |
| Native Windows control | Electron IPC allowlist, Full Control session, confirmation, audit log and PowerShell Win32/UI Automation helper | Desktop tools and main-process mediation | Run packaged Windows smoke test for minimize/maximize/restore, stale handles and ambiguous titles |
| Transcript overlay | Separate fixed, click-through transcript window; draggable orb remains icon-only | Separate renderer/overlay patterns | Verify visual placement on multi-monitor/high-DPI Windows hardware |
| Tool registry | Shared native tool-name filter; frontend/server provider declarations remain partly duplicated | Internal tools and dynamically discovered MCP tools | Generate provider schemas from a single dependency-free canonical schema |
| MCP transports | PR #75 implements stdio and HTTPS Streamable HTTP | stdio, SSE and Streamable HTTP | SSE-only legacy transport is not yet supported |
| MCP tool lifecycle | Per-account server configs, tool discovery, tool calls, bounded timeouts, shutdown cleanup and per-call consent | MCP config CRUD, lifecycle, health and tool discovery | Add OAuth/authenticated remote servers only after encrypted secret storage and consent design are complete |
| MCP resources/prompts | Not exposed to Jess yet | Resources and prompts discovery | Implement if needed after tool-call path is stable |
| Filesystem sandbox | Hub-Mind has explicit path-opening and bounded native command routes, but no verified general-purpose agent filesystem sandbox | PathResolver, mounted roots and containment checks | Design scoped workspace file tools with traversal/symlink tests; never allow arbitrary agent filesystem access |
| Permissions | Electron enforces Full Control ownership and native confirmations; MCP calls always prompt | Permission rules default unknown actions to ask | Add behavioral tests for authorization, cancellation, stale results and account switching |
| Progress and cancellation | Normalized execution trace exists; native bridge has per-call timeouts | Agent runner uses abort signals and trace steps | Carry cancellation through all long-running MCP/native operations and prevent stale responses |
| Data/auth | Firebase remains Hub-Mind's identity/workspace system; MCP config is account-scoped | Separate config/session/SQLite/auth model | Keep MCP identity separate from Firebase workspace permissions |
| Distribution | Existing Electron packaging and native Windows helpers remain in place | Different Node/Python/sandbox packaging assumptions | Keep Hub-Mind's packaging; inspect packaged MCP settings and acceptance-test the installer |

## MCP runtime security contract

- Only stdio and HTTPS Streamable HTTP are supported. Plain HTTP is permitted only for loopback hosts.
- HTTP redirects, URL credentials and fragments are rejected.
- Local processes launch with shell disabled and a minimal environment allowlist. Hub-Mind's application API keys are not inherited.
- Custom environment variables, OAuth, custom authorization headers and secret arguments are not supported. Configuration is encrypted at rest with Electron safeStorage; saving is blocked if secure storage is unavailable.
- Each server add/connect operation requires a native confirmation dialog. Every MCP tool call requires a separate native approval dialog.
- Tool names are provider-safe and limited to 64 characters. Schema depth, number of tools and output size are bounded.
- MCP tool declarations and results are external untrusted content and cannot authorize actions or override Jess's instructions.
- Server configuration and tool indexes are scoped to the signed-in Hub-Mind user. Browser-only clients do not get local process access.
- MCP tools are not sandboxed. Only connect servers you trust, and approve only actions you intended.

More detail is in docs/engineering/jess-mcp-runtime.md.

## Required Windows acceptance test

1. Install the generated Windows installer, sign in, and open Jess.
2. Say “Jess, full control” and accept the explicit confirmation.
3. Ask Jess to list windows and identify the Hub-Mind window by exact title/handle.
4. Ask Jess to minimize Hub-Mind and verify the same handle reports minimized.
5. Ask Jess to maximize Hub-Mind and verify that handle reports maximized.
6. Test a nonexistent title and stale handle; both must fail without selecting another window.
7. Stop Full Control and verify that mutating actions are rejected.
8. In Jess settings, add a local MCP test server; verify discovered tools, cancel one call, approve one call, remove the server, and verify a different signed-in account cannot see or invoke it.
9. Confirm local MCP processes do not inherit application secrets and configuration is encrypted on disk.
10. Save sanitized audit logs and the exact build SHA.

Do not claim these manual tests passed until someone performs them in the packaged Windows app.

## Validation record

- PR #69: merged at e52566c34acf5c16a81decf1b0d1e529b04e4a91. Jess regression, full CI, Firestore emulator tests, production build, Windows native validation and Windows installer packaging passed on the merged candidate.
- PR #75: open and under CI for the new MCP runtime. The MCP config/schema/stdio execution tests, account isolation tests, encrypted persistence test, typecheck, full unit suite, production build and Windows packaging must pass on the final head before merge.
- No actual Windows desktop interaction was possible in this environment. Native minimize/maximize and the manual MCP approval/identity scenarios remain unverified.
- No production deployment was performed.
