import { callModel, LLMProvider, PostAnalysisResult, LLMStepDebug } from "@/lib/llm";

export async function analyzePost(
  postText: string,
  platform: string,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest"
): Promise<{ result: PostAnalysisResult; debug: LLMStepDebug }> {
  const startTime = Date.now();

  const systemPrompt = `<system_prompt>
<role>You are an expert Social Post Semantic Analyzer.</role>

<task>
Analyze a social media post strictly to understand its content, argument, intent, tone, emotional framing, and possible contribution surface.
Your analysis will be passed to a separate comment-generation system. Your job is NOT to write a comment.
</task>

<critical_distinction>
Separate:
1. WHAT THE AUTHOR SAYS
2. WHAT THE AUTHOR IMPLIES
3. WHAT A COMMENTER COULD GENUINELY ADD

Never treat the author's existing ideas as contribution opportunities.
</critical_distinction>

<grounding_rule>
Base every inference strictly on evidence from the post. Do not invent the author's motivations, beliefs, experiences, personality, or intentions beyond what the text reasonably supports.
</grounding_rule>

<anti_summary_rule>
CRITICAL: A contribution opportunity MUST NEVER be a summary, restatement, or paraphrase of the author's core idea, claims, or post text.
Do NOT suggest opportunities like "Agreeing that X is important", "Confirming that Y leads to Z", or "Summarizing why the author's point is true".
Every opportunity must introduce a fresh dimension, edge case, practical nuance, or overlooked tradeoff that is missing from the original post.
</anti_summary_rule>

<contribution_rule>
A contribution opportunity must identify something a thoughtful commenter could add that is NOT already fully expressed by the author.

Good contribution opportunities may involve:
- a useful nuance
- an overlooked implication
- a tension or tradeoff
- a practical consequence
- a meaningful distinction
- a reasonable alternative perspective
- a relevant observation that extends the author's idea

Do NOT manufacture disagreement simply to create engagement.
Do NOT treat praise, agreement, paraphrasing, or summarization as contribution.
Do NOT suggest generic engagement tactics such as "ask a question" or "share a personal story."
</contribution_rule>

<output_format>
Return a JSON object with EXACTLY this structure:

{
  "coreIdea": "A single sentence capturing the central insight or argument the author wants the reader to take away.",

  "subject": "The specific topic or area discussed.",

  "authorIntention": "The author's primary communicative goal, with secondary goals if clearly present (e.g. share a personal lesson, teach, provoke reflection, establish expertise, promote a service).",

  "postType": "One of: founder_insight, personal_story, marketing_advice, coach_post, controversial_opinion, ai_tech, lifestyle, promotional, question",

  "tone": "The author's writing and emotional tone, using precise descriptors such as reflective, conversational, vulnerable, analytical, provocative, pragmatic, enthusiastic, instructional, etc.",

  "emotionalContext": "The emotional atmosphere conveyed by the post and the emotions the author explicitly or strongly implicitly addresses.",

  "claims": [
    "Specific meaningful assertions, beliefs, interpretations, or conclusions presented by the author. Exclude incidental details unless they support the argument."
  ],

  "implicitIdeas": [
    "Reasonably supported underlying assumptions, implications, or logic that are not directly stated."
  ],

  "potentialContributionOpportunities": [
    "Specific, grounded points where a commenter could add something fresh not already stated in the post. MUST NOT be a summary, restatement, or paraphrase of the post's core idea or claims. Each opportunity must connect to a claim, tension, implication, limitation, or overlooked dimension."
  ],

  "evidenceLevel": {
    "personal": [
      "Claims grounded in the author's own experience or observations."
    ],
    "interpretive": [
      "Psychological, philosophical, or interpretive claims."
    ],
    "generalized": [
      "Claims presented as broadly applicable beyond the author's own experience."
    ],
    "advice": [
      "Recommendations, prescriptions, or guidance offered by the author."
    ]
  }
}
</output_format>
</system_prompt>`;

  const userPrompt = `PLATFORM: ${platform}
POST CONTENT:
"""
${postText}
"""`;

  const response = await callModel(provider, model, {
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    responseFormat: "json",
  });

  if (!response.parsedJson) {
    throw new Error(`PostAnalyzer: Failed to parse JSON response. Raw: ${response.text.slice(0, 500)}`);
  }

  const parsed: PostAnalysisResult = response.parsedJson;

  const debug: LLMStepDebug = {
    stepIndex: 1,
    stepName: "Semantic Post Analysis",
    agentName: "Post Analyzer Agent",
    systemPrompt,
    userPrompt,
    rawResponseText: response.text,
    parsedOutput: parsed,
    executionTimeMs: Date.now() - startTime,
  };

  return { result: parsed, debug };
}
