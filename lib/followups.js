// Per-channel follow-up reminders (the channel_followups table -- see the
// bottom of db/schema.sql). Server-only: takes a supabaseAdmin() client.
//
// Before, leads.next_action / next_action_date was one field overwritten by
// whichever channel was logged last, so e.g. a LinkedIn touch silently
// erased the pending email follow-up. Now each (lead, channel) pair keeps
// its own reminder here, and the lead-level columns are kept in sync as a
// summary (= the earliest per-channel reminder), so anything that still
// reads leads.next_action_date keeps working.
//
// ROLLOUT SAFETY: until the channel_followups SQL has been run in Supabase,
// every query against it errors. Every helper here treats that as
// "per-channel follow-ups unavailable" and returns { available: false }
// instead of throwing, so callers fall back to the old lead-level-only
// behavior.
import { primaryFollowup } from "./urgency.js";

const TABLE = "channel_followups";

function unavailable(error) {
  console.warn(`[followups] ${TABLE} unavailable (has the migration in db/schema.sql been run?):`, error?.message);
  return { available: false, error };
}

// All per-channel follow-ups, grouped by lead_id. Pass leadIds to restrict.
export async function loadFollowups(db, leadIds) {
  let q = db.from(TABLE).select("lead_id, channel, step, next_action, next_action_date, updated_at");
  if (leadIds) q = q.in("lead_id", leadIds);
  const { data, error } = await q;
  if (error) return { ...unavailable(error), byLead: {} };
  const byLead = {};
  for (const row of data || []) (byLead[row.lead_id] ||= []).push(row);
  return { available: true, byLead };
}

// step is optional: when omitted (a manual edit from the tracker), an
// existing row keeps its recorded cadence step.
export async function upsertChannelFollowup(db, leadId, channel, { step, next_action = null, next_action_date = null }) {
  const row = { lead_id: leadId, channel, next_action, next_action_date, updated_at: new Date().toISOString() };
  if (step !== undefined) row.step = step;
  const { error } = await db.from(TABLE).upsert(row, { onConflict: "lead_id,channel" });
  if (error) return unavailable(error);
  return { available: true };
}

export async function deleteChannelFollowup(db, leadId, channel) {
  const { error } = await db.from(TABLE).delete().eq("lead_id", leadId).eq("channel", channel);
  if (error) return unavailable(error);
  return { available: true };
}

// Used when a lead reaches replied/won/lost: no follow-up is due on any channel.
export async function clearLeadFollowups(db, leadId) {
  const { error } = await db.from(TABLE).delete().eq("lead_id", leadId);
  if (error) return unavailable(error);
  return { available: true };
}

// The lead-level summary implied by this lead's per-channel follow-ups:
// { next_action, next_action_date } of the earliest one (next_action gets a
// "(Channel)" suffix so the lead-level text still says which channel), or
// both null if there are none. Returns null if the table is unavailable --
// the caller should then leave the lead-level columns to the old logic.
export async function leadSummaryFromFollowups(db, leadId) {
  const { available, byLead } = await loadFollowups(db, [leadId]);
  if (!available) return null;
  const p = primaryFollowup({ followups: byLead[leadId] || [] });
  if (!p.channel) return { next_action: null, next_action_date: null };
  return {
    next_action: p.next_action ? `${p.next_action} (${p.channel})` : null,
    next_action_date: p.next_action_date,
  };
}
