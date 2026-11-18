// Self-improvement loop for the rulebook/knowledge-base. Looks at leads that
// reached a real outcome (lead.status is replied/won/lost), plus findings a
// human removed before approving (findings.included=false -- a "this was
// weak" signal even before an outcome exists), and asks the Agent SDK to
// propose surgical edits to the live rulebook text -- sharpen what's working,
// cut what's being ignored or getting rejected. Never applied automatically;
// writes a `rulebook_proposals` row for a human to approve/reject.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { supabaseAdmin } from "./supabase.js";

// Don't bother running this on noise -- wait for a real sample size.
export const MIN_OUTCOME_LEADS = 8;

const TERMINAL_STATUSES = ["replied", "won", "lost"];

export async function collectOutcomeEvidence() {
  const db = supabaseAdmin();

  const { data: leads } = await db
    .from("leads")
    .select("id, company, domain, status, industry")
    .in("status", TERMINAL_STATUSES);

  const evidence = [];
  for (const lead of leads || []) {
    const { data: audits } = await db
      .from("audits")
      .select("id, run_at")
      .eq("lead_id", lead.id)
      .order("run_at", { ascending: false })
      .limit(1);
    const audit = audits?.[0];
    if (!audit) continue;

    const { data: findings } = await db
      .from("findings")
      .select("area, what, where_, why, fix, service, priority, included, source")
      .eq("audit_id", audit.id)
      .order("priority");

    const { data: outreach } = await db
      .from("outreach")
      .select("channel, step, subject, status")
      .eq("lead_id", lead.id)
      .order("sent_at", { ascending: true });

    evidence.push({
      lead_id: lead.id,
      company: lead.company,
      industry: lead.industry || null,
      outcome: lead.status, // replied | won | lost
      findings: (findings || []).map((f) => ({
        area: f.area,
        what: f.what,
        where: f.where_,
        why: f.why,
        service: f.service,
        priority: f.priority,
        kept: f.included !== false, // false = a human pulled this before sending -- weak-finding signal
        edited_by_human: f.source === "user",
      })),
      // Which channel(s)/how many touches it took to reach this outcome --
      // not something the rulebook text itself controls, but useful context
      // for judging whether a finding "worked" (e.g. a lead that replied
      // after one email touch is stronger evidence than one that only
      // replied after 3 touches across every channel).
      outreach_touches: (outreach || []).map((o) => ({ channel: o.channel, step: o.step, status: o.status })),
    });
  }
  return evidence;
}

export async function generateProposal() {
  const db = supabaseAdmin();
  const evidence = await collectOutcomeEvidence();

  if (evidence.length < MIN_OUTCOME_LEADS) {
    return {
      ok: false,
      reason: `Only ${evidence.length} leads have a terminal outcome (replied/won/lost) so far -- need at least ${MIN_OUTCOME_LEADS} before a proposal would be based on a real pattern instead of noise. Mark more leads' outcomes on their lead page first.`,
    };
  }

  const { data: versions } = await db
    .from("rulebook_versions")
    .select("version, text")
    .order("created_at", { ascending: false })
    .limit(1);
  const current = versions?.[0];
  if (!current) return { ok: false, reason: "No live rulebook found to improve -- seed it first via /api/rulebook/seed." };

  const wonOrReplied = evidence.filter((e) => e.outcome === "won" || e.outcome === "replied");
  const lost = evidence.filter((e) => e.outcome === "lost");
  const removedFindings = evidence.flatMap((e) =>
    e.findings.filter((f) => !f.kept).map((f) => ({ company: e.company, ...f }))
  );

  const prompt = `You improve Zaistech's e-commerce site-audit rulebook based on real outcomes,
not guesses. Below is the CURRENT live rulebook+knowledge-base text, followed by
evidence from real leads this was used on: which findings were written, whether a
human kept or pulled each finding before it went out (a pulled finding is a direct
signal that finding was weak/wrong even before any outreach happened), which
channel(s) outreach actually went out on and how many touches it took
(outreach_touches), and what ultimately happened with that lead (won = became a
client, replied = responded to outreach, lost = no response / went cold /
explicitly said no). Treat a reply after one touch as stronger evidence a
finding/approach worked than a reply that only came after several touches across
multiple channels.

YOUR JOB: propose SURGICAL edits to the rulebook text -- not a rewrite. Keep
everything that isn't contradicted by the evidence. Look for real patterns across
MULTIPLE leads, not a single data point (one lost lead with a speed finding does not
mean "stop writing speed findings" -- that needs to show up repeatedly, or be absent
across most won/replied leads, to be worth acting on). Concretely:
  - Finding areas/patterns that show up disproportionately often in won/replied
    leads -- the rulebook should tell the AI to look harder for these.
  - Finding areas/patterns that show up disproportionately often in pulled findings
    or lost leads with nothing else going for them -- the rulebook should warn
    against leading with these, or tighten the bar for when they count as "real."
  - Wording/framing patterns in the "why" of kept vs pulled findings that suggest
    what makes a finding land vs read as filler.
If the evidence doesn't clearly support a change, don't invent one -- a proposal
with 2-3 well-evidenced edits beats one with 10 speculative ones. If NOTHING in the
evidence is strong enough to act on yet, say so plainly in the summary and return
the rulebook text UNCHANGED.

Return your answer as JSON with this exact shape, nothing else:
{
  "changed": true|false,
  "summary": "2-5 sentence plain-English summary of what you changed and why, citing the pattern (e.g. '4 of 6 won leads had a checkout-abandonment finding as priority 1; 3 of 4 lost leads had their top finding be a vague SEO note that got pulled before sending -- tightened the SEO section's bar for what counts as a real finding.')",
  "proposed_text": "the FULL rulebook+knowledge-base text with your edits applied, ready to replace the current version as-is"
}

=== CURRENT RULEBOOK + KNOWLEDGE BASE (version ${current.version}) ===
${current.text}

=== EVIDENCE: ${wonOrReplied.length} won/replied leads, ${lost.length} lost leads, ${removedFindings.length} findings pulled by a human before sending ===
${JSON.stringify(evidence, null, 2)}
`;

  let resultText = "";
  for await (const msg of query({
    prompt,
    options: { permissionMode: "bypassPermissions", maxTurns: 1 },
  })) {
    if (msg.type === "result" && msg.subtype === "success") resultText = msg.result;
  }

  let parsed;
  try {
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
  } catch (e) {
    return { ok: false, reason: "Could not parse the AI's proposal response: " + e.message };
  }

  if (!parsed.changed) {
    return { ok: false, reason: "AI reviewed the evidence and found nothing strong enough to act on yet: " + parsed.summary };
  }

  const { data: proposal, error } = await db
    .from("rulebook_proposals")
    .insert({
      status: "pending",
      based_on_version: current.version,
      proposed_text: parsed.proposed_text,
      summary: parsed.summary,
      evidence: evidence.map((e) => ({ lead_id: e.lead_id, company: e.company, outcome: e.outcome })),
      lead_count: evidence.length,
    })
    .select()
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, proposal };
}

export async function approveProposal(proposalId, reviewedBy) {
  const db = supabaseAdmin();
  const { data: proposal, error: fetchErr } = await db
    .from("rulebook_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();
  if (fetchErr || !proposal) return { ok: false, reason: "Proposal not found" };
  if (proposal.status !== "pending") return { ok: false, reason: `Proposal already ${proposal.status}` };

  const version = new Date().toISOString().slice(0, 10) + "-selfimprove-" + Math.random().toString(36).slice(2, 6);
  const { error: insertErr } = await db.from("rulebook_versions").insert({
    version,
    text: proposal.proposed_text,
    changed_by: reviewedBy || "self-improvement loop",
    change_note: "Approved proposal " + proposal.id + ": " + (proposal.summary || "").slice(0, 300),
  });
  if (insertErr) return { ok: false, reason: insertErr.message };

  await db
    .from("rulebook_proposals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy || null, applied_version: version })
    .eq("id", proposalId);

  return { ok: true, version };
}

export async function rejectProposal(proposalId, reviewedBy, note) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("rulebook_proposals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy || null, review_note: note || null })
    .eq("id", proposalId)
    .eq("status", "pending");
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
