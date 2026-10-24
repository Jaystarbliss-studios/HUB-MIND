# Jess Offline Voice Platform: Architecture and Integration Plan

Status: engineering plan and repository audit. This document does not claim that a new speech engine is already wired in.

This plan turns the Hy-MT2, REA, and Wheelhouse research into an implementation path for Hub-Mind/Jess. It distinguishes source-verified capabilities from work that still needs implementation and device testing.

## Goals

- Hands-free voice interaction across Hub-Mind desktop and supported mobile experiences.
- Offline dictation and a reliable offline command set after one-time model installation.
- Natural utterances switch among dictation, conversation, and command mode without opening settings.
- Online speech and AI providers remain optional, visible, and privacy-labelled.
- No mandatory multi-gigabyte download just to install Hub-Mind; model packs are optional and separately downloadable.
- Desktop actions are mediated by Hub-Mind permission checks, confirmation rules, and a native bridge—not by a model with unrestricted operating-system access.

## Findings from the repositories

### Wheelhouse

Wheelhouse is a complete Windows voice-control application, not a drop-in speech-recognition package. Its published architecture separates the launcher/supervisor, command logic, Windows input process, tray UI, and STT provider. The STT provider streams transcript events to Wheelhouse's own logic process over WebSocket; its command pipeline routes utterances into command, dictation, or replacement paths.

The current public architecture describes a Parakeet TDT 0.6B v3 ONNX CPU provider as the default local STT option, with an approximately 2.5 GB model download. It also documents an opt-in NVIDIA GPU provider and a cloud provider. The public README lists Windows 10/11, 8 GB RAM minimum, 16 GB recommended, 10 GB free disk, and four or more CPU cores recommended.

**Integration rule:** reuse concepts and public source under the project's Apache-2.0 license, but do not treat Wheelhouse's internal Python objects, multiprocessing queues, pickle shared-memory messages, or private implementation details as a stable Hub-Mind API. Pin a reviewed source revision, preserve required notices, and put a narrow versioned bridge between the applications.

Sources:
- https://github.com/wheelhouse-project/Wheelhouse
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/ARCHITECTURE.md
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/docs/design/stt-and-ai.md
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/PRIVACY.md
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/LICENSE
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/NOTICE
- https://github.com/wheelhouse-project/Wheelhouse/blob/main/PROVENANCE.toml

### Tencent Hy-MT2

Hy-MT2 is a multilingual translation model family supporting 33 languages. Tencent publishes a 1.8B model with an AngelSlim 1.25-bit quantized build reported at approximately 440 MB, alongside larger models and GGUF variants.

Hy-MT2 does not capture microphone audio or convert audio to text. It cannot replace an STT engine, wake-word detector, or desktop action executor. The 440 MB figure refers to the quantized model's storage requirement, not the entire runtime, total RAM needed, or the complete voice stack. We must benchmark the exact artifact and inference runtime on supported devices before promising speed or memory consumption.

Potential role:
- Optional offline translation between a supported recognized language and the language used by Jess.
- Language normalization only where tests demonstrate that it improves command recognition.
- Never translate command identifiers, app names, file paths, URLs, code, or structured command payloads.
- Do not put translation in the critical path for ordinary same-language English commands unless the user enables it.

A separate STT engine is still required. A separate command parser/router is still required. If we want flexible offline natural-language reasoning beyond deterministic command patterns, that is a separate local-model capability and must be evaluated independently.

Sources:
- https://github.com/Tencent-Hunyuan/Hy-MT2
- https://github.com/Tencent-Hunyuan/Hy-MT2/blob/main/LICENSE.txt
- https://huggingface.co/tencent/Hy-MT2-1.8B-1.25bit-GGUF

### REA (Reverse Engineer Anything)

REA is an agent-facing MCP toolkit for evidence-based inspection of binaries, JavaScript/Electron apps, .NET assemblies, and runtime behavior. It is useful if we need to inspect a packaged Wheelhouse build or trace opaque runtime behavior. Since Wheelhouse's source code and architecture documents are public, source review and tests are the first-choice audit method; REA is not itself the voice engine and should not be bundled into Hub-Mind's end-user runtime.

If used during development, run it in the engineering environment, follow its installation instructions from the official project, and keep generated findings/evidence with the engineering notes. Do not point analysis tools at private user data or unrelated applications without permission.

Source: https://github.com/morluto/rea

## Target architecture

Microphone/platform audio session
-> Audio capture manager (permissions, VAD, mute, device)
-> Offline/online STT adapter
-> Timestamped transcript events
-> Jess Voice Mode Coordinator
-> Dictation OR Conversation OR Commands
-> Intent parser and policy gate
-> Confirmation/permission checks
-> Hub-Mind action registry
-> Windows bridge or platform-native mobile adapter

### Core modules to implement

1. **VoiceSessionCoordinator**
   - Owns one microphone session at a time.
   - Explicit states: idle, listening, dictation, conversation, command, processing, speaking, error.
   - Resolves utterances such as “Jess, dictate”, “Jess, let's converse”, and “Jess, voice command” into mode transitions.
   - Uses cancellation and bounded hand-off timeouts; never lets two engines capture the microphone simultaneously.
   - Shows a clear listening/muted indicator and has a stop control.

2. **SpeechProvider interface**
   - initialize, start, stop, dispose, health, and capabilities.
   - Emits partial transcript, final transcript, provider error, timing, and locale metadata.
   - Implementations: offline provider first; online provider opt-in; browser recognition only as a best-effort fallback.
   - Provider crashes must not crash the app. A provider can restart without resetting Jess's chat history.

3. **CommandRouter**
   - Fast deterministic local matching for supported actions, aliases, and custom phrase patterns.
   - Separate high-risk commands (delete, send, purchase, share, close unsaved work, destructive file operations) from safe commands.
   - Requires confirmation for high-impact actions and rejects commands outside the user's role/permissions.
   - Model output is a proposal, never direct execution. Only allowlisted typed intents can reach the action registry.
   - During dictation, ordinary words that resemble command names remain text unless a deliberate wake phrase or explicit command-mode state is active.

4. **Text insertion and desktop control**
   - Build a narrow Windows-only adapter using documented OS APIs and explicit permissions for keyboard, mouse, and accessibility actions.
   - Keep OS control out of the web renderer. Expose a limited typed API through Electron's preload boundary; do not expose arbitrary shell execution.
   - Prefer accessibility/UI Automation selectors with confidence checks. If target focus is ambiguous, do not type or click.
   - Clipboard-based insertion must save and restore clipboard state when possible and report failure rather than silently losing user data.

5. **Optional translation adapter**
   - Add Hy-MT2 only as an optional language translation stage after STT and before intent resolution, when input and target languages differ.
   - Ship no model in the base installer. Provide an explicit model-pack download, version, checksum, license attribution, disk-space estimate, and removal option.
   - Verify the exact AngelSlim GGUF artifact, compatible llama.cpp/runtime, CPU instruction compatibility, and memory use before choosing a default.
   - Add a strict pass-through path for app names, filenames, URLs, numbers, keyboard shortcuts, and structured action arguments.
   - Translation failures or low confidence must fall back to the original transcript and ask the user; never guess a destructive command.

6. **Mobile adapters**
   - Share the mode coordinator, provider interface, command schema, and policy rules across platforms.
   - Android: implement microphone/audio focus and supported accessibility integrations only with explicit user enablement and platform-policy review.
   - iOS: support the permitted in-app voice experience, Shortcuts/App Intents, and OS-supported integrations. Do not promise arbitrary system-wide control comparable to Windows; iOS does not expose unrestricted global mouse/keyboard automation to ordinary apps.
   - Offline capability is device- and model-dependent. Install model packs separately and communicate battery, storage, and performance impact.

## Phased implementation

### Phase 0 — audit and baseline
- Record the exact Hub-Mind main commit, Electron main/preload entry points, native bridge boundaries, existing wake-word/STT implementation, permissions, and tests.
- Pin the reviewed Wheelhouse revision and inventory its runtime/model dependencies and licenses.
- Use REA only for packaged-binary/runtime questions not answered by source review.
- Create a capability matrix: desktop web, Windows desktop, Android, iOS; online/offline; dictation/commands/conversation.

### Phase 1 — platform-neutral voice contract
- Add typed voice event/state contracts and unit tests.
- Implement mode arbitration and interruption/cancellation semantics before adding a new provider.
- Route every action through the existing Hub-Mind permission system.
- Add a fake speech provider so coordinator and command tests do not require a microphone.

### Phase 2 — Windows local STT spike
- Compare a small-footprint offline provider against Wheelhouse's current Parakeet option on the target HP EliteBook and a modern reference device.
- Measure first-result latency, real-time factor, RAM, CPU, disk, command phrase accuracy, Nigerian English recognition, and offline behavior.
- Do not assume the target laptop meets Wheelhouse's recommended four-core CPU requirement; benchmark it with Hub-Mind and the user's normal browser workload open.
- Decide whether to adapt Wheelhouse as a separately installed companion, reuse specific licensed components, or implement a clean provider adapter. Keep the app installer light in all cases.

### Phase 3 — command and dictation integration
- Add transcript stream -> coordinator -> typed intent/dictation flow.
- Add focus safety, spoken punctuation, cancellation, mode announcements, confirmation prompts, and recovery tests.
- Make “start dictation”, “stop dictation”, “switch to conversation”, and “voice command mode” work without opening settings.
- Do not enable destructive actions by voice until confirmation and permission tests pass.

### Phase 4 — optional Hy-MT2 language pack
- Prototype the 440 MB quantized artifact in an isolated benchmark branch.
- Confirm model card/license and redistribution terms, checksum, runtime compatibility, actual disk/RAM footprint, and quality on target hardware.
- Test multilingual command translation separately from free-form translation.
- Release only as an opt-in model pack if it improves real test results without unacceptable latency.

### Phase 5 — mobile
- Port the coordinator and command schema first, then implement platform-native audio and permitted actions.
- Clearly mark actions unavailable on each platform; do not imply Windows-level control on mobile.
- Test locked-screen/background behavior against platform rules and battery constraints.

## Acceptance tests and release gates

- Offline mode: disable the network after model setup; recognition and the supported local command set continue to work.
- No accidental actions: dictated sentences containing words like “delete”, “send”, or “close” do not execute commands.
- Mode switching: wake phrases transition correctly and release the microphone from the previous mode.
- Safety: high-impact actions require confirmation; unauthorized actions are denied even if transcript/model output asks for them.
- Failure: provider crash, missing model, permission denial, no microphone, and low-confidence transcript have clear recoverable states.
- Data protection: offline audio/transcripts remain local; cloud processing is clearly disclosed and opt-in.
- Packaging: base installer size is measured; models are separately downloadable, verifiable, removable, and license-compliant.
- Hardware: measure on the actual supported minimum hardware before declaring minimum specs.
- Mobile: verify each OS capability separately; no blanket “full system control” claims.

## Decision

Start with the platform-neutral coordinator and safe command router, then prove offline STT on Windows. Treat Hy-MT2 as an optional translation capability—not the recognizer. Use Wheelhouse as the primary reference implementation for command/dictation UX and Windows integration, while using REA as an engineering analysis tool where source review is insufficient. Do not bundle all of Wheelhouse or the model into the base Hub-Mind installer until target-device benchmarks, privacy review, licensing inventory, and acceptance tests pass.
