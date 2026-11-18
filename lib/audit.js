import { scanSite, runShopperTest } from "./scan.js";
import { getPageSpeed } from "./pagespeed.js";
import { writeFindings } from "./findings.js";
import { supabaseAdmin } from "./supabase.js";

// Lighthouse audits genuinely take 20-60s, but shouldn't hang forever --
// cap at 90s so one slow/unreachable page doesn't stall the whole audit.
function withTimeout(promise, ms, timeoutResult) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutResult), ms)),
  ]);
}

const STOPWORDS = new Set(["the","a","an","on","in","at","of","to","for","is","are","was","were","no","not","with","and","or","this","that","its","it's","product","page","homepage","site","website"]);
function tokenize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// Maps whatever the AI wrote in a finding's "where" field to the page-key we
// actually scanned (see pageTargets below). This is the thing that used to be
// missing: a finding about checkout/cart had nowhere to point to because we
// never scanned that page at all. Now every page a finding can name has a
// real scanned counterpart.
const WHERE_ALIASES = {
  "homepage": "homepage",
  "home": "homepage",
  "product page": "product",
  "product": "product",
  "checkout": "checkout",
  "cart": "checkout",
  "cart page": "checkout",
  "checkout page": "checkout",
};

// The AI writes findings in plain English; Lighthouse's elementIssues (from
// pagespeed.js) carry real pixel rects but only for the specific elements a
// Lighthouse audit happened to flag (missing alt text, tap targets, etc).
// This does a cheap keyword-overlap match between a finding's "what" text
// and each candidate element's label/audit title, so findings that DO
// correspond to a Lighthouse-flagged element get an exact crop instead of
// just the whole-page screenshot. Heuristic findings with no Lighthouse
// counterpart (e.g. "no trust badges") simply won't match, which is correct
// -- we have no real coordinates for those without a browser; they still get
// the full screenshot of the right page (via screenshot_source), just not a
// cropped close-up.
function matchCropRect(finding, pagespeedByKey) {
  const where = (finding.where || "").toLowerCase().trim();
  const key = WHERE_ALIASES[where];
  const pool = key ? pagespeedByKey[key] : null;
  if (!key) return null;
  if (!pool?.ok) return null;
  if (!Array.isArray(pool.elementIssues)) return { rect: null, screenshot_source: key };
  const findingTokens = new Set(tokenize(finding.what));
  if (!findingTokens.size) return { rect: null, screenshot_source: key };

  let best = null;
  let bestScore = 0;
  for (const issue of pool.elementIssues) {
    if (!issue.rect) continue;
    const issueTokens = tokenize(`${issue.label || ""} ${issue.audit || ""}`);
    const score = issueTokens.filter((t) => findingTokens.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = issue;
    }
  }
  // Even with no element-level match, still point at the right page's full
  // screenshot (screenshot_source) rather than showing nothing -- a whole-page
  // shot of the actual checkout page beats no screenshot at all.
  if (!best || bestScore < 2) return { rect: null, screenshot_source: key };
  return { rect: best.rect, screenshot_source: key };
}

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

  // Step 8: PageSpeed Insights -- homepage only, up front. We used to also
  // blind-scan the product page and /cart on every single audit regardless of
  // whether anything was actually wrong there, which was wasteful (two extra
  // 90s-capped Lighthouse runs most audits didn't need) and, because the full
  // page screenshot is captured at the END of the trace, often just showed
  // the same on-page popup on every page anyway. Homepage is scanned
  // unconditionally because it backs the overall "site speed" score and
  // homepage-speed findings are extremely common. Product/checkout PageSpeed
  // is now fetched ON DEMAND, after the AI has decided there's a genuine
  // finding on that specific page -- see "on-demand page screenshots" below.
  const url = lead.domain.startsWith("http") ? lead.domain : `https://${lead.domain}`;
  stepStatus.pagespeed_homepage = "running";
  const pagespeedByKey = {};
  pagespeedByKey.homepage = await withTimeout(
    getPageSpeed(url).catch((e) => ({ ok: false, error: e.message })),
    90000,
    { ok: false, error: "timed out after 90s" }
  );
  stepStatus.pagespeed_homepage = pagespeedByKey.homepage.ok ? "done" : "failed: " + pagespeedByKey.homepage.error;
  const pagespeed = pagespeedByKey.homepage;

  // Step 9/10: ads + outside signals are left for the caller to pass in today
  // (Ad Library and general web search need either a paid data source or a
  // browser session -- see the Build Plan doc's Connections & APIs table).
  const ads = { note: "Not automated yet in this build -- check the Meta Ad Library manually and add it on the lead detail page." };
  const outsideSignals = { note: "Not automated yet in this build -- add reviews/ratings found manually on the lead detail page." };
  stepStatus.ads = "manual (not yet automated)";
  stepStatus.outside_signals = "manual (not yet automated)";

  // Step 11: AI write-up. This only sees scan (heuristic, text-based -- no
  // PageSpeed needed) + homepage PageSpeed. Product-page and checkout
  // findings at this stage come from scan.productPage.issues and
  // scan.checkoutUpsell (both plain HTML/fetch checks, not Lighthouse), which
  // is enough to flag a real problem without needing a screenshot yet.
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
    // Log full detail to Render's app logs -- stepStatus only stores e.message,
    // which for Agent-SDK subprocess failures is often just "Claude Code
    // process exited with code 1" with no further clue. The SDK sometimes
    // attaches captured stderr/exit info on extra error properties, so dump
    // everything we can find.
    console.error("[audit] writeFindings failed:", {
      message: e?.message,
      stack: e?.stack,
      stderr: e?.stderr,
      exitCode: e?.exitCode ?? e?.code,
      cause: e?.cause,
      extraKeys: e && typeof e === "object" ? Object.keys(e) : null,
    });
    stepStatus.findings = "failed: " + e.message;
    findingsResult = { platform: scan?.homepage?.platform || "unknown", strengths: [], findings: [], topPitch: "", demoIdea: "" };
  }

  // On-demand page screenshots: now that we know which pages actually have a
  // real finding on them, fetch PageSpeed (score + screenshot) for exactly
  // those pages -- not a blanket pre-scan of every page type regardless of
  // whether anything's wrong there. Homepage is already covered above.
  const neededPageKeys = new Set();
  for (const f of findingsResult.findings || []) {
    const key = WHERE_ALIASES[(f.where || "").toLowerCase().trim()];
    if (key && key !== "homepage") neededPageKeys.add(key);
  }
  const ON_DEMAND_URL = {
    product: scan?.productPage?.url || null,
    checkout: (() => {
      try {
        return new URL("/cart", url).toString();
      } catch {
        return null;
      }
    })(),
  };
  await Promise.all(
    [...neededPageKeys].map(async (key) => {
      const pageUrl = ON_DEMAND_URL[key];
      if (!pageUrl) {
        stepStatus[`pagespeed_${key}`] = "skipped (no URL for this page)";
        return;
      }
      stepStatus[`pagespeed_${key}`] = "running";
      const result = await withTimeout(
        getPageSpeed(pageUrl).catch((e) => ({ ok: false, error: e.message })),
        90000,
        { ok: false, error: "timed out after 90s" }
      );
      pagespeedByKey[key] = result;
      stepStatus[`pagespeed_${key}`] = result.ok ? "done" : "failed: " + result.error;
    })
  );

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
      findingsResult.findings.map((f) => {
        const match = matchCropRect(f, pagespeedByKey);
        return {
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
          crop_rect: match?.rect || null,
          screenshot_source: match?.screenshot_source || null,
        };
      })
    );
  }
  if (findingsResult.strengths?.length) {
    await db.from("strengths").insert(
      findingsResult.strengths.map((s) => ({ audit_id: audit.id, text: s, source: "auto" }))
    );
  }
  // One metrics row per page we actually fetched PageSpeed for -- homepage
  // always, plus product/checkout only when a real finding needed them (see
  // "on-demand page screenshots" above). screenshot_base64 keeps the full
  // page (real coords, used for crop_rect close-ups); preview_screenshot_base64
  // is the early, popup-free filmstrip frame used for the page's header image.
  const METRICS_PAGE_NAME = { homepage: "homepage", product: "product", checkout: "checkout" };
  for (const [key, result] of Object.entries(pagespeedByKey)) {
    if (!result?.ok) continue;
    await db.from("metrics").insert({
      audit_id: audit.id,
      page: METRICS_PAGE_NAME[key] || key,
      device: "mobile",
      pagespeed_score: result.performanceScore,
      seo_score: result.seoScore,
      accessibility_score: result.accessibilityScore,
      lcp: result.lcp,
      cls: result.cls,
      tbt: result.tbt,
      speed_index: result.speedIndex,
      requests: key === "homepage" ? scan?.pageWeight?.requests || null : null,
      page_weight_kb: key === "homepage" ? scan?.homepage?.transferKB || null : null,
      top_opportunities: result.topOpportunities || [],
      screenshot_base64: result.screenshotBase64 || null,
      preview_screenshot_base64: result.previewScreenshotBase64 || null,
      screenshot_width: result.screenshotWidth || null,
      screenshot_height: result.screenshotHeight || null,
      element_issues: result.elementIssues || [],
      page_issues: key === "product" ? scan?.productPage?.issues || [] : key === "checkout" ? (scan?.checkoutUpsell?.checked ? [scan.checkoutUpsell.note] : null) : null,
    });
  }

  // Email welcome/abandoned-cart flow verdicts (heuristic -- see checkEmailFlows
  // in scan.js for why this is "unconfirmed" rather than a hard pass/fail).
  if (scan?.emailFlows) {
    await db.from("inbox_checks").insert([
      { audit_id: audit.id, kind: "welcome", verdict: scan.emailFlows.welcome.verdict, result: scan.emailFlows.welcome },
      { audit_id: audit.id, kind: "abandoned_cart", verdict: scan.emailFlows.abandonedCart.verdict, result: scan.emailFlows.abandonedCart },
    ]);
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
