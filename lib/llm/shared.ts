import { LLMHttpError, type LLMRequest } from "./types";

export const REQUEST_TIMEOUT_MS = 25000;

// Models wrap JSON in code fences or stray prose often enough that every provider needs this.
export function parseModelJson(rawText: string, label: string): unknown {
  const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
  if (!cleaned) return undefined;
  const attempts = [cleaned];
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const first = cleaned.indexOf(open), last = cleaned.lastIndexOf(close);
    if (first !== -1 && last > first) attempts.push(cleaned.slice(first, last + 1));
  }
  for (const text of attempts) {
    try { return JSON.parse(text); } catch { /* try the next shape */ }
  }
  console.warn(`Failed to parse ${label} JSON response:`, rawText.slice(0, 500));
  return undefined;
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers?.get?.("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 600) * 1000 : undefined;
}

export async function httpError(response: Response, label: string): Promise<LLMHttpError> {
  const body = (await response.text().catch(() => "")).slice(0, 600);
  return new LLMHttpError(response.status, `${label} API request failed with status ${response.status}: ${body}`, retryAfterMs(response));
}

// Groq and OpenRouter share the OpenAI chat format. Free models often reject JSON mode
// (400/404/422), so that one failure is retried without it; the prompts already demand JSON.
export async function openAIChat(
  label: string, url: string, headers: Record<string, string>, model: string, request: LLMRequest,
  options: { defaultTemperature: number; jsonMode: boolean; extra?: Record<string, unknown> },
): Promise<{ text: string; model: string }> {
  const payload: Record<string, unknown> = {
    model, ...options.extra,
    messages: [{ role: "system", content: request.systemPrompt }, { role: "user", content: request.userPrompt }],
    temperature: request.temperature ?? options.defaultTemperature,
    max_tokens: Math.min(Math.max(request.maxTokens ?? 1000, 64), 4500),
  };
  if (options.jsonMode) payload.response_format = { type: "json_object" };
  const send = () => fetch(url, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let response = await send();
  if (!response.ok && payload.response_format && [400, 404, 422].includes(response.status)) {
    delete payload.response_format;
    response = await send();
  }
  if (!response.ok) throw await httpError(response, label);
  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || "", model: typeof data.model === "string" ? data.model : model };
}
