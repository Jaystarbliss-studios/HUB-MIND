# Jess Google Search Grounding

Jess's existing `POST /api/chat` Netlify function supports Google Search grounding on the server using the official `@google/genai` SDK and the private `GEMINI_API_KEY` environment variable.

## Behaviour

- Explicit requests can set `useSearch: true` or `searchGrounding: true`.
- Automatic grounding is enabled for the latest user message when it clearly asks for current, recent, verified, researched, or other freshness-sensitive information.
- Send `autoSearch: false` to disable automatic selection for a specific request. Explicit `useSearch: true` still enables it.
- Ordinary conversation and rewriting do not enable search by default.
- The preferred model can be set server-side with `GEMINI_GROUNDED_MODEL`; otherwise Jess tries `gemini-3.8-flash` first and falls back through the configured model list.
- The API key must remain a Netlify server environment variable. Never add it to a `VITE_*` variable, frontend source, or client bundle.

## Response

The endpoint keeps its existing `text`, `functionCalls`, and `message` fields and adds `grounded`, `searchMode`, `sources`, `groundingMetadata`, `groundingChunks`, `groundingSupports`, `searchEntryPoint`, and `webSearchQueries`. Sources are also appended to `text` so older clients that render only the answer text can still show links.

Grounding improves freshness and provides source evidence, but does not guarantee that every generated claim is correct. The UI should not label every grounded answer as independently verified.
