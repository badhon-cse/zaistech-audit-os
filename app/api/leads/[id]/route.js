import { supabaseAdmin } from "../../../../lib/supabase.js";
import { clearLeadFollowups } from "../../../../lib/followups.js";
import { isValidTimezone } from "../../../../lib/sendTiming.js";

export async function GET(_request, { params }) {
  const db = supabaseAdmin();
  const { id } = params;

  const { data: lead, error: leadErr } = await db.from("leads").select("*").eq("id", id).single();
  if (leadErr || !lead) return Response.json({ error: "Not found" }, { status: 404 });

  // Only the latest audit is needed -- each audit row carries the full raw
  // scan JSON, so fetching every historical audit was wasted bandwidth.
  const { data: audits } = await db
    .from("audits")
    .select("*")
    .eq("lead_id", id)
    .order("run_at", { ascending: false })
    .limit(1);

  const latest = audits?.[0] || null;
  let findings = [], strengths = [], metrics = [], inboxChecks = [];
  if (latest) {
    [findings, strengths, metrics, inboxChecks] = await Promise.all([
      db.from("findings").select("*").eq("audit_id", latest.id).order("priority").then((r) => r.data || []),
      db.from("strengths").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
      db.from("metrics").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
      db.from("inbox_checks").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
    ]);
  }

  const { data: outreach } = await db
    .from("outreach")
    .select("*")
    .eq("lead_id", id)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  return Response.json({ lead, audits, latestAudit: latest, findings, strengths, metrics, inboxChecks, outreach: outreach || [] });
}

const NO_FOLLOWUP_STATUSES = ["replied", "won", "lost"];
// Must match the next_action text runAudit() sets in lib/audit.js.
const REVIEW_REMINDER = "Review AI findings and approve";

// Only these fields may be changed via PATCH -- everything else in the body
// is ignored (so a client can't overwrite domain, created_at, id, etc).
// These are the fields the UI actually sends (app/outreach/page.js and
// app/lead/[id]/page.js).
const PATCHABLE_FIELDS = ["status", "next_action", "next_action_date", "timezone"];
const VALID_STATUSES = ["new", "auditing", "needs_review", "audited", "demo_ready", "outreach_sent", "replied", "won", "lost", "failed"];

export async function PATCH(request, { params }) {
  const db = supabaseAdmin();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const patch = {};
  for (const key of PATCHABLE_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) {
    return Response.json({ error: "No updatable fields provided (allowed: " + PATCHABLE_FIELDS.join(", ") + ")" }, { status: 400 });
  }
  if (patch.status !== undefined && !VALID_STATUSES.includes(patch.status)) {
    return Response.json({ error: "Invalid status: " + patch.status }, { status: 400 });
  }
  if (patch.next_action !== undefined && patch.next_action !== null && typeof patch.next_action !== "string") {
    return Response.json({ error: "next_action must be a string or null" }, { status: 400 });
  }
  if (patch.next_action_date !== undefined && patch.next_action_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(patch.next_action_date)) {
    return Response.json({ error: "next_action_date must be YYYY-MM-DD or null" }, { status: 400 });
  }
  if (patch.timezone !== undefined && patch.timezone !== null && !isValidTimezone(patch.timezone)) {
    return Response.json({ error: "timezone must be a valid IANA zone id (e.g. America/Los_Angeles) or null" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  // Setting the outcome to replied/won/lost means no follow-up is due
  // anymore -- clear it from the tracker unless the caller explicitly set
  // next_action themselves in this same request.
  if (body.status && NO_FOLLOWUP_STATUSES.includes(body.status) && body.next_action_date === undefined) {
    patch.next_action = null;
    patch.next_action_date = null;
    // ...and every per-channel reminder too (no-op if that table doesn't
    // exist yet -- see lib/followups.js).
    await clearLeadFollowups(db, params.id);
  }

  // Approving an audit completes the "Review AI findings and approve"
  // reminder that runAudit() (lib/audit.js) set -- clear it so it doesn't
  // linger on the tracker as an ever-more-overdue follow-up.
  if (patch.status === "audited" && body.next_action === undefined && body.next_action_date === undefined) {
    const { data: current } = await db.from("leads").select("next_action").eq("id", params.id).single();
    if (current?.next_action === REVIEW_REMINDER) {
      patch.next_action = null;
      patch.next_action_date = null;
    }
  }

  const { data, error } = await db.from("leads").update(patch).eq("id", params.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lead: data });
}
