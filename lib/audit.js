import { scanSite, runShopperTest } from "./scan.js";
import { getPageSpeed } from "./pagespeed.js";
import { writeFindings } from "./findings.js";
import { supabaseAdmin } from "./supabase.js";

/**
 * Runs one full automated audit for a lead and writes every result to Supabase.
 * This is the single entry point the API route (and, later, a scheduled job)
 * calls -- it mirrors rulebook section 3.0 "Automated run".
 */
export async function runAudit({ leadId, allowSignupTest = false, auditEmail = null, rulebookText }) {
  const db = supabaseAdmin();

  const { data: lead, error: leadErr } = await db.from("leads").select("*").eq("id", leadId).single();
  if (leadErr || !lead) throw new Error("Lead not found: " + (leadErr?.message || leadId));

  await db.from("leads").update({ status: "auditing", updated_at: new Date().toISOString() }).eq("id", leadId);

  const stepStatus = {};
  const raw = {};

  // Step 1 + 3 + 6: homepage scan, product page, mobile screenshot
  stepStatus.scan = "running";
  const scan = await scanSite(lead.domain).catch((e) => {
    stepStatus.scan = "failed: " + e.message;
    return null;
  });
  if (scan) stepStatus.scan = "done";
  raw.scan = scan;

  // Step 2 (optional, opt-in only): welcome-flow signup test
  let shopperTest = null;
  if (allowSignupTest && auditEmail) {
    stepStatus.signup_test = "running";
    shopperTest = await runShopperTest(lead.domain, auditEmail, {
      allowSignup: true,
      allowCheckout: false, // checkout automation is intentionally not enabled yet -- see scan.js
    }).catch((e) => {
      stepStatus.signup_test = "failed: " + e.message;
      return null;
    });
    if (shopperTest) stepStatus.signup_test = "done";
  } else {
    stepStatus.signup_test = "skipped (no opt-in)";
  }
  raw.shopperTest = shopperTest;

  // Step 8: PageSpeed Insights
  stepStatus.pagespeed = "running";
  const url = lead.domain.startsWith("http") ? lead.domain : `https://${lead.domain}`;
  const pagespeed = await getPageSpeed(url).catch((e) => ({ ok: false, error: e.message }));
  stepStatus.pagespeed = pagespeed.ok ? "done" : "failed: " + pagespeed.error;

  // Step 9/10: ads + outside signals are left for the caller to pass in today
  // (Ad Library and general web search need either a paid data source or a
  // browser session -- see the Build Plan doc's Connections & APIs table).
  const ads = { note: "Not automated yet in this build -- check the Meta Ad Library manually and add it on the lead detail page." };
  const outsideSignals = { note: "Not automated yet in this build -- add reviews/ratings found manually on the lead detail page." };
  stepStatus.ads = "manual (not yet automated)";
  stepStatus.outside_signals = "manual (not yet automated)";

  // Step 11: AI write-up
  stepStatus.findings = "running";
  let findingsResult;
  try {
    findingsResult = await writeFindings({
      lead: { company: lead.company, title: lead.title, domain: lead.domain, industry: lead.industry },
      scan,
      pagespeed,
      ads,
      outsideSignals,
      rulebookText,
    });
    stepStatus.findings = "done";
  } catch (e) {
    stepStatus.findings = "failed: " + e.message;
    findingsResult = { platform: scan?.homepage?.platform || "unknown", strengths: [], findings: [], topPitch: "", demoIdea: "" };
  }

  // Persist: audit row, then findings/strengths/metrics rows.
  const { data: audit, error: auditErr } = await db
    .from("audits")
    .insert({
      lead_id: leadId,
      rulebook_version: "see rulebook_versions table",
      platform: findingsResult.platform,
      apps_detected: scan?.homepage?.apps || [],
      status: stepStatus,
      raw,
    })
    .select()
    .single();
  if (auditErr) throw new Error("Could not save audit: " + auditErr.message);

  if (findingsResult.findings?.length) {
    await db.from("findings").insert(
      findingsResult.findings.map((f) => ({
        audit_id: audit.id,
        area: f.area,
        what: f.what,
        where_: f.where,
        why: f.why,
        fix: f.fix,
        service: f.service,
        priority: f.priority || 0,
        source: "auto",
        included: true,
      }))
    );
  }
  if (findingsResult.strengths?.length) {
    await db.from("strengths").insert(
      findingsResult.strengths.map((s) => ({ audit_id: audit.id, text: s, source: "auto" }))
    );
  }
  if (pagespeed.ok) {
    await db.from("metrics").insert({
      audit_id: audit.id,
      page: "homepage",
      device: "mobile",
      pagespeed_score: pagespeed.performanceScore,
      lcp: pagespeed.lcp,
      cls: pagespeed.cls,
      tbt: pagespeed.tbt,
      speed_index: pagespeed.speedIndex,
      requests: scan?.pageWeight?.requests || null,
      page_weight_kb: scan?.homepage?.transferKB || null,
    });
  }

  await db
    .from("leads")
    .update({
      status: "needs_review",
      updated_at: new Date().toISOString(),
      next_action: "Review AI findings and approve",
      next_action_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", leadId);

  return { auditId: audit.id, stepStatus, topPitch: findingsResult.topPitch, demoIdea: findingsResult.demoIdea };
}
