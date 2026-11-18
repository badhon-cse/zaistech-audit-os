# E-commerce CRO / Email / Ads Knowledge Base

Reference material for the findings-writer AI (lib/findings.js). Use this to judge
whether an observed fact is a **real, benchmark-backed pain point** or just an
opinion/nitpick. Mirrors the rulebook's section letters (db/rulebook.md §4) so it
can be read alongside that file.

**How to use this file**: a finding is strongest when it pairs an observed fact
("your abandoned-cart flow doesn't exist") with a benchmark from here ("stores
with one recover ~1-3% of lost revenue at the median, per Klaviyo/Omnisend data")
rather than a vague claim ("this could help sales"). Where a stat below is marked
**[vendor-sourced, use with caution]**, don't present it as a settled fact to a
prospect — use it only as rough internal context for how big a category of
problem tends to be, and keep the pitch to the observed fact itself.

---

## A. Email & SMS capture

**Real problem patterns:**
- No email capture at all, or a capture form with no incentive.
- Popup is full-screen/blocking on mobile right after the page loads from a
  search result or ad click — this isn't just a UX nitpick, it's an active
  Google ranking penalty (see below).
- No welcome flow, or a single generic "thanks for subscribing" email with
  no sequence behind it.
- No abandoned-cart flow, or a single plain-template reminder with no urgency,
  social proof, or incentive.

**Benchmarks:**
- Google's "intrusive interstitials" mobile ranking signal (official policy
  since Jan 2017) actively penalizes a page that shows a popup covering the
  main content right after a user arrives from search, or a standalone
  interstitial the user must dismiss before seeing content. Small banners
  using a reasonable amount of screen space, and legally-required popups
  (cookie/age-gate) are exempt. [Source: Google Search Central / widely
  documented, e.g. Search Engine Land, Smashing Magazine — this is a real,
  citable policy, not a vendor claim.]
- DTC flow benchmarks (18-brand welcome / 13-brand abandoned-cart sample,
  Top Growth Marketing's DTC benchmark dataset):
  | Flow | Click rate (median / top quartile) | Conversion rate (median / top quartile) | Revenue per recipient (median / top quartile) |
  |---|---|---|---|
  | Welcome series | 3.11% / 6.10% | 2.03% / 2.73% | $2.01 / $3.10 |
  | Abandoned cart | 5.07% / 5.55% | 1.39% / 2.14% | $2.19 / $2.79 |
  Abandoned-cart email #1 alone typically earns ~$2.97/recipient and carries
  ~64% of the whole flow's revenue — email #2 and #3+ each earn under $1.
  **[vendor/agency-sourced sample of DTC brands, directionally useful, small
  sample — use as "flows like this typically earn $X per recipient," not as
  a guaranteed number for this specific lead]**.
- Flows (automated) convert far better than one-off campaigns: median flow
  click rate ~3.21% vs. ~0.88% for campaigns (same dataset) — a ~3.7x gap.
  This is the single best argument for "you're sending campaigns but have no
  flows" as a finding — flows are passive, compounding revenue a campaign
  can't replicate.

**What makes it real vs. filler:**
- Real: "No email capture tool detected at all" or "No abandoned-cart flow —
  zero reminder emails sent to a cart left for 24h" (directly, concretely
  observed + ties to the benchmark table above).
- Filler: "Your popup could have nicer copy" or "Consider adding more flows"
  with no observed gap — don't file these.

---

## B. Customer support & chat

**Real problem patterns:**
- No chat widget at all on a site with heavy FAQ/sizing/shipping content
  (signals real unanswered-question volume).
- A chat widget present but clearly not AI (e.g., Shopify Inbox with no bot)
  on a site with high apparent support need.

**Benchmarks:**
- No single rigorous public study pins an exact revenue-per-chat number for
  small e-commerce brands — this category is judged by evidence of need
  (FAQ page size/depth, sizing complexity, shipping-policy complexity), not
  a benchmark stat. Don't manufacture a percentage here; the sellable finding
  is "no instant-answer channel exists for the X/Y/Z questions this product
  category clearly generates."

**What makes it real vs. filler:**
- Real: "No chat tool at all, and the product page has a sizing FAQ + shipping
  FAQ + returns FAQ bundled into three separate long text blocks" (shows
  genuine unanswered-question volume).
- Filler: "No chatbot" alone, on a simple one-product site with no FAQ
  complexity — low priority, likely not worth a finding on its own.

---

## C. Reviews & social proof

**Real problem patterns:**
- Zero reviews/ratings visible anywhere, especially on a product that implies
  an established brand (claims "5,000+ happy customers" sitewide but shows 0
  reviews on the PDP).
- Reviews widget present but not surfaced near Add to Cart.

**Benchmarks:**
- Spiegel Research Center (Northwestern) / PowerReviews study (Hammacher
  Schlemmer dataset): once reviews appeared on a previously-review-less
  product, **higher-priced items saw a 380% conversion increase**, and
  **lower-priced items saw a 190% increase**. The first ~5 reviews on a
  product account for most of the conversion lift — each additional review
  after that adds progressively less. **[Single-retailer study — real,
  citable academic-affiliated research, but from one dataset, so use the
  general shape of the finding ("the first few reviews matter far more than
  reaching a big number") rather than quoting 380%/190% as universal truth
  for every lead.]**

**What makes it real vs. filler:**
- Real: "Product page shows 0 reviews despite the brand claiming '10,000+
  happy customers' on the homepage" (direct contradiction + ties to the
  first-reviews-matter-most research above).
- Filler: "Could add more reviews" when reviews already exist and look
  reasonable — not a finding.

---

## D. Product page (PDP)

**Real problem patterns:**
- No guarantee/returns/shipping info near Add to Cart (trust gap at the
  exact moment of purchase decision).
- Conflicting policy text on the same page (e.g., "no returns" in one block,
  "30-day returns" in another) — always a real, high-value finding regardless
  of benchmarks, since it actively damages trust and can be screenshotted as
  direct proof.
- Missing size guide on apparel/footwear (drives returns, which cost more
  than the original sale).
- No subscription option on a genuinely consumable product (supplements,
  coffee, skincare) — leaves recurring revenue on the table.

**Benchmarks:**
- Baymard's broader checkout-abandonment reasons (below) apply here too,
  since PDP trust gaps feed directly into checkout abandonment — "unsatisfactory
  returns policy" alone accounts for 13% of documented abandonment reasons.
  (See section G for the full list and its primary source.)

**What makes it real vs. filler:**
- Real: directly conflicting policy text; a guarantee/shipping/returns block
  entirely absent near the buy box; no size guide on apparel.
- Filler: subjective headline/copy critique ("the headline could be more
  benefit-led") without a concrete missing element — too soft to sell against
  on its own; only include if it's the single strongest thing found.

---

## E. SEO (Google & AI)

**Real problem patterns:**
- Missing or duplicate H1s (confuses Google's primary-topic signal for the
  page).
- Images missing alt text at scale (hurts image search + accessibility, and
  the "X of Y images missing alt text" framing is Baymard/Google-documented
  best practice, not a judgment call).
- No Product schema / no aggregateRating schema despite having real reviews
  — directly costs the rich-snippet star rating in search results, which is
  one of the highest-leverage, cheapest-to-fix findings available (schema is
  a markup fix, not a redesign).

**Benchmarks:**
- No single "X% more clicks" number is reliably sourced for alt-text/schema
  fixes specifically (this varies hugely by site/category) — present these as
  "you're leaving a known Google ranking signal unused," not with an invented
  percentage.

**What makes it real vs. filler:**
- Real: "95 of 95 product images missing alt text" (concrete, 100% rate, easy
  to verify) or "Product schema present but missing aggregateRating despite
  having a reviews widget live" (specific, fixable, cheap).
- Filler: "Title tag could be more compelling" — too subjective to sell
  against without more context.

---

## F. Speed & technical

**Real problem patterns:**
- Mobile PageSpeed/Lighthouse performance score well below "needs work"
  threshold on a page that actually matters (homepage, PDP, checkout) —
  not just a low score in isolation, but paired with a real LCP number.
- Heavy, unexplained page weight (large unoptimized images/video, excessive
  third-party app scripts).

**Benchmarks:**
- Lighthouse/PageSpeed score bands (Google's own published guidance, already
  used by this rulebook): 90+ good, 50-89 needs improvement, <50 poor.
  LCP ≤2.5s good, >4s poor. CLS ≤0.1 good, >0.25 poor. INP ≤200ms good,
  >500ms poor.
- **Deloitte/Google "Milliseconds Make Millions" study** (commissioned by
  Google, conducted by Deloitte + 55, 37 brand sites, 30M+ user sessions,
  30 days of mobile monitoring, late 2019) — this IS a rigorous, well-sourced
  study, safe to cite directly:
  - A 0.1-second improvement across 4 load-speed metrics raised conversion
    **8.4% for retail sites**, **10.1% for travel sites**.
  - Retail funnel detail: Product Detail → Add to Basket +9.1%; Basket →
    Checkout +3.9%; Checkout → Order +4.7%; retail shoppers who experienced
    faster pages spent **9.2% more**.
  - This means even a modest, real speed fix (not a full rebuild) has a
    directly citable, credible revenue argument behind it.
- **[DO NOT USE]** The oft-repeated "Amazon found every 100ms of latency
  costs 1% in sales" stat has no verifiable primary source — it traces back
  to an unconfirmed conference anecdote, not a published Amazon study. Do not
  present it as fact. Use the Deloitte/Google figures above instead, which
  are independently documented and methodologically disclosed.

**What makes it real vs. filler:**
- Real: an actual measured LCP/performance score from this audit's own
  PageSpeed data, converted into plain language ("product photos take 17s to
  appear on mobile") — always real when the number is this audit's own.
- Filler: generic "speed is important" statements without this audit's own
  measured number attached.

---

## G. Checkout & conversion friction

**Real problem patterns:**
- Forced account creation to check out.
- Shipping cost/taxes/fees only revealed at the final step, not before.
- No guest checkout option.
- Narrow payment options (no express pay, no BNPL) on a store where AOV
  suggests price-sensitivity matters.

**Benchmarks — Baymard Institute's documented reasons for cart/checkout
abandonment** (their latest quantitative survey of US online shoppers; this
is the single most-cited primary source in this space and safe to quote
directly). Excluding the 42% who were "just browsing, not ready to buy":
| Reason | Share of abandoners |
|---|---|
| Extra costs too high (shipping, tax, fees) | 40% |
| Slow delivery | 20% |
| Distrust of entering card details on the site | 19% |
| Forced/pressured account creation | 18% |
| Checkout too long or complicated | 17% |
| Site errors/crashes | 17% |
| Unsatisfactory returns policy | 13% |
| Total cost not visible up front | 12% |
| Card declined | 10% |
| Too few payment methods | 9% |

- Separately, Baymard's account-creation research: **37%** of surveyed
  shoppers actively dislike being forced to create an account; sites that
  remove that requirement commonly see a **10-30% increase in conversion**
  **[range reported across multiple secondary summaries of Baymard's work —
  treat as a reasonable range, not a precise universal number]**.

**What makes it real vs. filler:**
- Real: "Checkout forces account creation" or "Shipping cost first shown at
  final payment step" — both map directly to a specific, large line item
  in Baymard's table above (18% and 40% respectively).
- Filler: generic "checkout could be smoother" without identifying which
  specific friction point (from the table above) is actually present.

---

## G2. Upsells & AOV

**Real problem patterns:**
- No upsell/cross-sell anywhere in the funnel (PDP, cart, checkout, or
  post-purchase) on a store that clearly could support one (multiple related
  products, consumables, apparel with accessories).

**Benchmarks — treat as directional only, vendor-sourced:**
- Post-purchase one-click upsell reports (Upsell.com's own merchant data,
  40,000+ merchants, 16.9M offers / 1.13M additional orders) claim an
  average ~5-7% conversion rate on the offer itself and a low-single-digit
  % average AOV lift, with top-performing stores well above that.
  **[vendor-sourced — self-interested (sold by the company reporting it),
  and the report has internal inconsistencies in its own published numbers
  (its 4.7% conversion figure doesn't match its own 16.9M/1.13M volume
  figures, which calculate to ~6.7%). Use only to say "stores commonly see a
  measurable but modest lift from post-purchase upsells," never quote an
  exact percentage as guaranteed.]**

**What makes it real vs. filler:**
- Real: "Zero upsell/cross-sell anywhere in the funnel" on a multi-product
  catalog — concrete, verifiable, and the fix (add one upsell block) is cheap
  relative to even a conservative view of the benchmark data above.
- Filler: "Could optimize upsell copy" when an upsell already exists — not
  worth a finding.

---

## H. Ads & tracking

**Real problem patterns:**
- Active ad spend (pixels + live ads in Meta Ad Library) paired with a weak
  landing page or no post-click nurture flow — "paying for traffic that
  leaks" is the strongest, most concrete ads-related finding this audit can
  make, because it combines two already-observed facts (ads running + no
  flow/slow page) rather than needing a new stat.
- Same creative running unchanged for months (visible directly in Ad
  Library's "time running" field) — a real, directly-observable fact, not
  an estimate.

**Benchmarks:**
- Ad-fatigue thresholds (frequency climbing, CTR dropping) are agency rules
  of thumb, not Meta-published figures, and are inconsistent across sources
  (commonly cited range: frequency above ~3-4 on a cold audience over a week,
  alongside a CTR drop of ~20%+, is treated as "creative exhausted" by
  performance-marketing agencies). **[agency-sourced convention, not an
  official Meta benchmark — don't quote as a hard rule, use only to explain
  why "same ad running N+ weeks" is worth flagging.]**

**What makes it real vs. filler:**
- Real: "3 active ads detected, oldest running since [actual date from Ad
  Library], all pointing to the same slow/no-flow homepage" — this is two
  directly observed facts combined, not a guess.
- Filler: speculating about ad performance/spend without any Ad Library
  evidence — don't claim what can't be observed.

---

## I2. Business-specific friction

**Real problem patterns:**
- Any step where the customer must do manual work a tool could automate
  (calculate a quote by hand, email for a size chart, dig through a PDF for
  specs).

**Benchmarks:**
- No universal stat applies here by definition — these are judged purely on
  the observed friction itself. A real finding names the exact manual step
  observed; there's no benchmark to lean on, so keep the bar for "real" at
  "this is a concrete, observed obstacle," not "this seems inefficient."

---

## Summary: benchmark numbers worth feeding into the findings prompt directly

The most defensible, directly-citable numbers (safe to let the AI reference
in a finding's "why it costs money" without hedging):
1. **Baymard checkout-abandonment table (section G)** — the single best
   source for checkout/account/shipping-cost findings.
2. **Deloitte/Google Milliseconds Make Millions (section F)** — the best
   source for speed findings; retail-specific breakdown by funnel step.
3. **Spiegel/PowerReviews first-reviews-matter finding (section C)** — good
   for "zero reviews" findings, keep the "first 5 reviews matter most" point
   rather than quoting the single-retailer 380%/190% figures as universal.
4. **Google's intrusive-interstitials policy (section A)** — turns "annoying
   popup" into a real, citable SEO/ranking risk, not just a UX opinion.

Numbers to NEVER present as settled fact: the Amazon "100ms = 1% sales" claim
(no verifiable source), and any single-vendor self-reported upsell/BNPL
percentage (Upsell.com, BNPL providers) — these can inform internal judgment
about rough problem size but should not appear in outreach copy as a cited
statistic.
