// Lightweight, browser-free site scan -- ports the rulebook's browser scripts
// (SKILL.md sections 3.1-3.3) to plain fetch() + HTML parsing.
//
// NOTE: this used to launch a real Chromium via Playwright, but Render's free
// tier only gives the instance 512MB of RAM, and a real browser launch
// reliably blew past that and OOM-crashed the whole Node process (confirmed
// via Render's Events log: "Ran out of memory (used over 512MB)"). Fetch +
// regex/HTML parsing uses a few MB instead of a few hundred, so it runs fine
// on the free tier. The trade-off: no JS-rendered content, no mobile
// screenshot, and page-weight numbers are approximate (main-document size
// only, not every sub-resource a real browser would load).

const APP_SIGNATURES = {
  klaviyo: "klaviyo", omnisend: "omnisend", attentive: "attentive", postscript: "postscript",
  privy: "privy", justuno: "justuno", mailchimp: "mailchimp", brevo: "brevo", gorgias: "gorgias",
  tidio: "tidio", zendesk: "zdassets", intercom: "intercom", richpanel: "richpanel", reamaze: "reamaze",
  shopifyInbox: "shopify-chat", judgeme: "judge.me", yotpo: "yotpo", okendo: "okendo",
  stamped: "stamped.io", loox: "loox", junip: "junip", recharge: "rechargeapps", skio: "skio",
  metaPixel: "fbevents", tiktok: "analytics.tiktok", gtm: "googletagmanager",
  afterpay: "afterpay", klarna: "klarna", affirm: "affirm", sezzle: "sezzle",
};

// Email service providers that can run welcome/abandoned-cart flows. Finding
// one of these in the homepage HTML tells us the lead HAS the tool to run
// those flows -- it does NOT tell us the flows are actually built/turned on
// (that needs an email sent + a wait + an inbox check, which this fetch-based
// scan can't do synchronously). So this is reported as a verdict with an
// honest confidence label, not a hard "confirmed" claim.
const ESP_SIGNATURES = {
  klaviyo: "klaviyo", omnisend: "omnisend", attentive: "attentive", postscript: "postscript",
  privy: "privy", mailchimp: "mailchimp", brevo: "brevo", drip: "drip.com", sendlane: "sendlane",
};

// Checkout/cart upsell apps -- finding one of these on the cart/checkout page
// means the store IS running a post-add-to-cart upsell. Their absence is
// itself a finding (leaving revenue on the table at the highest-intent moment).
const UPSELL_SIGNATURES = {
  reconvert: "reconvert", zipifyOCU: "zipify", carthook: "carthook", honeycomb: "honeycomb",
  candyRack: "candyrack", afterSell: "aftersell", boldUpsell: "boldapps", rebuy: "rebuyengine",
  ultimateUpsell: "ultimateupsell", frequentlyBought: "frequently-bought",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchHtml(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const html = await res.text();
    const transferKB = Math.round(
      (Number(res.headers.get("content-length")) || Buffer.byteLength(html, "utf8")) / 1024
    );
    return { ok: res.ok, status: res.status, html, transferKB };
  } finally {
    clearTimeout(t);
  }
}

function matchAll(html, re) {
  return [...html.matchAll(re)].map((m) => m[1]);
}

function detectPlatform(html) {
  const has = (s) => html.includes(s);
  if (has("cdn.shopify.com") || has("shopify.com") || has("Shopify.theme"))
    return "Shopify";
  if (has("woocommerce")) return "WooCommerce";
  if (has("wp-content")) return "WordPress";
  if (has("bigcommerce")) return "BigCommerce";
  if (has("squarespace")) return "Squarespace";
  if (has("cdn.shopifycdn") || has("wix.com") || has("wixstatic")) return "Wix";
  return "other";
}

function parseHomepage(html, rawUrl) {
  const lower = html.toLowerCase();
  const has = (s) => lower.includes(s);
  const apps = Object.keys(APP_SIGNATURES).filter((k) => has(APP_SIGNATURES[k]));

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const metaDescMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i
  );
  const h1s = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi)
    .map((h) => h.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .map((h) => h.slice(0, 80));

  const imgTags = matchAll(html, /<img\b[^>]*>/gi);
  const imgsNoAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;
  const scripts = (html.match(/<script\b/gi) || []).length;
  const emailInputs = (html.match(/<input[^>]+type=["']email["']/gi) || []).length;

  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  const bodyText = (bodyMatch ? bodyMatch[0] : html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  return {
    platform: detectPlatform(lower),
    title: titleMatch ? titleMatch[1].trim() : null,
    metaDesc: metaDescMatch ? metaDescMatch[1].trim() : null,
    h1s,
    apps,
    emailInputs,
    imgsNoAlt,
    imgs: imgTags.length,
    scripts,
    loadMs: null, // not measurable without a real browser
    transferKB: null, // filled in by caller from the fetch response
    bodyText,
  };
}

function findProductLink(html, baseUrl) {
  const hrefs = matchAll(html, /href=["']([^"']+)["']/gi);
  const candidate = hrefs.find(
    (h) => /\/products?\//.test(h) && !/gift|#/.test(h)
  );
  if (!candidate) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseProductPage(html, link) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const h1 = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((h) =>
    h.replace(/<[^>]+>/g, "").trim()
  );
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  const imgTags = matchAll(html, /<img\b[^>]*>/gi);
  const imgsNoAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;

  const reviewsMention = (text.match(/\d[\d,]*\s*(reviews|ratings)/gi) || []).slice(0, 2);
  const hasReviewsWidget = /judge\.me|yotpo|okendo|stamped\.io|loox|junip/i.test(html);
  const guarantee = (text.match(/[^.]{0,60}(guarantee|money.back|risk.free)[^.]{0,40}/i) || [null])[0];
  const shipping = (text.match(/[^.]{0,30}free shipping[^.]{0,50}/i) || [null])[0];
  const sizeGuide = /size\s*(guide|chart)/i.test(lower);
  const trustBadges = /secure\s*checkout|ssl\s*secure|norton|mcafee|trustpilot|verified\s*reviews/i.test(lower);
  const urgency = /only\s+\d+\s+(left|in stock)|low\s*stock|selling\s*fast|limited\s*time/i.test(lower);
  const addToCartBtn = (
    html.match(/<button[^>]*>([^<]{0,40})<\/button>/gi) || []
  ).find((b) => /add to cart|add to bag|buy now/i.test(b));

  // Build the "what's wrong on THIS page" list the UI/AI can show right next
  // to the screenshot for this page.
  const issues = [];
  if (!reviewsMention.length && !hasReviewsWidget)
    issues.push("No reviews or ratings visible on the product page");
  if (!guarantee) issues.push("No guarantee / risk-free / money-back language found");
  if (!shipping) issues.push("No free-shipping or shipping-cost messaging found near the buy box");
  if (!sizeGuide) issues.push("No size guide/chart found (if apparel/footwear, this drives returns)");
  if (!trustBadges) issues.push("No trust badges (secure checkout, SSL, review-platform badges) found");
  if (!urgency) issues.push("No urgency/scarcity messaging (stock level, limited time) found");
  if (!addToCartBtn) issues.push("Could not find a clear Add to Cart / Buy Now button in the page HTML");
  if (imgsNoAlt > 0) issues.push(`${imgsNoAlt} image(s) on the product page missing alt text`);

  return {
    url: link,
    title: titleMatch ? titleMatch[1].trim() : null,
    h1,
    reviewsMention,
    hasReviewsWidget,
    guarantee,
    shipping,
    sizeGuide,
    trustBadges,
    urgency,
    hasAddToCartBtn: !!addToCartBtn,
    imgsNoAlt,
    imgs: imgTags.length,
    issues,
  };
}

/**
 * Heuristic-only email-flow check. We can detect whether an ESP capable of
 * running welcome/abandoned-cart flows is installed on the site; we CANNOT
 * confirm from a single fetch whether those specific flows are actually
 * turned on -- that needs an email submitted + a wait + an inbox check
 * (done outside this app and logged via /api/leads/[id]/shopper-test, then
 * checked by /api/inbox-checks/poll). So this returns a verdict with an honest confidence label
 * rather than a hard "confirmed" result.
 */
function checkEmailFlows(html) {
  const lower = html.toLowerCase();
  const esps = Object.keys(ESP_SIGNATURES).filter((k) => lower.includes(ESP_SIGNATURES[k]));
  const hasPopup = /exit.intent|newsletter|subscribe|% off your first order|get \d+% off/i.test(lower) &&
    (html.match(/<input[^>]+type=["']email["']/gi) || []).length > 0;

  if (esps.length === 0) {
    return {
      welcome: { verdict: "missing", confidence: "high", note: "No email marketing tool (Klaviyo/Omnisend/etc.) detected on the site at all -- without one, there's no welcome flow to run." },
      abandonedCart: { verdict: "missing", confidence: "high", note: "Same reason: no ESP detected, so no abandoned-cart flow is possible." },
    };
  }
  return {
    welcome: { verdict: "unconfirmed", confidence: "medium", note: `${esps.join(", ")} detected${hasPopup ? " with an email-capture popup" : ""} -- the tool to run a welcome flow is present, but whether the flow itself is built and live needs a manual signup test (submit a test email, wait, check inbox).`, espsDetected: esps, hasSignupPopup: hasPopup },
    abandonedCart: { verdict: "unconfirmed", confidence: "medium", note: `${esps.join(", ")} detected -- capable of abandoned-cart flows, but confirming one is actually live needs a manual cart-abandon test (add to cart, wait, check inbox).`, espsDetected: esps },
  };
}

/**
 * Adds an item to cart and loads the cart/checkout page to look for upsell
 * apps. Shopify-only for now (uses the standard /cart/add.js + /cart.js
 * endpoints every Shopify store exposes). Never fills payment or places an
 * order -- this only adds 1 unit of 1 product to a cart and reads the page,
 * same as any shopper who abandons a cart.
 */
async function fetchWithTimeout(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkCheckoutUpsell(baseUrl, platform) {
  if (platform !== "Shopify") {
    return { checked: false, reason: `Checkout-upsell check only supports Shopify today (detected platform: ${platform}).` };
  }
  try {
    const productsRes = await fetchHtml(new URL("/products.json?limit=1", baseUrl).toString());
    const productsJson = JSON.parse(productsRes.html);
    const variantId = productsJson?.products?.[0]?.variants?.[0]?.id;
    if (!variantId) return { checked: false, reason: "Could not find a product variant via /products.json" };

    const addRes = await fetchWithTimeout(new URL("/cart/add.js", baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA, Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
    });
    const cookie = addRes.headers.get("set-cookie") || "";
    if (!addRes.ok) return { checked: false, reason: `Add-to-cart returned ${addRes.status}` };

    const cartPageRes = await fetchWithTimeout(new URL("/cart", baseUrl).toString(), {
      headers: { "User-Agent": UA, Cookie: cookie },
    });
    const cartHtml = await cartPageRes.text();
    const lower = cartHtml.toLowerCase();
    const upsellApps = Object.keys(UPSELL_SIGNATURES).filter((k) => lower.includes(UPSELL_SIGNATURES[k]));
    const hasInlineUpsellText = /you may also like|frequently bought together|add.?on|complete the look|customers also bought/i.test(lower);

    return {
      checked: true,
      upsellAppsDetected: upsellApps,
      hasUpsellSection: upsellApps.length > 0 || hasInlineUpsellText,
      verdict: upsellApps.length > 0 || hasInlineUpsellText ? "present" : "missing",
      note: upsellApps.length > 0
        ? `Upsell app detected at cart: ${upsellApps.join(", ")}.`
        : hasInlineUpsellText
        ? "No dedicated upsell app detected, but a 'you may also like' style section was found."
        : "No post-add-to-cart upsell section or app detected -- the cart page shows only what was added, no cross-sell/upsell.",
    };
  } catch (e) {
    return { checked: false, reason: "Error during checkout-upsell check: " + e.message };
  }
}

/**
 * Runs the no-login, no-payment parts of the audit: homepage scan, page weight
 * (approximate), and one product page. Fetch-based -- no real browser, so it
 * fits inside Render's free-tier RAM limit. Does NOT do the email signup or
 * checkout tests -- those need a real browser, which doesn't fit in Render's
 * 512MB instance, so they're run outside this app and logged via
 * /api/leads/[id]/shopper-test.
 */
export async function scanSite(domain) {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  const result = { url, scannedAt: new Date().toISOString() };

  const home = await fetchHtml(url);
  if (!home.ok && !home.html) {
    throw new Error(`Could not fetch ${url} (status ${home.status})`);
  }

  const homepage = parseHomepage(home.html, url);
  homepage.transferKB = home.transferKB;
  result.homepage = homepage;

  result.pageWeight = {
    requests: null,
    fontFiles: null,
    biggest: [],
    note: "Sub-resource breakdown needs a real browser; only the main document's transfer size is available in this fetch-based scan.",
  };

  const productLink = findProductLink(home.html, url);
  if (productLink) {
    result.productPage = await fetchHtml(productLink)
      .then((r) => (r.html ? parseProductPage(r.html, productLink) : null))
      .catch(() => null);
  } else {
    result.productPage = null;
  }

  result.emailFlows = checkEmailFlows(home.html);
  result.checkoutUpsell = await Promise.race([
    checkCheckoutUpsell(url, homepage.platform),
    new Promise((resolve) =>
      setTimeout(() => resolve({ checked: false, reason: "Checkout-upsell check timed out (store may be behind bot protection)." }), 20000)
    ),
  ]).catch((e) => ({ checked: false, reason: "Error: " + e.message }));

  result.mobileScreenshotBase64 = null;
  result.note = "Fetch-based scan (no real browser) -- see comment at top of lib/scan.js.";

  return result;
}
