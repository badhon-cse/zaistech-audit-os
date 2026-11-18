import { supabaseAdmin } from "../../../../lib/supabase.js";

export async function GET(_request, { params }) {
  const db = supabaseAdmin();
  const { id } = params;

  const { data: lead, error: leadErr } = await db.from("leads").select("*").eq("id", id).single();
  if (leadErr || !lead) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: audits } = await db
    .from("audits")
    .select("*")
    .eq("lead_id", id)
    .order("run_at", { ascending: false });

  const latest = audits?.[0] || null;
  let findings = [], strengths = [], metrics = [], inboxChecks = [];
  if (latest) {
    [findings, strengths, metrics, inboxChecks] = await Promise.all([
      db.from("findings").select("*").eq("audit_id", latest.id).order("priority").then((r) => r.data || []),
      db.from("strengths").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
      db.from("metrics").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
      db.from("inbox_checks").select("*").eq("audit_id", latest.id).then((r) => r.data || []),
    ]);
  }

  return Response.json({ lead, audits, latestAudit: latest, findings, strengths, metrics, inboxChecks });
}

export async function PATCH(request, { params }) {
  const db = supabaseAdmin();
  const body = await request.json();
  const { data, error } = await db
    .from("leads")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lead: data });
}
