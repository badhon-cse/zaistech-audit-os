// "Best time to send" for a lead: works out the recipient's local weekday
// and clock time from their timezone, and whether now is a good moment to
// send outreach (local business hours, Mon-Fri) or whether to wait -- so the
// operator (in Bangladesh, UTC+6) never sends an email at the lead's 2am by
// mistake. Also expresses the next good window in Bangladesh's own clock
// time, since that's the time the operator actually has to act on.
//
// A lead's timezone is set by hand on the outreach tracker (there's no
// reliable auto-detection from company/city/country text in this app), so
// everything here treats a missing/invalid timezone as "unknown" rather
// than guessing.

// Curated list for the dropdown -- the countries Zaistech's e-commerce
// leads actually come from, not the full IANA tz database. Value is a real
// IANA zone id (validated at write time -- see isValidTimezone).
export const COMMON_TIMEZONES = [
  { value: "America/Los_Angeles", label: "US — Pacific" },
  { value: "America/Denver", label: "US — Mountain" },
  { value: "America/Chicago", label: "US — Central" },
  { value: "America/New_York", label: "US — Eastern" },
  { value: "America/Toronto", label: "Canada — Eastern" },
  { value: "America/Vancouver", label: "Canada — Pacific" },
  { value: "Europe/London", label: "UK / Ireland" },
  { value: "Europe/Berlin", label: "Europe — Central (DE/FR/IT/ES/NL)" },
  { value: "Europe/Helsinki", label: "Europe — Eastern" },
  { value: "Australia/Sydney", label: "Australia — Eastern" },
  { value: "Australia/Perth", label: "Australia — Western" },
  { value: "Pacific/Auckland", label: "New Zealand" },
  { value: "Asia/Dubai", label: "UAE" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Kolkata", label: "India" },
  { value: "Asia/Dhaka", label: "Bangladesh" },
];

const TZ_LABELS = Object.fromEntries(COMMON_TIMEZONES.map((t) => [t.value, t.label]));
// Falls back to the raw zone id for one set some other way (e.g. directly
// in Supabase) that isn't in the curated list above.
export function timezoneLabel(tz) {
  return TZ_LABELS[tz] || tz;
}

export function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUSINESS_START_HOUR = 9; // 9am
const BUSINESS_END_HOUR = 18; // 6pm, exclusive

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday").value;
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10) % 24;
  return { weekday, hour };
}

function isGoodSendTime(date, timeZone) {
  const { weekday, hour } = localParts(date, timeZone);
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  return isWeekday && hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

// Steps forward in 15-minute increments (not timezone-arithmetic, so DST
// transitions and odd-offset zones can't throw it off) until business hours
// start. Gives up after 8 days (should never actually take that long).
function nextGoodSendTime(from, timeZone) {
  let t = new Date(from);
  t.setSeconds(0, 0);
  const step = 15 * 60 * 1000;
  for (let i = 0; i < (8 * 24 * 60) / 15; i++) {
    if (isGoodSendTime(t, timeZone)) return t;
    t = new Date(t.getTime() + step);
  }
  return null;
}

function fmtClock(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(date);
}

// { available, good, nowLabel, nextLabel, nextLabelBD, hoursUntil } --
// `available` is false when the lead has no (valid) timezone set yet.
// `nowLabel`/`nextLabel` are in the LEAD's local time; `nextLabelBD` is the
// same next-good-window moment expressed in the operator's own clock
// (Asia/Dhaka), since that's what they actually have to act on.
export function getSendTiming(timeZone, now = new Date()) {
  if (!isValidTimezone(timeZone)) return { available: false };

  const good = isGoodSendTime(now, timeZone);
  const nowLabel = fmtClock(now, timeZone);
  if (good) return { available: true, good: true, nowLabel };

  const next = nextGoodSendTime(now, timeZone);
  if (!next) return { available: true, good: false, nowLabel };

  const hoursUntil = Math.round(((next.getTime() - now.getTime()) / 3600000) * 10) / 10;
  return {
    available: true,
    good: false,
    nowLabel,
    nextLabel: fmtClock(next, timeZone),
    nextLabelBD: fmtClock(next, "Asia/Dhaka"),
    hoursUntil,
  };
}
