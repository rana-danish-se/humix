import { analyzePost } from "./postAnalyzer";
import { analyzeContribution } from "./contributionAnalyzer";
import { generateCommentCandidate } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import { LLMProvider, LLMStepDebug, PipelineResult, PlatformType } from "@/lib/llm";

export async function runCommentIntelligencePipeline(
  postText: string,
  platform: PlatformType = "LinkedIn",
  userAdditionalContext?: string,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest"
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stepDebugLogs: LLMStepDebug[] = [];

  // 1. Analyze Post
  const postAnalysisData = await analyzePost(postText, platform, provider, model);
  const analysis = postAnalysisData.result;
  stepDebugLogs.push(postAnalysisData.debug);

  // 2. Discover Contribution & Relevance
  const contributionData = await analyzeContribution(
    postText,
    platform,
    analysis,
    userAdditionalContext,
    provider,
    model
  );
  const contribution = contributionData.result;
  stepDebugLogs.push(contributionData.debug);

  // If Contribution Analyzer recommends SKIP immediately
  if (contribution.shouldSkip) {
    return {
      status: "SKIP",
      analysis,
      contribution,
      critic: {
        verdict: "SKIP",
        score: 0,
        reasons: [contribution.skipReason || "No valuable contribution opportunity found for this post."],
        checks: {
          understandsPost: true,
          followsSelectedAngle: false,
          preservesAuthorTopic: true,
          addsNewObservation: false,
          isNotSummary: true,
          isNotGeneric: false,
          fails20PostTest: true,
          personalContextIsRelevant: false,
          avoidsTopicHijacking: true,
          avoidsSelfPromotion: true,
          avoidsAISlop: true,
          fitsPlatform: true,
          soundsNaturalHuman: true,
          proportionalLength: true,
          noFabricatedExperience: true,
        },
        critiqueSummary: contribution.skipReason || "Skipped due to low contribution value or topic hijacking risk.",
      },
      stepDebugLogs,
      metadata: {
        platform,
        modelUsed: model,
        providerUsed: provider,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // 3. Generate Candidate
  let generationData = await generateCommentCandidate(
    postText,
    platform,
    analysis,
    contribution,
    provider,
    model
  );
  let generation = generationData.result;
  stepDebugLogs.push(generationData.debug);

  // 4. Quality Critic & Anti-Slop Audit
  let criticData = await evaluateCommentQuality(
    postText,
    platform,
    generation.comment,
    analysis,
    contribution,
    provider,
    model
  );
  let critic = criticData.result;
  stepDebugLogs.push(criticData.debug);

  // Retry loop if critic demands REGENERATE (up to 1 retry)
  if (critic.verdict === "REGENERATE") {
    generationData = await generateCommentCandidate(
      postText,
      platform,
      analysis,
      {
        ...contribution,
        angleExplanation: `${contribution.angleExplanation}\n\nCRITIC FEEDBACK TO FIX IN THIS RETRY:\nSummary: ${critic.critiqueSummary}\nIssues to resolve: ${critic.reasons.join("; ")}`,
      },
      provider,
      model
    );
    generation = generationData.result;
    stepDebugLogs.push({
      ...generationData.debug,
      stepIndex: 3.5,
      stepName: "Candidate Regeneration (Retry)",
    });

    criticData = await evaluateCommentQuality(
      postText,
      platform,
      generation.comment,
      analysis,
      contribution,
      provider,
      model
    );
    critic = criticData.result;
    stepDebugLogs.push({
      ...criticData.debug,
      stepIndex: 4.5,
      stepName: "Anti-Slop Critic Re-Audit",
    });
  }

  const finalStatus = critic.verdict;

  return {
    status: finalStatus,
    comment: finalStatus === "PASS" ? generation.comment : undefined,
    analysis,
    contribution,
    critic,
    stepDebugLogs,
    metadata: {
      platform,
      modelUsed: model,
      providerUsed: provider,
      executionTimeMs: Date.now() - startTime,
    },
  };
}
