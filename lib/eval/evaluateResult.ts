import { QUALITY_CHECKS, type PipelineResult } from "@/lib/llm/types";
import type { TestCase } from "./testCases";

// Contract checks are separate from a human's judgment of conversation quality.
export function evaluateResult(tc: TestCase, result: PipelineResult): string[] {
  const failures: string[] = [];
  if (result.status !== tc.expectedStatus) failures.push(`Expected ${tc.expectedStatus}, got ${result.status}`);
  if (result.status === "PASS") {
    if (result.comments.length !== 3) failures.push("Expected exactly three comments");
    if (!result.review?.distinct) failures.push("The reviewer did not confirm different contributions");
    if (new Set(result.comments.map(c => c.text.trim().toLowerCase())).size !== 3) failures.push("Duplicate comments");
    for (const comment of result.comments) {
      const review = result.review?.reviews.find(r => r.id === comment.id);
      if (!comment.text.trim() || !tc.postText.includes(comment.anchor)) failures.push("Missing comment or original-post anchor");
      if (!review?.grounding.length || QUALITY_CHECKS.some(key => review?.checks[key] !== true)) failures.push(`Incomplete or failed review for ${comment.id}`);
      for (const phrase of tc.prohibitKeywords || []) {
        if (comment.text.toLowerCase().includes(phrase.toLowerCase())) failures.push(`Prohibited phrase: ${phrase}`);
      }
    }
  } else if (result.comments.length) failures.push("Rejected result exposed comments");
  return failures;
}
