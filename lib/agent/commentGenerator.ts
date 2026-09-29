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

export function validateComment(comment: string, postText: string = "", userAdditionalContext: string = ""): { valid: boolean; issues: string[] } {
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
  if (!userAdditionalContext.trim() && /\b(?:I|we|my|our)\b/i.test(normalized)) {
    issues.push("Uses a first-person claim without user-provided context");
  }
  if (/\b(?:everyone|everybody|every (?:deal|founder)|most (?:founders|people))\b/i.test(normalized)) {
    issues.push("Makes a broad claim that the post does not establish");
  }
  const unstatedEmotion = normalized.match(/\b(?:emotional(?:ly)?|fear|afraid|ego|insecure|anxious|motivation|intentions?)\b/i)?.[0];
  if (unstatedEmotion && !new RegExp(`\\b${unstatedEmotion}\\b`, "i").test(postText)) {
    issues.push(`Attributes an unstated feeling or motive: ${unstatedEmotion}`);
  }
  if (postText) {
    const postWords = wordsIn(postText);
    const commentWords = wordsIn(comment);
    const postPhrases = new Set<string>();
    for (let index = 0; index <= postWords.length - 5; index++) {
      postPhrases.add(postWords.slice(index, index + 5).join(" "));
    }
    if (commentWords.some((_, index) => index <= commentWords.length - 5 &&
        postPhrases.has(commentWords.slice(index, index + 5).join(" ")))) {
      issues.push("Copies a five-word phrase from the post");
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

export async function generateCommentCandidate(
  postText: string,
  platform: string,
  analysis: PostAnalysisResult,
  contribution: ContributionResult,
  provider: LLMProvider = "gemini",
  model: string = "gemini-flash-lite-latest",
  userAdditionalContext?: string
): Promise<{ result: CommentGenerationResult; debug: LLMStepDebug }> {
  const startTime = Date.now();

  const systemPrompt = `You write possible social media replies for a real person to review before posting. Sound like a person speaking to the author, not a content creator performing insight.

Return JSON with a comments array of four different strings. Each reply should be 6–25 words, at most two short sentences. Put the strongest option first. If there is no genuine opening, return an empty array.

Read the original post first. Use the analysis and selected angle only as hints; ignore any claim in them that the post does not support. Use the user's optional context only for facts they actually supplied. Never invent their experience, clients, opinion, or credentials. Never mention Ivoro or pitch services unless asked.
When the user supplies a genuine reaction or recurring client question, make at least one candidate use that exact perspective in plain language. Do not claim it proves a result or guarantees customers.

Give each option a small reason to exist beyond agreement: a practical implication, a specific question the author could answer, a gentle joke, or a plain reaction to a concrete detail. Do not simply summarize the post with fresh synonyms. A reaction can be enough; do not force a lesson.

Match the author's tone. For a humorous post, be lightly playful and do not turn the joke into a moral. For a personal story, respond to what the author actually described without diagnosing their feelings. For business advice, focus on a real practical tension instead of a generic takeaway.

Do not quote or copy a sentence from the post. You may refer to its situation in your own words. Do not open with 'that line', 'the part about', 'the idea that', 'it's wild how', or 'the real'. Avoid 'really hits', 'quietly', dramatic metaphors, broad claims, and neat X-versus-Y endings. Avoid questions asked only for engagement.

Calibration: A reply like 'The real magic is how multitasking gets treated like a harmless confession' is weak because it restates the author's joke. A short reply such as 'Imagine trying that excuse at dinner' is stronger because it extends the situation naturally. Do not reuse either sentence; apply the distinction to this post.

Return only JSON: {"comments":["...","...","...","..."]}.`;

  const userPrompt = `PLATFORM: ${platform}
POST SUBJECT: ${analysis.subject}
AUTHOR TONE: ${analysis.tone}
SELECTED CONTRIBUTION ANGLE: ${contribution.selectedAngle}
ANGLE EXPLANATION: ${contribution.angleExplanation}
PERSONALIZATION LEVEL: Level ${contribution.personalizationLevel}
TOPIC HIJACK RISK: ${contribution.topicHijackRisk}
ALLOWED PERSONAL CONTEXT SNIPPET: ${contribution.relevantContextSnippet || "None (Level 0 - Do not inject tech/personal background)"}
USER'S OWN REACTION OR EXPERIENCE: ${userAdditionalContext || "None supplied"}

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
      maxTokens: 450,
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
    const validCandidates: string[] = [];
    for (const candidate of candidates) {
      const rawComment = candidate.trim();
      if (!rawComment) continue;
      const validation = validateComment(rawComment, postText, userAdditionalContext);
      lastCandidate = rawComment;
      if (validation.valid) validCandidates.push(rawComment);
      else issues.push(...validation.issues);
    }

    if (validCandidates.length > 0) {
      let chosen = validCandidates[0];
      let editorScore: number | undefined;
      let editorReason: string | undefined;
      let editorModelUsed: string | undefined;
      const useEditor = model === "anthropic/claude-sonnet-4.6" || model === "openai/gpt-5.4-mini";
      if (useEditor) {
        try {
          const editorModel = response.modelUsed === "openai/gpt-5.4-mini"
            ? "anthropic/claude-sonnet-4.6"
            : "openai/gpt-5.4-mini";
          const review = await callModel("openrouter", editorModel, {
            systemPrompt: `You are a strict human editor choosing one LinkedIn reply. Rate from 0 to 10. An 8 means you would comfortably post it yourself: natural, specific to the author's situation, grounded, and adding a small reaction, question, or implication. A 5 is generic praise, paraphrase, polished AI phrasing, or a forced insight. Reject invented experience and copied wording. If USER CONTEXT is None, first-person claims such as "I've heard that many times" are invented and must score below 8. For a humorous post, a small playful extension beats a serious moral. Prefer simple language over clever language. Pick the strongest candidate only if it reaches 8. Return JSON: {"bestIndex": number or -1, "score": number, "reason": string}.`,
            userPrompt: `POST:\n${postText}\n\nUSER CONTEXT:\n${userAdditionalContext || "None"}\n\nCANDIDATES:\n${JSON.stringify(validCandidates)}`,
            temperature: 0,
            maxTokens: 180,
            responseFormat: "json",
          });
          const selection = review.parsedJson;
          editorModelUsed = review.modelUsed;
          editorScore = typeof selection?.score === "number" ? Math.max(0, Math.min(10, selection.score)) : 0;
          editorReason = typeof selection?.reason === "string" ? selection.reason : "Editor did not explain its selection.";
          if (Number.isInteger(selection?.bestIndex) && selection.bestIndex >= 0 && selection.bestIndex < validCandidates.length) {
            chosen = validCandidates[selection.bestIndex];
          } else {
            editorScore = Math.min(editorScore, 7);
          }
          if (review.modelUsed !== "openai/gpt-5.4-mini" && review.modelUsed !== "anthropic/claude-sonnet-4.6") {
            editorScore = 0;
            editorReason = `Quality editor unavailable; fallback used ${review.modelUsed}. Check OpenRouter credits, retry, or choose a faster model.`;
          } else if (review.modelUsed === response.modelUsed) {
            editorScore = 0;
            editorReason = "An independent quality editor was unavailable. Check OpenRouter credits, retry, or choose a faster model.";
          }
        } catch {
          editorScore = 0;
          editorReason = "Quality editor unavailable. Check OpenRouter credits, retry, or choose a faster model.";
        }
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
