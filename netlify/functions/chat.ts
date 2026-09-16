import { GoogleGenAI } from '@google/genai';

const models = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
];

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

export default async (req: Request) => {
  if (req.method !== 'POST') return responseJson({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      const detail = 'GEMINI_API_KEY is missing from the Netlify environment.';
      return responseJson({
        text: `Shawn is offline because the AI provider is not configured. ${detail}`,
        error: 'Shawn is not configured on this deployment.',
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        detail,
        serviceError: true,
      });
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const functionTools = (body.tools || [])
      .filter((t: any) => t.functionDeclarations)
      .map((t: any) => ({
        functionDeclarations: t.functionDeclarations.map((f: any) => ({
          ...f,
          parameters: f.parameters ? mapTypes(f.parameters, true) : undefined,
        })),
      }));

    const tools: any[] = [...functionTools];
    if (body.useSearch || body.searchGrounding) tools.push({ googleSearch: {} });
    if (body.useMaps || body.mapsGrounding) tools.push({ googleMaps: {} });

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
          },
        });
        const candidate = response.candidates?.[0];
        return responseJson({
          text: response.text || '',
          functionCalls: response.functionCalls,
          message: candidate?.content,
          groundingChunks: candidate?.groundingMetadata?.groundingChunks,
          webSearchQueries: candidate?.groundingMetadata?.webSearchQueries,
          model,
        });
      } catch (e: any) {
        lastError = e;
        console.warn(`Shawn model ${model} failed:`, e?.message || e);
      }
    }

    const detail = lastError?.message || 'All configured AI models failed.';
    return responseJson({
      text: `I could not reach any of my AI models just now. ${detail}`,
      error: 'Shawn could not reach a working AI model.',
      code: 'AI_ALL_MODELS_FAILED',
      detail,
      attemptedModels,
      serviceError: true,
    });
  } catch (error: any) {
    console.error('Shawn Netlify function error:', error);
    const detail = error?.message || 'Unknown server error';
    return responseJson({
      text: `Shawn hit a server error before I could answer. ${detail}`,
      error: 'Shawn request failed before a response could be generated.',
      code: 'AI_REQUEST_FAILED',
      detail,
      serviceError: true,
    });
  }
};
