import { supabaseAdmin } from "../../../../../lib/supabase.js";

// Follow-up cadence per db/rulebook.md §7 (day 3, day 7) -- used to
// auto-suggest the lead's next_action/next_action_date whenever a real
// (non-draft) touch is logged, so the outreach tracker always shows when
// someone is due for a follow-up without the user having to work it out by
// hand. Always editable afterward on the tracker page.
const NEXT_STEP = {
  first: { step: "follow_up_1", label: "Send follow-up 1", daysOut: 3 },
  follow_up_1: { step: "follow_up_2", label: "Send follow-up 2", daysOut: 4 },
  follow_up_2: { step: "follow_up_3", label: "Decide: revisit in a month or move on", daysOut: 30 },
};

export async function GET(_request, { params }) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("outreach")
    .select("*")
    .eq("lead_id", params.id)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ outreach: data });
}

export async function POST(request, { params }) {
  const db = supabaseAdmin();
  const body = await request.json();
  const { channel, step, subject, body: messageBody, status } = body;

  if (!channel || !messageBody) {
    return Response.json({ error: "channel and body are required" }, { status: 400 });
  }

  const row = {
    lead_id: params.id,
    channel,
    step: step || "first",
    subject: subject || null,
    body: messageBody,
    status: status || "sent",
    sent_at: (status || "sent") === "draft" ? null : new Date().toISOString(),
  };

  const { data, error } = await db.from("outreach").insert(row).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Logging a real (non-draft) outreach touch is a useful implicit status bump --
  // only move the lead forward, never backward (e.g. don't downgrade a lead
  // that's already replied/won/lost just because an older touch got logged).
  const { data: lead } = await db.from("leads").select("status").eq("id", params.id).single();
  const FORWARD_FROM = ["new", "auditing", "needs_review", "audited", "demo_ready"];
  const leadPatch = { updated_at: new Date().toISOString() };
  if (row.status !== "draft" && lead && FORWARD_FROM.includes(lead.status)) {
    leadPatch.status = "outreach_sent";
  }

  // Auto-suggest the next follow-up so the tracker always has a due date --
  // but never for a draft (nothing was actually sent), and never for a lead
  // that's already replied/won/lost (no follow-up needed).
  const STOP_STATUSES = ["replied", "won", "lost"];
  if (row.status !== "draft" && !(lead && STOP_STATUSES.includes(lead.status))) {
    const next = NEXT_STEP[row.step];
    if (next) {
      const dueDate = new Date(Date.now() + next.daysOut * 24 * 60 * 60 * 1000);
      leadPatch.next_action = `${next.label} (${channel})`;
      leadPatch.next_action_date = dueDate.toISOString().slice(0, 10);
    } else {
      leadPatch.next_action = null;
      leadPatch.next_action_date = null;
    }
  }
  await db.from("leads").update(leadPatch).eq("id", params.id);

  return Response.json({ outreach: data });
}
