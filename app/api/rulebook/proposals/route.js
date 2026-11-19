import { supabaseAdmin } from "../../../../lib/supabase.js";
import { generateProposal, countOutcomeLeads, MIN_OUTCOME_LEADS } from "../../../../lib/selfImprove.js";

// No dynamic segment and no request-specific API used here, so Next.js
// would otherwise statically render this GET once at build time and keep
// serving that stale snapshot forever. Force it to run fresh every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("rulebook_proposals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Progress toward the next self-improvement run, plus the rulebook text
  // each pending proposal was based on (so the page can show a diff instead
  // of the full replacement text) and the live version's name (so it can
  // warn if the rulebook changed since the proposal was drafted).
  const pendingBases = [...new Set((data || []).filter((p) => p.status === "pending" && p.based_on_version).map((p) => p.based_on_version))];
  const [outcomeLeads, { data: latest }, { data: bases }] = await Promise.all([
    countOutcomeLeads().catch(() => null),
    db.from("rulebook_versions").select("version").order("created_at", { ascending: false }).limit(1),
    pendingBases.length
      ? db.from("rulebook_versions").select("version, text").in("version", pendingBases)
      : Promise.resolve({ data: [] }),
  ]);

  return Response.json({
    proposals: data,
    progress: { outcomeLeads, minOutcomeLeads: MIN_OUTCOME_LEADS },
    liveVersion: latest?.[0]?.version || null,
    baseTexts: Object.fromEntries((bases || []).map((v) => [v.version, v.text])),
  });
}

export async function POST() {
  const result = await generateProposal();
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}
