import { generateCommentCandidates } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import { checkGroqPromptGuard, type PipelineMode, type PipelineResult, type LLMProvider, type PlatformType, type WritingContext } from "@/lib/llm";

export async function runCommentIntelligencePipeline(
  postText: string, platform: PlatformType = "LinkedIn", userContext = "",
  mode: PipelineMode = "collaborative", model?: string,
  criticProvider?: LLMProvider, criticModel?: string, options: WritingContext = {},
): Promise<PipelineResult> {
  const started = Date.now();
  const defaults: Record<LLMProvider, string> = {
    groq: "openai/gpt-oss-120b", gemini: "gemini-3.7-flash", openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  };
  const writer = mode === "collaborative" ? "groq" : mode;
  const reviewer = criticProvider || (mode === "collaborative" ? "gemini" : writer);
  const result: PipelineResult = {
    status: "SKIP", comments: [], message: "", stepDebugLogs: [],
    metadata: { platform, pipelineMode: mode, executionTimeMs: 0, attempts: 0 },
  };
  const finish = (status: PipelineResult["status"], message: string) => {
    result.status = status;
    result.message = message;
    result.metadata.executionTimeMs = Date.now() - started;
    return result;
  };
  if (typeof postText !== "string" || !postText.trim()) return finish("SKIP", "Paste the full post first.");
  // Direct callers use the same bounded input contract as the API.
  if (postText.length > 16000 || typeof userContext !== "string" || userContext.length > 3000 ||
      (options.authorContext !== undefined && (typeof options.authorContext !== "string" || options.authorContext.length > 1000)) ||
      [options.voiceSamples, options.recentComments].some((items, index) => items !== undefined &&
        (!Array.isArray(items) || items.length > (index === 0 ? 5 : 12) || items.some(item => typeof item !== "string" || item.length > 700)))) {
    return finish("SKIP", "Some input is invalid or too long. Shorten it and try again.");
  }
  const post = postText.trim();
  const guard = await checkGroqPromptGuard(post + "\n" + userContext);
  result.promptGuard = guard;
  if (guard.isAttack) return finish("SKIP", "The input contains instructions that interfere with drafting. Remove them and try again.");
  let feedback: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    result.metadata.attempts++;
    const generated = await generateCommentCandidates(post, platform, userContext, options, writer,
      (mode !== "collaborative" && model) || defaults[writer], feedback);
    result.analysis = generated.result.analysis;
    result.stepDebugLogs.push({ ...generated.debug, stepIndex: attempt * 2 + 1 });
    result.metadata.providerUsed = generated.debug.providerUsed;
    result.metadata.modelUsed = generated.debug.modelUsed;
    if (generated.result.analysis.missingContext.trim() || !generated.result.candidates.length) {
      return finish("SKIP", generated.result.skipReason || generated.result.analysis.missingContext);
    }
    const reviewed = await evaluateCommentQuality(post, platform, userContext, generated.result.candidates, options, reviewer,
      criticModel || (mode !== "collaborative" && !criticProvider && model) || defaults[reviewer]);
    result.review = reviewed.result;
    result.stepDebugLogs.push({ ...reviewed.debug, stepIndex: attempt * 2 + 2 });
    result.metadata.criticProviderUsed = reviewed.debug.providerUsed;
    result.metadata.criticModelUsed = reviewed.debug.modelUsed;
    if (reviewed.comments.length === 3) {
      result.comments = reviewed.comments;
      return finish("PASS", "Three different ways to join the conversation. Choose the one you agree with.");
    }
    feedback = { previousCandidates: generated.result.candidates, review: reviewed.result,
      instruction: "Create a complete improved set. Address the rejected premises; do not merely rephrase them. Supply three distinct acceptable options." };
  }
  return finish("REGENERATE", "I couldn't find three distinct comments that passed review. Add any missing context or try another set.");
}
