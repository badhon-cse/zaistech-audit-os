// One-time import: reads the "Ecommerce - Verified" tab of the lead sheet
// (exported to CSV first -- see README) and inserts rows into Supabase,
// skipping anything already there by domain.
//
// Usage:
//   node scripts/import_leads.mjs path/to/ecommerce-verified.csv
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const [, , csvPath] = process.argv;
if (!csvPath) {
  console.error("Usage: node scripts/import_leads.mjs <csv file>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment first.");
  process.exit(1);
}
const db = createClient(url, key);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // naive CSV split -- good enough for this export, which has no embedded commas in use
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
    return row;
  });
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
console.log(`Read ${rows.length} rows from ${csvPath}`);

let inserted = 0, skipped = 0;
for (const r of rows) {
  const domain = (r.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain || !r.company) { skipped++; continue; }

  const { error } = await db.from("leads").upsert(
    {
      first_name: r.first || null,
      last_name: r.last || null,
      title: r.title || null,
      email: r.email || null,
      company: r.company,
      domain,
      employees: r.employees || null,
      industry: r.industry || null,
      city: r.city || null,
      state: r.state || null,
      country: r.country || null,
      linkedin: r.linkedin || null,
      sheet_row_id: r.pulled_at || null,
      status: "new",
    },
    { onConflict: "domain", ignoreDuplicates: true }
  );
  if (error) {
    console.error(`  skip ${domain}: ${error.message}`);
    skipped++;
  } else {
    inserted++;
  }
}
console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
