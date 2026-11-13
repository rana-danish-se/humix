import { generateCommentCandidates } from "./commentGenerator";

// Saved facts are appended to the per-post context so the writer, the reviewer and
// the deterministic checks all treat them as the same evidence source.
export function withProfileFacts(userContext: string, profileFacts?: string): string {
  const facts = (profileFacts || "").trim();
  return [userContext.trim(), facts && `Standing facts about me (true; use only when directly relevant):\n${facts}`].filter(Boolean).join("\n\n");
}
import { evaluateCommentQuality } from "./qualityCritic";
import { checkGroqPromptGuard, DEFAULT_MODELS, type PipelineMode, type PipelineResult, type LLMProvider, type PlatformType, type WritingContext } from "@/lib/llm";

export async function runCommentIntelligencePipeline(
  postText: string, platform: PlatformType = "LinkedIn", userContext = "",
  mode: PipelineMode = "collaborative", model?: string,
  criticProvider?: LLMProvider, criticModel?: string, options: WritingContext = {},
): Promise<PipelineResult> {
  const started = Date.now();
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
      (options.profileFacts !== undefined && (typeof options.profileFacts !== "string" || options.profileFacts.length > 1500)) ||
      [options.voiceSamples, options.recentComments].some((items, index) => items !== undefined &&
        (!Array.isArray(items) || items.length > (index === 0 ? 5 : 12) || items.some(item => typeof item !== "string" || item.length > 700)))) {
    return finish("SKIP", "Some input is invalid or too long. Shorten it and try again.");
  }
  const post = postText.trim();
  const { profileFacts, ...writing } = options;
  const evidence = withProfileFacts(userContext, profileFacts);
  const guard = await checkGroqPromptGuard(post + "\n" + evidence);
  result.promptGuard = guard;
  if (guard.isAttack) return finish("SKIP", "The input contains instructions that interfere with drafting. Remove them and try again.");
  let feedback: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    result.metadata.attempts++;
    const generated = await generateCommentCandidates(post, platform, evidence, writing, writer,
      (mode !== "collaborative" && model) || DEFAULT_MODELS[writer], feedback);
    result.analysis = generated.result.analysis;
    result.stepDebugLogs.push({ ...generated.debug, stepIndex: attempt * 2 + 1 });
    result.metadata.providerUsed = generated.debug.providerUsed;
    result.metadata.modelUsed = generated.debug.modelUsed;
    if (generated.result.analysis.missingContext.trim() || !generated.result.candidates.length) {
      return finish("SKIP", generated.result.skipReason || generated.result.analysis.missingContext);
    }
    const reviewed = await evaluateCommentQuality(post, platform, evidence, generated.result.candidates, writing, reviewer,
      criticModel || (mode !== "collaborative" && !criticProvider && model) || DEFAULT_MODELS[reviewer]);
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
