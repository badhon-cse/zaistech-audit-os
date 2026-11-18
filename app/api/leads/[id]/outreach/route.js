import { supabaseAdmin } from "../../../../../lib/supabase.js";

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
  if (row.status !== "draft" && lead && FORWARD_FROM.includes(lead.status)) {
    await db.from("leads").update({ status: "outreach_sent", updated_at: new Date().toISOString() }).eq("id", params.id);
  }

  return Response.json({ outreach: data });
}
