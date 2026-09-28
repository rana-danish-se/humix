import { callModel, LLMProvider, PostAnalysisResult, ContributionResult, LLMStepDebug } from "@/lib/llm";
import { USER_PROFILE } from "@/lib/context/userProfile";

export async function analyzeContribution(
  postText: string,
  platform: string,
  analysis: PostAnalysisResult,
  userAdditionalContext?: string,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest"
): Promise<{ result: ContributionResult; debug: LLMStepDebug }> {
  const startTime = Date.now();
  const techTerms = /\b(?:AI|automation|software|coding?|API|algorithms?|machine learning|SaaS|tech(?:nology)?)\b/i;
  const isTechPost = analysis.postType === "ai_tech" || techTerms.test(`${analysis.subject} ${postText}`);

  const systemPrompt = `<system_prompt>
<role>You are a Social Contribution & Relevance Analyzer.</role>

<task>
Evaluate whether the user has a natural, genuine, and human reason to participate in the conversation, and if so, identify the ONE strongest contribution angle.
You are NOT writing the comment.
</task>

<context>
This system is designed for outbound prospecting. The user is NOT trying to position themselves as a domain expert, wellness guru, or thought leader on every topic.
The user is trying to become a familiar, intelligent, normal human presence in the author's comment section.

The comment does NOT need to demonstrate: "I know more than you."
It simply needs to demonstrate: "I actually read what you wrote."
</context>

<priority_hierarchy>
NATURAL RELEVANCE → CONTRIBUTION → AUTHENTICITY → SPECIFICITY → PERSONALIZATION → ENGAGEMENT

A comment that is engaging or valuable but irrelevant or unnatural is a failure.
A simple, specific, natural observation is far better than a forced "expert" contribution.
</priority_hierarchy>

<rules>
<rule id="1" name="Professional Expertise Is Optional">
The user may participate in a conversation even when the post is outside their professional domain.

The user can comment as:
- a thoughtful reader
- a founder / business owner
- a customer / client
- a general observer
- a participant in the conversation

Do NOT assume the user must provide expert knowledge to justify a comment.

If the post contains a genuine conversational opening (an idea, tension, story, observation, or question), the user may comment even with zero domain expertise.

When professional expertise is irrelevant:
- Do not force professional background into the comment.
- Do not create artificial connections to technology, AI, software, automation, SaaS, etc.
- Do NOT skip solely because the topic is outside the user's professional domain.
</rule>

<rule id="2" name="A Comment Does Not Have To Teach The Author">
The purpose of a comment is not to demonstrate superior intelligence or teach the author something new.

A legitimate contribution can:
- notice something specific in the post, including a grounded human reaction
- extend an idea slightly
- point out a practical implication
- add a useful nuance or distinction
- respond thoughtfully to a question or tension
- connect two ideas already present in the post
- express a grounded reaction to a specific point

"New information" or "expert insight" is NOT required.
</rule>

<rule id="3" name="Brutal Filter For Truly Uncommentable Posts">
Do NOT swing too far and allow comments on everything.

Recommend SKIP (shouldSkip = true) when:
1. PURE LIFESTYLE / PERSONAL MOMENTS: Posts like "Spent the weekend hiking with my family ❤️" with no discussion surface. Do NOT manufacture generic AI sludge about "stepping away from the noise."
2. PURE PROMOTIONAL / ANNOUNCEMENTS: Posts like "Excited to announce my new coaching program!" with no underlying story, hook, or discussion idea. Do NOT manufacture profound observations.
3. NO DISCUSSION SURFACE: The post contains no meaningful idea, question, tension, observation, or hook to engage with.
4. ONLY SUMMARY / ECHO REMAINING: The only possible response is to paraphrase, summarize, or give generic praise ("Great post!"). A brief reaction to a specific detail is still a valid response.
5. REQUIRED FABRICATION: A comment would require inventing personal experience, clients, stats, or beliefs not in the user context.

Do NOT skip posts that discuss real concepts, stories, or tensions (e.g. treating symptoms vs root causes, or realizing you were solving the wrong problem) simply because they are in wellness, coaching, or branding. The user can engage as a thoughtful human reader.
<rule id="4" name="Strict Anti-Summary & Anti-Echo Filter">
Do not select an angle that merely summarizes, restates, or rephrases the author's core idea or claims. A specific natural reaction is enough; do not manufacture novelty.

- An angleExplanation should state the actual response the commenter can make, whether that is a nuance or a specific grounded reaction.
- Do NOT write angleExplanations such as: "Agreeing that fixing processes first is key", "Summarizing why sales hiring requires a playbook", or "Reiterating the author's point about X".
- If a post's ideas leave NO room to add a fresh nuance or observation without repeating or summarizing the author's message, recommend SKIP (shouldSkip: true) with skipReason: "Post leaves no room for genuine contribution beyond echoing or summarizing the author's point."
</rule>
</rules>

<contribution_selection>
If commenting makes sense, select the strongest ONE contribution angle:

Valid contribution types:
- personal_experience
- relevant_observation
- useful_nuance
- respectful_disagreement
- additional_example
- practical_perspective
- relevant_question
- alternative_interpretation

Prefer an angle that:
- anchors to something specific in the post
- adds a natural human reaction, nuance, or perspective
- does not pretend to have unprovided experience
- does not hijack the topic to tech/AI
</contribution_selection>

<personalization_levels>
0 = No user background needed (comment as a general thoughtful reader).
1 = Broad perspective consistent with user background is relevant, but no specific facts needed.
2 = Specific professional context materially strengthens the contribution.
3 = Direct specific fact/project from user context is directly relevant.

If personalizationLevel = 0, set relevantContextSnippet = null and do not force professional context.

If topicHijackRisk = true:
The user's professional background MUST NOT be used for this post, but the user MAY STILL COMMENT at personalizationLevel = 0 if a natural general contribution exists.
</personalization_levels>

<output_format>
Return JSON with EXACTLY this structure:

{
  "shouldSkip": boolean,
  "skipReason": "Specific explanation if shouldSkip is true, otherwise empty string",
  "skipReasonCode": "ONE OF: PURE_LIFESTYLE_NO_HOOK | PURE_PROMOTIONAL_NO_HOOK | NO_DISCUSSION_SURFACE | ONLY_SUMMARY_ECHO_POSSIBLE | REQUIRES_FABRICATION | TOPIC_HIJACK_RISK | NO_GENUINE_CONTRIBUTION | POST_TOO_SHORT | INSUFFICIENT_CONTEXT",
  "selectedAngle": "one of the available angles above, or null if shouldSkip",
  "angleExplanation": "Brief explanation of the NEW added angle or nuance to contribute. MUST NOT summarize, restate, or paraphrase the post's core idea or claims.",
  "personalizationLevel": 0 | 1 | 2 | 3,
  "topicHijackRisk": boolean,
  "relevantContextSnippet": "Only include specific user background facts directly relevant. If personalizationLevel is 0, return null."
}
</output_format>
</system_prompt>`;

  const userPrompt = `PLATFORM: ${platform}
POST TYPE: ${analysis.postType}
SUBJECT: ${analysis.subject}
CORE IDEA: ${analysis.coreIdea}
AUTHOR TONE: ${analysis.tone}
POST CLAIMS: ${JSON.stringify(analysis.claims)}

USER BACKGROUND SUMMARY:
${isTechPost ? JSON.stringify(USER_PROFILE.background) : "Not supplied for this topic; comment as a reader without professional positioning."}
OPTIONAL USER CONTEXT PROVIDED FOR THIS POST:
${userAdditionalContext || "None"}

ORIGINAL POST CONTENT:
"""
${postText}
"""`;

  const response = await callModel(provider, model, {
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    responseFormat: "json",
  });

  if (!response.parsedJson) {
    throw new Error(`ContributionAnalyzer: Failed to parse JSON response. Raw: ${response.text.slice(0, 500)}`);
  }

  const parsed: ContributionResult = response.parsedJson;

  // Programmatic skip reason code assignment
  if (parsed.shouldSkip && parsed.skipReason) {
    const reason = parsed.skipReason.toLowerCase();
    if (reason.includes("lifestyle") || reason.includes("personal moment") || reason.includes("no discussion surface")) {
      parsed.skipReasonCode = "PURE_LIFESTYLE_NO_HOOK";
    } else if (reason.includes("promotional") || reason.includes("announcement") || reason.includes("marketing")) {
      parsed.skipReasonCode = "PURE_PROMOTIONAL_NO_HOOK";
    } else if (reason.includes("no discussion") || reason.includes("no hook") || reason.includes("no surface")) {
      parsed.skipReasonCode = "NO_DISCUSSION_SURFACE";
    } else if (reason.includes("summary") || reason.includes("echo") || reason.includes("paraphrase") || reason.includes("generic praise")) {
      parsed.skipReasonCode = "ONLY_SUMMARY_ECHO_POSSIBLE";
    } else if (reason.includes("fabricat") || reason.includes("invent") || reason.includes("fake")) {
      parsed.skipReasonCode = "REQUIRES_FABRICATION";
    } else if (reason.includes("hijack") || reason.includes("topic") || reason.includes("tech") || reason.includes("ai")) {
      parsed.skipReasonCode = "TOPIC_HIJACK_RISK";
    } else if (reason.includes("no genuine") || reason.includes("no contribution") || reason.includes("no value")) {
      parsed.skipReasonCode = "NO_GENUINE_CONTRIBUTION";
    } else if (reason.includes("short") || reason.includes("insufficient")) {
      parsed.skipReasonCode = "INSUFFICIENT_CONTEXT";
    } else {
      parsed.skipReasonCode = "NO_GENUINE_CONTRIBUTION";
    }
  }

  // Keep an unrelated professional angle out of the comment without discarding
  // a valid conversational opening in the post.
  if (!isTechPost && parsed.angleExplanation && techTerms.test(parsed.angleExplanation)) {
    parsed.topicHijackRisk = true;
    parsed.personalizationLevel = 0;
    parsed.relevantContextSnippet = undefined;
    const alternative = analysis.potentialContributionOpportunities?.find(
      (opportunity) => !techTerms.test(opportunity)
    );
    if (alternative) {
      parsed.shouldSkip = false;
      parsed.skipReason = undefined;
      parsed.skipReasonCode = undefined;
      parsed.selectedAngle = "relevant_observation";
      parsed.angleExplanation = alternative;
    } else {
      parsed.shouldSkip = true;
      parsed.skipReasonCode = "TOPIC_HIJACK_RISK";
      parsed.skipReason = "No grounded, non-promotional comment angle was found.";
      parsed.selectedAngle = undefined;
      parsed.angleExplanation = undefined;
    }
  } else if (!isTechPost && parsed.relevantContextSnippet && techTerms.test(parsed.relevantContextSnippet)) {
    parsed.topicHijackRisk = true;
    parsed.personalizationLevel = 0;
    parsed.relevantContextSnippet = undefined;
  }

  const debug: LLMStepDebug = {
    stepIndex: 2,
    stepName: "Contribution Discovery & Relevance",
    agentName: "Contribution Discovery Agent",
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
