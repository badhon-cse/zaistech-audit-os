import { runAudit } from "../../../../lib/audit.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { leadId, allowSignupTest, auditEmail } = body;
    if (!leadId) {
      return Response.json({ error: "leadId is required" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: rb } = await db
      .from("rulebook_versions")
      .select("text")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const result = await runAudit({
      leadId,
      allowSignupTest: !!allowSignupTest,
      auditEmail: auditEmail || null,
      rulebookText: rb?.text || "(no rulebook stored yet -- add one via the Rulebook page)",
    });

    return Response.json(result);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
