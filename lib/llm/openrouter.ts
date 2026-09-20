import { LLMRequest, LLMResponse } from "./types";

export async function callOpenRouter(
  request: LLMRequest,
  model: string = "deepseek/deepseek-chat"
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const modelSlug = model && model.trim() ? model.trim() : "deepseek/deepseek-chat";

  const payload: any = {
    model: modelSlug,
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
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
  };
}
