import { supabaseAdmin } from "../../../../lib/supabase.js";
import { clearLeadFollowups } from "../../../../lib/followups.js";

export async function PATCH(request, { params }) {
  const db = supabaseAdmin();
  const body = await request.json();
  const patch = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === "sent" && !body.sent_at) patch.sent_at = new Date().toISOString();
  }
  if (body.sent_at) patch.sent_at = body.sent_at;

  const { data, error } = await db.from("outreach").update(patch).eq("id", params.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // A reply means no follow-up is due anymore -- clear it from the tracker,
  // and bump the lead's own status to replied so it shows up that way too
  // (unless it's already further along, e.g. won).
  if (body.status === "replied" && data?.lead_id) {
    const { data: lead } = await db.from("leads").select("status").eq("id", data.lead_id).single();
    const leadPatch = { next_action: null, next_action_date: null, updated_at: new Date().toISOString() };
    if (lead && !["won", "lost"].includes(lead.status)) leadPatch.status = "replied";
    await db.from("leads").update(leadPatch).eq("id", data.lead_id);
    await clearLeadFollowups(db, data.lead_id); // per-channel reminders too (no-op before migration)
  }

  return Response.json({ outreach: data });
}

export async function DELETE(_request, { params }) {
  const db = supabaseAdmin();
  const { error } = await db.from("outreach").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
