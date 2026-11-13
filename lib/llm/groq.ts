import { DEFAULT_MODELS, LLMRequest, LLMResponse } from "./types";
import { openAIChat, parseModelJson } from "./shared";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroq(request: LLMRequest, model: string = DEFAULT_MODELS.groq): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");
  const modelSlug = model?.trim() || DEFAULT_MODELS.groq;
  // Only enable response_format json_object for models known to support it cleanly
  const jsonMode = request.responseFormat === "json" && !modelSlug.includes("gpt-oss-20b");
  const result = await openAIChat("Groq", GROQ_URL, { Authorization: `Bearer ${apiKey}` }, modelSlug, request,
    { defaultTemperature: 0.2, jsonMode });
  return {
    text: result.text,
    parsedJson: request.responseFormat === "json" ? parseModelJson(result.text, "Groq") : undefined,
    providerUsed: "groq",
    modelUsed: result.model,
  };
}

export async function checkGroqPromptGuard(
  text: string
): Promise<{ status: "checked" | "unavailable"; isAttack: boolean; score: number }> {
  const unavailable = { status: "unavailable" as const, isAttack: false, score: 0 };
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || !text || !text.trim()) return unavailable;
  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-prompt-guard-2-86m",
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
      // Optional check: never let it hold up drafting for long.
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return unavailable;
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    const score = raw ? Number(raw) : NaN;
    if (!Number.isFinite(score) || score < 0 || score > 1) return unavailable;
    return { status: "checked", isAttack: score > 0.85, score };
  } catch (err) {
    console.warn("Groq Prompt Guard check skipped:", err instanceof Error ? err.message : err);
    return unavailable;
  }
}
