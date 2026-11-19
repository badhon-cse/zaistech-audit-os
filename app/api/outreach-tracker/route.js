import { supabaseAdmin } from "../../../lib/supabase.js";
import { loadTrackerRows } from "../../../lib/outreachData.js";

// One call, whole pipeline's outreach state: every lead plus its outreach
// history summary, per-channel follow-ups and lead-level
// next_action/next_action_date -- the data behind the /outreach tracker and
// /today pages. The join itself lives in lib/outreachData.js so
// /api/today-summary uses exactly the same data.
//
// No dynamic segment and no request-specific API used here, so Next.js
// would otherwise statically render this GET once at build time and keep
// serving that stale snapshot forever. Force it to run fresh every request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows, followupsAvailable } = await loadTrackerRows(supabaseAdmin());
    return Response.json({ leads: rows, followupsAvailable });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
