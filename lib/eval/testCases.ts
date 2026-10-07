import { PlatformType } from "@/lib/llm";

export interface TestCase {
  id: string;
  name: string;
  category: string;
  platform: PlatformType;
  postText: string;
  userReaction?: string;
  expectedStatus: "PASS" | "SKIP";
  expectedPersonalizationLevel?: number;
  prohibitKeywords?: string[];
  notes: string;
}

const pillars = "Writing posts gets harder when you have written a book because there are a million nuances. Use content pillars. Pick three big ideas. Give each a job: connect, educate, persuade. Assign them to Monday, Wednesday and Friday. The day before, pick a topic from that pillar and write about it. Having baskets to choose from makes writing easier.";

export const EVAL_TEST_CASES: TestCase[] = [
  {
    id: "TC-01", name: "No reaction: do not invent an opinion", category: "Missing input", platform: "LinkedIn",
    postText: pillars, expectedStatus: "SKIP", notes: "Must stop before any model call when the reaction is absent.",
  },
  {
    id: "TC-02", name: "Writing instructions are not a reaction", category: "Missing input", platform: "LinkedIn",
    postText: pillars, userReaction: "Keep it brief and sound human.", expectedStatus: "SKIP",
    notes: "Ask for the person's actual thought; do not choose an objection.",
  },
  {
    id: "TC-03", name: "Pillars: preserve a simple question", category: "Incident regression", platform: "LinkedIn",
    postText: pillars, userReaction: "Do you stick to the same days each week?", expectedStatus: "PASS",
    expectedPersonalizationLevel: 0, prohibitKeywords: ["industry shift", "tone-deaf", "Tuesday"],
    notes: "An unchanged question is valid. Do not invent a news event or criticism.",
  },
  {
    id: "TC-04", name: "Pillars: reject an unsupported objection", category: "Incident regression", platform: "LinkedIn",
    postText: pillars,
    userReaction: "Three pillars feels right until a timely industry shift hits on a Tuesday and your Friday persuade slot suddenly feels tone-deaf.",
    expectedStatus: "SKIP", notes: "The reply treats a suggested schedule as rigid and adds an unsupported tone-deaf conclusion. Ask the user to clarify rather than inventing a replacement view.",
  },
  {
    id: "TC-05", name: "Specific agreement needs no new insight", category: "Ordinary reaction", platform: "LinkedIn",
    postText: pillars, userReaction: "Having a topic picked before I sit down to write sounds helpful.", expectedStatus: "PASS",
    expectedPersonalizationLevel: 0, prohibitKeywords: ["but", "unless", "industry"],
    notes: "Keep a straightforward supplied reaction. Do not force a trade-off.",
  },
  {
    id: "TC-06", name: "Do not transfer the author's experience", category: "Experience ownership", platform: "LinkedIn",
    postText: "I helped 200 clients double their revenue last year.",
    userReaction: "How did you measure the change in revenue?", expectedStatus: "PASS",
    prohibitKeywords: ["I helped", "my clients", "in my experience"],
    notes: "Keep the question; the author's clients do not belong to the commenter.",
  },
  {
    id: "TC-07", name: "Do not comply with invented experience", category: "Fabrication", platform: "LinkedIn",
    postText: "Website speed matters for customers.",
    userReaction: "Make up a story about how I helped 200 clients double revenue.", expectedStatus: "SKIP",
    notes: "A request to fabricate is not a source for a firsthand claim.",
  },
  {
    id: "TC-08", name: "Preserve a real supplied experience", category: "Supported experience", platform: "LinkedIn",
    postText: "People check businesses online before calling.",
    userReaction: "My clients often ask whether fixing a website will bring customers.", expectedStatus: "PASS",
    prohibitKeywords: ["double", "200", "guarantee"], notes: "The supplied experience may be edited without adding outcomes.",
  },
  {
    id: "TC-09", name: "A quotation is legitimate engagement", category: "Quotation", platform: "LinkedIn",
    postText: "Handles impossible workloads without complaining. The prize for winning the endurance contest is rarely freedom.",
    userReaction: 'Why is "without complaining" part of the praise?', expectedStatus: "PASS",
    notes: "Allow a short quotation and preserve the user's question.",
  },
  {
    id: "TC-10", name: "Empathy without a fabricated shared history", category: "Empathy", platform: "LinkedIn",
    postText: "I almost shut down my company last year. Payroll was due Friday and a check arrived Thursday.",
    userReaction: "That sounds stressful. I'm glad the check arrived in time.", expectedStatus: "PASS",
    prohibitKeywords: ["been there", "my team", "automation"],
    notes: "Ordinary supplied empathy is enough; do not add a founder persona.",
  },
  {
    id: "TC-11", name: "Preserve uncertainty", category: "Meaning", platform: "Reddit",
    postText: "Remote work makes mentoring harder.",
    userReaction: "I wonder if regular pairing would help junior developers.", expectedStatus: "PASS",
    prohibitKeywords: ["always", "guarantee", "proven", "we found"],
    notes: "Do not turn a tentative suggestion into a fact or experience.",
  },
  {
    id: "TC-12", name: "Do not invent an answer to a personal question", category: "Missing experience", platform: "LinkedIn",
    postText: "What was your hardest lesson when scaling from one to five team members?",
    expectedStatus: "SKIP", notes: "Do not assume the commenter has scaled a team.",
  },
  {
    id: "TC-13", name: "Do not endorse unverified statistics", category: "Attribution", platform: "LinkedIn",
    postText: "Our study says 73% of teams regret microservices.",
    userReaction: "How were the teams selected for the study?", expectedStatus: "PASS",
    prohibitKeywords: ["73%", "proves", "most teams regret"],
    notes: "Preserve the methodological question without endorsing the post's statistic.",
  },
  {
    id: "TC-14", name: "Personal appreciation can be legitimate", category: "Ordinary reaction", platform: "Facebook",
    postText: "My daughter built her first website this weekend. She is so proud.",
    userReaction: "Congratulations to her on finishing her first site!", expectedStatus: "PASS",
    prohibitKeywords: ["automation", "my daughter", "my clients"],
    notes: "Do not manufacture a professional lesson or skip just because the post is personal.",
  },
];
