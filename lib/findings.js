// Turns the raw scan + PageSpeed data into rulebook-format findings, using the
// Claude Agent SDK -- authenticated with CLAUDE_CODE_OAUTH_TOKEN (the Pro/Max
// subscription's Agent SDK credit), NOT a Console API key. See .env.example.
import { query } from "@anthropic-ai/claude-agent-sdk";

const RULEBOOK_AREAS = [
  "email", "chat", "reviews", "pdp", "seo", "speed",
  "checkout", "upsells", "ads", "business_specific",
];

export async function writeFindings({ lead, scan, pagespeed, ads, outsideSignals, rulebookText }) {
  const prompt = `You are auditing an e-commerce (or appointment-based retail) prospect's
website for Zaistech, following the attached rulebook exactly. Only claim what the
data below actually shows -- never invent a finding. If something can't be told from
this data, leave it out rather than guessing.

RULEBOOK (follow its service names, its "what/where/why/fix/service" finding shape,
and section 4's area -> service mapping):
---
${rulebookText}
---

LEAD:
${JSON.stringify(lead, null, 2)}

HOMEPAGE + PRODUCT PAGE SCAN:
${JSON.stringify(scan, null, 2)}

PAGESPEED INSIGHTS:
${JSON.stringify(pagespeed, null, 2)}

ADS CHECK:
${JSON.stringify(ads, null, 2)}

OUTSIDE SIGNALS (reviews, ratings, listings found by web search):
${JSON.stringify(outsideSignals, null, 2)}

Respond with ONLY a single JSON object (no prose, no markdown fence) with this shape:
{
  "platform": string,
  "strengths": string[],            // 4-6 genuine, specific strengths
  "findings": [
    {
      "area": one of ${JSON.stringify(RULEBOOK_AREAS)},
      "what": string,               // the observed fact
      "where": string,              // page/URL
      "why": string,                // revenue impact in plain words
      "fix": string,
      "service": string,            // Zaistech service name, from the rulebook
      "priority": number            // 1 = top finding, higher = lower priority
    }
  ],
  "topPitch": string,               // 1-2 sentences: the recommended lead service + proof to cite
  "demoIdea": string                // 2-3 sentences, per rulebook section 6.1
}`;

  let lastText = "";
  for await (const message of query({
    prompt,
    options: {
      model: "claude-sonnet-4-5",
      allowedTools: [],
      systemPrompt: "You are a precise, careful e-commerce auditor. You never fabricate data. You respond with raw JSON only.",
    },
  })) {
    if (message.type === "result" && "result" in message) {
      lastText = message.result;
    }
  }

  const jsonMatch = lastText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Agent SDK did not return parseable JSON: " + lastText.slice(0, 300));
  }
  return JSON.parse(jsonMatch[0]);
}
