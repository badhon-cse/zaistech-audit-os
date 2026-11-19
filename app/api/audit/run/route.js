import { runAudit, AuditAlreadyRunningError } from "../../../../lib/audit.js";
import { supabaseAdmin } from "../../../../lib/supabase.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { leadId } = body;
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
      rulebookText: rb?.text || "(no rulebook stored yet -- add one via the Rulebook page)",
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof AuditAlreadyRunningError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
