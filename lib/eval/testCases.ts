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
  {
    id: "TC-16",
    name: "Adversarial: Post Designed to Trigger AI Summary",
    category: "Adversarial / Summary Trap",
    platform: "LinkedIn",
    postText:
      "The single most important thing in business is cash flow. Everything else is noise. If you run out of cash, you're dead. So watch your cash flow like a hawk.",
    expectedStatus: "PASS",
    notes:
      "Post states obvious truth. System must NOT summarize ('Cash flow is important'). Must add specific nuance (e.g., 'The lag between revenue recognition and actual cash receipt is what kills growing companies').",
    prohibitKeywords: ["cash flow is important", "watch your cash", "couldn't agree more", "so true"],
  },
  {
    id: "TC-17",
    name: "Adversarial: Personal Story with Tech Adjacent Keywords",
    category: "Adversarial / Hijack Trap",
    platform: "LinkedIn",
    postText:
      "My daughter built her first website this weekend using a no-code tool. She's 12 and so proud. The joy of creating something from nothing!",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 0,
    notes:
      "Contains 'website', 'no-code', 'tool' - must NOT hijack into tech commentary. Should comment as a parent/human about pride/joy of creation.",
    prohibitKeywords: ["automation", "AI", "software", "developer", "code", "API", "tech stack"],
  },
  {
    id: "TC-18",
    name: "Adversarial: Controversial Take Requiring Nuanced Disagreement",
    category: "Adversarial / Disagreement",
    platform: "Reddit",
    postText:
      "Agile is dead. All it does is create meetings about meetings. Just ship code and talk to users directly.",
    expectedStatus: "PASS",
    notes:
      "Should offer respectful disagreement with specific nuance (e.g., 'The ceremonies are the problem, not the principles. Lightweight kanban works where scrum fails'). NOT generic agreement.",
    prohibitKeywords: ["couldn't agree more", "spot on", "well said", "agile is dead"],
  },
  {
    id: "TC-19",
    name: "Adversarial: Very Short Post (Edge Case)",
    category: "Adversarial / Edge Case",
    platform: "Reddit",
    postText:
      "Hiring is broken.",
    expectedStatus: "SKIP",
    notes:
      "Too short, no discussion surface. Must SKIP with appropriate skipReasonCode.",
  },
  {
    id: "TC-20",
    name: "Adversarial: Post with Fake Stats to Test Hallucination Resistance",
    category: "Adversarial / Hallucination",
    platform: "LinkedIn",
    postText:
      "Our internal study of 500 companies shows that 73% of teams using microservices regret it within 18 months. The complexity tax is real.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 1,
    notes:
      "Post cites specific (likely fabricated) stats. Comment must NOT repeat or validate the stats. Must comment on the general tension or tradeoff without citing numbers.",
    prohibitKeywords: ["73%", "500 companies", "18 months", "internal study"],
  },
  {
    id: "TC-21",
    name: "Adversarial: Coaching Post with Actionable Advice",
    category: "Adversarial / Coach Post",
    platform: "LinkedIn",
    postText:
      "Stop setting goals. Set systems instead. Goals are for direction; systems are for progress. James Clear said it best.",
    expectedStatus: "PASS",
    notes:
      "References James Clear / Atomic Habits. Must NOT summarize the quote. Must add practical observation about systems vs goals in specific context.",
    prohibitKeywords: ["james clear", "atomic habits", "goals are for direction", "systems are for progress"],
  },
  {
    id: "TC-22",
    name: "Adversarial: Founder Vulnerability Post",
    category: "Adversarial / Personal Story",
    platform: "LinkedIn",
    postText:
      "I almost shut down my company last year. $40k in the bank, payroll due Friday. We got a check Thursday. The anxiety changes you.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 1,
    notes:
      "Vulnerable founder story. Must respond with empathy + relevant founder perspective (level 1), NOT tech solutions. No 'automation would help'.",
    prohibitKeywords: ["automation", "AI", "software", "tool", "platform"],
  },
  {
    id: "TC-23",
    name: "Adversarial: Meta Post About Commenting",
    category: "Adversarial / Meta",
    platform: "LinkedIn",
    postText:
      "The best comments on LinkedIn aren't the long thoughtful ones. They're the short specific ones that show you actually read the post.",
    expectedStatus: "PASS",
    expectedPersonalizationLevel: 0,
    notes:
      "Meta post about commenting. Comment must be self-aware and meta, showing you read it. Short, specific, about commenting behavior.",
    prohibitKeywords: ["couldn't agree more", "great point", "well said"],
  },
  {
    id: "TC-24",
    name: "Adversarial: Platform-Specific Style (Reddit)",
    category: "Adversarial / Platform Convention",
    platform: "Reddit",
    postText:
      "Anyone else find that 'senior' devs with 10 years exp often write worse code than mid-levels who actually care?",
    expectedStatus: "PASS",
    notes:
      "Reddit style: direct, conversational, slightly opinionated. No LinkedIn polish. Should engage with the observation directly.",
    prohibitKeywords: ["I couldn't agree more", "this is so important", "great insight", "thought leadership"],
  },
  {
    id: "TC-25",
    name: "Adversarial: Self-Promotion Trap Post",
    category: "Adversarial / Self-Promo Trap",
    platform: "LinkedIn",
    postText:
      "What's the biggest bottleneck in your content creation workflow right now?",
    expectedStatus: "PASS",
    notes:
      "Question post inviting discussion. Must NOT pivot to promoting user's services/tools. Answer as a peer with genuine observation.",
    prohibitKeywords: ["my tool", "my service", "my platform", "I built", "check out", "DM me"],
  },
];
