import { analyzePost } from "./postAnalyzer";
import { analyzeContribution } from "./contributionAnalyzer";
import { generateCommentCandidate } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import { LLMProvider, LLMStepDebug, PipelineResult, PlatformType, PostAnalysisResult } from "@/lib/llm";

function getCriticProvider(provider: LLMProvider): LLMProvider {
  return provider === "gemini" ? "openrouter" : "gemini";
}

function getCriticModel(provider: LLMProvider): string {
  return provider === "gemini" ? "deepseek/deepseek-chat" : "gemini-flash-lite-latest";
}

function validatePostAnalysis(analysis: PostAnalysisResult, postText: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check coreIdea is substantial and specific
  if (!analysis.coreIdea || analysis.coreIdea.trim().length < 20) {
    issues.push("coreIdea too short or missing");
  }
  if (analysis.coreIdea.toLowerCase().includes("general post") || analysis.coreIdea.toLowerCase().includes("general observation")) {
    issues.push("coreIdea appears generic/fallback");
  }

  // Check subject is specific
  if (!analysis.subject || analysis.subject.trim().length < 5) {
    issues.push("subject too short or missing");
  }

  // Check claims are non-empty and not just truncated post text
  if (!analysis.claims || analysis.claims.length === 0) {
    issues.push("claims array is empty");
  } else {
    for (const claim of analysis.claims) {
      if (claim.length > 200 && postText.includes(claim.slice(0, 100))) {
        issues.push("claim appears to be truncated post text rather than extracted claim");
      }
    }
  }

  // Check potentialContributionOpportunities don't contain summaries
  if (analysis.potentialContributionOpportunities) {
    for (const opp of analysis.potentialContributionOpportunities) {
      const lower = opp.toLowerCase();
      if (lower.includes("agree") || lower.includes("summariz") || lower.includes("restate") || 
          lower.includes("paraphrase") || lower.includes("echo") || lower.includes("confirm")) {
        issues.push(`potentialContributionOpportunity appears to be summary/echo: "${opp}"`);
      }
      if (lower === "general comment" || lower === "general observation") {
        issues.push("potentialContributionOpportunity is generic fallback");
      }
    }
  }

  // Check postType is valid enum
  const validPostTypes = [
    "founder_insight", "personal_story", "marketing_advice", "coach_post",
    "controversial_opinion", "ai_tech", "lifestyle", "promotional", "question"
  ];
  if (!validPostTypes.includes(analysis.postType)) {
    issues.push(`invalid postType: ${analysis.postType}`);
  }

  // Check implicitIdeas exist (can be empty but not missing)
  if (!analysis.implicitIdeas) {
    issues.push("implicitIdeas missing");
  }

  return { valid: issues.length === 0, issues };
}

export async function runCommentIntelligencePipeline(
  postText: string,
  platform: PlatformType = "LinkedIn",
  userAdditionalContext?: string,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest",
  criticProvider?: LLMProvider,
  criticModel?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stepDebugLogs: LLMStepDebug[] = [];

  const criticProv = criticProvider || getCriticProvider(provider);
  const criticMod = criticModel || getCriticModel(provider);

  // 1. Analyze Post (with validation retry)
  let postAnalysisData = await analyzePost(postText, platform, provider, model);
  let analysis = postAnalysisData.result;
  stepDebugLogs.push(postAnalysisData.debug);

  // Validate Step 1 output, retry once if invalid
  let analysisValidation = validatePostAnalysis(analysis, postText);
  if (!analysisValidation.valid) {
    console.warn(`[Pipeline] PostAnalysis validation failed: ${analysisValidation.issues.join("; ")}. Retrying...`);
    postAnalysisData = await analyzePost(postText, platform, provider, model);
    analysis = postAnalysisData.result;
    stepDebugLogs.push({
      ...postAnalysisData.debug,
      stepIndex: 1.5,
      stepName: "Semantic Post Analysis (Retry)",
    });
    
    analysisValidation = validatePostAnalysis(analysis, postText);
    if (!analysisValidation.valid) {
      throw new Error(`PostAnalysis validation failed after retry: ${analysisValidation.issues.join("; ")}`);
    }
  }

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
        criticModelUsed: criticMod,
        criticProviderUsed: criticProv,
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

  // 4. Quality Critic & Anti-Slop Audit (uses DIFFERENT provider/model)
  let criticData = await evaluateCommentQuality(
    postText,
    platform,
    generation.comment,
    analysis,
    contribution,
    criticProv,
    criticMod
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
      criticProv,
      criticMod
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
      criticModelUsed: criticMod,
      criticProviderUsed: criticProv,
      executionTimeMs: Date.now() - startTime,
    },
  };
}
