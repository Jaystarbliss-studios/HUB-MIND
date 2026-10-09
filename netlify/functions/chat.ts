import { GoogleGenAI } from '@google/genai';

const models = [
  process.env.GEMINI_GROUNDED_MODEL || 'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
].filter((model, index, all) => all.indexOf(model) === index);

const responseJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function mapTypes(params: any, upper: boolean): any {
  if (!params || typeof params !== 'object') return params;
  const out = { ...params };
  if (out.type) out.type = upper ? String(out.type).toUpperCase() : String(out.type).toLowerCase();
  if (out.properties) out.properties = Object.fromEntries(Object.entries(out.properties).map(([k, v]) => [k, mapTypes(v, upper)]));
  if (out.items) out.items = mapTypes(out.items, upper);
  return out;
}

function textFromMessage(message: any): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message.text === 'string') return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.parts)) return message.parts.map((part: any) => part?.text || '').join(' ');
  if (Array.isArray(message.content)) return message.content.map((part: any) => part?.text || '').join(' ');
  return '';
}

function latestUserMessage(messages: any): string {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const role = String(message?.role || message?.speaker || '').toLowerCase();
    if (role === 'user') return textFromMessage(message);
  }
  return '';
}

/**
 * Search is automatic only when the user's latest request signals freshness,
 * verification, research, or a topic that changes frequently. Callers can
 * explicitly force it with useSearch/searchGrounding or disable auto-search.
 */
export function shouldGroundWithSearch(prompt: string): boolean {
  const value = prompt.trim();
  if (!value) return false;
  return /\b(latest|current|currently|today|tonight|this week|this month|this year|right now|up[- ]to[- ]date|recent|newest|as of \d{4}|look up|search (?:the )?web|google search|research|fact[- ]?check|verify (?:this|that|whether|if)|check (?:the )?(?:latest|current|official)|source(?:s)? for|cite (?:your )?sources?|references?|live (?:data|information|updates?)|release notes?|version (?:number|history)|price today|exam (?:syllabus|registration|date|deadline)|admission requirements|competition dates?)\b/i.test(value);
}

function sourceList(chunks: any[] = []) {
  const seen = new Set<string>();
  return chunks.flatMap((chunk: any) => {
    const web = chunk?.web;
    const uri = typeof web?.uri === 'string' ? web.uri : '';
    if (!uri || !/^https?:\/\//i.test(uri) || seen.has(uri)) return [];
    seen.add(uri);
    return [{ title: typeof web?.title === 'string' && web.title.trim() ? web.title : 'Web source', uri }];
  });
}

export default async (req: Request) => {
  if (req.method !== 'POST') return responseJson({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      const detail = 'GEMINI_API_KEY is missing from the Netlify environment.';
      return responseJson({
        text: 'Jess is offline because the AI provider is not configured. ' + detail,
        error: 'Jess is not configured on this deployment.',
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        detail,
        serviceError: true,
      }, 503);
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const functionTools = (Array.isArray(body.tools) ? body.tools : [])
      .filter((t: any) => t?.functionDeclarations)
      .map((t: any) => ({
        functionDeclarations: t.functionDeclarations.map((f: any) => ({
          ...f,
          parameters: f.parameters ? mapTypes(f.parameters, true) : undefined,
        })),
      }));

    const latestPrompt = latestUserMessage(body.messages);
    const explicitSearch = body.useSearch === true || body.searchGrounding === true;
    const autoSearch = body.autoSearch !== false && shouldGroundWithSearch(latestPrompt);
    const useSearch = explicitSearch || autoSearch;
    const useMaps = body.useMaps === true || body.mapsGrounding === true;
    const tools: any[] = [...functionTools];
    if (useSearch) tools.push({ googleSearch: {} });
    if (useMaps) tools.push({ googleMaps: {} });

    const system = typeof body.systemInstruction === 'string'
      ? body.systemInstruction
      : body.systemInstruction?.parts?.[0]?.text || '';

    let lastError: any = null;
    const attemptedModels: string[] = [];

    for (const model of models) {
      attemptedModels.push(model);
      try {
        const response = await ai.models.generateContent({
          model,
          contents: body.messages || [],
          config: {
            systemInstruction: system || undefined,
            tools: tools.length ? tools : undefined,
            ...(useSearch ? { temperature: 0.2 } : {}),
          },
        });
        const candidate = response.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
        const groundingChunks = groundingMetadata?.groundingChunks || [];
        const sources = sourceList(groundingChunks);
        let answerText = response.text || '';

        // Keep sources visible even in existing clients that only render text.
        // Structured fields are also returned for clients that render inline citations.
        if (sources.length && !/\n\s*(?:sources|references)\s*:?\s*\n/i.test(answerText)) {
          answerText += '\n\n**Sources**\n' + sources.map((source, index) =>
            (index + 1) + '. [' + source.title.replace(/[\[\]]/g, '') + '](' + source.uri + ')'
          ).join('\n');
        }

        return responseJson({
          text: answerText,
          functionCalls: response.functionCalls,
          message: candidate?.content,
          grounded: Boolean(useSearch && (groundingMetadata || sources.length)),
          groundingMetadata: groundingMetadata || undefined,
          groundingChunks,
          groundingSupports: groundingMetadata?.groundingSupports,
          searchEntryPoint: groundingMetadata?.searchEntryPoint,
          sources,
          webSearchQueries: groundingMetadata?.webSearchQueries || [],
          searchMode: useSearch ? (explicitSearch ? 'explicit' : 'automatic') : 'none',
          model,
        });
      } catch (e: any) {
        lastError = e;
        console.warn('Jess model ' + model + ' failed:', e?.message || e);
      }
    }

    const detail = lastError?.message || 'All configured AI models failed.';
    return responseJson({
      text: 'I could not reach any of my AI models just now. ' + detail,
      error: 'Jess could not reach a working AI model.',
      code: 'AI_ALL_MODELS_FAILED',
      detail,
      attemptedModels,
      serviceError: true,
    }, 502);
  } catch (error: any) {
    console.error('Jess Netlify function error:', error);
    const detail = error?.message || 'Unknown server error';
    return responseJson({
      text: 'Jess hit a server error before I could answer. ' + detail,
      error: 'Jess request failed before a response could be generated.',
      code: 'AI_REQUEST_FAILED',
      detail,
      serviceError: true,
    }, 500);
  }
};

export const config = { path: '/api/chat' };
