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
import { chromium } from "playwright";

const APP_SIGNATURES = {
  klaviyo: "klaviyo", omnisend: "omnisend", attentive: "attentive", postscript: "postscript",
  privy: "privy", justuno: "justuno", mailchimp: "mailchimp", brevo: "brevo", gorgias: "gorgias",
  tidio: "tidio", zendesk: "zdassets", intercom: "intercom", richpanel: "richpanel", reamaze: "reamaze",
  shopifyInbox: "shopify-chat", judgeme: "judge.me", yotpo: "yotpo", okendo: "okendo",
  stamped: "stamped.io", loox: "loox", junip: "junip", recharge: "rechargeapps", skio: "skio",
  metaPixel: "fbevents", tiktok: "analytics.tiktok", gtm: "googletagmanager",
  afterpay: "afterpay", klarna: "klarna", affirm: "affirm", sezzle: "sezzle",
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
  const imgTags = matchAll(html, /<img\b[^>]*>/gi);
  const imgsNoAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;

  return {
    url: link,
    title: titleMatch ? titleMatch[1].trim() : null,
    h1,
    reviewsMention: (text.match(/\d[\d,]*\s*(reviews|ratings)/gi) || []).slice(0, 2),
    guarantee: (text.match(/[^.]{0,60}(guarantee|money.back|risk.free)[^.]{0,40}/i) || [null])[0],
    shipping: (text.match(/[^.]{0,30}free shipping[^.]{0,50}/i) || [null])[0],
    imgsNoAlt,
    imgs: imgTags.length,
  };
}

/**
 * Runs the no-login, no-payment parts of the audit: homepage scan, page weight
 * (approximate), and one product page. Fetch-based -- no real browser, so it
 * fits inside Render's free-tier RAM limit. Does NOT do the email signup or
 * checkout tests -- those need an explicit per-run opt-in (see runAudit in
 * audit.js) and still use Playwright (see runShopperTest below); keep those
 * opt-in-only unless the service is on a plan with more than 512MB RAM.
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

  result.mobileScreenshotBase64 = null;
  result.note = "Fetch-based scan (no real browser) -- see comment at top of lib/scan.js.";

  return result;
}

/**
 * The opt-in-only shopper test: subscribes the audit email on the signup form,
 * and separately enters it at checkout. Never fills payment or places an order.
 * Call this ONLY after the dashboard UI has recorded the user's one-line OK
 * for this specific lead (see the "allowSignupTest"/"allowCheckoutTest" flags
 * on the audit run).
 *
 * Still uses a real Playwright browser, since filling and submitting a form
 * needs one. On Render's free tier (512MB RAM) this can OOM-crash the
 * instance -- keep it opt-in-only, and upgrade the Render plan before relying
 * on it for real runs.
 */
export async function runShopperTest(domain, auditEmail, { allowSignup, allowCheckout }) {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  const browser = await chromium.launch({ headless: true });
  const result = {};
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});

    if (allowSignup) {
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.count()) {
        await emailInput.fill(auditEmail).catch(() => {});
        const form = emailInput.locator("xpath=ancestor::form[1]");
        if (await form.count()) {
          await form.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
        }
        result.welcomeTest = { attempted: true, emailUsed: auditEmail, at: new Date().toISOString() };
      } else {
        result.welcomeTest = { attempted: false, reason: "no email input found on homepage" };
      }
    }

    if (allowCheckout) {
      // Rulebook rule: enter the audit email at checkout, then STOP. Never fill
      // payment, never click a final "Place order" button. This function does not
      // contain any payment-field or order-submit logic, by design.
      result.checkoutTest = {
        attempted: false,
        reason:
          "Checkout flows differ too much per platform to automate the add-to-cart + checkout navigation safely here -- this step currently needs a human-driven run (see the rulebook skill). Logged as couldn't verify.",
      };
    }

    return result;
  } finally {
    await browser.close();
  }
}
