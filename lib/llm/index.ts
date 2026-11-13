import { DEFAULT_MODELS, LLMHttpError, LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";
import { callGroq } from "./groq";

const KEY_NAMES: Record<LLMProvider, string> = {
  groq: "GROQ_API_KEY", gemini: "GEMINI_API_KEY", openrouter: "OPENROUTER_API_KEY",
};
const CALLERS: Record<LLMProvider, (request: LLMRequest, model: string) => Promise<LLMResponse>> = {
  groq: callGroq, gemini: callGemini, openrouter: callOpenRouter,
};
// Who takes over, in order, when a provider fails.
const FALLBACK_ORDER: Record<LLMProvider, LLMProvider[]> = {
  groq: ["gemini", "openrouter"], gemini: ["groq", "openrouter"], openrouter: ["gemini", "groq"],
};
const hasKey = (provider: LLMProvider) => Boolean(process.env[KEY_NAMES[provider]]?.trim());

// Free tiers rate-limit by the minute. A limited provider is skipped until its window
// passes, so later calls go straight to one that can answer.
const coolingUntil = new Map<LLMProvider, number>();
function noteFailure(provider: LLMProvider, error: unknown) {
  if (!(error instanceof LLMHttpError)) return;
  if (error.status === 429) coolingUntil.set(provider, Date.now() + (error.retryAfterMs ?? 30000));
  if (error.status === 402) coolingUntil.set(provider, Date.now() + 5 * 60000);
}

// Worth one more try on the same provider: a server hiccup, a dropped connection or malformed JSON.
// Rate limits, timeouts and rejected keys are not: move to the next provider at once.
function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMHttpError) return error.status >= 500;
  return error instanceof Error && error.name !== "TimeoutError" &&
    (error.message === "Invalid JSON model response" || /ETIMEDOUT|ECONNRESET|fetch failed/i.test(error.message));
}

async function callProvider(provider: LLMProvider, model: string, request: LLMRequest, attempts: number): Promise<LLMResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await CALLERS[provider](request, model);
      if (request.responseFormat === "json" &&
          (response.parsedJson === undefined || response.parsedJson === null || typeof response.parsedJson !== "object")) {
        throw new Error("Invalid JSON model response");
      }
      coolingUntil.delete(provider);
      return response;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  noteFailure(provider, lastError);
  throw lastError;
}

export async function callModel(
  provider: LLMProvider = "groq",
  model: string = DEFAULT_MODELS.groq,
  request: LLMRequest,
  retries: number = 2
): Promise<LLMResponse> {
  const configured = [{ provider, model }, ...FALLBACK_ORDER[provider].map(next => ({ provider: next, model: DEFAULT_MODELS[next] }))]
    .filter(target => hasKey(target.provider));
  if (!configured.length) throw new Error(`${KEY_NAMES[provider]} environment variable is not set`);
  const now = Date.now();
  const ready = configured.filter(target => (coolingUntil.get(target.provider) ?? 0) <= now);
  // If every provider is cooling down, trying is still better than failing outright.
  const targets = ready.length ? ready : configured;

  const errors: unknown[] = [];
  for (const target of targets) {
    try {
      return await callProvider(target.provider, target.model, request, Math.max(1, retries));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, "Multiple model providers failed");
}

export { callGroq, checkGroqPromptGuard } from "./groq";
export { callGemini } from "./gemini";
export { callOpenRouter } from "./openrouter";
export * from "./types";
