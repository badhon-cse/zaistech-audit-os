// One-time (and re-runnable) seed: reads db/rulebook.md from this deployed
// instance's own filesystem and inserts it into rulebook_versions. This
// exists because the rulebook_versions table started out empty -- audits
// were running against the fallback "(no rulebook stored yet)" text -- and
// the dev container this app is edited from has no network access to
// Supabase directly (only the deployed Render instance does), so seeding
// happens via this endpoint instead of a local script.
import { readFileSync } from "fs";
import path from "path";
import { supabaseAdmin } from "../../../../lib/supabase.js";

export async function POST() {
  const db = supabaseAdmin();
  const filePath = path.join(process.cwd(), "db", "rulebook.md");
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (e) {
    return Response.json({ error: "Could not read db/rulebook.md: " + e.message }, { status: 500 });
  }

  const version = new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6);
  const { data, error } = await db
    .from("rulebook_versions")
    .insert({
      version,
      text,
      changed_by: "api seed",
      change_note: "Seeded from db/rulebook.md via /api/rulebook/seed",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, version, chars: text.length, id: data.id });
}
