// Records that a real welcome-signup or add-to-cart-then-abandon test was
// just run on this lead's live site (by a human, or by Claude driving a
// browser -- see lib/mailbox.js's header comment: Render's own 512MB
// instance can't reliably run a real browser, so that step happens outside
// it, and calls this endpoint afterward to log what it did). Sets due_at so
// /api/inbox-checks/poll knows when it's fair to check for the email.
import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { testEmailForLead, isMailboxConfigured } from "../../../../../lib/mailbox.js";

const DUE_AFTER_MS = { welcome: 30 * 60 * 1000, abandoned_cart: 26 * 60 * 60 * 1000 };

export async function GET(_request, { params }) {
  // Convenience lookup: what test email to use for this lead's signup/cart test.
  if (!isMailboxConfigured()) {
    return Response.json({ configured: false, reason: "AUDIT_INBOX_EMAIL / AUDIT_INBOX_APP_PASSWORD not set yet." });
  }
  return Response.json({ configured: true, testEmail: testEmailForLead(params.id) });
}

export async function POST(request, { params }) {
  const db = supabaseAdmin();
  const body = await request.json();
  const kind = body.kind === "abandoned_cart" ? "abandoned_cart" : "welcome";

  const { data: audits } = await db
    .from("audits")
    .select("id")
    .eq("lead_id", params.id)
    .order("run_at", { ascending: false })
    .limit(1);
  const audit = audits?.[0];
  if (!audit) return Response.json({ error: "No audit found for this lead yet -- run an audit first." }, { status: 400 });

  const now = new Date();
  const dueAt = new Date(now.getTime() + DUE_AFTER_MS[kind]);

  const { data: existing } = await db
    .from("inbox_checks")
    .select("id")
    .eq("audit_id", audit.id)
    .eq("kind", kind)
    .limit(1);

  const patch = {
    triggered_at: now.toISOString(),
    due_at: dueAt.toISOString(),
    verdict: "unconfirmed_pending", // picked up by /api/inbox-checks/poll once due
  };

  let row;
  if (existing?.[0]) {
    const { data, error } = await db.from("inbox_checks").update(patch).eq("id", existing[0].id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    row = data;
  } else {
    const { data, error } = await db
      .from("inbox_checks")
      .insert({ audit_id: audit.id, kind, ...patch })
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    row = data;
  }

  return Response.json({ ok: true, inboxCheck: row, dueAt: dueAt.toISOString() });
}
