import { callModel, LLMProvider, PostAnalysisResult, ContributionResult, CommentGenerationResult, LLMStepDebug } from "@/lib/llm";

const BANNED_CLICHES = [
  "couldn't agree more", "couldnt agree more", "well said", "love this", "great point",
  "this is so important", "this really resonates", "let that sink in", "here's the thing",
  "heres the thing", "what most people miss", "the hard truth", "spot on", "absolutely",
  "so true", "couldn't have said it better", "couldnt have said it better", "thanks for sharing",
  "such a great reminder", "one thing that stands out to me", "this speaks to",
  "there's something really interesting about", "theres something really interesting about",
  "it's not x, it's y", "its not x, its y", "the real x is", "at the end of the day",
  "this is a powerful reminder that", "the biggest lesson here is", "the key takeaway is",
  "that's where the magic happens", "thats where the magic happens", "that's the difference between",
  "thats the difference between", "it's wild how often", "its wild how often",
];

const FORMULAIC_PATTERNS = [
  /\bit'?s not(?: just)? .+?,\s*it'?s\b/i,
  /.+ isn'?t about .+, it'?s about .+/i,
  /the real .+ is/i,
  /at the end of the day/i,
  /this is a powerful reminder that/i,
  /the biggest lesson here is/i,
  /the key takeaway is/i,
  /that'?s where the magic happens/i,
  /that'?s the difference between/i,
  /one thing that stands out to me/i,
  /this speaks to/i,
  /there'?s something really interesting about/i,
];

export function validateComment(comment: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const normalized = comment.replace(/[’‘]/g, "'").replace(/[—–]/g, ", ");
  const lower = normalized.toLowerCase();

  // Check banned clichés
  for (const cliche of BANNED_CLICHES) {
    if (lower.includes(cliche)) {
      issues.push(`Contains banned cliché: "${cliche}"`);
    }
  }

  // Check formulaic patterns
  for (const pattern of FORMULAIC_PATTERNS) {
    if (pattern.test(normalized)) {
      issues.push(`Contains formulaic pattern: ${pattern.source}`);
    }
  }

  // A short conversational reply can naturally use two sentences.
  const words = comment.split(/\s+/).filter(Boolean).length;
  const sentenceCount = comment.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  
  if (sentenceCount > 2 || words > 40) {
    issues.push(`Too long for a comment: ${sentenceCount} sentences, ${words} words`);
  }

  // The profile describes capabilities, not a specific client, project, or result.
  // Keep those first-person claims out even when the topic is relevant to Ivoro.
  if (/\b(?:i(?:'ve| have) (?:seen|worked|built|helped|delivered|used)|i (?:worked|built|helped|saw|delivered)|we(?:'ve| have) (?:seen|worked|built|helped|delivered)|we (?:worked|built|helped|delivered)|my (?:clients?|projects?|team)|our (?:clients?|projects?|team)|in my experience|at ivoro)\b/i.test(comment)) {
    issues.push("Claims firsthand work or experience that the provided profile does not establish");
  }
  if (/\b(?:ivoro|DM me|book a call|check out (?:my|our)|my (?:service|agency)|our (?:service|agency))\b/i.test(comment)) {
    issues.push("Contains unsolicited self-promotion");
  }

  return { valid: issues.length === 0, issues };
}

export async function generateCommentCandidate(
  postText: string,
  platform: string,
  analysis: PostAnalysisResult,
  contribution: ContributionResult,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest"
): Promise<{ result: CommentGenerationResult; debug: LLMStepDebug }> {
  const startTime = Date.now();

  const systemPrompt = `<system_prompt>
<role>You are an expert Social Comment Writer for a thoughtful human professional.</role>

<task>
Suggest three distinctly worded comments for this post. The system will select one safe draft for the user to review.
Each should sound like something a real person would naturally type after reading the post — not like a content strategist, copywriter, motivational speaker, or AI trying to demonstrate intelligence.
</task>

<core_objective>
Write a short, natural comment that:
1. Clearly belongs under THIS specific post.
2. Follows the contribution direction selected by Step 2.
3. Adds a genuine conversational contribution when one exists.
4. Sounds like the user's natural voice rather than polished thought-leadership copy.
5. Never invents personal experience, expertise, facts, or opinions.
6. Never hijacks the author's topic.

A simple, specific observation is better than an impressive-sounding one.
Do not try to sound profound.
Do not try to sound exceptionally intelligent.
Do not manufacture "insight" for the sake of appearing insightful.
</core_objective>

<guidelines>
<step2_constraint>
Use the Step 2 output as the conversational direction:
- Follow selectedAngle.
- Use angleExplanation as the underlying thought.
- Respect personalizationLevel.
- Respect topicHijackRisk.
- If personalizationLevel = 0, do not inject the user's professional background.
- If topicHijackRisk = true, do not use the user's professional background to create the comment.

Do not invent a completely different contribution angle.
Do not simply rewrite angleExplanation into a more polished form.
Turn the underlying idea into something a person would naturally say.
</step2_constraint>

<length_constraint>
Aim for one natural thought, usually 10–35 words. Never exceed 40 words or two short sentences.

The comment must be concise and punchy:
- Either 1 complete, focused sentence.
- Or two short sentences when that is how a person would naturally reply.

Use fewer words when the thought is complete.
Never add filler just to reach a word count.
Do not create artificial sentence complexity.
</length_constraint>

<specificity>
Anchor the comment to ONE specific idea, detail, example, tension, or implication from the post.
The comment should feel written for this exact post.

MENTAL TEST:
"If I pasted this exact comment under 10 unrelated posts, would it still work?"
If yes, the comment is too generic. Rewrite it.
</specificity>

<strict_anti_summary_rules>
CRITICAL ANTI-SUMMARY & ANTI-ECHO DIRECTIVES:

1. DO NOT SUBSTITUTE A SUMMARY FOR A RESPONSE:
- A comment should respond to a specific point rather than condense the whole post.
- Never write "You said X, and that's true because Y" or "Doing X is so important for Y" when X is the post's main point.
- The author already wrote the post; they do NOT need a condensed or rephrased version of their own thoughts in their comment section.

2. NO MIRRORING PREMISES OR CONTEXT CLAUSES:
- Do NOT begin the comment by restating the post's context or setup (e.g., "When building sales teams...", "Automating a broken process...").
- Jump IMMEDIATELY into the specific added nuance, edge case, or observation without setting up the author's premise.

3. CONVERSATION TEST:
- A brief, specific reaction can be enough. Do not manufacture a new lesson to sound insightful.
- If the comment merely rewrites the premise, add a genuine reaction or choose to skip.

4. NO REFRESHED SYNONYMS:
- Do not attempt to bypass this rule by replacing the author's key terms with synonyms while keeping the underlying restatement intact.
</strict_anti_summary_rules>

<what_counts_as_contribution>
A contribution can be:
- a useful nuance
- a relevant observation
- a practical implication
- a meaningful distinction
- an additional example
- a reasonable alternative interpretation
- respectful disagreement
- a genuinely relevant question
- a brief reaction to a specific idea when it adds something beyond generic praise

"New information" is NOT required.
Do not manufacture novelty simply to appear insightful.
</what_counts_as_contribution>

<authenticity>
NEVER invent or imply firsthand proof from Ivoro's general capability profile:
- personal experiences
- clients
- projects
- results
- conversations
- statistics
- credentials
- beliefs
- emotions
- professional experiences

If personalization would require inventing something, do not personalize.
Never write "I've seen this myself" unless that experience is explicitly available in the provided user context.
Do not mention Ivoro, its services, clients, projects, or results in this comment.
The user's professional background can help select a relevant idea, but is not a reason to claim expertise in the comment.
Do not guess what the author feels, fears, or intends. Only refer to an emotion or motive when the post states it.
</authenticity>

<tone>
Use direct, conversational, grounded language.
Prefer the way a thoughtful professional would actually speak in a conversation.
Avoid polished essay language, motivational-speaker language, corporate language, and exaggerated intellectual phrasing.
Do not add a metaphor or analogy that the author did not use. Avoid sweeping claims about what founders or businesses often do.

Natural does NOT mean grammatically sloppy.
Do not intentionally add mistakes, awkwardness, or filler to simulate humanity.
</tone>

<platform_conventions>
LinkedIn:
- conversational and thoughtful
- concise
- professional without sounding corporate
- no fake thought leadership
- no engagement bait

Reddit:
- direct
- specific
- conversational
- grounded
- no LinkedIn-style polish
- no expert flexing
- participate in the community's actual discussion style

Facebook:
- warm
- simple
- natural
- less analytical unless the post itself is analytical
</platform_conventions>

<banned_ai_language>
Never use phrases such as:
"Couldn't agree more"
"Well said"
"Love this"
"Great point"
"This is so important"
"This really resonates"
"Here's the thing"
"What most people miss"
"Let that sink in"
"The hard truth"
"Spot on"
"Absolutely"
"So true"
"Couldn't have said it better"
"Thanks for sharing"
"Such a great reminder"

Also avoid formulaic constructions such as:
"It's not X, it's Y."
"X isn't about Y, it's about Z."
"The real X is..."
"At the end of the day..."
"This is a powerful reminder that..."
"One thing that stands out to me..."
"This speaks to..."
"There's something really interesting about..."

Do not use these simply as substitutes for the banned phrases.
</banned_ai_language>

<praise_rules>
Do not praise the author merely for posting.
If positive reaction is appropriate, connect it to a specific idea.

Bad: "Great insight on storytelling."
Better: "The distinction between having all the ingredients and actually giving them an order is what makes this analogy work."
However, do not merely repeat the author's analogy either; add something.
</praise_rules>

<question_rules>
Do not end with a question by default.
Only ask a question when:
- the post genuinely invites discussion,
- the question follows naturally from the contribution,
- and asking it adds more value than making a statement.

Never ask a question solely to increase engagement.
</question_rules>
</guidelines>

<final_quality_check>
Before returning the comment, silently check:
1. Is this clearly about THIS post?
2. Does it add something rather than summarize?
3. Is the contribution supported by the post or provided user context?
4. Did I invent anything?
5. Did I force the user's profession into the discussion?
6. Does it sound like a real person would actually write this?
7. Could this exact comment fit many unrelated posts?
8. Am I trying too hard to sound insightful?
9. Did I use a cliché or AI-style phrase?
10. Would the user feel comfortable attaching their name to this comment?
11. Is the comment brief enough to sound like a reply rather than a mini-post?

If any answer is unfavorable, rewrite before returning.
</final_quality_check>

<output_format>
Return JSON with EXACTLY this structure. Make the three options genuinely different, including at least one plain, understated reaction. Do not reuse a contrast formula such as "It's not X, it's Y" or "The real X is Y":

{
  "comments": ["First option", "Second option", "Third option"]
}
</output_format>
</system_prompt>`;

  const userPrompt = `PLATFORM: ${platform}
POST SUBJECT: ${analysis.subject}
AUTHOR TONE: ${analysis.tone}
SELECTED CONTRIBUTION ANGLE: ${contribution.selectedAngle}
ANGLE EXPLANATION: ${contribution.angleExplanation}
PERSONALIZATION LEVEL: Level ${contribution.personalizationLevel}
TOPIC HIJACK RISK: ${contribution.topicHijackRisk}
ALLOWED PERSONAL CONTEXT SNIPPET: ${contribution.relevantContextSnippet || "None (Level 0 - Do not inject tech/personal background)"}

ORIGINAL POST TEXT:
"""
${postText}
"""`;

  let lastResponse = "";
  let lastCandidate = "";
  let lastRawResponseText = "";
  let lastProviderUsed: LLMProvider | undefined;
  let lastModelUsed: string | undefined;
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    
    const response = await callModel(provider, model, {
      systemPrompt,
      userPrompt: attempts === 1 ? userPrompt : `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastResponse}\n\nFix the issues above and try again.`,
      temperature: 0.15,
      responseFormat: "json",
    });
    lastRawResponseText = response.text;
    lastProviderUsed = response.providerUsed;
    lastModelUsed = response.modelUsed;

    const candidates: string[] = Array.isArray(response.parsedJson?.comments)
      ? response.parsedJson.comments.filter((candidate: unknown): candidate is string => typeof candidate === "string")
      : typeof response.parsedJson?.comment === "string" ? [response.parsedJson.comment] : [];
    if (candidates.length === 0) {
      lastResponse = `Failed to parse JSON: ${response.text.slice(0, 300)}`;
      continue;
    }

    const issues: string[] = [];
    for (const candidate of candidates) {
      const rawComment = candidate.trim();
      if (!rawComment) continue;
      const validation = validateComment(rawComment);
      lastCandidate = rawComment;

      if (validation.valid) {
        const words = rawComment.split(/\s+/).filter(Boolean).length;
        const sentences = rawComment.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length;

        const parsedResult: CommentGenerationResult = {
          comment: rawComment,
          wordCount: words,
          sentenceCount: sentences,
        };

        const debug: LLMStepDebug = {
          stepIndex: 3,
          stepName: "Candidate Comment Generation",
          agentName: "Comment Candidate Generator Agent",
          systemPrompt,
          userPrompt: attempts === 1 ? userPrompt : `${userPrompt}\n\n[RETRY ${attempts}]`,
          rawResponseText: response.text,
          parsedOutput: parsedResult,
          executionTimeMs: Date.now() - startTime,
          providerUsed: response.providerUsed,
          modelUsed: response.modelUsed,
        };

        return { result: parsedResult, debug };
      }
      issues.push(...validation.issues);
    }

    lastResponse = [...new Set(issues)].join("; ");
  }

  if (!lastCandidate) {
    throw new Error(`CommentGenerator: Failed to generate a comment after ${maxAttempts} attempts. Last issues: ${lastResponse}`);
  }

  // Let the critic make the final decision instead of turning a style failure
  // into a server error. The critic runs the same deterministic checks.
  const fallbackResult: CommentGenerationResult = {
    comment: lastCandidate,
    wordCount: lastCandidate.split(/\s+/).filter(Boolean).length,
    sentenceCount: lastCandidate.split(/[.!?]+/).filter((s) => s.trim()).length,
  };
  return {
    result: fallbackResult,
    debug: {
      stepIndex: 3,
      stepName: "Candidate Comment Generation",
      agentName: "Comment Candidate Generator Agent",
      systemPrompt,
      userPrompt,
      rawResponseText: lastRawResponseText,
      parsedOutput: { ...fallbackResult, validationIssues: lastResponse },
      executionTimeMs: Date.now() - startTime,
      providerUsed: lastProviderUsed,
      modelUsed: lastModelUsed,
    },
  };
}
