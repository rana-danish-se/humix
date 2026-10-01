import { analyzePost } from "./postAnalyzer";
import { analyzeContribution } from "./contributionAnalyzer";
import { generateCommentCandidate } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import { LLMProvider, LLMStepDebug, PipelineResult, PlatformType, PostAnalysisResult, QualityCriticResult, CommentGenerationResult } from "@/lib/llm";

function getCriticProvider(primaryProvider: LLMProvider): LLMProvider {
  return primaryProvider === "gemini" ? "gemini" : "openrouter";
}

function getCriticModel(primaryProvider: LLMProvider): string {
  return primaryProvider === "gemini" ? "gemini-3.8-flash" : "qwen/qwen3.8-27b:free";
}

function editorReview(generation: CommentGenerationResult): QualityCriticResult {
  const passed = typeof generation.editorScore === "number" && generation.editorScore >= 8;
  const reason = generation.editorReason || "Quality editor reviewed draft candidates.";
  return {
    verdict: passed ? "PASS" : "REGENERATE",
    score: Math.round((generation.editorScore || 0) * 10),
    reasons: [reason],
    critiqueSummary: reason,
    checks: {
      understandsPost: passed,
      followsSelectedAngle: passed,
      preservesAuthorTopic: passed,
      addsNewObservation: passed,
      isNotSummary: passed,
      isNotGeneric: passed,
      fails20PostTest: !passed,
      personalContextIsRelevant: passed,
      avoidsTopicHijacking: passed,
      avoidsSelfPromotion: passed,
      avoidsAISlop: passed,
      fitsPlatform: passed,
      soundsNaturalHuman: passed,
      proportionalLength: passed,
      noFabricatedExperience: passed,
    },
  };
}

function validatePostAnalysis(analysis: PostAnalysisResult, postText: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!analysis || typeof analysis !== "object") return { valid: false, issues: ["analysis is not an object"] };

  // Check coreIdea is substantial and specific
  if (typeof analysis?.coreIdea !== "string" || analysis.coreIdea.trim().length < 15) {
    issues.push("coreIdea too short or missing");
  } else if (analysis.coreIdea.toLowerCase().includes("general post") || analysis.coreIdea.toLowerCase().includes("general observation")) {
    issues.push("coreIdea appears generic/fallback");
  }

  // Check subject is specific
  if (typeof analysis.subject !== "string" || analysis.subject.trim().length < 3) {
    issues.push("subject too short or missing");
  }

  // Check claims are non-empty and not just truncated post text
  if (!Array.isArray(analysis.claims) || analysis.claims.length === 0) {
    issues.push("claims array is empty");
  } else {
    for (const claim of analysis.claims) {
      if (typeof claim !== "string") {
        issues.push("claim is not a string");
      } else if (claim.length > 200 && postText.includes(claim.slice(0, 100))) {
        issues.push("claim appears to be truncated post text rather than extracted claim");
      }
    }
  }

  // Check potentialContributionOpportunities don't contain summaries
  if (analysis.potentialContributionOpportunities && !Array.isArray(analysis.potentialContributionOpportunities)) {
    issues.push("potentialContributionOpportunities is not an array");
  } else if (analysis.potentialContributionOpportunities) {
    for (const opp of analysis.potentialContributionOpportunities) {
      if (typeof opp !== "string") {
        issues.push("potentialContributionOpportunity is not a string");
        continue;
      }
      const lower = opp.toLowerCase();
      if (/^(?:agreeing that|summarizing|restating|paraphrasing|echoing|confirming that)\b/.test(lower)) {
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
  if (!Array.isArray(analysis.implicitIdeas)) {
    issues.push("implicitIdeas missing");
  }

  return { valid: issues.length === 0, issues };
}

export async function runCommentIntelligencePipeline(
  postText: string,
  platform: PlatformType = "LinkedIn",
  userAdditionalContext?: string,
  provider: LLMProvider = "gemini",
  model: string = "gemini-3.8-flash",
  criticProvider?: LLMProvider,
  criticModel?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stepDebugLogs: LLMStepDebug[] = [];

  const criticProv = criticProvider || getCriticProvider(provider);
  const criticMod = criticModel || getCriticModel(provider);
  const planningModel = model;

  // 1. Analyze Post (with validation retry)
  let postAnalysisData = await analyzePost(postText, platform, provider, planningModel);
  let analysis = postAnalysisData.result;
  stepDebugLogs.push(postAnalysisData.debug);

  // Validate Step 1 output, retry once if invalid
  let analysisValidation = validatePostAnalysis(analysis, postText);
  if (!analysisValidation.valid) {
    console.warn(`[Pipeline] PostAnalysis validation failed: ${analysisValidation.issues.join("; ")}. Retrying with feedback...`);
    postAnalysisData = await analyzePost(
      `${postText}\n\n[INSTRUCTION: Please fix previous validation errors: ${analysisValidation.issues.join("; ")}]`,
      platform,
      provider,
      planningModel
    );
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
    planningModel
  );
  const contribution = contributionData.result;
  if (typeof contribution.shouldSkip !== "boolean" ||
      ![0, 1, 2, 3].includes(contribution.personalizationLevel) ||
      typeof contribution.topicHijackRisk !== "boolean" ||
      (!contribution.shouldSkip && (!contribution.selectedAngle || typeof contribution.angleExplanation !== "string"))) {
    throw new Error("Contribution analysis returned an invalid decision");
  }
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
        modelUsed: contributionData.debug.modelUsed || model,
        providerUsed: contributionData.debug.providerUsed || provider,
        criticModelUsed: undefined,
        criticProviderUsed: undefined,
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
    model,
    userAdditionalContext
  );
  let generation = generationData.result;
  stepDebugLogs.push(generationData.debug);

  // If the candidate generator's built-in editor score is >= 8, it meets quality threshold
  if (typeof generation.editorScore === "number" && generation.editorScore >= 8) {
    const critic = editorReview(generation);
    return {
      status: critic.verdict,
      comment: critic.verdict === "PASS" ? generation.comment : undefined,
      analysis,
      contribution,
      critic,
      stepDebugLogs,
      metadata: {
        platform,
        modelUsed: generationData.debug.modelUsed || model,
        providerUsed: generationData.debug.providerUsed || provider,
        criticModelUsed: generation.editorModelUsed || model,
        criticProviderUsed: provider,
        editorScore: generation.editorScore,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // 4. Quality Critic & Anti-Slop Audit
  let criticData = await evaluateCommentQuality(
    postText,
    platform,
    generation.comment,
    analysis,
    contribution,
    criticProv,
    criticMod,
    userAdditionalContext
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
      model,
      userAdditionalContext
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
      criticMod,
      userAdditionalContext
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
      modelUsed: generationData.debug.modelUsed || model,
      providerUsed: generationData.debug.providerUsed || provider,
      criticModelUsed: criticData.debug.modelUsed || criticMod,
      criticProviderUsed: criticData.debug.providerUsed || criticProv,
      editorScore: generation.editorScore,
      executionTimeMs: Date.now() - startTime,
    },
  };
}
