import { analyzePost } from "./postAnalyzer";
import { analyzeContribution } from "./contributionAnalyzer";
import { generateCommentCandidate } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import {
  LLMProvider, LLMStepDebug, PipelineResult, PlatformType, PostAnalysisResult,
  ContributionResult, QualityCriticResult, checkGroqPromptGuard,
} from "@/lib/llm";

export async function runCommentIntelligencePipeline(
  postText: string, platform: PlatformType = "LinkedIn", userAdditionalContext?: string,
  providerOrMode: LLMProvider | "collaborative" = "collaborative", model?: string,
  criticProvider?: LLMProvider, criticModel?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stepDebugLogs: LLMStepDebug[] = [];
  const collaborative = providerOrMode === "collaborative";
  const defaultModels: Record<LLMProvider, string> = {
    groq: "openai/gpt-oss-120b", gemini: "gemini-3.7-flash", openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  };
  const role = (preferred: LLMProvider) => {
    const provider = collaborative ? preferred : providerOrMode;
    return { provider, model: (!collaborative && model) || defaultModels[provider] };
  };
  const reader = role("groq");
  const strategy = role("gemini");
  const writer = role("openrouter");
  const editor = role("groq");
  const reviewer = role("gemini");
  if (criticProvider) {
    reviewer.provider = criticProvider;
    reviewer.model = criticModel || defaultModels[criticProvider];
  } else if (criticModel) reviewer.model = criticModel;

  let analysis: PostAnalysisResult | undefined;
  let critic: QualityCriticResult | undefined;
  let promptGuard: PipelineResult["promptGuard"];
  let contribution: ContributionResult = {
    shouldSkip: true, skipReasonCode: "INSUFFICIENT_CONTEXT",
    skipReason: "Add your own reaction or rough reply. Humix edits your thought instead of inventing one.",
    personalizationLevel: 0, topicHijackRisk: false,
  };
  let writerUsed: { provider?: LLMProvider; model?: string } = {};
  const finish = (status: PipelineResult["status"], comment?: string): PipelineResult => ({
    status, ...(status === "PASS" && comment ? { comment } : {}),
    analysis, contribution, critic, stepDebugLogs, promptGuard,
    metadata: {
      platform, pipelineMode: providerOrMode, providerUsed: writerUsed.provider || providerOrMode,
      modelUsed: writerUsed.model || "Not run",
      criticProviderUsed: stepDebugLogs.findLast(step => step.stepIndex === 4 || step.stepIndex === 4.5)?.providerUsed,
      criticModelUsed: stepDebugLogs.findLast(step => step.stepIndex === 4 || step.stepIndex === 4.5)?.modelUsed,
      executionTimeMs: Date.now() - startTime,
    },
  });
  const stop = (reason: string): PipelineResult => {
    contribution = { ...contribution, shouldSkip: true, skipReason: reason };
    return finish("SKIP");
  };

  // This boundary applies to API, evaluation and direct callers, before any LLM.
  if (typeof userAdditionalContext !== "string" || !userAdditionalContext.trim()) return finish("SKIP");
  const reaction = userAdditionalContext.trim();

  const guardStart = Date.now();
  const guard = await checkGroqPromptGuard(postText + "\n" + reaction);
  promptGuard = { ...guard, flagged: guard.isAttack };
  stepDebugLogs.push({
    stepIndex: 0, stepName: "Input Guard", agentName: "Input Guard",
    systemPrompt: "Check inputs for prompt injection.", userPrompt: "",
    rawResponseText: JSON.stringify(guard), parsedOutput: guard, executionTimeMs: Date.now() - guardStart,
    ...(guard.status === "checked" ? { providerUsed: "groq" as const, modelUsed: "meta-llama/llama-prompt-guard-2-86m" } : {}),
  });
  if (guard.isAttack) return stop("The input guard flagged instructions that could interfere with drafting. Remove embedded instructions and try again.");

  const read = await analyzePost(postText, platform, reader.provider, reader.model);
  analysis = read.result;
  stepDebugLogs.push(read.debug);
  const relevance = await analyzeContribution(postText, platform, analysis, reaction, strategy.provider, strategy.model);
  contribution = relevance.result;
  stepDebugLogs.push(relevance.debug);
  if (contribution.shouldSkip) return finish("SKIP");

  let generation = await generateCommentCandidate(postText, platform, analysis, contribution,
    writer.provider, writer.model, reaction, editor.provider, editor.model);
  writerUsed = { provider: generation.debug.providerUsed, model: generation.debug.modelUsed };
  stepDebugLogs.push(generation.debug);
  if (!generation.result.comment) return stop(generation.result.abstentionReason || "No faithful edit was found.");

  let review = await evaluateCommentQuality(postText, platform, generation.result.comment,
    analysis, contribution, reviewer.provider, reviewer.model, reaction);
  critic = review.result;
  stepDebugLogs.push(review.debug);
  // Only wording defects get one retry. Unsupported premises stop immediately.
  if (critic.verdict === "REGENERATE") {
    generation = await generateCommentCandidate(postText, platform, analysis, contribution,
      writer.provider, writer.model, reaction, editor.provider, editor.model, critic.reasons.join("; "));
    writerUsed = { provider: generation.debug.providerUsed, model: generation.debug.modelUsed };
    stepDebugLogs.push({ ...generation.debug, stepIndex: 3.5, stepName: "Wording Revision" });
    if (!generation.result.comment) return stop(generation.result.abstentionReason || "No faithful revision was found.");
    review = await evaluateCommentQuality(postText, platform, generation.result.comment,
      analysis, contribution, reviewer.provider, reviewer.model, reaction);
    critic = review.result;
    stepDebugLogs.push({ ...review.debug, stepIndex: 4.5 });
  }
  if (critic.verdict === "SKIP") contribution = { ...contribution, shouldSkip: true, skipReason: critic.critiqueSummary };
  return finish(critic.verdict, generation.result.comment);
}
