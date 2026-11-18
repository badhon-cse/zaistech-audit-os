// Google PageSpeed Insights API (free, 25,000 requests/day per project).
// https://developers.google.com/speed/docs/insights/v5/get-started
export async function getPageSpeed(url, { strategy = "mobile" } = {}) {
  const key = process.env.PAGESPEED_API_KEY;
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  // NOTE: category is a repeatable query param. URLSearchParams#set() overwrites
  // the previous value instead of adding another one, so calling set() three
  // times in a row (as this used to) silently requested ONLY the last category
  // ("accessibility") -- that's why performance/seo scores and the LCP/CLS/TBT
  // audits were always null even though pagespeed.ok was true. append() adds a
  // separate "category=..." pair for each, which is what the API expects.
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "seo");
  endpoint.searchParams.append("category", "accessibility");
  if (key) endpoint.searchParams.set("key", key);

  const res = await fetch(endpoint.toString());
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text().catch(() => res.statusText) };
  }
  const json = await res.json();
  const audits = json?.lighthouseResult?.audits || {};
  const cats = json?.lighthouseResult?.categories || {};

  // Lighthouse (which powers this API) renders the page in a real headless
  // Chrome on Google's servers and hands back a screenshot of what it saw --
  // this is how we get a real rendered screenshot for the audit result
  // without running a browser ourselves (which OOMs Render's free tier).
  const screenshotData = audits["final-screenshot"]?.details?.data || null;

  // Per-element "this is the thing that's slow/broken" callouts, so the UI
  // can point at a specific spot on the screenshot rather than just listing
  // opportunities in the abstract.
  const elementIssues = [];
  for (const [key, a] of Object.entries(audits)) {
    const items = a?.details?.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const node = item.node || item.element;
      if (node?.nodeLabel || node?.snippet) {
        elementIssues.push({
          audit: a.title,
          label: node.nodeLabel || node.snippet?.slice(0, 80) || null,
        });
      }
    }
    if (elementIssues.length >= 6) break;
  }

  return {
    ok: true,
    performanceScore: cats.performance ? Math.round(cats.performance.score * 100) : null,
    seoScore: cats.seo ? Math.round(cats.seo.score * 100) : null,
    accessibilityScore: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
    lcp: audits["largest-contentful-paint"]?.displayValue || null,
    cls: audits["cumulative-layout-shift"]?.displayValue || null,
    tbt: audits["total-blocking-time"]?.displayValue || null,
    speedIndex: audits["speed-index"]?.displayValue || null,
    screenshotBase64: screenshotData, // data: URI, ready for <img src>
    elementIssues: elementIssues.slice(0, 6),
    topOpportunities: Object.values(audits)
      .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .slice(0, 3)
      .map((a) => ({ title: a.title, savingsMs: Math.round(a.numericValue) })),
  };
}
