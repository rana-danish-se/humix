import fs from "fs";
import path from "path";
import { runCommentIntelligencePipeline } from "../lib/agent/pipeline";

// Load .env.local manually
try {
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
} catch (e) {
  console.warn("Could not load .env.local file", e);
}

async function verifyFix() {
  console.log("--- Testing Gemini Pipeline (gemini-flash-lite-latest) ---");
  const post = "Why founders struggle with hiring their first salesperson: they usually expect them to create the sales process from scratch rather than executing an established playbook.";
  
  let startTime = Date.now();
  const resGemini = await runCommentIntelligencePipeline(post, "LinkedIn", undefined, "gemini", "gemini-flash-lite-latest");
  console.log(`Gemini Status: ${resGemini.status} (${Date.now() - startTime}ms)`);
  console.log("Generated Comment:", resGemini.comment);
  console.log("Debug Steps Executed:", resGemini.stepDebugLogs?.length);

  console.log("\n--- Testing OpenRouter Pipeline (deepseek/deepseek-chat) ---");
  startTime = Date.now();
  const resOpenRouter = await runCommentIntelligencePipeline(post, "LinkedIn", undefined, "openrouter", "deepseek/deepseek-chat");
  console.log(`OpenRouter Status: ${resOpenRouter.status} (${Date.now() - startTime}ms)`);
  console.log("Generated Comment:", resOpenRouter.comment);
  console.log("Debug Steps Executed:", resOpenRouter.stepDebugLogs?.length);
}

verifyFix();
