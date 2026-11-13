import { DEFAULT_MODELS, LLMRequest, LLMResponse } from "./types";
import { httpError, parseModelJson, REQUEST_TIMEOUT_MS } from "./shared";

const LITE_MODEL = "gemini-3.5-flash-lite";

export async function callGemini(request: LLMRequest, model: string = DEFAULT_MODELS.gemini): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  const modelName = model?.trim() || DEFAULT_MODELS.gemini;

  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature ?? 0.2,
    maxOutputTokens: Math.min(Math.max(request.maxTokens ?? 1200, 128), 4500),
  };
  if (request.responseFormat === "json") generationConfig.responseMimeType = "application/json";
  const requestBody: Record<string, unknown> = { contents: [{ parts: [{ text: request.userPrompt }] }], generationConfig };
  if (request.systemPrompt?.trim()) requestBody.systemInstruction = { parts: [{ text: request.systemPrompt }] };

  // The key travels in a header so it never appears in URLs or request logs.
  const send = (name: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let activeModel = modelName;
  let response = await send(modelName);
  // Free-tier quotas are per model, so a busy or rate-limited model can hand over to the lite one.
  if (!response.ok && (response.status === 503 || response.status === 429) && modelName !== LITE_MODEL) {
    console.warn(`Gemini model ${modelName} returned ${response.status}. Falling back to ${LITE_MODEL}...`);
    activeModel = LITE_MODEL;
    response = await send(LITE_MODEL);
  }
  if (!response.ok) throw await httpError(response, "Gemini");

  const data = await response.json();
  const parts = (data.candidates?.[0]?.content?.parts || []) as Array<{ text?: string; thought?: boolean }>;
  // Thinking models return thought parts first; the answer is every remaining text part.
  const rawText = parts.filter(p => p.text && !p.thought).map(p => p.text).join("") || parts[0]?.text || "";

  return {
    text: rawText,
    parsedJson: request.responseFormat === "json" ? parseModelJson(rawText, "Gemini") : undefined,
    providerUsed: "gemini",
    modelUsed: activeModel,
  };
}
