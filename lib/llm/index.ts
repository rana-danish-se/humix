import { LLMHttpError, LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";
import { callGroq } from "./groq";

function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMHttpError) return error.status === 429 || error.status >= 500;
  return error instanceof Error &&
    (/timeout|abort|ETIMEDOUT|ECONNRESET|fetch failed/i.test(error.message) || error.name === "TimeoutError");
}

// A 402 is a billing wall — no point retrying it at all.
function isTerminalError(error: unknown): boolean {
  return error instanceof LLMHttpError && error.status === 402;
}

async function callProvider(provider: LLMProvider, model: string, request: LLMRequest, attempts: number): Promise<LLMResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      let response: LLMResponse;
      if (provider === "groq") {
        response = await callGroq(request, model);
      } else if (provider === "gemini") {
        response = await callGemini(request, model);
      } else {
        response = await callOpenRouter(request, model);
      }

      if (request.responseFormat === "json" &&
          (response.parsedJson === undefined || response.parsedJson === null || typeof response.parsedJson !== "object")) {
        throw new Error("Invalid JSON model response");
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isTerminalError(error) || !isRetryableError(error) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

function getProviderFallback(provider: LLMProvider): { provider: LLMProvider; model: string } {
  if (provider === "groq") {
    return { provider: "gemini", model: "gemini-3.7-flash" };
  }
  if (provider === "gemini") {
    return { provider: "groq", model: "openai/gpt-oss-120b" };
  }
  return { provider: "gemini", model: "gemini-3.7-flash" };
}

export async function callModel(
  provider: LLMProvider = "groq",
  model: string = "openai/gpt-oss-120b",
  request: LLMRequest,
  retries: number = 2
): Promise<LLMResponse> {
  try {
    return await callProvider(provider, model, request, Math.max(1, retries));
  } catch (primaryError) {
    const fallback = getProviderFallback(provider);
    const fallbackKey =
      fallback.provider === "gemini"
        ? process.env.GEMINI_API_KEY
        : fallback.provider === "groq"
        ? process.env.GROQ_API_KEY
        : process.env.OPENROUTER_API_KEY;

    if (!fallbackKey) throw primaryError;

    try {
      return await callProvider(fallback.provider, fallback.model, request, 2);
    } catch (fallbackError) {
      throw new AggregateError([primaryError, fallbackError], "Multiple model providers failed");
    }
  }
}

export { callGroq, checkGroqPromptGuard } from "./groq";
export { callGemini } from "./gemini";
export { callOpenRouter } from "./openrouter";
export * from "./types";
