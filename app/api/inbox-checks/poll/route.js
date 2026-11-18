// Checks the dedicated test inbox (see lib/mailbox.js) for every inbox_checks
// row that's past its due_at and still unconfirmed, and finalizes a real
// verdict (good/weak/missing) instead of the heuristic "unconfirmed" scanSite()
// leaves behind. Safe to call anytime, including before the mailbox is
// configured -- it just reports that and does nothing.
//
// Call this on a schedule (e.g. a Claude scheduled task hitting this URL a
// few times a day) once AUDIT_INBOX_EMAIL / AUDIT_INBOX_APP_PASSWORD are set.
import { supabaseAdmin } from "../../../../lib/supabase.js";
import { isMailboxConfigured, findEmailsForLead } from "../../../../lib/mailbox.js";

export async function POST() {
  if (!isMailboxConfigured()) {
    return Response.json({
      ok: false,
      reason: "Mailbox not configured yet -- set AUDIT_INBOX_EMAIL and AUDIT_INBOX_APP_PASSWORD in Render's environment variables first.",
    });
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from("inbox_checks")
    .select("id, audit_id, kind, triggered_at, due_at, audits(lead_id)")
    .eq("verdict", "unconfirmed_pending") // only rows a live shopper-test actually triggered (see trigger route) -- not the plain heuristic-only "unconfirmed" from scanSite
    .lte("due_at", now);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const check of due || []) {
    const leadId = check.audits?.lead_id;
    if (!leadId) continue;

    const found = await findEmailsForLead(leadId, new Date(check.triggered_at));
    if (!found.ok) {
      results.push({ id: check.id, error: found.reason });
      continue;
    }

    const verdict = found.messages.length > 0 ? "good" : "missing";
    const note =
      found.messages.length > 0
        ? `Found ${found.messages.length} matching email(s), e.g. "${found.messages[0].subject}" from ${found.messages[0].from}.`
        : `No ${check.kind === "welcome" ? "welcome" : "abandoned-cart"} email arrived by the deadline -- real evidence it's missing, not a guess.`;

    await db
      .from("inbox_checks")
      .update({ verdict, result: { ...found, note, polled_at: now } })
      .eq("id", check.id);

    results.push({ id: check.id, kind: check.kind, verdict, note });
  }

  return Response.json({ ok: true, checked: results.length, results });
}
