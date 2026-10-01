import { callModel, LLMProvider, PostAnalysisResult, ContributionResult, QualityCriticResult, LLMStepDebug } from "@/lib/llm";
import { validateComment } from "./commentGenerator";

const REQUIRED_CHECKS = [
  "understandsPost", "followsSelectedAngle", "preservesAuthorTopic", "addsNewObservation",
  "isNotSummary", "isNotGeneric", "fails20PostTest", "personalContextIsRelevant",
  "avoidsTopicHijacking", "avoidsSelfPromotion", "avoidsAISlop", "fitsPlatform",
  "soundsNaturalHuman", "proportionalLength", "noFabricatedExperience",
] as const;

export async function evaluateCommentQuality(
  postText: string,
  platform: string,
  candidateComment: string,
  analysis: PostAnalysisResult,
  contribution: ContributionResult,
  provider: LLMProvider = "gemini",
  model: string = "gemini-3.8-flash",
  userAdditionalContext?: string
): Promise<{ result: QualityCriticResult; debug: LLMStepDebug }> {
  const startTime = Date.now();
  const systemPrompt = `You are reviewing a proposed social media comment for a real person to post under their own name on ${platform}.
Judge the exact wording, not how clever it sounds. A brief, natural reaction or practical observation is ideal; a new profound insight is NOT required. Mark isNotSummary true when it does not merely condense or paraphrase the author's post.

PASS only if it clearly responds to this post, sounds like an authentic human being, and is safe to publish.
REGENERATE if the angle is okay but the wording is generic, formulaic, too long, awkward, or sounds like ChatGPT.
SKIP if the post cannot be commented on naturally without forced promotion or fabrication.

CRITICAL CHECKS:
- Reject claims of client work, projects, results, or firsthand experience that are not in the context.
- Reject ungrounded guesses about the author's private motives or psychology.
- Reject performative AI openings ('That line hits hard', 'It's wild how', 'The part about', 'Quietly', 'At the end of the day').
- Reject dramatic endings or neat X-versus-Y contrasts.
- Do NOT turn the reply into a sales pitch.
- Set fails20PostTest to TRUE ONLY if the comment is completely generic and could be pasted onto 20 completely unrelated posts without changing a word. If it refers to this post's situation, fails20PostTest must be FALSE.

Return JSON:
{
  "verdict": "PASS" | "REGENERATE" | "SKIP",
  "score": number (0-100),
  "reasons": string[],
  "critiqueSummary": "one sentence",
  "checks": {
    "understandsPost": boolean,
    "followsSelectedAngle": boolean,
    "preservesAuthorTopic": boolean,
    "addsNewObservation": boolean,
    "isNotSummary": boolean,
    "isNotGeneric": boolean,
    "fails20PostTest": boolean,
    "personalContextIsRelevant": boolean,
    "avoidsTopicHijacking": boolean,
    "avoidsSelfPromotion": boolean,
    "avoidsAISlop": boolean,
    "fitsPlatform": boolean,
    "soundsNaturalHuman": boolean,
    "proportionalLength": boolean,
    "noFabricatedExperience": boolean
  }
}`;

  const userPrompt = `PLATFORM: ${platform}
POST:
"""${postText}"""
CORE IDEA: ${analysis.coreIdea}
SELECTED ANGLE: ${contribution.angleExplanation || "None"}
PERSONALIZATION LEVEL: ${contribution.personalizationLevel}
USER CONTEXT: ${userAdditionalContext || "None"}
CANDIDATE:
"""${candidateComment}"""`;

  const response = await callModel(provider, model, {
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    maxTokens: 500,
    responseFormat: "json",
  });

  const parsed = response.parsedJson as QualityCriticResult | undefined;
  if (!parsed || !["PASS", "REGENERATE", "SKIP"].includes(parsed.verdict) ||
      typeof parsed.score !== "number" || !Array.isArray(parsed.reasons) ||
      parsed.reasons.some((reason) => typeof reason !== "string") ||
      typeof parsed.critiqueSummary !== "string" || !parsed.checks ||
      REQUIRED_CHECKS.some((check) => typeof parsed.checks[check] !== "boolean")) {
    throw new Error("QualityCritic: Invalid response structure");
  }

  const deterministicIssues = validateComment(candidateComment, postText, userAdditionalContext, platform).issues;
  if (deterministicIssues.length > 0) {
    if (parsed.verdict === "PASS") parsed.verdict = "REGENERATE";
    if (deterministicIssues.some((issue) => issue.includes("formulaic") || issue.includes("cliché"))) {
      parsed.checks.avoidsAISlop = false;
    }
    if (deterministicIssues.some((issue) => issue.includes("Too long"))) parsed.checks.proportionalLength = false;
    if (deterministicIssues.some((issue) => issue.includes("firsthand"))) parsed.checks.noFabricatedExperience = false;
    if (deterministicIssues.some((issue) => issue.includes("self-promotion"))) parsed.checks.avoidsSelfPromotion = false;
    parsed.reasons.push(...deterministicIssues);
  }

  // Sanity check checks against verdict
  const failedCrucialChecks =
    !parsed.checks.understandsPost ||
    !parsed.checks.preservesAuthorTopic ||
    !parsed.checks.isNotSummary ||
    !parsed.checks.avoidsTopicHijacking ||
    !parsed.checks.avoidsSelfPromotion ||
    !parsed.checks.avoidsAISlop ||
    !parsed.checks.noFabricatedExperience;

  if (parsed.verdict === "PASS" && failedCrucialChecks) {
    parsed.verdict = "REGENERATE";
    parsed.reasons.push("The quality checks contradict a publishable verdict.");
  }

  const debug: LLMStepDebug = {
    stepIndex: 4,
    stepName: "Comment Quality Review",
    agentName: "Quality Critic Agent",
    systemPrompt,
    userPrompt,
    rawResponseText: response.text,
    parsedOutput: parsed,
    executionTimeMs: Date.now() - startTime,
    providerUsed: response.providerUsed,
    modelUsed: response.modelUsed,
  };

  return { result: parsed, debug };
}
