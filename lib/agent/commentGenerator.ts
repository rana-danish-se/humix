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
  "that line hits different", "this line hits different", "when you realize",
  "that line hits hard", "this line hits hard", "it's wild how", "its wild how",
  "it's strange how", "its strange how", "until it's too late", "until its too late",
  "hanging by a thread",
  "quietly terrifying",
  "sense of self", "quietly rewrite", "quietly rewrites",
];

const FORMULAIC_PATTERNS = [
  /\bit'?s not(?: just)? .+?,\s*it'?s\b/i,
  /.+ isn'?t about .+, it'?s about .+/i,
  /at the end of the day/i,
  /this is a powerful reminder that/i,
  /the biggest lesson here is/i,
  /the key takeaway is/i,
  /that'?s where the magic happens/i,
  /that'?s the difference between/i,
  /one thing that stands out to me/i,
  /this speaks to/i,
  /there'?s something really interesting about/i,
  /\b(?:isn'?t|is not) [^,.]+,\s*it'?s\b/i,
  /^(?:that|this|the) (?:line|part|point|bit) (?:about .+? )?(?:hits?|really hits?)\b/i,
  /^the part about\b/i,
  /\breally hits\b/i,
  /^the idea that\b/i,
  /^(?:that|this|the) line\b/i,
];

function wordsIn(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
}

export function validateComment(
  comment: string,
  postText: string = "",
  userAdditionalContext: string = "",
  platform: string = "LinkedIn"
): { valid: boolean; issues: string[] } {
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

  // Platform-based length checks
  const words = comment.split(/\s+/).filter(Boolean).length;
  const sentenceCount = comment.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  
  const maxSentences = platform === "Reddit" ? 3 : 2;
  const maxWords = platform === "Reddit" ? 50 : 38;

  if (sentenceCount > maxSentences || words > maxWords) {
    issues.push(`Too long for a ${platform} comment: ${sentenceCount} sentences, ${words} words (max ${maxSentences} sentences, ${maxWords} words)`);
  }

  // Prevent fabricating specific firsthand experience or client work without supplied context
  if (!userAdditionalContext.trim() && /\b(?:i(?:'ve| have) (?:seen|worked|built|helped|delivered|heard|used)|i (?:worked|built|helped|delivered|heard)|we(?:'ve| have) (?:seen|worked|built|helped|delivered|heard)|we (?:worked|built|helped|delivered)|my (?:clients?|projects?|team)|our (?:clients?|projects?|team)|in my experience|at ivoro)\b/i.test(normalized)) {
    issues.push("Claims firsthand work or experience that the provided context does not establish");
  }

  // Prevent commercial self-promotion
  if (/\b(?:my agency|our agency|DM me|book a call|hire (?:me|us)|check out (?:my|our)|my (?:service|agency)|our (?:service|agency))\b/i.test(normalized)) {
    issues.push("Contains unsolicited self-promotion");
  }

  // Detect quoting or verbatim copying from post
  if (postText) {
    const postWords = wordsIn(postText);
    const commentWords = wordsIn(comment);
    const postPhrases = new Set<string>();
    for (let index = 0; index <= postWords.length - 5; index++) {
      postPhrases.add(postWords.slice(index, index + 5).join(" "));
    }
    if (commentWords.some((_, index) => index <= commentWords.length - 5 &&
        postPhrases.has(commentWords.slice(index, index + 5).join(" ")))) {
      issues.push("Copies a five-word phrase verbatim from the post");
    }

    const postNormalized = ` ${postWords.join(" ")} `;
    for (const match of comment.matchAll(/[“"]([^”"]+)[”"]|‘([^’]+)’|(?<![\p{L}\p{N}])'([^']+)'(?![\p{L}\p{N}])/gu)) {
      const quotedWords = wordsIn(match[1] || match[2] || match[3]);
      if (quotedWords.length >= 2 && postNormalized.includes(` ${quotedWords.join(" ")} `)) {
        issues.push("Quotes wording from the post");
        break;
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function getPlatformGuidance(platform: string): string {
  if (platform === "Reddit") {
    return `PLATFORM RULES (Reddit):
- Speak like an authentic Reddit user participating in a subreddit thread.
- Direct, candid, conversational, slightly pragmatic or skeptical.
- Avoid LinkedIn-style motivational polish, self-importance, or formal posturing.
- 1 to 3 short sentences, 10–40 words.
- You may ask a real, direct question or offer a concrete counter-observation.`;
  }
  if (platform === "Facebook") {
    return `PLATFORM RULES (Facebook):
- Conversational, warm, friendly, and community-centered.
- Avoid stiff corporate jargon.
- 1 to 2 short sentences, 8–30 words.`;
  }
  return `PLATFORM RULES (LinkedIn):
- Sound like a thoughtful professional or founder commenting peer-to-peer.
- Focus on practical trade-offs, operational realities, or real tensions.
- Avoid influencer clichés ('Well said!', 'So true!', 'Let that sink in').
- 1 to 2 short sentences, 8–30 words.`;
}

export async function generateCommentCandidate(
  postText: string,
  platform: string,
  analysis: PostAnalysisResult,
  contribution: ContributionResult,
  provider: LLMProvider = "gemini",
  model: string = "gemini-3.8-flash",
  userAdditionalContext?: string
): Promise<{ result: CommentGenerationResult; debug: LLMStepDebug }> {
  const startTime = Date.now();

  const platformGuidance = getPlatformGuidance(platform);

  const systemPrompt = `You write possible social media replies for a real person to review before posting. Sound like a real human being speaking directly to the author, not an AI bot performing insight.

${platformGuidance}

Return JSON with a 'comments' array of 4 distinct candidate strings. Put the strongest option first. If there is genuinely no natural opening, return an empty array.

GUIDELINES:
1. Ground every comment in what the author actually wrote. Use the analysis and selected angle only as guidance.
2. Give each option a real reason to exist: a practical implication, a concrete trade-off, a gentle observation, or a grounded reaction.
3. Match the author's tone: lightly humorous for a joke, empathetic for vulnerability, pragmatic for business.
4. Do NOT summarize or paraphrase the post using fancy synonyms.
5. Do NOT open with performative AI tropes like 'That line hits hard', 'It's wild how', 'The part about', 'Quietly', or 'At the end of the day'.
6. If the user provided a personal reaction or experience, use it naturally in plain language without exaggerating.
7. Avoid generic praise ('Well said!', 'Great insight!') and unsolicited self-promotion.

Return ONLY JSON: {"comments":["...","...","...","..."]}`;

  const userPrompt = `PLATFORM: ${platform}
POST SUBJECT: ${analysis.subject}
AUTHOR TONE: ${analysis.tone}
SELECTED ANGLE: ${contribution.selectedAngle || "relevant_observation"}
ANGLE EXPLANATION: ${contribution.angleExplanation || "Respond thoughtfully to the author's point."}
PERSONALIZATION LEVEL: Level ${contribution.personalizationLevel}
ALLOWED CONTEXT: ${contribution.relevantContextSnippet || "None"}
USER'S OWN REACTION: ${userAdditionalContext || "None supplied"}

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
      userPrompt: attempts === 1 ? userPrompt : `${userPrompt}\n\nPREVIOUS ATTEMPT ISSUES:\n${lastResponse}\n\nPlease generate 4 improved candidates addressing these points.`,
      temperature: attempts === 1 ? 0.75 : 0.85,
      maxTokens: 400,
      responseFormat: "json",
    });
    lastRawResponseText = response.text;
    lastProviderUsed = response.providerUsed;
    lastModelUsed = response.modelUsed;

    const candidates: string[] = Array.isArray(response.parsedJson?.comments)
      ? response.parsedJson.comments.filter((c: unknown): c is string => typeof c === "string")
      : typeof response.parsedJson?.comment === "string" ? [response.parsedJson.comment] : [];
    if (candidates.length === 0) {
      lastResponse = `Failed to parse JSON: ${response.text.slice(0, 300)}`;
      continue;
    }

    const issues: string[] = [];
    const validCandidates: string[] = [];
    for (const candidate of candidates) {
      const rawComment = candidate.trim().replace(/^["']|["']$/g, "");
      if (!rawComment) continue;
      const validation = validateComment(rawComment, postText, userAdditionalContext, platform);
      lastCandidate = rawComment;
      if (validation.valid) validCandidates.push(rawComment);
      else issues.push(...validation.issues);
    }

    if (validCandidates.length > 0) {
      let chosen = validCandidates[0];
      let editorScore: number | undefined;
      let editorReason: string | undefined;
      let editorModelUsed: string | undefined;

      // Run quality editor review across all models to pick the single most human comment
      try {
        const editorPrompt = `You are a strict human editor selecting the best single comment for a real person to post on ${platform}.
Rate the options and choose the most natural, human-sounding reply.

Criteria:
- Must sound like an authentic human being speaking to the author, NOT an AI generating corporate insight.
- Must add a genuine observation, practical tension, or grounded reaction (no summaries or paraphrases).
- Reject performative phrases ('quietly', 'it's wild how', 'hits hard', 'at the end of the day').
- Score 8-10 if it's natural, specific, and ready to post without embarrassment.
- Score 0-7 if it feels generic, like AI slop, or summarizes the post.

Return JSON: {"bestIndex": number, "score": number, "reason": "concise explanation"}`;

        const review = await callModel(
          provider,
          model,
          {
            systemPrompt: editorPrompt,
            userPrompt: `PLATFORM: ${platform}\nPOST:\n"""${postText}"""\n\nUSER CONTEXT: ${userAdditionalContext || "None"}\n\nCANDIDATES:\n${JSON.stringify(validCandidates)}`,
            temperature: 0.1,
            maxTokens: 200,
            responseFormat: "json",
          },
          1
        );

        const selection = review.parsedJson;
        editorModelUsed = review.modelUsed;
        if (typeof selection?.score === "number") {
          editorScore = Math.max(0, Math.min(10, selection.score));
        }
        if (typeof selection?.reason === "string") {
          editorReason = selection.reason;
        }
        if (Number.isInteger(selection?.bestIndex) && selection.bestIndex >= 0 && selection.bestIndex < validCandidates.length) {
          chosen = validCandidates[selection.bestIndex];
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Editor review fallback to heuristic selection:", msg);
        // Heuristic fallback: pick candidate that is closest to optimal word length and contains no cliches
        chosen = validCandidates.reduce((best, current) => {
          const currentWords = current.split(/\s+/).length;
          const bestWords = best.split(/\s+/).length;
          const targetWords = platform === "Reddit" ? 22 : 18;
          return Math.abs(currentWords - targetWords) < Math.abs(bestWords - targetWords) ? current : best;
        }, validCandidates[0]);
        editorScore = 8;
        editorReason = "Heuristically selected for natural length and conversational flow.";
      }

      const parsedResult: CommentGenerationResult = {
        comment: chosen,
        wordCount: chosen.split(/\s+/).filter(Boolean).length,
        sentenceCount: chosen.split(/[.!?]+/).filter((s) => s.trim().length > 0).length,
        editorScore,
        editorReason,
        editorModelUsed,
      };

      return {
        result: parsedResult,
        debug: {
          stepIndex: 3,
          stepName: "Candidate Comment Generation",
          agentName: "Comment Candidate Generator Agent",
          systemPrompt,
          userPrompt: attempts === 1 ? userPrompt : `${userPrompt}\n\n[RETRY ${attempts}]`,
          rawResponseText: response.text,
          parsedOutput: { ...parsedResult, candidates: validCandidates },
          executionTimeMs: Date.now() - startTime,
          providerUsed: response.providerUsed,
          modelUsed: response.modelUsed,
        },
      };
    }

    lastResponse = [...new Set(issues)].join("; ");
  }

  if (!lastCandidate) {
    throw new Error(`CommentGenerator: Failed to generate a comment after ${maxAttempts} attempts. Issues: ${lastResponse}`);
  }

  const fallbackResult: CommentGenerationResult = {
    comment: lastCandidate,
    wordCount: lastCandidate.split(/\s+/).filter(Boolean).length,
    sentenceCount: lastCandidate.split(/[.!?]+/).filter((s) => s.trim()).length,
    editorScore: 5,
    editorReason: "Draft generated with potential stylistic compromises.",
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
