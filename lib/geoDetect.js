// Best-guess "what country is this company in" + a representative IANA
// timezone, read straight out of signals already present in the homepage
// HTML fetched during the audit scan (lib/scan.js) -- no paid geolocation
// API, no extra request. Same heuristic spirit as the rest of scan.js: a
// best guess with an honest confidence label and a note of which signal it
// came from, not a guaranteed fact. It's written onto the lead automatically
// when an audit runs (see lib/audit.js), and the operator can still correct
// it by hand on the outreach tracker if a specific lead is wrong -- a manual
// correction is never overwritten by a later re-audit (see lib/audit.js).
//
// Priority, strongest signal first:
//   1. schema.org / JSON-LD postal address ("addressCountry") -- the company
//      is telling you directly where it is registered/located.
//   2. og:locale meta tag -- set deliberately by the store for its audience.
//   3. <html lang="..."> attribute -- same idea, weaker (often just "en").
//   4. Store currency (Shopify currency meta / JSON, schema priceCurrency)
//      -- tells you who the store SELLS to, not necessarily where the
//      company itself sits, so this is a lower-confidence signal.
//   5. Domain TLD (.co.uk, .com.au, ...) -- last resort, easy to be wrong
//      (plenty of US/global brands sit on .com regardless of HQ).

const COUNTRY_ALIASES = {
  us: "United States", usa: "United States", "united states": "United States", "united states of america": "United States",
  gb: "United Kingdom", uk: "United Kingdom", "united kingdom": "United Kingdom",
  ca: "Canada", canada: "Canada",
  au: "Australia", australia: "Australia",
  nz: "New Zealand", "new zealand": "New Zealand",
  ie: "Ireland", ireland: "Ireland",
  de: "Germany", germany: "Germany",
  fr: "France", france: "France",
  it: "Italy", italy: "Italy",
  es: "Spain", spain: "Spain",
  nl: "Netherlands", netherlands: "Netherlands",
  fi: "Finland", finland: "Finland",
  sg: "Singapore", singapore: "Singapore",
  in: "India", india: "India",
  ae: "United Arab Emirates", "united arab emirates": "United Arab Emirates",
};

// country name -> representative IANA timezone. Large countries don't have
// one true timezone, so this picks the zone where the bulk of e-commerce HQs
// actually sit (US -> Eastern, Canada -> Toronto) -- close enough for "is it
// office hours", and always correctable by hand.
const COUNTRY_TZ = {
  "United States": "America/New_York",
  "United Kingdom": "Europe/London",
  Canada: "America/Toronto",
  Australia: "Australia/Sydney",
  "New Zealand": "Pacific/Auckland",
  Ireland: "Europe/London",
  Germany: "Europe/Berlin",
  France: "Europe/Berlin",
  Italy: "Europe/Berlin",
  Spain: "Europe/Berlin",
  Netherlands: "Europe/Berlin",
  Finland: "Europe/Helsinki",
  Singapore: "Asia/Singapore",
  India: "Asia/Kolkata",
  "United Arab Emirates": "Asia/Dubai",
};

const LOCALE_COUNTRY = {
  "en-us": "United States", "en-gb": "United Kingdom", "en-ca": "Canada", "en-au": "Australia",
  "en-nz": "New Zealand", "en-ie": "Ireland", "en-in": "India", "en-sg": "Singapore",
  "de-de": "Germany", "de-at": "Germany", "de-ch": "Germany",
  "fr-fr": "France", "es-es": "Spain", "it-it": "Italy", "nl-nl": "Netherlands",
};

const CURRENCY_COUNTRY = {
  usd: "United States", gbp: "United Kingdom", cad: "Canada", aud: "Australia", nzd: "New Zealand",
  eur: "Germany", // EUR alone can't tell you which euro country -- Germany is the most common
                  // e-commerce-tool default and a safe representative for "European business hours".
  inr: "India", sgd: "Singapore", aed: "United Arab Emirates",
};

// Two-part TLDs need checking before the last segment alone.
const CCTLD_COUNTRY = {
  "co.uk": "United Kingdom", "com.au": "Australia", "co.nz": "New Zealand",
};
const SINGLE_TLD_COUNTRY = {
  uk: "United Kingdom", ca: "Canada", au: "Australia", nz: "New Zealand", ie: "Ireland",
  de: "Germany", fr: "France", it: "Italy", es: "Spain", nl: "Netherlands", fi: "Finland",
  sg: "Singapore", in: "India", ae: "United Arab Emirates",
};

function tldCountry(domain) {
  const host = (domain || "").replace(/^https?:\/\//, "").replace(/\/.*/, "").toLowerCase();
  const parts = host.split(".");
  if (parts.length >= 3) {
    const two = parts.slice(-2).join(".");
    if (CCTLD_COUNTRY[two]) return { country: CCTLD_COUNTRY[two], source: `domain (.${two})` };
  }
  const last = parts[parts.length - 1];
  if (SINGLE_TLD_COUNTRY[last]) return { country: SINGLE_TLD_COUNTRY[last], source: `domain (.${last})` };
  return null;
}

function normalizeCountry(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return COUNTRY_ALIASES[key] || null;
}

function extractAddressCountry(html) {
  const m = html.match(/"addressCountry"\s*:\s*"([^"]+)"/i) || html.match(/"addressCountry"\s*:\s*\{\s*"[^"]*"\s*:\s*"([^"]+)"/i);
  return m ? normalizeCountry(m[1]) : null;
}

function extractLocale(html) {
  const og = html.match(/<meta[^>]+property=["']og:locale["'][^>]*content=["']([^"']+)["']/i);
  if (og) return og[1].toLowerCase().replace(/_/g, "-");
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  return lang ? lang[1].toLowerCase() : null;
}

function extractCurrency(html) {
  const m =
    html.match(/<meta[^>]+name=["']shopify-currency["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/Shopify\.currency\s*=\s*\{\s*"active"\s*:\s*"([A-Za-z]{3})"/) ||
    html.match(/"priceCurrency"\s*:\s*"([A-Za-z]{3})"/i) ||
    html.match(/"currency"\s*:\s*"([A-Za-z]{3})"/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * @param {string} html  Raw homepage HTML (the same string scan.js fetches).
 * @param {string} domain
 * @returns {{country: string|null, timezone: string|null, confidence: "high"|"medium"|"low"|"none", source: string|null}}
 */
export function detectCountryAndTimezone(html, domain) {
  if (!html) return { country: null, timezone: null, confidence: "none", source: null };

  const addressCountry = extractAddressCountry(html);
  if (addressCountry) {
    return { country: addressCountry, timezone: COUNTRY_TZ[addressCountry] || null, confidence: "high", source: "store address (schema.org)" };
  }

  const locale = extractLocale(html);
  if (locale && LOCALE_COUNTRY[locale]) {
    const country = LOCALE_COUNTRY[locale];
    return { country, timezone: COUNTRY_TZ[country] || null, confidence: "medium", source: `page locale (${locale})` };
  }

  const currency = extractCurrency(html);
  if (currency && CURRENCY_COUNTRY[currency]) {
    const country = CURRENCY_COUNTRY[currency];
    return { country, timezone: COUNTRY_TZ[country] || null, confidence: "low", source: `store currency (${currency.toUpperCase()})` };
  }

  const fromTld = tldCountry(domain);
  if (fromTld) {
    return { country: fromTld.country, timezone: COUNTRY_TZ[fromTld.country] || null, confidence: "low", source: fromTld.source };
  }

  return { country: null, timezone: null, confidence: "none", source: null };
}
