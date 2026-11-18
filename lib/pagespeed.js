// Google PageSpeed Insights API (free, 25,000 requests/day per project).
// https://developers.google.com/speed/docs/insights/v5/get-started
export async function getPageSpeed(url, { strategy = "mobile" } = {}) {
  const key = process.env.PAGESPEED_API_KEY;
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("category", "seo");
  endpoint.searchParams.set("category", "accessibility");
  if (key) endpoint.searchParams.set("key", key);

  const res = await fetch(endpoint.toString());
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text().catch(() => res.statusText) };
  }
  const json = await res.json();
  const audits = json?.lighthouseResult?.audits || {};
  const cats = json?.lighthouseResult?.categories || {};

  return {
    ok: true,
    performanceScore: cats.performance ? Math.round(cats.performance.score * 100) : null,
    seoScore: cats.seo ? Math.round(cats.seo.score * 100) : null,
    accessibilityScore: cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
    lcp: audits["largest-contentful-paint"]?.displayValue || null,
    cls: audits["cumulative-layout-shift"]?.displayValue || null,
    tbt: audits["total-blocking-time"]?.displayValue || null,
    speedIndex: audits["speed-index"]?.displayValue || null,
    topOpportunities: Object.values(audits)
      .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .slice(0, 3)
      .map((a) => ({ title: a.title, savingsMs: Math.round(a.numericValue) })),
  };
}
