import { PipelineResult } from "@/lib/llm";
import { TestCase } from "./testCases";

// These are contract checks, not a substitute for a person's assessment of voice.
export function evaluateResult(tc: TestCase, result: PipelineResult): string[] {
  const failures: string[] = [];
  if (result.status !== tc.expectedStatus) failures.push(`Expected ${tc.expectedStatus}, got ${result.status}`);
  if (tc.expectedPersonalizationLevel !== undefined && result.contribution.personalizationLevel !== tc.expectedPersonalizationLevel) {
    failures.push(`Expected personalization level ${tc.expectedPersonalizationLevel}`);
  }
  if (result.status === "PASS") {
    if (!result.comment?.trim()) failures.push("Accepted result has no draft");
    if (!tc.userReaction?.trim()) failures.push("Accepted result has no supplied reaction");
    for (const key of ["preservesUserMeaning", "noUnsupportedClaims", "fairlyRepresentsPost", "soundsNaturalHuman", "noFabricatedExperience"] as const) {
      if (result.critic?.checks[key] !== true) failures.push(`Required review check failed: ${key}`);
    }
    if (!result.critic?.grounding.length) failures.push("Accepted result has no source evidence");
    for (const phrase of tc.prohibitKeywords || []) {
      if (result.comment?.toLowerCase().includes(phrase.toLowerCase())) failures.push(`Prohibited phrase: ${phrase}`);
    }
  } else if (result.comment) failures.push("Rejected result exposed a draft");
  return failures;
}
