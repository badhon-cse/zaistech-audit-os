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

  // Append the CONDENSED CRO/email/ads benchmark cheat-sheet (~3.3KB) so the
  // findings-writer AI has real, sourced numbers to ground findings in --
  // not the full db/cro_knowledge_base.md (~16.8KB), which has the same
  // numbers plus a lot of per-section explanatory prose that's useful for a
  // human reading it once but not worth re-sending on every single audit
  // call (it was adding ~4,200 tokens per run for content the condensed
  // version covers in ~830 tokens). The full file stays on disk as reference
  // documentation. Optional -- if the file isn't there, seed with just the
  // rulebook.
  try {
    const kbPath = path.join(process.cwd(), "db", "cro_knowledge_base_condensed.md");
    const kbText = readFileSync(kbPath, "utf8");
    text += "\n\n---\n\n" + kbText;
  } catch {
    // no knowledge base file yet -- fine, seed with the rulebook alone
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
