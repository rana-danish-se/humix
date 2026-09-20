import { PlatformType } from "@/lib/llm";

export interface TestCase {
  id: string;
  name: string;
  category: string;
  platform: PlatformType;
  postText: string;
  expectedStatus: "PASS" | "SKIP";
  expectedPersonalizationLevel?: number; // 0, 1, 2, or 3
  prohibitKeywords?: string[]; // e.g., ["automation", "software", "AI"] for non-tech posts
  notes: string;
}

export const EVAL_TEST_CASES: TestCase[] = [
  {
    id: "TC-01",
    name: "Founder Insight on Sales Hiring",
    category: "Founder Insight",
    platform: "LinkedIn",
    postText:
      "Why founders struggle with hiring their first salesperson: they usually expect them to create the sales process from scratch rather than executing an established playbook.",
    expectedStatus: "PASS",
    notes:
      "Should comment on defining sales processes before hiring, without hijacking into tech/automation.",
    prohibitKeywords: ["automate", "AI tool", "software stack"],
  },
  {
    id: "TC-02",
    name: "Founder Personal Story (Weekend Off)",
    category: "Lifestyle / Personal Story",
    platform: "LinkedIn",
    postText:
      "I finally took a full weekend off work and spent it entirely with my family. No phone, no emails, no Slack. Feeling recharged.",
    expectedStatus: "SKIP",
    notes:
      "MUST NOT respond with 'Taking time away shows why automation helps founders create freedom'. MUST NOT hijack topic into tech.",
    prohibitKeywords: ["automation", "AI", "software", "delegation tool"],
  },
  {
    id: "TC-03",
    name: "Marketing Advice on Brand Messaging",
    category: "Marketing Advice",
    platform: "LinkedIn",
    postText:
      "Stop confusing your target market by trying to appeal to everyone. Clear, hyper-specific messaging converts 10x better than broad generalizations.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 0,
    notes: "Should offer a practical observation on positioning without generic praise.",
    prohibitKeywords: ["Couldn't agree more", "Well said", "Great post"],
  },
  {
    id: "TC-04",
    name: "Coach Post on Mindset",
    category: "Coach Post",
    platform: "LinkedIn",
    postText:
      "The biggest barrier to growth isn't your strategy—it's your fear of uncomfortable conversations with your team.",
    expectedStatus: "PASS",
    notes: "Should reflect on leadership nuance without motivational clichés.",
    prohibitKeywords: ["grind", "100%", "let that sink in"],
  },
  {
    id: "TC-05",
    name: "Controversial Opinion on Remote Work",
    category: "Controversial Opinion",
    platform: "Reddit",
    postText:
      "Unpopular opinion: Full remote work destroys junior developer growth because 90% of learning happens through passive osmosis in an office.",
    expectedStatus: "PASS",
    notes: "Should provide respectful disagreement or nuance regarding deliberate async mentorship.",
    prohibitKeywords: ["LinkedIn", "thought leadership", "agree 100%"],
  },
  {
    id: "TC-06",
    name: "AI Post on LLM Wrapper Hype",
    category: "AI / Tech Post",
    platform: "LinkedIn",
    postText:
      "95% of AI startups launching today are just thin OpenAI API wrappers with no real defensibility or workflow integration.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 2,
    notes: "User's AI/API expertise IS relevant here! Should discuss workflow integration.",
  },
  {
    id: "TC-07",
    name: "Technology Architecture Post",
    category: "Technology Post",
    platform: "Reddit",
    postText:
      "What is your biggest pain point when decoupling a monolithic Node.js app into microservices?",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 2,
    notes: "User's full-stack & backend expertise is relevant.",
  },
  {
    id: "TC-08",
    name: "Pure Personal Lifestyle Moment",
    category: "Personal / Lifestyle",
    platform: "Facebook",
    postText:
      "Cooked a 3-course dinner for my spouse's birthday tonight. Homemade pasta was a total mess but tasted great!",
    expectedStatus: "SKIP",
    notes: "No professional value to add. System should recommend SKIP.",
  },
  {
    id: "TC-09",
    name: "Pure Promotional Noise",
    category: "Promotional Post",
    platform: "LinkedIn",
    postText:
      "🚀 SUPER EXCITING NEWS! We just launched our brand new 5-day webinar masterclass! Link in comments to register NOW before seats fill up!!! 🔥",
    expectedStatus: "SKIP",
    notes: "Promotional noise with no genuine discussion hook. Must output SKIP.",
  },
  {
    id: "TC-10",
    name: "Generic Motivational Quote",
    category: "Low Contribution Value",
    platform: "LinkedIn",
    postText:
      "If you want to go fast, go alone. If you want to go far, go together. Happy Monday team!",
    expectedStatus: "SKIP",
    notes: "Cliché quote with zero room for meaningful contribution. Must output SKIP.",
  },
  {
    id: "TC-11",
    name: "Tech Expertise Relevant: Legacy API Migration",
    category: "Tech Relevant",
    platform: "LinkedIn",
    postText:
      "Legacy systems rarely fail because of bad code; they fail because the original business logic was never documented when legacy APIs were replaced.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 2,
    notes: "Direct hit for user's background in API integration and process analysis.",
  },
  {
    id: "TC-12",
    name: "Tech Expertise Irrelevant: Office Lease Decisions",
    category: "Tech Irrelevant",
    platform: "LinkedIn",
    postText:
      "Commercial real estate leases are becoming far more flexible in 2026. Landlords are offering month-to-month terms for small business teams.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 0,
    notes: "Must NOT force tech into office real estate discussion. Level 0 required.",
    prohibitKeywords: ["software", "API", "automation", "AI"],
  },
  {
    id: "TC-13",
    name: "Respectful Disagreement: No-Code Vs Code",
    category: "Disagreement Appropriate",
    platform: "Reddit",
    postText:
      "No-code platforms have rendered custom web developers obsolete for custom business tools.",
    expectedStatus: "PASS",
    notes: "Respectfully counter with technical nuance regarding scalability and custom business rules.",
  },
  {
    id: "TC-14",
    name: "Direct Question Post",
    category: "Question Post",
    platform: "Reddit",
    postText:
      "What is the single hardest lesson you learned when scaling from 1 to 5 team members?",
    expectedStatus: "PASS",
    notes: "Direct concise observation on operational handoffs.",
  },
  {
    id: "TC-15",
    name: "Summary Trap: Automating Broken Processes",
    category: "Summary Trap",
    platform: "LinkedIn",
    postText:
      "Businesses shouldn't automate broken processes. Fix the workflow first, then automate.",
    expectedStatus: "PASS",
    notes:
      "MUST NOT summarize as 'I agree, fix the process before automating'. MUST contribute a new observation like edge cases or undocumented exceptions.",
    prohibitKeywords: [
      "Fix the workflow first",
      "Businesses shouldn't automate",
      "Couldn't agree more",
    ],
  },
];
