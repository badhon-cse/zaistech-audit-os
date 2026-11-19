import { supabaseAdmin } from "../../../lib/supabase.js";

// One call, whole pipeline's outreach state: every lead plus its outreach
// history and current next_action/next_action_date -- the data behind the
// /outreach tracker page. Small-scale (a few hundred leads at most), so
// doing the join in JS rather than a Postgres function is fine.
export async function GET() {
  const db = supabaseAdmin();

  const [{ data: leads, error: leadsErr }, { data: outreach, error: outreachErr }] = await Promise.all([
    db
      .from("leads")
      .select("id, company, first_name, last_name, title, domain, status, next_action, next_action_date"),
    db
      .from("outreach")
      .select("id, lead_id, channel, step, status, sent_at")
      .order("sent_at", { ascending: false, nullsFirst: false }),
  ]);

  if (leadsErr) return Response.json({ error: leadsErr.message }, { status: 500 });
  if (outreachErr) return Response.json({ error: outreachErr.message }, { status: 500 });

  const touchesByLead = {};
  for (const o of outreach || []) {
    (touchesByLead[o.lead_id] ||= []).push(o);
  }

  const rows = (leads || []).map((lead) => {
    const touches = touchesByLead[lead.id] || [];
    return {
      ...lead,
      touchCount: touches.length,
      lastTouch: touches[0] || null,
      channelsUsed: [...new Set(touches.map((t) => t.channel))],
    };
  });

  return Response.json({ leads: rows });
}
