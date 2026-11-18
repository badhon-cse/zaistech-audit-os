// Turns a lead's audit findings into ready-to-send outreach copy, following
// the rulebook's §7 "Output format" rules exactly (word counts, subject line
// style, tone, CTA rules) -- same Agent SDK pattern as lib/findings.js.
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function writeOutreach({ lead, findings, strengths, demoExists, rulebookText }) {
  const prompt = `You write cold outreach for Zaistech, following the attached rulebook's
"Output format" section (§7) EXACTLY -- word counts, subject line style, tone, CTA rules,
and the "Writing rules" at the end of that section. This lead has already been audited;
below are the real findings and strengths from that audit. Do not invent anything not in
this data -- every claim must trace back to a finding below, using "when I checked"
phrasing for our own observations, per the rulebook's writing rules.

Pick the top 2-3 findings to lead with per §5's prioritization (concrete+specific,
revenue impact, maps to a Zaistech service, easy to verify in 10 seconds) -- match the
angle to the lead's title per §5's title-matching guidance.

Return ONLY JSON with this exact shape, nothing else:
{
  "email": {
    "subject": "...",
    "body": "...",
    "followUp1": "...",
    "followUp2": "..."
  },
  "linkedin": {
    "connectionNote": "...",
    "message": "..."
  },
  "instagram": {
    "dm": "..."
  }
}

=== RULEBOOK (follow §7 Output format and its Writing rules exactly) ===
${rulebookText}

=== LEAD ===
${JSON.stringify(lead, null, 2)}

=== FINDINGS (ranked, priority 1 = strongest) ===
${JSON.stringify(findings, null, 2)}

=== STRENGTHS (things the site already does well -- use for the sincere opening note / email line 1 flavor if it fits naturally, never forced) ===
${JSON.stringify(strengths, null, 2)}

=== DEMO STATUS ===
${demoExists ? "A personalized demo already exists for this lead -- per the rulebook, the soft CTA should offer to send it on reply, not push it in the first cold email." : "No demo built yet -- CTA should be the free 3-min audit video walkthrough offer, per the rulebook's default CTA."}
`;

  let resultText = "";
  for await (const msg of query({
    prompt,
    options: { permissionMode: "bypassPermissions", maxTurns: 1 },
  })) {
    if (msg.type === "result" && msg.subtype === "success") resultText = msg.result;
  }

  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse outreach response as JSON");
  return JSON.parse(jsonMatch[0]);
}
