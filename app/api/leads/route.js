import { supabaseAdmin } from "../../../lib/supabase.js";

// No dynamic segment and no request-specific API used here, so Next.js
// would otherwise statically render this GET once at build time and keep
// serving that stale snapshot forever. Force it to run fresh every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("leads").select("*").order("updated_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ leads: data });
}

export async function POST(request) {
  const db = supabaseAdmin();
  const body = await request.json();
  if (!body.company || !body.domain) {
    return Response.json({ error: "company and domain are required" }, { status: 400 });
  }
  const { data, error } = await db
    .from("leads")
    .insert({
      first_name: body.firstName || null,
      last_name: body.lastName || null,
      title: body.title || null,
      email: body.email || null,
      company: body.company,
      domain: body.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      industry: body.industry || null,
      linkedin: body.linkedin || null,
      status: "new",
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lead: data });
}
