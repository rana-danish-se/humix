import { LLMHttpError, LLMRequest, LLMResponse } from "./types";

export async function callGroq(
  request: LLMRequest,
  model: string = "openai/gpt-oss-120b"
): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  const modelSlug = model && model.trim() ? model.trim() : "openai/gpt-oss-120b";

  const payload: Record<string, unknown> = {
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
    temperature: request.temperature ?? 0.2,
    max_tokens: Math.min(Math.max(request.maxTokens ?? 1000, 64), 2500),
  };

  // Only enable response_format json_object for models known to support it cleanly
  if (request.responseFormat === "json" && !modelSlug.includes("gpt-oss-20b")) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LLMHttpError(
      response.status,
      `Groq API request failed with status ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "";

  let parsedJson: unknown = undefined;
  if (request.responseFormat === "json") {
    try {
      const cleaned = rawText.replace(/```(?:json)?\n?|\n?```/g, "").trim();
      try {
        parsedJson = JSON.parse(cleaned);
      } catch {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsedJson = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } else {
          const firstBracket = cleaned.indexOf("[");
          const lastBracket = cleaned.lastIndexOf("]");
          if (firstBracket !== -1 && lastBracket > firstBracket) {
            parsedJson = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
          }
        }
      }
    } catch {
      console.warn("Failed to parse Groq JSON response:", rawText);
    }
  }

  return {
    text: rawText,
    parsedJson,
    providerUsed: "groq",
    modelUsed: typeof data.model === "string" ? data.model : modelSlug,
  };
}

export async function checkGroqPromptGuard(
  text: string
): Promise<{ isAttack: boolean; score: number }> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || !text || !text.trim()) {
    return { isAttack: false, score: 0 };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-prompt-guard-2-86m",
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { isAttack: false, score: 0 };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "0";
    const score = parseFloat(raw);
    const validScore = Number.isFinite(score) ? score : 0;
    return {
      isAttack: validScore > 0.85,
      score: validScore,
    };
  } catch (err) {
    console.warn("Groq Prompt Guard check skipped:", err);
    return { isAttack: false, score: 0 };
  }
}
