# CRO / Email / Ads benchmark cheat-sheet

Condensed from db/cro_knowledge_base.md (full research + per-section "real vs
filler" guidance lives there for human reference). This is the version fed to
the findings-writer AI every audit -- just the numbers worth grounding a
finding in, kept small on purpose since this gets sent on every single run.

**Use these to judge if a finding is genuinely costly, and to write "why it
costs money" with a real citation instead of an invented number. Never quote
a specific percentage as a guaranteed outcome for this one lead -- use the
general shape ("this is one of the top reasons shoppers abandon checkout"),
not a promise.**

- **Checkout/cart abandonment reasons** (Baymard Institute, the primary
  source in this space): extra costs (shipping/tax/fees) 40%, slow delivery
  20%, card-detail distrust 19%, forced account creation 18%, checkout too
  long/complicated 17%, site errors 17%, bad returns policy 13%, total cost
  not shown up front 12%, card declined 10%, too few payment methods 9%.
  Removing forced account creation commonly sees a 10-30% conversion lift
  (range across secondary summaries of Baymard's work, not a precise number).
- **Speed vs. conversion** (Deloitte + Google "Milliseconds Make Millions,"
  37 sites, 30M+ sessions -- rigorous, safe to cite directly): a 0.1s
  improvement raised conversion 8.4% on retail sites; faster shoppers spent
  9.2% more. Funnel detail: Product->Basket +9.1%, Basket->Checkout +3.9%,
  Checkout->Order +4.7%. [DO NOT USE the "Amazon 100ms=1% sales" claim --
  no verifiable source, don't present it as fact.]
- **Reviews** (Spiegel Research Center / PowerReviews, Northwestern-affiliated):
  adding reviews to a previously-review-less product raised conversion 380%
  (higher-priced items) / 190% (lower-priced) in that study, and the first
  ~5 reviews on a product drive most of the lift. Single-retailer study --
  use the general shape ("first few reviews matter most"), not those exact
  percentages as universal.
- **Popups** (Google's "intrusive interstitials" policy, official since 2017):
  a full-page popup covering content right after a visitor arrives from
  search is an active Google mobile-ranking penalty, not just a UX nitpick --
  small banners and legally-required popups (cookie/age-gate) are exempt.
- **Email flows vs. campaigns** (DTC benchmark sample): automated flows
  convert far better than one-off campaigns (~3.21% vs ~0.88% median click
  rate, ~3.7x). Abandoned-cart email #1 alone typically earns the majority of
  that flow's revenue. [Vendor/agency-sourced sample -- directional, not a
  guarantee for a specific lead.]
- **Post-purchase upsells / BNPL AOV lift**: vendor-reported, self-interested,
  internally inconsistent in places -- use only to say "stores commonly see a
  modest measurable lift," never quote an exact percentage as settled fact.
- **Ad creative fatigue** (frequency ~3-4+ on a cold audience, CTR dropping
  ~20%+): an agency rule of thumb, not an official Meta benchmark -- use only
  to explain why "same ad running N+ weeks" is worth flagging, not as a hard
  rule.

If a potential finding has no real data behind it in either the scan data or
this list, that itself is a sign it's filler -- leave it out rather than
inventing a number to back it.
