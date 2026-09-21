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
  "thats the difference between",
];

const FORMULAIC_PATTERNS = [
  /it'?s not .+, it'?s .+/i,
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

function validateComment(comment: string, contribution: ContributionResult, postText: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lower = comment.toLowerCase();

  // Check banned clichés
  for (const cliche of BANNED_CLICHES) {
    if (lower.includes(cliche)) {
      issues.push(`Contains banned cliché: "${cliche}"`);
    }
  }

  // Check formulaic patterns
  for (const pattern of FORMULAIC_PATTERNS) {
    if (pattern.test(comment)) {
      issues.push(`Contains formulaic pattern: ${pattern.source}`);
    }
  }

  // Length check: max 1.5 sentences, ~22 words
  const words = comment.split(/\s+/).filter(Boolean).length;
  const sentenceCount = comment.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  
  if (sentenceCount > 2 || (sentenceCount === 2 && words > 22) || words > 28) {
    issues.push(`Exceeds length limit: ${sentenceCount} sentences, ${words} words (max 1.5 sentences, ~22 words)`);
  }

  // Basic angle adherence: check if angleExplanation key concepts appear
  if (contribution.angleExplanation) {
    const angleKeywords = contribution.angleExplanation
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 5);
    
    const hasAngleOverlap = angleKeywords.some(kw => lower.includes(kw));
    if (!hasAngleOverlap && angleKeywords.length > 0) {
      issues.push(`Comment may not follow selected angle (${contribution.selectedAngle})`);
    }
  }

  // Topic hijack check for personalizationLevel 0
  if (contribution.personalizationLevel === 0 && contribution.topicHijackRisk) {
    const techTerms = ["automation", "ai tool", "software", "api", "code", "script", "workflow", "integration", "backend", "saas"];
    for (const term of techTerms) {
      if (lower.includes(term)) {
        issues.push(`Topic hijack detected: contains "${term}" but personalizationLevel=0 and topicHijackRisk=true`);
      }
    }
  }

  // Authenticity check: first-person claims without context
  const firstPersonClaims = ["i've seen", "i have seen", "in my experience", "my clients", "my projects", "i've worked", "i worked"];
  if (contribution.personalizationLevel === 0) {
    for (const claim of firstPersonClaims) {
      if (lower.includes(claim)) {
        issues.push(`Invented personal experience detected: "${claim}" (personalizationLevel=0)`);
      }
    }
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
Write the exact comment the user can paste under the given social media post.
The comment must sound like something a real person would naturally type after reading the post — not like a content strategist, copywriter, motivational speaker, or AI trying to demonstrate intelligence.
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
STRICT LENGTH CONSTRAINT: Maximum 1.5 sentences length max (approx 8–22 words).

The comment must be concise and punchy:
- Either 1 complete, focused sentence.
- Or 1 main sentence with a short connecting clause/phrase (max 1.5 sentences total).
- Under no circumstances should the comment be 2 full, lengthy sentences or exceed 1.5 sentences.

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

1. ABSOLUTE BAN ON POST SUMMARIES & CORE IDEA RESTATEMENTS:
- Never write a comment that summarizes, paraphrases, or echoes the author's main message, conclusion, or argument.
- Never write "You said X, and that's true because Y" or "Doing X is so important for Y" when X is the post's main point.
- The author already wrote the post; they do NOT need a condensed or rephrased version of their own thoughts in their comment section.

2. NO MIRRORING PREMISES OR CONTEXT CLAUSES:
- Do NOT begin the comment by restating the post's context or setup (e.g., "When building sales teams...", "Automating a broken process...").
- Jump IMMEDIATELY into the specific added nuance, edge case, or observation without setting up the author's premise.

3. THE INDEPENDENT VALUE TEST:
- Strip out the author's post. Does the comment stand alone as a distinct, fresh thought or observation?
- If the comment just repeats the premise of the post in different words, IT IS A SUMMARY FAILURE. Rewrite it immediately to focus purely on a specific new angle or observation.

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
NEVER invent:
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
</authenticity>

<tone>
Use direct, conversational, grounded language.
Prefer the way a thoughtful professional would actually speak in a conversation.
Avoid polished essay language, motivational-speaker language, corporate language, and exaggerated intellectual phrasing.

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
11. Is the comment strictly within the maximum 1.5 sentences length constraint?

If any answer is unfavorable, rewrite before returning.
</final_quality_check>

<output_format>
Return JSON with EXACTLY this structure:

{
  "comment": "The exact comment text."
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
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    
    const response = await callModel(provider, model, {
      systemPrompt,
      userPrompt: attempts === 1 ? userPrompt : `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastResponse}\n\nFix the issues above and try again.`,
      temperature: 0.15,
      responseFormat: "json",
    });

    if (!response.parsedJson?.comment) {
      lastResponse = `Failed to parse JSON: ${response.text.slice(0, 300)}`;
      continue;
    }

    const rawComment = response.parsedJson.comment.trim();
    const validation = validateComment(rawComment, contribution, postText);

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
      };

      return { result: parsedResult, debug };
    }

    lastResponse = validation.issues.join("; ");
  }

  throw new Error(`CommentGenerator: Failed to generate valid comment after ${maxAttempts} attempts. Last issues: ${lastResponse}`);
}
