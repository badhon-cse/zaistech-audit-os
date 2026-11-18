import { supabaseAdmin } from "../../../../../lib/supabase.js";
import { generateDemo } from "../../../../../lib/demo.js";

// POST /api/findings/:id/demo -- generates (or regenerates) a small AI
// mockup showing the fix for this one finding, and saves it so it doesn't
// need to be regenerated every time the lead page is viewed.
export async function POST(_request, { params }) {
  const db = supabaseAdmin();
  const { id } = params;

  const { data: finding, error: findingErr } = await db.from("findings").select("*").eq("id", id).single();
  if (findingErr || !finding) return Response.json({ error: "Finding not found" }, { status: 404 });

  const { data: audit, error: auditErr } = await db.from("audits").select("lead_id").eq("id", finding.audit_id).single();
  if (auditErr || !audit) return Response.json({ error: "Audit not found" }, { status: 404 });

  const { data: lead, error: leadErr } = await db.from("leads").select("*").eq("id", audit.lead_id).single();
  if (leadErr || !lead) return Response.json({ error: "Lead not found" }, { status: 404 });

  try {
    const html = await generateDemo({ lead, finding });
    const { error: updateErr } = await db
      .from("findings")
      .update({ demo_html: html, demo_generated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateErr) throw new Error("Could not save demo: " + updateErr.message);
    return Response.json({ demo_html: html });
  } catch (e) {
    console.error("[api/findings/demo] generateDemo failed:", e?.message, e?.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
