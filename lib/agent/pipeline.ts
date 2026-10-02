import { analyzePost } from "./postAnalyzer";
import { analyzeContribution } from "./contributionAnalyzer";
import { generateCommentCandidate } from "./commentGenerator";
import { evaluateCommentQuality } from "./qualityCritic";
import {
  LLMProvider,
  LLMStepDebug,
  PipelineResult,
  PlatformType,
  PostAnalysisResult,
  checkGroqPromptGuard,
} from "@/lib/llm";

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
  providerOrMode: LLMProvider | "collaborative" = "collaborative",
  model?: string,
  criticProvider?: LLMProvider,
  criticModel?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const stepDebugLogs: LLMStepDebug[] = [];
  const isCollaborative = providerOrMode === "collaborative";

  // Provider assignment based on multi-provider collaborative architecture:
  // 1. Safety & Fast Semantic Post Analysis: Groq (120B / 27B + Prompt Guard)
  // 2. Contribution Strategy & Angle Reasoning: Gemini (3.7 Flash / 3.5 Flash)
  // 3. Multi-Candidate Generation: OpenRouter (Nemotron Ultra 550B / Super 120B / Space Bunny)
  // 4. Candidate Editorial Review: Groq (120B / 27B)
  // 5. Adversarial Quality Critic & Audit: Gemini (3.7 Flash / 3.5 Flash)
  const analysisProv: LLMProvider = isCollaborative ? "groq" : providerOrMode;
  const analysisMod: string = isCollaborative
    ? "openai/gpt-oss-120b"
    : model || (providerOrMode === "groq" ? "openai/gpt-oss-120b" : providerOrMode === "gemini" ? "gemini-3.7-flash" : "nvidia/nemotron-3-ultra-550b-a55b:free");

  const strategyProv: LLMProvider = isCollaborative ? "gemini" : providerOrMode;
  const strategyMod: string = isCollaborative
    ? "gemini-3.7-flash"
    : model || (strategyProv === "gemini" ? "gemini-3.7-flash" : strategyProv === "groq" ? "openai/gpt-oss-120b" : "nvidia/nemotron-3-ultra-550b-a55b:free");

  const generationProv: LLMProvider = isCollaborative ? "openrouter" : providerOrMode;
  const generationMod: string = isCollaborative
    ? "nvidia/nemotron-3-ultra-550b-a55b:free"
    : model || (generationProv === "openrouter" ? "nvidia/nemotron-3-ultra-550b-a55b:free" : generationProv === "gemini" ? "gemini-3.7-flash" : "openai/gpt-oss-120b");

  const editorProv: LLMProvider = isCollaborative ? "groq" : providerOrMode;
  const editorMod: string = isCollaborative ? "openai/gpt-oss-120b" : generationMod;

  const criticProv: LLMProvider = criticProvider || (isCollaborative ? "gemini" : providerOrMode);
  const criticMod: string = criticModel || (isCollaborative ? "gemini-3.7-flash" : strategyMod);

  // 0. Pre-Flight Security & Prompt Injection Guard (Groq)
  let promptGuardInfo: { isAttack: boolean; score: number; flagged: boolean } | undefined;
  try {
    const pgStart = Date.now();
    const guardRes = await checkGroqPromptGuard(`${postText}\n${userAdditionalContext || ""}`);
    promptGuardInfo = {
      isAttack: guardRes.isAttack,
      score: guardRes.score,
      flagged: guardRes.isAttack,
    };
    stepDebugLogs.push({
      stepIndex: 0,
      stepName: "Prompt Injection & Security Guard",
      agentName: "Prompt Guard Agent (Groq)",
      systemPrompt: "Evaluate social media post and user inputs for prompt injection, jailbreaks, or adversarial manipulation.",
      userPrompt: postText.slice(0, 1000),
      rawResponseText: `Model: meta-llama/llama-prompt-guard-2-86m\nAttack Probability: ${(guardRes.score * 100).toFixed(2)}%\nVerdict: ${guardRes.isAttack ? "ALERT_FLAGGED" : "CLEAN"}`,
      parsedOutput: promptGuardInfo,
      executionTimeMs: Date.now() - pgStart,
      providerUsed: "groq",
      modelUsed: "meta-llama/llama-prompt-guard-2-86m",
    });
  } catch (err) {
    console.warn("[Pipeline] Prompt Guard check skipped or failed:", err);
  }

  // 1. Analyze Post (Groq: ultra-fast structural and semantic extraction)
  let postAnalysisData = await analyzePost(postText, platform, analysisProv, analysisMod);
  let analysis = postAnalysisData.result;
  stepDebugLogs.push(postAnalysisData.debug);

  // Validate Step 1 output, retry once if invalid
  let analysisValidation = validatePostAnalysis(analysis, postText);
  if (!analysisValidation.valid) {
    console.warn(`[Pipeline] PostAnalysis validation failed: ${analysisValidation.issues.join("; ")}. Retrying with feedback...`);
    postAnalysisData = await analyzePost(
      `${postText}\n\n[INSTRUCTION: Please fix previous validation errors: ${analysisValidation.issues.join("; ")}]`,
      platform,
      analysisProv,
      analysisMod
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

  // 2. Discover Contribution & Relevance (Gemini: deep cognitive reasoning and angle strategy)
  const contributionData = await analyzeContribution(
    postText,
    platform,
    analysis,
    userAdditionalContext,
    strategyProv,
    strategyMod
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
      promptGuard: promptGuardInfo,
      metadata: {
        platform,
        pipelineMode: isCollaborative ? "collaborative" : providerOrMode,
        providerRoles: {
          safety: { provider: "groq", model: "meta-llama/llama-prompt-guard-2-86m" },
          analysis: { provider: analysisProv, model: analysisMod },
          strategy: { provider: strategyProv, model: strategyMod },
          generation: { provider: generationProv, model: generationMod },
          editor: { provider: editorProv, model: editorMod },
          critic: { provider: criticProv, model: criticMod },
        },
        modelUsed: strategyMod,
        providerUsed: isCollaborative ? "collaborative" : providerOrMode,
        criticModelUsed: undefined,
        criticProviderUsed: undefined,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }

  // 3. Generate Candidate Comments (OpenRouter: creative human-sounding draft candidates)
  // With Groq handling editorial scoring and ranking of the generated drafts
  let generationData = await generateCommentCandidate(
    postText,
    platform,
    analysis,
    contribution,
    generationProv,
    generationMod,
    userAdditionalContext,
    editorProv,
    editorMod
  );
  let generation = generationData.result;
  stepDebugLogs.push(generationData.debug);

  // 4. Quality Critic & Adversarial Anti-Slop Audit (Gemini: strict 15-check evaluation)
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

  // Retry loop if critic demands REGENERATE (up to 1 retry by OpenRouter with Gemini's critique)
  if (critic.verdict === "REGENERATE") {
    generationData = await generateCommentCandidate(
      postText,
      platform,
      analysis,
      {
        ...contribution,
        angleExplanation: `${contribution.angleExplanation}\n\nCRITIC FEEDBACK TO FIX IN THIS RETRY:\nSummary: ${critic.critiqueSummary}\nIssues to resolve: ${critic.reasons.join("; ")}`,
      },
      generationProv,
      generationMod,
      userAdditionalContext,
      editorProv,
      editorMod
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
    promptGuard: promptGuardInfo,
    metadata: {
      platform,
      pipelineMode: isCollaborative ? "collaborative" : providerOrMode,
      providerRoles: {
        safety: { provider: "groq", model: "meta-llama/llama-prompt-guard-2-86m" },
        analysis: { provider: analysisProv, model: analysisMod },
        strategy: { provider: strategyProv, model: strategyMod },
        generation: { provider: generationProv, model: generationMod },
        editor: { provider: editorProv, model: editorMod },
        critic: { provider: criticProv, model: criticMod },
      },
      modelUsed: `${generationProv}/${generationMod}`,
      providerUsed: isCollaborative ? "collaborative" : providerOrMode,
      criticModelUsed: criticData.debug.modelUsed || criticMod,
      criticProviderUsed: criticData.debug.providerUsed || criticProv,
      editorScore: generation.editorScore,
      executionTimeMs: Date.now() - startTime,
    },
  };
}
