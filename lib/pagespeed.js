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
  //
  // "full-page-screenshot" (not "final-screenshot") covers the ENTIRE page,
  // not just the viewport, and comes with pixel dimensions -- that's what
  // lets us crop a specific element's region out of it client-side (pure
  // CSS background-position, no image library needed) instead of only ever
  // showing the whole page.
  const fullPageShot = audits["full-page-screenshot"]?.details?.screenshot;
  const screenshotData = fullPageShot?.data || audits["final-screenshot"]?.details?.data || null;
  const screenshotWidth = fullPageShot?.width || null;
  const screenshotHeight = fullPageShot?.height || null;
  const fpsNodes = audits["full-page-screenshot"]?.details?.nodes || {};

  // The full-page screenshot above is captured at the very END of the trace,
  // which is exactly when a timed email/discount popup (Privy, Klaviyo, Justuno
  // etc.) has usually had time to fire -- and since the SAME popup fires on
  // every page of a site, every page's "full page" screenshot ends up looking
  // identical (just the popup), which defeats the whole point of a per-page
  // screenshot. "screenshot-thumbnails" is Lighthouse's filmstrip of the page
  // at several points DURING load, earliest first -- an early frame is much
  // more likely to still show the real page underneath, before the popup's
  // delay timer has fired. This is a heuristic, not a guarantee (a popup with
  // no delay would still show up), but it's free and needs no extra browser.
  const thumbs = audits["screenshot-thumbnails"]?.details?.items || [];
  const earlyThumb = thumbs.length ? thumbs[Math.min(2, thumbs.length - 1)] : null;
  const previewScreenshotBase64 = earlyThumb?.data
    ? (earlyThumb.data.startsWith("data:") ? earlyThumb.data : `data:image/jpeg;base64,${earlyThumb.data}`)
    : null;

  // Per-element "this is the thing that's slow/broken" callouts, with pixel
  // rects when Lighthouse gives us one, so the UI can crop/zoom to the exact
  // spot on the screenshot rather than just listing opportunities in the
  // abstract or showing the whole page for every finding.
  const elementIssues = [];
  for (const [auditKey, a] of Object.entries(audits)) {
    const items = a?.details?.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const node = item.node || item.element;
      if (!node?.nodeLabel && !node?.snippet) continue;
      // boundingRect is present directly on the node for most accessibility/
      // SEO audit items; otherwise fall back to the full-page-screenshot's
      // separate nodes-by-lhId map (used by some performance diagnostics).
      let rect = node.boundingRect && node.boundingRect.width > 0 ? node.boundingRect : null;
      if (!rect && node.lhId && fpsNodes[node.lhId]) rect = fpsNodes[node.lhId];
      elementIssues.push({
        audit: a.title,
        auditKey,
        label: node.nodeLabel || node.snippet?.slice(0, 80) || null,
        rect: rect && rect.width > 0 && rect.height > 0
          ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          : null,
      });
    }
    if (elementIssues.length >= 20) break; // keep a decent pool to match findings against, trimmed later
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
    screenshotBase64: screenshotData, // data: URI, ready for <img src> -- full page, real coords, may show a popup
    screenshotWidth,
    screenshotHeight,
    previewScreenshotBase64, // early filmstrip frame, popup-free in most cases -- use for the "what does this page look like" preview
    elementIssues: elementIssues.slice(0, 20),
    topOpportunities: Object.values(audits)
      .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
      .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
      .slice(0, 3)
      .map((a) => ({ title: a.title, savingsMs: Math.round(a.numericValue) })),
  };
}
