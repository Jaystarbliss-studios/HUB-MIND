# Jess Offline Voice: Existing Hub-Mind Implementation Audit

Audit date: 2026-10-16
Repository baseline inspected: main

This is a source-level inspection only. No executable changes or local Windows tests were performed as part of this audit.

## Existing integration points found

### 1. Native offline wake/dictation helper

File: https://github.com/Jaystarbliss-studios/HUB-MIND/blob/main/native/JessOfflineWake/Program.cs

The current helper uses .NET System.Speech.Recognition with a DictationGrammar and the default Windows audio device. It has two modes:

- Wake mode: continuously recognizes speech, checks whether the transcript begins with a greeting/wake phrase followed by “Jess”, emits a JSON wake event, and cancels recognition after a match.
- Dictation mode: emits recognized transcript text and a confidence score as JSON lines.

It reports a ready event and emits errors as JSON. This gives Hub-Mind a useful process boundary and a starter offline path.

Limitations to verify on target machines:
- The helper uses Windows speech recognition capabilities and installed language resources; it is not the same acoustic model or recognition quality as Wheelhouse's Parakeet engine.
- A grammar-based wake check runs after Windows recognition has produced a transcript. It is not evidence of a dedicated low-power always-on wake-word model.
- The current implementation does not itself provide Wheelhouse's full command/dictation/replacement state machine, streaming word stability logic, accessibility tree selection, or complete keyboard/mouse control.
- Actual language availability, accent recognition, continuous CPU use, false wakes, and offline behavior must be measured on the target Windows installation.

### 2. Electron API boundary

File: https://github.com/Jaystarbliss-studios/HUB-MIND/blob/main/electron/preload.cjs

The preload exposes methods for starting offline wake and dictation, stopping wake recognition, and subscribing to wake/dictation events. It also exposes native actions such as typing text, pressing shortcuts, launching apps, and running named system commands.

This means the next integration should extend a controlled IPC contract, not expose arbitrary Node.js or shell access to the renderer. Every new action should be allowlisted, validated in the main process, and routed through existing permission/confirmation checks.

### 3. Native action process

File: https://github.com/Jaystarbliss-studios/HUB-MIND/blob/main/electron/agentBridge.cjs

Hub-Mind already launches a PowerShell-based native helper through a child process, uses a JSON-lines request/response protocol, tracks pending requests, applies timeouts, and records runtime audit events. This is a suitable existing pattern for a separately managed speech-provider process, provided that provider output is treated as untrusted input and that audio capture has an explicit single-owner policy.

### 4. Packaging constraints

File: https://github.com/Jaystarbliss-studios/HUB-MIND/blob/main/electron-builder.yml

The Windows package currently bundles the native Jess helpers and Chrome extension. A speech model should not be added to the base installer by default. Model packs need a separate, versioned, checksum-verified download/install/remove path and should report actual disk and memory requirements before activation.

## Recommended next implementation steps

1. Add a shared voice-mode coordinator with explicit states and microphone ownership. It must coordinate the existing System.Speech helper, any future local STT provider, and Jess Live conversation so they cannot capture audio simultaneously.
2. Add a typed speech-provider interface and fake provider tests before swapping engines.
3. Add an offline STT provider experiment. Compare recognition quality, latency, RAM, CPU, startup time, and disk use against the existing helper on the actual HP EliteBook and a modern reference machine.
4. Route recognized commands through an allowlisted intent schema and the existing native action/permission layer. Dictation text must not trigger commands merely because it contains a word such as “delete” or “send”.
5. Test wake-word false positives, stop/cancel, provider crash recovery, no-microphone and missing-language-pack errors, offline network-disabled operation, and microphone handoff.
6. Only then prototype the optional Hy-MT2 quantized translation model. Translation must not alter application names, file paths, URLs, numbers, keyboard shortcuts, or structured action arguments.
7. Treat Android and iOS as platform-specific adapters. The shared coordinator can travel across platforms; unrestricted Windows-style global mouse/keyboard control cannot be assumed on mobile.

## Current status

Existing baseline identified: offline wake/dictation helper, Electron IPC, and native action process.

Not yet verified: live microphone behavior on a target device, speech accuracy/latency, reliable automatic mode switching, Wheelhouse interoperability, Hy-MT2 runtime compatibility, or any end-to-end mobile voice control.

No Wheelhouse code, model weights, or REA tooling have been bundled into Hub-Mind by this audit.
