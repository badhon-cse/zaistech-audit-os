import { supabaseAdmin } from "../../../../lib/supabase.js";

export async function PATCH(request, { params }) {
  const db = supabaseAdmin();
  const body = await request.json();
  const patch = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === "sent" && !body.sent_at) patch.sent_at = new Date().toISOString();
  }
  if (body.sent_at) patch.sent_at = body.sent_at;

  const { data, error } = await db.from("outreach").update(patch).eq("id", params.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ outreach: data });
}

export async function DELETE(_request, { params }) {
  const db = supabaseAdmin();
  const { error } = await db.from("outreach").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
