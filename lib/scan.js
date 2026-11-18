// Playwright-based site scan -- ports the rulebook's browser scripts (SKILL.md sections 3.1-3.3)
// into a script this backend can run on its own, without a human driving the browser.
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

/**
 * Runs the no-login, no-payment parts of the audit: homepage scan, page weight,
 * one product page, and a mobile screenshot. Does NOT do the email signup or
 * checkout tests -- those need an explicit per-run opt-in (see runAudit in audit.js)
 * and are intentionally left as a separate, smaller function so they're never run
 * by accident.
 */
export async function scanSite(domain) {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  const browser = await chromium.launch({ headless: true });
  const result = { url, scannedAt: new Date().toISOString() };

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    result.homepage = await page.evaluate((sigs) => {
      const html = document.documentElement.outerHTML.toLowerCase();
      const has = (s) => html.includes(s);
      const apps = Object.keys(sigs).filter((k) => has(sigs[k]));
      const perf = performance.getEntriesByType("navigation")[0] || {};
      return {
        platform: window.Shopify
          ? "Shopify"
          : has("wp-content")
          ? has("woocommerce")
            ? "WooCommerce"
            : "WordPress"
          : has("bigcommerce")
          ? "BigCommerce"
          : has("squarespace")
          ? "Squarespace"
          : has("wix")
          ? "Wix"
          : "other",
        title: document.title,
        metaDesc: (document.querySelector("meta[name=description]") || {}).content || null,
        h1s: [...document.querySelectorAll("h1")].map((h) => h.innerText.trim().slice(0, 80)),
        apps,
        emailInputs: document.querySelectorAll("input[type=email]").length,
        imgsNoAlt: [...document.images].filter((i) => !i.alt).length,
        imgs: document.images.length,
        scripts: document.scripts.length,
        loadMs: Math.round(perf.loadEventEnd || 0),
        transferKB: Math.round(
          performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), 0) / 1024
        ),
        bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 2000),
      };
    }, APP_SIGNATURES);

    result.pageWeight = await page.evaluate(() => {
      const res = performance.getEntriesByType("resource");
      return {
        requests: res.length,
        fontFiles: res.filter((r) => [".woff", ".ttf", ".otf"].some((x) => r.name.includes(x))).length,
        biggest: [...res]
          .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
          .slice(0, 6)
          .map((r) => [r.name.slice(0, 120), Math.round((r.transferSize || 0) / 1024) + "KB"]),
      };
    });

    // One product page, if this looks like an e-commerce storefront.
    result.productPage = await page
      .evaluate(async () => {
        const link = [...document.querySelectorAll('a[href*="/products/"],a[href*="/product/"]')]
          .map((a) => a.href)
          .find((h) => !/gift|#/.test(h));
        if (!link) return null;
        const r = await fetch(link);
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        doc.querySelectorAll("script,style,noscript").forEach((e) => e.remove());
        const t = doc.body.textContent.replace(/\s+/g, " ");
        return {
          url: link,
          title: doc.title,
          h1: [...doc.querySelectorAll("h1")].map((h) => h.textContent.trim()),
          reviewsMention: (t.match(/\d[\d,]*\s*(reviews|ratings)/gi) || []).slice(0, 2),
          guarantee: (t.match(/[^.]{0,60}(guarantee|money.back|risk.free)[^.]{0,40}/i) || [null])[0],
          shipping: (t.match(/[^.]{0,30}free shipping[^.]{0,50}/i) || [null])[0],
          imgsNoAlt: [...doc.images].filter((i) => !i.getAttribute("alt")).length,
          imgs: doc.images.length,
        };
      })
      .catch(() => null);

    // Mobile screenshot -- stored as a base64 PNG; the caller is responsible for
    // uploading it somewhere durable (Supabase Storage) if it wants to keep it.
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await mobile.waitForTimeout(2000);
    result.mobileScreenshotBase64 = (await mobile.screenshot({ type: "jpeg", quality: 60 })).toString("base64");
    await mobile.close();

    return result;
  } finally {
    await browser.close();
  }
}

/**
 * The opt-in-only shopper test: subscribes the audit email on the signup form,
 * and separately enters it at checkout. Never fills payment or places an order.
 * Call this ONLY after the dashboard UI has recorded the user's one-line OK
 * for this specific lead (see the "allowSignupTest"/"allowCheckoutTest" flags
 * on the audit run).
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
