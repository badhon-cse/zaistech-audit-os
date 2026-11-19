import { supabaseAdmin } from "../../../../../lib/supabase.js";

// Follow-up cadence -- used to auto-suggest the lead's
// next_action/next_action_date whenever a real (non-draft) touch is logged,
// so the outreach tracker always shows when someone is due for a follow-up
// without the user having to work it out by hand. Always editable afterward
// on the tracker page.
//
// This is relationship-building, not bulk sequencing: few touches, spaced
// out, each one meant to read as a person following up rather than a
// sequence firing. Email follows db/rulebook.md §7 (day 3, day 7, then a
// long gap). LinkedIn and Instagram/FB are their own, slightly slower
// cadences -- those are conversational channels where a quick second and
// third touch reads as pushy, so they get more room between touches than a
// cold email follow-up would. After the last scripted touch, the lead goes
// to a single long-out "revisit" with no further auto-step -- continuing
// after that is a deliberate human decision, not an autopilot continuation.
const CHANNEL_CADENCE = {
  Email: {
    first: { step: "follow_up_1", label: "Follow up with a different finding", daysOut: 3 },
    follow_up_1: { step: "follow_up_2", label: "Send the breakup-style follow-up (keep the door open)", daysOut: 4 },
    follow_up_2: { step: "revisit", label: "Revisit — reach out again if the timing looks better", daysOut: 45 },
  },
  "LinkedIn DM": {
    first: { step: "follow_up_1", label: "Send a second note with one more finding", daysOut: 4 },
    follow_up_1: { step: "follow_up_2", label: "Send a warm last check-in", daysOut: 10 },
    follow_up_2: { step: "revisit", label: "Revisit — reconnect in a few weeks", daysOut: 45 },
  },
  "Instagram DM": {
    first: { step: "follow_up_1", label: "Send a quick, friendly follow-up", daysOut: 4 },
    follow_up_1: { step: "follow_up_2", label: "Send a warm last check-in", daysOut: 10 },
    follow_up_2: { step: "revisit", label: "Revisit — reach out again later", daysOut: 45 },
  },
  "Facebook DM": {
    first: { step: "follow_up_1", label: "Send a quick, friendly follow-up", daysOut: 4 },
    follow_up_1: { step: "follow_up_2", label: "Send a warm last check-in", daysOut: 10 },
    follow_up_2: { step: "revisit", label: "Revisit — reach out again later", daysOut: 45 },
  },
  WhatsApp: {
    first: { step: "follow_up_1", label: "Send a quick, friendly follow-up", daysOut: 3 },
    follow_up_1: { step: "follow_up_2", label: "Send a warm last check-in", daysOut: 7 },
    follow_up_2: { step: "revisit", label: "Revisit — reach out again later", daysOut: 30 },
  },
};
// "Other", or anything not listed above, follows the email pace -- the
// slowest, most deliberate one -- rather than assuming it can move fast.
const DEFAULT_CADENCE = CHANNEL_CADENCE.Email;

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
  const FORWARD_FROM = ["new", "auditing", "failed", "needs_review", "audited", "demo_ready"];
  const leadPatch = { updated_at: new Date().toISOString() };
  if (row.status !== "draft" && lead && FORWARD_FROM.includes(lead.status)) {
    leadPatch.status = "outreach_sent";
  }

  // Auto-suggest the next follow-up so the tracker always has a due date --
  // but never for a draft (nothing was actually sent), and never for a lead
  // that's already replied/won/lost (no follow-up needed).
  const STOP_STATUSES = ["replied", "won", "lost"];
  if (row.status !== "draft" && !(lead && STOP_STATUSES.includes(lead.status))) {
    const cadence = CHANNEL_CADENCE[channel] || DEFAULT_CADENCE;
    const next = cadence[row.step];
    if (next) {
      // Stored as a plain UTC calendar date (YYYY-MM-DD). The server has no
      // idea of the operator's timezone; the tracker page compares this
      // against the viewer's *local* date (see todayISO in
      // app/outreach/page.js), so near midnight it can be off by one day
      // at most, which is fine for a follow-up reminder.
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
