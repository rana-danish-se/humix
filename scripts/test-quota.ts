import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function testGeminiQuotaModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const candidateModels = [
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello" }] }],
        }),
      });
      console.log(`Gemini [${m}]: status ${res.status}`);
      if (!res.ok) {
        const err = await res.text();
        console.log("  error:", err.slice(0, 200));
      } else {
        const data = await res.json();
        console.log("  success response:", data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
      }
    } catch (e: any) {
      console.error(`Gemini [${m}] failed:`, e.message);
    }
  }
}

async function testOpenRouterFallback() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return;

  const candidateModels = [
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct",
  ];

  for (const m of candidateModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      console.log(`OpenRouter [${m}]: status ${res.status}`);
      if (!res.ok) {
        const text = await res.text();
        console.log("  error:", text);
      } else {
        const data = await res.json();
        console.log("  success response:", data.choices?.[0]?.message?.content?.trim());
      }
    } catch (e: any) {
      console.error(`OpenRouter [${m}] failed:`, e.message);
    }
  }
}

async function main() {
  console.log("Testing Gemini Quota Models...");
  await testGeminiQuotaModels();
  console.log("\nTesting OpenRouter Models...");
  await testOpenRouterFallback();
}

main();
