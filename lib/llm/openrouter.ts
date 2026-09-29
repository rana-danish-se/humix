import { LLMHttpError, LLMRequest, LLMResponse } from "./types";

export async function callOpenRouter(
  request: LLMRequest,
  model: string = "qwen/qwen3-30b-a3b-instruct-2507"
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const modelSlug = model && model.trim() ? model.trim() : "qwen/qwen3-30b-a3b-instruct-2507";
  const fallbackModels = (modelSlug === "anthropic/claude-sonnet-4.6"
    ? ["openai/gpt-5.4-mini", "qwen/qwen3-30b-a3b-instruct-2507", "meta-llama/llama-3.3-70b-instruct"]
    : ["qwen/qwen3-30b-a3b-instruct-2507", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat"]
  ).filter((candidate) => candidate !== modelSlug);

  const payload: any = {
    model: modelSlug,
    models: fallbackModels,
    messages: [
      {
        role: "system",
        content: request.systemPrompt,
      },
      {
        role: "user",
        content: request.userPrompt,
      },
    ],
    temperature: request.temperature ?? 0.3,
    max_tokens: Math.min(Math.max(request.maxTokens ?? 900, 128), 2000),
  };

  if (request.responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Humix Comment Intelligence",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMHttpError(response.status,
      `OpenRouter API request failed with status ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "";

  let parsedJson: any = undefined;
  if (request.responseFormat === "json") {
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
      parsedJson = JSON.parse(cleaned);
    } catch (e) {
      console.warn("Failed to parse OpenRouter JSON response:", rawText);
    }
  }

  return {
    text: rawText,
    parsedJson,
    providerUsed: "openrouter",
    modelUsed: typeof data.model === "string" ? data.model : modelSlug,
  };
}
