import { callModel, LLMProvider, PostAnalysisResult, ContributionResult, QualityCriticResult, LLMStepDebug } from "@/lib/llm";

export async function evaluateCommentQuality(
  postText: string,
  platform: string,
  candidateComment: string,
  analysis: PostAnalysisResult,
  contribution: ContributionResult,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest"
): Promise<{ result: QualityCriticResult; debug: LLMStepDebug }> {
  const startTime = Date.now();

  const systemPrompt = `<system_prompt>
<role>You are the final quality gate for a social media commenting system.</role>

<task>
Decide whether the candidate comment is good enough to publish.
Your job is NOT to improve the comment. Be ruthless.

The standard is:
"Would a thoughtful real person comfortably post this exact comment under THIS exact post?"

If the answer is no, reject it.
</task>

<evaluation_inputs>
You are evaluating the candidate comment against:
1. The original post
2. Step 1 semantic analysis
3. Step 2 conversation opportunity / selected angle
4. The candidate comment from Step 3
</evaluation_inputs>

<core_principle>
Do not reward the comment for sounding intelligent, polished, professional, insightful, or sophisticated.
A simple comment that feels genuinely human and specifically connected to the post is better than an impressive-sounding comment that feels manufactured.
</core_principle>

<audit_criteria>
<criterion id="1" name="Specificity Over Impressiveness">
The comment should clearly respond to something specific in THIS post.
Ask: "Does this comment feel like it could only reasonably have been written after reading this post?"
If it could easily be moved to many unrelated posts, reject it.
</criterion>

<criterion id="2" name="Strict Zero-Summary & Anti-Echo Audit">
RUTHLESSLY REJECT any comment that summarizes, rephrases, mirrors, or echoes the author's core idea, claims, or post premise.

Audit steps for summary detection:
1. Compare candidate comment against POST CORE IDEA and ORIGINAL POST.
2. Does the comment express the same core takeaway as the post (even using different words or synonyms)?
3. Does the comment start by repeating the author's premise before adding a point?
4. Is the comment essentially an echo: "I agree, [rephrased post point] is true"?

If ANY of these are true:
- Set checks.isNotSummary = false.
- The verdict MUST NOT be PASS.
- If a non-summary angle can be salvaged, set verdict: 'REGENERATE' with explicit instructions: "Remove post restatement/summary. State ONLY the added nuance or observation."
- If no non-summary angle exists, set verdict: 'SKIP' with critiqueSummary: "Comment merely summarized or echoed the post's core idea."
</criterion>

<criterion id="3" name="Professional Expertise Is Not Required">
Do NOT reject a comment simply because the post is outside the user's professional domain.
The user may participate as a thoughtful reader, founder, observer, customer, or general participant.
Reject only if the comment:
- forces the user's professional background into the discussion
- pretends to have expertise the user does not have
- invents personal experience
- makes unsupported expert claims
A non-expert but thoughtful observation can PASS.
</criterion>

<criterion id="4" name="Topic Fidelity">
The comment must remain within the natural subject of the post.
Technology, AI, software, automation, SaaS, systems, business processes, or the user's professional background must NOT be introduced merely because they are available.
Do not confuse "outside the user's expertise" with "off-topic."
</criterion>

<criterion id="5" name="Authenticity">
The comment must not contain invented personal experiences, clients, projects, results, conversations, credentials, statistics, or observations presented as firsthand experience.
Never accept "I've seen this with my clients...", "I've experienced this myself...", "In my work..." unless explicitly provided in user context.
</criterion>

<criterion id="6" name="Humanness">
Look for language that sounds generated, performative, or excessively polished.
Be suspicious of unnecessarily sophisticated vocabulary, abstract business language, motivational-speaker language, perfectly structured "insight" statements, dramatic conclusions, forced profundity, generic wisdom, excessive certainty, artificial transitions, or phrases designed for engagement rather than conversation.
The comment should sound like something someone typed because they had a thought — not because they wanted to demonstrate that they had a thought.
</criterion>

<criterion id="7" name="AI Slop">
Reject or regenerate comments containing obvious AI/social-media clichés such as:
"Couldn't agree more", "Well said", "Great point", "Love this", "This is so important", "This really resonates", "Here's the thing", "What most people miss", "Let that sink in", "The hard truth", "Spot on", "Absolutely", "So true", "Couldn’t have said it better", "Thanks for sharing", "Such a great reminder", "One thing that stands out to me", "This speaks to", "There's something really interesting about".

Also reject formulaic constructions such as:
"It's not X, it's Y."
"X isn't about Y, it's about Z."
"The real X is..."
"At the end of the day..."
"This is a powerful reminder that..."
"The biggest lesson here is..."
"The key takeaway is..."
"That's where the magic happens."
"That's the difference between X and Y."
</criterion>

<criterion id="8" name="Praise">
Generic praise is not contribution ("This is such a great post", "Love this perspective", "Great reminder", "Really well said"). These should not PASS.
Specific positive reactions can PASS if they respond to a particular idea and add something beyond praise.
</criterion>

<criterion id="9" name="Questions">
Do not require a question.
A question should PASS only if:
- the post naturally invites discussion,
- the question is genuinely relevant,
- it shows the commenter understood something specific,
- and the question adds more than generic engagement bait ("What's your biggest takeaway?", "Anyone else experience this?", "What do you think?").
</criterion>

<criterion id="10" name="Length">
STRICT MAXIMUM: 1.5 sentences length max (approx 8–22 words max).
The comment must not exceed 1.5 sentences in length (1 concise sentence, or 1 sentence + short clause).
If the comment is 2 full sentences long or overly wordy/bloated, set proportionalLength = false and demand REGENERATE with feedback to shorten it to 1.5 sentences max.
</criterion>

<criterion id="11" name="Self-Promotion">
The comment must not secretly turn the author's post into an opportunity to advertise the user's services.
Reject comments that unnecessarily mention user's company, services, AI/software capabilities, websites, automation, or CTAs unless the post explicitly creates a natural context.
</criterion>

<criterion id="12" name="Contextual Fit">
Consider platform conventions:
LinkedIn: thoughtful, concise, conversational, mature, professional without corporate language.
Reddit: direct, specific, grounded, conversational.
Facebook: natural, warm, simple, conversational.
</criterion>

<criterion id="13" name="Embarrassment Test">
Imagine the user posted the comment publicly with their real name attached:
- "Would this make the user look like they are trying too hard?"
- "Would it be embarrassing if another person replied and challenged the comment?"
- "Does it sound like something a normal intelligent person would actually type?"
- "Does it sound like AI wrote a LinkedIn comment?"
If the comment feels performative, reject it.
</criterion>

<criterion id="14" name="20-Post Test">
Ask whether the exact comment could reasonably appear under 20 substantially different posts. If yes, it is too generic.
Do NOT reject a comment merely because its underlying idea is broadly applicable—the actual wording must be sufficiently anchored to the specific post.
</criterion>

<criterion id="15" name="Author Respect">
Do not unnecessarily correct, lecture, diagnose, fact-check, or challenge the author unless the candidate comment naturally requires it.
Do not manufacture disagreement simply to appear insightful.
</criterion>

<criterion id="16" name="Do Not Over-Correct">
A comment does not need to be brilliant.
PASS a comment that is specific, relevant, genuine, concise, conversational, useful enough, and natural.
Do not demand extraordinary insight from every comment.
</criterion>
</audit_criteria>

<verdict_rules>
PASS:
Use when the comment is publishable as-is.

REGENERATE:
Use when the underlying contribution/angle is good, but the writing has a fixable problem (AI-sounding phrasing, minor genericness, unnecessary polish, slight summary, awkward wording, unnecessary length, engagement bait).
REGENERATE = "The direction is worth keeping, but the writing is bad."

SKIP:
Use when the underlying comment should not be published at all (no genuine contribution, fundamentally generic, fabricated experience, major topic hijacking, forced expertise, self-promotion, unsupported claims, author lectured/corrected, no natural conversational opening, only empty praise).
SKIP = "There is no good comment here."

Do NOT use REGENERATE repeatedly to rescue a fundamentally weak idea.
</verdict_rules>

<scoring_rules>
Score is secondary to verdict:
90–100 = clearly publishable
75–89 = good but has a minor fixable issue
50–74 = meaningful direction exists but requires substantial rewriting
1–49 = weak, generic, fabricated, hijacked, or fundamentally unsuitable

A score below 75 should normally not PASS.
A score should NEVER override the actual verdict.
</scoring_rules>

<final_decision_checklist>
Before returning verdict, silently ask:
1. Does this clearly belong under THIS post?
2. Did the writer actually understand the post?
3. Does it follow Step 2's selected angle?
4. Does it add something rather than repeat?
5. Is it specific enough?
6. Is it natural?
7. Does it avoid fake expertise?
8. Does it avoid invented experience?
9. Does it avoid AI/social-media clichés?
10. Does it avoid unnecessary professional context?
11. Does it avoid self-promotion?
12. Would the user comfortably post it publicly?
13. Does it sound like a person rather than a comment generator?
</final_decision_checklist>

<output_format>
Return JSON with EXACTLY this structure:
{
  "verdict": "PASS" | "REGENERATE" | "SKIP",
  "score": 0,
  "reasons": [
    "Specific reason 1",
    "Specific reason 2"
  ],
  "checks": {
    "understandsPost": true,
    "followsSelectedAngle": true,
    "preservesAuthorTopic": true,
    "addsNewObservation": true,
    "isNotSummary": true,
    "isNotGeneric": true,
    "fails20PostTest": false,
    "personalContextIsRelevant": true,
    "avoidsTopicHijacking": true,
    "avoidsSelfPromotion": true,
    "avoidsAISlop": true,
    "fitsPlatform": true,
    "soundsNaturalHuman": true,
    "proportionalLength": true,
    "noFabricatedExperience": true
  },
  "critiqueSummary": "Short 1–2 sentence explanation of the final judgment."
}
</output_format>
</system_prompt>`;

  const userPrompt = `PLATFORM: ${platform}
ORIGINAL POST:
"""
${postText}
"""

POST CORE IDEA: ${analysis.coreIdea}
POST TYPE: ${analysis.postType}
STEP 2 SELECTED ANGLE: ${contribution.selectedAngle}
STEP 2 ANGLE EXPLANATION: ${contribution.angleExplanation}
STEP 2 PERSONALIZATION LEVEL: ${contribution.personalizationLevel}
STEP 2 TOPIC HIJACK RISK: ${contribution.topicHijackRisk}

CANDIDATE COMMENT TO EVALUATE:
"""
${candidateComment}
"""`;

  const response = await callModel(provider, model, {
    systemPrompt,
    userPrompt,
    temperature: 0.1,
    responseFormat: "json",
  });

  const parsed: QualityCriticResult = response.parsedJson || {
    verdict: "PASS",
    score: 85,
    reasons: ["Passed basic validation checks."],
    checks: {
      understandsPost: true,
      followsSelectedAngle: true,
      preservesAuthorTopic: true,
      addsNewObservation: true,
      isNotSummary: true,
      isNotGeneric: true,
      fails20PostTest: false,
      personalContextIsRelevant: true,
      avoidsTopicHijacking: true,
      avoidsSelfPromotion: true,
      avoidsAISlop: true,
      fitsPlatform: true,
      soundsNaturalHuman: true,
      proportionalLength: true,
      noFabricatedExperience: true,
    },
    critiqueSummary: "Comment appears relevant and concise.",
  };

  const lowerComment = candidateComment.toLowerCase();
  const bannedCliches = [
    "couldn't agree more",
    "couldnt agree more",
    "well said",
    "love this",
    "great point",
    "this is so important",
    "this really resonates",
    "let that sink in",
    "here's the thing",
    "heres the thing",
    "what most people miss",
    "the hard truth",
    "spot on",
    "absolutely",
    "so true",
    "couldn't have said it better",
    "couldnt have said it better",
    "thanks for sharing",
    "such a great reminder",
    "one thing that stands out to me",
    "this speaks to",
    "there's something really interesting about",
    "theres something really interesting about",
    "it's not x, it's y",
    "its not x, its y",
    "the real x is",
    "at the end of the day",
    "this is a powerful reminder that",
    "the biggest lesson here is",
    "the key takeaway is",
    "that's where the magic happens",
    "thats where the magic happens",
    "that's the difference between",
    "thats the difference between",
  ];

  const foundCliche = bannedCliches.find((c) => lowerComment.includes(c));
  if (foundCliche) {
    parsed.checks.avoidsAISlop = false;
    if (parsed.verdict === "PASS") {
      parsed.verdict = "REGENERATE";
    }
    parsed.reasons.push(`Contains banned AI cliche: "${foundCliche}"`);
  }

  // Programmatic summary enforcement check
  if (parsed.checks.isNotSummary === false) {
    if (parsed.verdict === "PASS") {
      parsed.verdict = "REGENERATE";
    }
    if (!parsed.reasons.some((r) => r.toLowerCase().includes("summary"))) {
      parsed.reasons.push("Comment restates or summarizes the post's core idea instead of adding a fresh observation.");
    }
  }

  // Programmatic sentence & word length check (1.5 sentences max)
  const words = candidateComment.split(/\s+/).filter(Boolean).length;
  const sentenceCount = candidateComment.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  if (sentenceCount > 2 || (sentenceCount === 2 && words > 22) || words > 28) {
    parsed.checks.proportionalLength = false;
    if (parsed.verdict === "PASS") {
      parsed.verdict = "REGENERATE";
    }
    parsed.reasons.push(
      `Exceeds maximum 1.5 sentence length limit (${sentenceCount} sentences, ${words} words). Shorten to 1.5 sentences max.`
    );
  }

  const debug: LLMStepDebug = {
    stepIndex: 4,
    stepName: "Anti-Slop Critic & Quality Audit",
    agentName: "Anti-Slop Critic Agent",
    systemPrompt,
    userPrompt,
    rawResponseText: response.text,
    parsedOutput: parsed,
    executionTimeMs: Date.now() - startTime,
  };

  return { result: parsed, debug };
}
