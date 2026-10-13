export type LLMProvider = "groq" | "gemini" | "openrouter";
export type PipelineMode = LLMProvider | "collaborative";
export type PlatformType = "LinkedIn" | "Reddit" | "Facebook";
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}
export interface LLMResponse {
  text: string;
  // Provider payloads are validated at each application boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export interface WritingContext {
  voiceSamples?: string[];
  recentComments?: string[];
  authorContext?: string;
}
export interface PostAnalysisResult {
  coreIdea: string;
  tone: string;
  intent: string;
  missingContext: string;
}
export const COMMENT_ANGLES = ["question", "insight", "practical", "challenge", "humor", "support"] as const;
export type CommentAngle = typeof COMMENT_ANGLES[number];
export interface CommentOption {
  id: number;
  angle: CommentAngle;
  text: string;
  anchor: string;
  contribution: string;
}
export interface CandidateBatch {
  analysis: PostAnalysisResult;
  candidates: CommentOption[];
  skipReason: string;
}
export const QUALITY_CHECKS = [
  "understandsPost", "addsValue", "notGeneric", "toneFits", "naturalVoice",
  "noUnsupportedClaims", "noFabricatedExperience", "fairChallenge", "questionNotAnswered",
  "noPromotion", "respectsUserContext", "notRepetitive",
] as const;
export interface CandidateReview {
  id: number;
  checks: Record<typeof QUALITY_CHECKS[number], boolean>;
  reasons: string[];
  grounding: Array<{
    claim: string;
    kind: "post" | "personal" | "inference" | "question" | "humor" | "reaction";
    evidenceQuote: string;
  }>;
}
export interface BatchReview {
  reviews: CandidateReview[];
  selectedIds: number[];
  distinct: boolean;
  summary: string;
}
export interface LLMStepDebug {
  stepIndex: number;
  stepName: string;
  systemPrompt: string;
  userPrompt: string;
  rawResponseText: string;
  parsedOutput: unknown;
  executionTimeMs: number;
  providerUsed?: LLMProvider;
  modelUsed?: string;
}
export interface PipelineResult {
  status: "PASS" | "SKIP" | "REGENERATE";
  comments: CommentOption[];
  analysis?: PostAnalysisResult;
  message: string;
  review?: BatchReview;
  stepDebugLogs: LLMStepDebug[];
  promptGuard?: { status: "checked" | "unavailable"; isAttack: boolean; score: number };
  metadata: {
    platform: PlatformType;
    pipelineMode: PipelineMode;
    providerUsed?: LLMProvider;
    modelUsed?: string;
    criticProviderUsed?: LLMProvider;
    criticModelUsed?: string;
    executionTimeMs: number;
    attempts: number;
  };
}
