import { supabaseAdmin } from "../../../../../../lib/supabase.js";
import { writeOutreach } from "../../../../../../lib/outreach.js";

export async function POST(_request, { params }) {
  const db = supabaseAdmin();
  const { id } = params;

  const { data: lead, error: leadErr } = await db.from("leads").select("*").eq("id", id).single();
  if (leadErr || !lead) return Response.json({ error: "Lead not found" }, { status: 404 });

  const { data: audits } = await db
    .from("audits")
    .select("id")
    .eq("lead_id", id)
    .order("run_at", { ascending: false })
    .limit(1);
  const audit = audits?.[0];
  if (!audit) return Response.json({ error: "No audit yet for this lead -- run an audit first." }, { status: 400 });

  const [{ data: findings }, { data: strengths }, { data: demos }, { data: versions }] = await Promise.all([
    db.from("findings").select("area, what, where_, why, fix, service, priority").eq("audit_id", audit.id).eq("included", true).order("priority"),
    db.from("strengths").select("text").eq("audit_id", audit.id),
    db.from("demos").select("id").eq("lead_id", id).limit(1),
    db.from("rulebook_versions").select("text").order("created_at", { ascending: false }).limit(1),
  ]);

  if (!findings?.length) {
    return Response.json({ error: "No findings to write outreach from -- this audit has no kept findings." }, { status: 400 });
  }
  const rulebookText = versions?.[0]?.text;
  if (!rulebookText) return Response.json({ error: "No rulebook found -- seed it first via /api/rulebook/seed." }, { status: 400 });

  try {
    const outreach = await writeOutreach({
      lead: { first_name: lead.first_name, last_name: lead.last_name, title: lead.title, company: lead.company, domain: lead.domain, industry: lead.industry },
      findings,
      strengths: (strengths || []).map((s) => s.text),
      demoExists: (demos || []).length > 0,
      rulebookText,
    });
    return Response.json({ outreach });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
