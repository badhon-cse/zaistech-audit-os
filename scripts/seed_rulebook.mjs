// One-time (and re-runnable) upload: pushes the current SKILL.md rulebook text
// into the rulebook_versions table, so the running app's audits always read the
// latest version without redeploying code.
//
// Usage:
//   node scripts/seed_rulebook.mjs path/to/SKILL.md
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const [, , rulebookPath] = process.argv;
if (!rulebookPath) {
  console.error("Usage: node scripts/seed_rulebook.mjs <SKILL.md path>");
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const text = readFileSync(rulebookPath, "utf8");
const version = new Date().toISOString().slice(0, 10) + "-" + Math.random().toString(36).slice(2, 6);

const { error } = await db.from("rulebook_versions").insert({
  version,
  text,
  changed_by: "manual seed",
  change_note: "Synced from " + rulebookPath,
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`Rulebook version ${version} saved (${text.length} chars).`);
