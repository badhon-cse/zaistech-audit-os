import { supabaseAdmin } from "../../../../lib/supabase.js";

// Toggle whether a finding goes into outreach. Body: { included: boolean }.
// included=false means a human pulled it as not good enough to send -- the
// AI draft generator skips it (app/api/leads/[id]/outreach/generate filters
// on included=true) and the rulebook self-improvement loop reads it as a
// "weak finding" signal (lib/selfImprove.js). Only `included` is patchable.
export async function PATCH(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  if (typeof body.included !== "boolean") {
    return Response.json({ error: "included must be true or false (it is the only updatable field)" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("findings")
    .update({ included: body.included })
    .eq("id", params.id)
    .select("id, included")
    .single();
  if (error) {
    const notFound = error.code === "PGRST116"; // .single() matched no rows
    return Response.json({ error: notFound ? "Finding not found" : error.message }, { status: notFound ? 404 : 500 });
  }
  return Response.json({ finding: data });
}
