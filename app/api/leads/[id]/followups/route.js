import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { upsertChannelFollowup, deleteChannelFollowup, leadSummaryFromFollowups } from "../../../../../lib/followups.js";

// Edit one channel's follow-up reminder for a lead (the per-channel
// "Next action / Due" shown on the outreach tracker). Body:
//   { channel: string, next_action: string|null, next_action_date: "YYYY-MM-DD"|null }
// Clearing both fields removes that channel's reminder. The lead-level
// next_action/next_action_date summary is re-synced afterward.
export async function PATCH(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const { channel, next_action = null, next_action_date = null } = body;
  if (typeof channel !== "string" || !channel.trim()) {
    return Response.json({ error: "channel is required" }, { status: 400 });
  }
  if (next_action !== null && typeof next_action !== "string") {
    return Response.json({ error: "next_action must be a string or null" }, { status: 400 });
  }
  if (next_action_date !== null && (typeof next_action_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(next_action_date))) {
    return Response.json({ error: "next_action_date must be YYYY-MM-DD or null" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const result = next_action || next_action_date
    ? await upsertChannelFollowup(db, params.id, channel, { next_action: next_action || null, next_action_date })
    : await deleteChannelFollowup(db, params.id, channel);
  if (!result.available) {
    return Response.json(
      { error: "Per-channel follow-ups aren't set up yet (run the channel_followups SQL from db/schema.sql in Supabase): " + (result.error?.message || "") },
      { status: 503 }
    );
  }

  const summary = await leadSummaryFromFollowups(db, params.id);
  if (summary) {
    const { error } = await db
      .from("leads")
      .update({ ...summary, updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, summary });
}
