import fs from "fs";
import path from "path";

// Load .env.local
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

async function testGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Testing Gemini models with key present:", !!apiKey);
  if (!apiKey) return;

  // List available models
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();
    console.log("Gemini Available Models:");
    if (listData.models) {
      listData.models.forEach((m: any) => console.log(" -", m.name, m.supportedGenerationMethods));
    } else {
      console.log(listData);
    }
  } catch (e: any) {
    console.error("Gemini List models error:", e.message);
  }
}

async function testOpenRouterModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log("\nTesting OpenRouter models with key present:", !!apiKey);
  if (!apiKey) return;

  const testModels = [
    "qwen/qwen-2.5-72b-instruct",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-chat",
  ];

  for (const m of testModels) {
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
      }
    } catch (e: any) {
      console.error(`OpenRouter [${m}] failed:`, e.message);
    }
  }
}

async function main() {
  await testGeminiModels();
  await testOpenRouterModels();
}

main();
