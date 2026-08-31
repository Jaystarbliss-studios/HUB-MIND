import { GoogleGenAI } from "@google/genai";

const models = ["gemini-3.1-flash-lite", "gemini-3.1-pro-preview"];

function mapTypes(params: any, upper: boolean): any {
  if (!params || typeof params !== "object") return params;
  const out = { ...params };
  if (out.type) out.type = upper ? String(out.type).toUpperCase() : String(out.type).toLowerCase();
  if (out.properties) out.properties = Object.fromEntries(Object.entries(out.properties).map(([k,v]) => [k, mapTypes(v, upper)]));
  if (out.items) out.items = mapTypes(out.items, upper);
  return out;
}

export default async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured on Netlify." }), { status: 500, headers: { "Content-Type": "application/json" } });

    const ai = new GoogleGenAI({ apiKey: key });
    const functionTools = (body.tools || []).filter((t: any) => t.functionDeclarations).map((t: any) => ({
      functionDeclarations: t.functionDeclarations.map((f: any) => ({ ...f, parameters: f.parameters ? mapTypes(f.parameters, true) : undefined }))
    }));
    const tools: any[] = [...functionTools];
    if (body.useSearch || body.searchGrounding) tools.push({ googleSearch: {} });
    if (body.useMaps || body.mapsGrounding) tools.push({ googleMaps: {} });

    const system = typeof body.systemInstruction === "string"
      ? body.systemInstruction
      : body.systemInstruction?.parts?.[0]?.text || "";

    let lastError: any = null;
    for (const model of models) {
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
        return new Response(JSON.stringify({
          text: response.text || "",
          functionCalls: response.functionCalls,
          message: candidate?.content,
          groundingChunks: candidate?.groundingMetadata?.groundingChunks,
          webSearchQueries: candidate?.groundingMetadata?.webSearchQueries,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e: any) {
        lastError = e;
      }
    }
    throw lastError || new Error("All configured AI models failed.");
  } catch (error: any) {
    console.error("Shawn Netlify function error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Shawn could not generate a response." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
