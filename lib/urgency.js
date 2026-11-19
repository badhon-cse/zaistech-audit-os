// Shared follow-up urgency / due-date helpers. Plain JS with no server-only
// imports, so it's safe to use from client pages (app/outreach, app/today)
// AND server routes (app/api/today-summary).
//
// Dates are plain calendar dates (YYYY-MM-DD), compared as strings.

// Today's date as YYYY-MM-DD.
//  - No argument: the *runtime's local timezone*. In the browser that's the
//    operator's calendar day (Bangladesh, UTC+6) -- toISOString() would give
//    UTC's date, which is still "yesterday" for the first 6 hours of every
//    local day.
//  - With an IANA timeZone (e.g. "Asia/Dhaka"): that zone's calendar day.
//    Server routes use this, since the server itself runs in UTC.
export function todayISO(timeZone) {
  if (timeZone) {
    try {
      // en-CA formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch {
      // Unknown zone name -- fall through to runtime-local.
    }
  }
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "overdue" | "today" | "upcoming" | null (no date).
export function urgency(dateStr, today = todayISO()) {
  if (!dateStr) return null;
  if (dateStr < today) return "overdue";
  if (dateStr === today) return "today";
  return "upcoming";
}

export const URGENCY_STYLE = {
  overdue: { bg: "#fdecec", fg: "#b42318", label: "Overdue" },
  today: { bg: "#fef3e2", fg: "#9a6700", label: "Due today" },
  upcoming: { bg: "#eef2ff", fg: "#4338ca", label: "Upcoming" },
};

export const URGENCY_ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3 };

// The one follow-up a lead's row should show as "Next action / Due".
//
// Each channel keeps its own follow-up (lead.followups, from the
// channel_followups table) so a touch on a second channel no longer erases
// the first channel's reminder. The primary is the earliest-dated one; if
// none has a date, the first one with an action. If the lead has no
// per-channel follow-ups at all (e.g. before the channel_followups migration
// has been run, or for a manually-set reminder), fall back to the lead-level
// next_action / next_action_date columns.
//
// Returns { channel, next_action, next_action_date } -- channel is null for
// the lead-level fallback.
export function primaryFollowup(lead) {
  const list = (lead?.followups || []).filter((f) => f.next_action_date || f.next_action);
  if (list.length) {
    const dated = list.filter((f) => f.next_action_date).sort((a, b) => a.next_action_date.localeCompare(b.next_action_date));
    const f = dated[0] || list[0];
    return { channel: f.channel, next_action: f.next_action || null, next_action_date: f.next_action_date || null };
  }
  return { channel: null, next_action: lead?.next_action || null, next_action_date: lead?.next_action_date || null };
}

// Sorts by urgency bucket, then by due date (earliest first).
export function compareByDue(a, b, today = todayISO()) {
  const da = primaryFollowup(a).next_action_date;
  const db = primaryFollowup(b).next_action_date;
  const ua = URGENCY_ORDER[urgency(da, today) || "none"];
  const ub = URGENCY_ORDER[urgency(db, today) || "none"];
  if (ua !== ub) return ua - ub;
  if (da && db) return da.localeCompare(db);
  return 0;
}

// Statuses meaning "audit approved, ready for outreach".
export const READY_FOR_OUTREACH_STATUSES = ["audited", "demo_ready"];

// Splits tracker rows (see lib/outreachData.js) into the "Today" buckets,
// most urgent first. Each lead lands in at most one bucket, so nothing is
// listed twice:
//   needsReview  -- status needs_review: audited, waiting for a human to
//                   review/approve findings. Always goes here (the audit also
//                   sets a lead-level "Review AI findings and approve"
//                   reminder; the review IS that task, so it's not repeated
//                   under overdue/due today).
//   notContacted -- audit approved (audited/demo_ready) but no real
//                   (non-draft) touch sent yet. Always goes here too.
//   overdue      -- any other lead whose primary follow-up is before today
//   dueToday     -- any other lead whose primary follow-up is today
// Won/lost leads are skipped: nothing left to do for them.
export function bucketLeadsForToday(rows, today = todayISO()) {
  const buckets = { overdue: [], dueToday: [], needsReview: [], notContacted: [] };
  for (const lead of rows || []) {
    if (lead.status === "won" || lead.status === "lost") continue;
    if (lead.status === "needs_review") {
      buckets.needsReview.push(lead);
      continue;
    }
    if (READY_FOR_OUTREACH_STATUSES.includes(lead.status) && !(lead.sentCount > 0)) {
      buckets.notContacted.push(lead);
      continue;
    }
    const u = urgency(primaryFollowup(lead).next_action_date, today);
    if (u === "overdue") buckets.overdue.push(lead);
    else if (u === "today") buckets.dueToday.push(lead);
  }
  buckets.overdue.sort((a, b) => compareByDue(a, b, today));
  buckets.dueToday.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
  // Oldest first: the longer something has waited, the higher it goes.
  const byUpdated = (a, b) => (a.updated_at || "").localeCompare(b.updated_at || "");
  buckets.needsReview.sort(byUpdated);
  buckets.notContacted.sort(byUpdated);
  return buckets;
}
