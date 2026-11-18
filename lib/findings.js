// Turns the raw scan + PageSpeed data into rulebook-format findings, using the
// Claude Agent SDK -- authenticated with CLAUDE_CODE_OAUTH_TOKEN (the Pro/Max
// subscription's Agent SDK credit), NOT a Console API key. See .env.example.
import { query } from "@anthropic-ai/claude-agent-sdk";

const RULEBOOK_AREAS = [
  "email", "chat", "reviews", "pdp", "seo", "speed",
  "checkout", "upsells", "ads", "business_specific",
];

export async function writeFindings({ lead, scan, pagespeed, productPagespeed, ads, outsideSignals, rulebookText }) {
  const prompt = `You are auditing an e-commerce (or appointment-based retail) prospect's
website for Zaistech, following the attached rulebook exactly. Only claim what the
data below actually shows -- never invent a finding. If something can't be told from
this data, leave it out rather than guessing.

QUALITY OVER QUANTITY -- this is the most important rule. Do NOT pad the findings
list to make the audit look thorough. Not every site has a problem in every
rulebook area, and that's fine -- if an area looks solid, say so in "strengths"
and move on. Only include a finding if it passes ALL of these:
  1. It is a SPECIFIC, concrete fact from the data below (not a vague gripe).
  2. It genuinely costs the business money or customers -- a real owner would
     wince reading it, not shrug.
  3. Fixing it is something Zaistech can credibly pitch and deliver as one of
     its services, and the business owner would understand why paying for
     that fix is worth it.
If a potential finding doesn't clearly clear all three, leave it out rather
than including it "just in case." A sharp 2-finding audit beats a padded
8-finding one where half the items are nitpicks nobody would pay to fix --
filler findings make the real ones easier to dismiss. It is completely fine
to return very few findings (even just one) if that's all that's genuinely
wrong. Order "findings" by how compelling/sellable each one is, most
compelling first (priority 1) -- priority 1 should be the single strongest
reason this specific lead would respond to outreach, not just the first
thing you noticed.

RULEBOOK (follow its service names, its "what/where/why/fix/service" finding shape,
and section 4's area -> service mapping):
---
${rulebookText}
---

LEAD:
${JSON.stringify(lead, null, 2)}

HOMEPAGE + PRODUCT PAGE SCAN:
${JSON.stringify(scan, null, 2)}

PAGESPEED INSIGHTS (homepage):
${JSON.stringify({ ...pagespeed, screenshotBase64: pagespeed?.screenshotBase64 ? "[omitted, see UI]" : null }, null, 2)}

PAGESPEED INSIGHTS (product page, if one was found):
${JSON.stringify({ ...productPagespeed, screenshotBase64: productPagespeed?.screenshotBase64 ? "[omitted, see UI]" : null }, null, 2)}

Note: scan.emailFlows (welcome/abandoned-cart) and scan.checkoutUpsell are
heuristic signals, not confirmed test results -- word findings about them as
"X tool detected but flow status needs manual check" or "no X tool detected",
never as a confirmed pass/fail. scan.productPage.issues is a ready-made list
of specific things missing on the product page (reviews, guarantee, trust
badges, etc.) -- use these as concrete findings with "where": "product page"
rather than re-deriving them yourself. For every finding, set "where" to one
of: "homepage", "product page", "checkout", or "email" so the UI can group
findings under the matching screenshot.

ADS CHECK:
${JSON.stringify(ads, null, 2)}

OUTSIDE SIGNALS (reviews, ratings, listings found by web search):
${JSON.stringify(outsideSignals, null, 2)}

Respond with ONLY a single JSON object (no prose, no markdown fence) with this shape:
{
  "platform": string,
  "strengths": string[],            // 4-6 genuine, specific strengths
  "findings": [                     // real, sellable pain points ONLY -- see
                                     // "QUALITY OVER QUANTITY" above. Can be
                                     // short. Never padded to hit a count.
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

  console.log("[findings] starting Agent SDK query, prompt length:", prompt.length);
  let lastText = "";
  let messageCount = 0;
  try {
    for await (const message of query({
      prompt,
      options: {
        model: "claude-sonnet-4-5",
        allowedTools: [],
        systemPrompt: "You are a precise, careful e-commerce auditor. You never fabricate data. You respond with raw JSON only.",
      },
    })) {
      messageCount++;
      console.log("[findings] message", messageCount, "type:", message.type, message.type === "system" ? JSON.stringify(message).slice(0, 300) : "");
      if (message.type === "result" && "result" in message) {
        lastText = message.result;
      }
    }
  } catch (e) {
    console.error("[findings] query() threw after", messageCount, "messages:", e?.message, e?.stack);
    throw e;
  }
  console.log("[findings] query() finished, messages:", messageCount, "lastText length:", lastText.length);

  const jsonMatch = lastText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Agent SDK did not return parseable JSON: " + lastText.slice(0, 300));
  }
  return JSON.parse(jsonMatch[0]);
}
