# Jess integration

## Product contract

Jess is Hub-Mind's embedded live voice operating layer. She is not a separate page, drawer, settings panel, or chat screen.

- Floating transparent/reactive orb in the viewport.
- Double tap/click activates a live voice session.
- Double tap/click while active ends the session.
- Pointer drag works on mouse and touch devices.
- Position is persisted locally per browser.
- No wake word is required.
- No assistant settings UI is exposed.
- The signed-in Hub-Mind identity is passed into the live session.
- Jess can use authenticated workspace tools and navigate the visible application.

## Runtime layers

1. `JessFloatingAssistant` owns the interaction surface and viewport position.
2. `LiveAudioClient` owns microphone capture, PCM streaming, Gemini Live, interruption, audio playback and session lifecycle.
3. `jessTools` owns the tool declarations and authenticated Firestore/Calendar operations.
4. Existing Hub-Mind pages remain the visible workspace; navigation is performed through the existing router.

## Security model

The browser never receives the long-lived Gemini API key. It requests an authenticated, short-lived Live token using the current Firebase ID token. Tool execution runs with the signed-in Hub-Mind profile and checks ownership/role before mutations.

## Voice model migration

The standalone VOICE-MODEL implementation established the low-latency 16 kHz capture / 24 kHz playback interaction pattern. Hub-Mind keeps its authenticated ephemeral-token path and integrates the voice runtime rather than embedding the standalone application's settings, vault, transcript, or chat UI.

## Navigation and document behavior

Jess can navigate to tasks, projects, documents, calendar, clients and other existing routes. Document creation returns a real document ID and opens the Hub-Mind editor. Document content updates use Firestore and preserve the existing document version/save metadata.

The next extension point for true character-level live document typing is a `jess:document_edit` event bridge inside `DocumentEditor`; the current integration deliberately uses the existing document persistence path so edits remain auditable and permission-checked.
