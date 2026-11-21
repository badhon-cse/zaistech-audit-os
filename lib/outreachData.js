// Server-only: the whole pipeline's outreach state in one pass -- every lead
// plus its outreach-touch summary and per-channel follow-ups. Shared by
// /api/outreach-tracker (the /outreach and /today pages) and
// /api/today-summary (the daily-digest endpoint), so both always agree.
// Small-scale (a few hundred leads at most), so the join is done in JS.
import { loadFollowups } from "./followups.js";

export async function loadTrackerRows(db) {
  const [{ data: leads, error: leadsErr }, { data: outreach, error: outreachErr }, followups] = await Promise.all([
    db
      .from("leads")
      .select("id, company, first_name, last_name, title, domain, status, next_action, next_action_date, timezone, country, updated_at"),
    db
      .from("outreach")
      .select("id, lead_id, channel, step, status, sent_at")
      .order("sent_at", { ascending: false, nullsFirst: false }),
    loadFollowups(db),
  ]);

  if (leadsErr) throw new Error(leadsErr.message);
  if (outreachErr) throw new Error(outreachErr.message);

  const touchesByLead = {};
  for (const o of outreach || []) {
    (touchesByLead[o.lead_id] ||= []).push(o);
  }

  const rows = (leads || []).map((lead) => {
    const touches = touchesByLead[lead.id] || [];
    return {
      ...lead,
      touchCount: touches.length, // includes drafts
      sentCount: touches.filter((t) => t.status !== "draft").length, // real touches only
      lastTouch: touches[0] || null,
      channelsUsed: [...new Set(touches.map((t) => t.channel))],
      // Per-channel follow-ups (empty when the channel_followups table
      // doesn't exist yet -- the UI then falls back to next_action/_date).
      followups: followups.byLead[lead.id] || [],
    };
  });

  return { rows, followupsAvailable: followups.available };
}
