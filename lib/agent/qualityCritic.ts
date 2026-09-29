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
  provider: LLMProvider = "openrouter",
  model: string = "qwen/qwen3-30b-a3b-instruct-2507"
): Promise<{ result: QualityCriticResult; debug: LLMStepDebug }> {
  const startTime = Date.now();
  const systemPrompt = `You are reviewing a proposed social media comment for a real person to post under their own name.
Judge the exact wording, not how clever it sounds. A brief, specific reaction is enough; a new insight is not required.

PASS only if it clearly responds to this post, sounds like a natural conversation, and is safe to publish as written.
REGENERATE if the angle is useful but the wording is generic, formulaic, wordy, awkward, or too polished.
SKIP if the angle itself is forced, promotional, fabricated, unrelated, or disrespectful.

Reject claims of client work, projects, results, credentials, or firsthand experience that are not explicitly supplied as facts. A general professional profile is not proof of any particular result. Compare every claim to the ORIGINAL POST, not merely the selected angle: the angle may be speculative too. Reject guesses about the author's behavior, feelings, fears, motives, or private process unless the post states them. Reject direct quotes, copied phrases, and reactions to a "line" instead of the idea. Reject new metaphors or sweeping claims that make the reply sound written for an audience rather than for the author. Do not introduce AI, software, automation, or the commenter's services when the post does not call for them. Do not turn the reply into a pitch. Do not require a question, praise, or a novel lesson. A response may use the post's key terms without copying its wording or becoming a summary.

Return JSON only with verdict (PASS, REGENERATE, or SKIP), score (0-100), reasons (array of concise strings), critiqueSummary (one sentence), and checks containing these booleans: understandsPost, followsSelectedAngle, preservesAuthorTopic, addsNewObservation, isNotSummary, isNotGeneric, fails20PostTest, personalContextIsRelevant, avoidsTopicHijacking, avoidsSelfPromotion, avoidsAISlop, fitsPlatform, soundsNaturalHuman, proportionalLength, noFabricatedExperience. Set fails20PostTest true when the comment could fit many unrelated posts. For a grounded, specific reaction, addsNewObservation may be true even without a new factual claim.`;

  const userPrompt = `PLATFORM: ${platform}
POST:
"""${postText}"""
CORE IDEA: ${analysis.coreIdea}
SELECTED ANGLE: ${contribution.angleExplanation || "None"}
PERSONALIZATION LEVEL: ${contribution.personalizationLevel}
TOPIC HIJACK RISK: ${contribution.topicHijackRisk}
CANDIDATE:
"""${candidateComment}"""`;

  const response = await callModel(provider, model, {
    systemPrompt,
    userPrompt,
    temperature: 0.1,
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

  const deterministicIssues = validateComment(candidateComment, postText).issues;
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

  if (parsed.verdict === "PASS" && (
    !parsed.checks.understandsPost || !parsed.checks.followsSelectedAngle ||
    !parsed.checks.preservesAuthorTopic || !parsed.checks.isNotSummary ||
    !parsed.checks.isNotGeneric || parsed.checks.fails20PostTest ||
    !parsed.checks.avoidsTopicHijacking || !parsed.checks.avoidsSelfPromotion ||
    !parsed.checks.avoidsAISlop || !parsed.checks.soundsNaturalHuman ||
    !parsed.checks.proportionalLength || !parsed.checks.noFabricatedExperience
  )) {
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
