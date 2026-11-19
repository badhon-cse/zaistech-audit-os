import { supabaseAdmin } from "../../../../lib/supabase.js";
import { generateProposal } from "../../../../lib/selfImprove.js";

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
  return Response.json({ proposals: data });
}

export async function POST() {
  const result = await generateProposal();
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
  return Response.json({ proposal: result.proposal });
}
