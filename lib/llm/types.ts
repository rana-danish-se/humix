export type LLMProvider = "openrouter" | "gemini";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface LLMResponse {
  text: string;
  parsedJson?: any;
  providerUsed: LLMProvider;
  modelUsed: string;
}

export class LLMHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "LLMHttpError";
  }
}

export type PlatformType = "LinkedIn" | "Reddit" | "Facebook";

export interface PostAnalysisResult {
  coreIdea: string;
  subject: string;
  authorIntention: string;
  postType:
    | "founder_insight"
    | "personal_story"
    | "marketing_advice"
    | "coach_post"
    | "controversial_opinion"
    | "ai_tech"
    | "lifestyle"
    | "promotional"
    | "question";
  tone: string;
  emotionalContext: string;
  claims: string[];
  implicitIdeas: string[];
  potentialContributionOpportunities: string[];
  evidenceLevel?: {
    personal?: string[];
    interpretive?: string[];
    generalized?: string[];
    advice?: string[];
  };
}

export type SkipReasonCode =
  | "PURE_LIFESTYLE_NO_HOOK"
  | "PURE_PROMOTIONAL_NO_HOOK"
  | "NO_DISCUSSION_SURFACE"
  | "ONLY_SUMMARY_ECHO_POSSIBLE"
  | "REQUIRES_FABRICATION"
  | "TOPIC_HIJACK_RISK"
  | "NO_GENUINE_CONTRIBUTION"
  | "POST_TOO_SHORT"
  | "INSUFFICIENT_CONTEXT";

export interface ContributionResult {
  shouldSkip: boolean;
  skipReason?: string;
  skipReasonCode?: SkipReasonCode;
  selectedAngle?:
    | "personal_experience"
    | "relevant_observation"
    | "useful_nuance"
    | "respectful_disagreement"
    | "additional_example"
    | "practical_perspective"
    | "relevant_question"
    | "alternative_interpretation";
  angleExplanation?: string;
  personalizationLevel: 0 | 1 | 2 | 3;
  topicHijackRisk: boolean;
  relevantContextSnippet?: string;
}

export interface CommentGenerationResult {
  comment: string;
  wordCount: number;
  sentenceCount: number;
  editorScore?: number;
  editorReason?: string;
  editorModelUsed?: string;
}

export interface QualityCriticResult {
  verdict: "PASS" | "REGENERATE" | "SKIP";
  score: number; // 0 to 100
  reasons: string[];
  checks: {
    understandsPost: boolean;
    followsSelectedAngle: boolean;
    preservesAuthorTopic: boolean;
    addsNewObservation: boolean;
    isNotSummary: boolean;
    isNotGeneric: boolean;
    fails20PostTest: boolean; // true if it would fit 20 unrelated posts (BAD)
    personalContextIsRelevant: boolean;
    avoidsTopicHijacking: boolean;
    avoidsSelfPromotion: boolean;
    avoidsAISlop: boolean;
    fitsPlatform: boolean;
    soundsNaturalHuman: boolean;
    proportionalLength: boolean;
    noFabricatedExperience: boolean;
  };
  critiqueSummary: string;
}

export interface LLMStepDebug {
  stepIndex: number;
  stepName: string;
  agentName: string;
  systemPrompt: string;
  userPrompt: string;
  rawResponseText: string;
  parsedOutput: any;
  executionTimeMs: number;
  providerUsed?: LLMProvider;
  modelUsed?: string;
}

export interface PipelineResult {
  status: "PASS" | "SKIP" | "REGENERATE";
  comment?: string;
  analysis: PostAnalysisResult;
  contribution: ContributionResult;
  critic: QualityCriticResult;
  stepDebugLogs: LLMStepDebug[];
  metadata: {
    platform: PlatformType;
    modelUsed: string;
    providerUsed: LLMProvider;
    criticModelUsed?: string;
    criticProviderUsed?: LLMProvider;
    editorScore?: number;
    executionTimeMs: number;
  };
}
