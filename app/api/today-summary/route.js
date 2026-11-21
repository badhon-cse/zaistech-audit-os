// Daily-digest data endpoint: "what needs doing today" in one small payload,
// built for an external scheduled task to turn into a daily reminder message
// (email/Slack/WhatsApp/etc). Same buckets and logic as the /today page
// (bucketLeadsForToday in lib/urgency.js, over lib/outreachData.js rows):
// overdue follow-ups, follow-ups due today, and approved-but-not-contacted
// leads.
//
//   GET /api/today-summary              -> JSON { date, timeZone, counts, text, buckets }
//   GET /api/today-summary?format=text  -> just the plain-text digest
//   ?tz=<IANA zone>                     -> whose "today" to use (default
//                                          OPERATOR_TZ env var, else Asia/Dhaka)
//
// MANUAL STEP (outside this codebase): nothing calls this automatically.
// Wiring up an actual daily trigger -- e.g. a Render Cron Job that curls this
// URL and forwards the text, a Claude scheduled task, or an external
// uptime-style pinger -- has to be set up separately. The same scheduler can
// also POST /api/inbox-checks/poll a few times a day.
//
// Note: like every other route in this app, this endpoint is unauthenticated.
import { supabaseAdmin } from "../../../lib/supabase.js";
import { loadTrackerRows } from "../../../lib/outreachData.js";
import { bucketLeadsForToday, primaryFollowup, todayISO } from "../../../lib/urgency.js";

export const dynamic = "force-dynamic";

const MAX_NAMES = 10; // per bucket, to keep the message short

export async function GET(request) {
  const url = new URL(request.url);
  const timeZone = url.searchParams.get("tz") || process.env.OPERATOR_TZ || "Asia/Dhaka";
  const today = todayISO(timeZone);

  let rows;
  try {
    ({ rows } = await loadTrackerRows(supabaseAdmin()));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  const b = bucketLeadsForToday(rows, today);
  const item = (lead) => {
    const p = primaryFollowup(lead);
    return {
      id: lead.id,
      company: lead.company,
      status: lead.status,
      next_action: p.next_action,
      next_action_date: p.next_action_date,
      channel: p.channel,
    };
  };
  const buckets = {
    overdue: b.overdue.map(item),
    dueToday: b.dueToday.map(item),
    notContacted: b.notContacted.map(item),
  };
  const counts = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length]));

  const origin = process.env.PUBLIC_APP_URL || url.origin;
  const section = (title, list, describe) => {
    if (!list.length) return null;
    const shown = list.slice(0, MAX_NAMES).map((x) => `  - ${describe(x)}`);
    if (list.length > MAX_NAMES) shown.push(`  - …and ${list.length - MAX_NAMES} more`);
    return `${title} (${list.length}):\n${shown.join("\n")}`;
  };
  const followupLine = (x) =>
    [x.company, x.next_action, x.next_action_date && `due ${x.next_action_date}`].filter(Boolean).join(" — ");

  const total = counts.overdue + counts.dueToday + counts.notContacted;
  const headline = total
    ? `${counts.overdue} overdue, ${counts.dueToday} due today, ${counts.notContacted} approved but not contacted`
    : "Nothing due today.";
  const text = [
    `Zaistech Audit OS — ${today}`,
    headline,
    section("Overdue follow-ups", buckets.overdue, followupLine),
    section("Due today", buckets.dueToday, followupLine),
    section("Approved, not contacted yet", buckets.notContacted, (x) => x.company),
    total ? `Open: ${origin}/today` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (url.searchParams.get("format") === "text") {
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return Response.json({ date: today, timeZone, counts, text, buckets });
}
