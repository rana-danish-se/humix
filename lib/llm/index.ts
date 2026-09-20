import { LLMProvider, LLMRequest, LLMResponse } from "./types";
import { callOpenRouter } from "./openrouter";
import { callGemini } from "./gemini";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callModel(
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest",
  request: LLMRequest,
  retries: number = 2
): Promise<LLMResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (provider === "gemini") {
        return await callGemini(request, model);
      } else {
        return await callOpenRouter(request, model);
      }
    } catch (error: any) {
      console.warn(`Model call attempt ${attempt}/${retries} (${provider}/${model}) failed: ${error.message}`);
      
      const isRateLimit =
        error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");

      // On rate limit or last attempt, trigger provider fallback immediately
      if (isRateLimit || attempt === retries) {
        if (provider === "gemini" && process.env.OPENROUTER_API_KEY) {
          console.info("Rate limit or error hit on Gemini. Falling back to OpenRouter provider...");
          return await callOpenRouter(request, "deepseek/deepseek-chat");
        } else if (provider === "openrouter" && process.env.GEMINI_API_KEY) {
          console.info("Error hit on OpenRouter. Falling back to Gemini provider...");
          return await callGemini(request, "gemini-flash-lite-latest");
        }
      }

      if (attempt < retries) {
        await delay(1000);
      }
    }
  }

  throw new Error("All model call attempts and fallbacks failed.");
}

export * from "./types";
