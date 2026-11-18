"use client";
import { useEffect, useState } from "react";

const PAGE_GROUPS = [
  { key: "homepage", label: "Homepage", metricsPage: "homepage" },
  { key: "product page", label: "Product Page", metricsPage: "product" },
  { key: "checkout", label: "Checkout", metricsPage: "checkout" },
  { key: "email", label: "Email (Welcome + Abandoned Cart)", metricsPage: null },
];

export default function LeadDetail({ params }) {
  const { id } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  async function load() {
    const res = await fetch(`/api/leads/${id}`);
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function approve() {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "audited" }),
    });
    load();
  }

  if (loading) return <p style={{ padding: 24, color: "#5b6673" }}>Loading…</p>;
  if (data.error) return <p style={{ padding: 24 }}>{data.error}</p>;

  const { lead, latestAudit, findings, strengths, metrics, inboxChecks } = data;
  const checkoutUpsell = latestAudit?.raw?.scan?.checkoutUpsell || null;

  const findingsByPage = {};
  for (const g of PAGE_GROUPS) findingsByPage[g.key] = [];
  const otherFindings = [];
  for (const f of findings) {
    const key = (f.where_ || "").toLowerCase().trim();
    if (findingsByPage[key]) findingsByPage[key].push(f);
    else otherFindings.push(f);
  }

  const topScore = metrics.find((m) => m.page === "homepage")?.pagespeed_score;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={lightboxOverlay}>
          <img src={lightbox} alt="Full screenshot" style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,.4)" }} />
        </div>
      )}

      <a href="/" style={{ color: "#2f5d8a", fontSize: 13, textDecoration: "none" }}>
        ← Back to pipeline
      </a>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 10, marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 2px", fontSize: 28 }}>{lead.company}</h1>
          <p style={{ color: "#5b6673", margin: 0, fontSize: 14 }}>
            {lead.domain} &middot; {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}
            {lead.title ? ` — ${lead.title}` : ""}
          </p>
        </div>
        {topScore != null && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <ScoreRing value={topScore} size={60} />
            <div style={{ fontSize: 11, color: "#9aa3af", marginTop: 2 }}>Site speed score</div>
          </div>
        )}
      </div>

      {!latestAudit && (
        <p style={{ color: "#5b6673" }}>No audit yet. Go back to the pipeline and press "Run audit".</p>
      )}

      {latestAudit && (
        <>
          {strengths.length > 0 && (
            <section style={{ ...cardStyle, background: "#f4faf6", border: "1px solid #d7ecdf" }}>
              <h3 style={{ ...h3, color: "#1e7a43" }}>✓ Strengths</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {strengths.map((s) => (
                  <li key={s.id} style={{ marginBottom: 4, fontSize: 14 }}>{s.text}</li>
                ))}
              </ul>
            </section>
          )}

          {PAGE_GROUPS.map((g) => {
            const pageFindings = findingsByPage[g.key];
            const metric = g.metricsPage ? metrics.find((m) => m.page === g.metricsPage) : null;
            const hasEmailData = g.key === "email" && inboxChecks?.length > 0;
            const hasCheckoutData = g.key === "checkout" && checkoutUpsell;
            if (!pageFindings.length && !metric && !hasEmailData && !hasCheckoutData) return null;

            return (
              <section key={g.key} style={cardStyle}>
                <h3 style={h3}>{g.label}</h3>

                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {/* preview_screenshot_base64 is an early, popup-free filmstrip
                      frame -- used here instead of the full-page screenshot
                      because the full-page shot is captured at the END of the
                      page load, by which point a timed email/discount popup has
                      usually appeared and covers the whole page (so every page's
                      "full page" screenshot ends up looking like the same popup).
                      Clicking still zooms to the full-page screenshot since
                      that's still useful to see in full, popup and all. */}
                  {(metric?.preview_screenshot_base64 || metric?.screenshot_base64) && (
                    <img
                      src={metric.preview_screenshot_base64 || metric.screenshot_base64}
                      alt={`${g.label} screenshot`}
                      onClick={() => setLightbox(metric.screenshot_base64 || metric.preview_screenshot_base64)}
                      style={{ width: 150, borderRadius: 8, border: "1px solid #e6e9ee", cursor: "zoom-in", flexShrink: 0 }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 220 }}>
                    {metric && (
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 10 }}>
                        <ScoreBadge label="Performance" value={metric.pagespeed_score} />
                        <ScoreBadge label="SEO" value={metric.seo_score} />
                        <ScoreBadge label="Accessibility" value={metric.accessibility_score} />
                      </div>
                    )}
                    {metric && (
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "#374151", marginBottom: 10 }}>
                        <Metric label="LCP" value={metric.lcp} />
                        <Metric label="CLS" value={metric.cls} />
                        <Metric label="TBT" value={metric.tbt} />
                        <Metric label="Speed Index" value={metric.speed_index} />
                        {metric.page_weight_kb != null && <Metric label="Page weight" value={`${metric.page_weight_kb} KB`} />}
                      </div>
                    )}

                    {hasEmailData && (
                      <div style={{ marginBottom: 10 }}>
                        {inboxChecks.map((c) => (
                          <VerdictRow
                            key={c.id}
                            label={c.kind === "welcome" ? "Welcome flow" : "Abandoned-cart flow"}
                            verdict={c.verdict}
                            note={c.result?.note}
                          />
                        ))}
                      </div>
                    )}

                    {hasCheckoutData && (
                      <div style={{ marginBottom: 10 }}>
                        <VerdictRow
                          label="Post-add-to-cart upsell"
                          verdict={checkoutUpsell.checked ? checkoutUpsell.verdict : "not_applicable"}
                          note={checkoutUpsell.checked ? checkoutUpsell.note : checkoutUpsell.reason}
                        />
                      </div>
                    )}

                    {metric?.top_opportunities?.length > 0 && (
                      <IssueList title="Top opportunities" items={metric.top_opportunities.map((o) => `${o.title}${o.savingsMs ? ` — saves ~${o.savingsMs}ms` : ""}`)} />
                    )}
                    {metric?.page_issues?.length > 0 && (
                      <IssueList title="Product page issues" items={metric.page_issues} />
                    )}
                  </div>
                </div>

                {pageFindings.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    {pageFindings.map((f) => <FindingRow key={f.id} f={f} metric={metric} onZoom={setLightbox} />)}
                  </div>
                )}
              </section>
            );
          })}

          {otherFindings.length > 0 && (
            <section style={cardStyle}>
              <h3 style={h3}>Other Findings</h3>
              {otherFindings.map((f) => {
                const m = f.screenshot_source ? metrics.find((mm) => mm.page === f.screenshot_source) : null;
                return <FindingRow key={f.id} f={f} metric={m} onZoom={setLightbox} />;
              })}
            </section>
          )}

          {lead.status === "needs_review" && (
            <button onClick={approve} style={primaryBtn}>
              Approve audit
            </button>
          )}
        </>
      )}
    </div>
  );
}

function FindingRow({ f, metric, onZoom }) {
  const [demoHtml, setDemoHtml] = useState(f.demo_html || null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoError, setDemoError] = useState(null);

  async function generateDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const res = await fetch(`/api/findings/${f.id}/demo`, { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDemoHtml(json.demo_html);
      setDemoOpen(true);
    } catch (e) {
      setDemoError(e.message);
    } finally {
      setDemoLoading(false);
    }
  }

  // A crop is only shown when a real Lighthouse-flagged element matched this
  // finding (see matchCropRect in lib/audit.js) -- pure CSS crop of the
  // full-page screenshot, no image processing needed.
  const hasCrop = f.crop_rect && metric?.screenshot_base64 && metric.screenshot_width && metric.screenshot_height;
  const crop = hasCrop ? f.crop_rect : null;
  const thumbW = 110;
  const thumbH = crop ? Math.max(46, Math.min(130, Math.round((thumbW * crop.height) / crop.width))) : 0;

  return (
    <div style={{ borderBottom: "1px solid #f0f2f5", padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {crop && (
          <div
            onClick={() => onZoom?.(metric.screenshot_base64)}
            title="Click to see full page screenshot"
            style={{
              width: thumbW,
              height: thumbH,
              flexShrink: 0,
              borderRadius: 6,
              border: "1px solid #e6e9ee",
              cursor: "zoom-in",
              backgroundImage: `url(${metric.screenshot_base64})`,
              backgroundSize: `${metric.screenshot_width}px ${metric.screenshot_height}px`,
              backgroundPosition: `-${crop.left}px -${crop.top}px`,
              backgroundRepeat: "no-repeat",
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            <span style={{ ...tag, marginRight: 6 }}>{f.area}</span>
            {f.what}
          </div>
          <div style={{ fontSize: 13, color: "#5b6673", marginTop: 3 }}>Why it costs money: {f.why}</div>
          <div style={{ fontSize: 13, color: "#5b6673" }}>Fix: {f.fix}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2f5d8a", marginTop: 2 }}>Service: {f.service}</div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!demoHtml && (
              <button onClick={generateDemo} disabled={demoLoading} style={demoBtn}>
                {demoLoading ? "Generating demo…" : "✨ Generate Demo"}
              </button>
            )}
            {demoHtml && (
              <>
                <button onClick={() => setDemoOpen((o) => !o)} style={demoBtnSecondary}>
                  {demoOpen ? "Hide demo" : "▸ View demo"}
                </button>
                <button onClick={generateDemo} disabled={demoLoading} style={{ ...demoBtnSecondary, opacity: 0.7 }}>
                  {demoLoading ? "Regenerating…" : "Regenerate"}
                </button>
              </>
            )}
            {demoError && <span style={{ color: "#b42318", fontSize: 12 }}>Demo failed: {demoError}</span>}
          </div>
        </div>
      </div>

      {demoOpen && demoHtml && (
        <div style={{ marginTop: 10, border: "1px solid #e6e9ee", borderRadius: 8, overflow: "hidden" }}>
          <iframe srcDoc={demoHtml} sandbox="" title="Demo mockup" style={{ width: "100%", height: 440, border: "none", display: "block" }} />
        </div>
      )}
    </div>
  );
}

function IssueList({ title, items }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#5b6673", marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function VerdictRow({ label, verdict, note }) {
  const colors = {
    missing: { bg: "#fdecec", fg: "#b42318", text: "Missing" },
    unconfirmed: { bg: "#fef3e2", fg: "#9a6700", text: "Tool detected — needs manual check" },
    present: { bg: "#e7f6ec", fg: "#1e7a43", text: "Present" },
    good: { bg: "#e7f6ec", fg: "#1e7a43", text: "Good" },
    weak: { bg: "#fef3e2", fg: "#9a6700", text: "Weak" },
    not_applicable: { bg: "#f0f2f5", fg: "#5b6673", text: "N/A" },
  };
  const c = colors[verdict] || colors.not_applicable;
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}: </span>
      <span style={{ background: c.bg, color: c.fg, borderRadius: 5, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>{c.text}</span>
      {note && <div style={{ fontSize: 12.5, color: "#5b6673", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function scoreColor(v) {
  if (v == null) return "#9aa3af";
  if (v >= 90) return "#16a34a";
  if (v >= 50) return "#d97706";
  return "#dc2626";
}

function ScoreRing({ value, size = 48 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", border: `4px solid ${scoreColor(value)}`,
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
        fontSize: size * 0.32, color: scoreColor(value), margin: "0 auto",
      }}
    >
      {value ?? "—"}
    </div>
  );
}

function ScoreBadge({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <ScoreRing value={value} size={46} />
      <div style={{ fontSize: 11, color: "#5b6673", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span style={{ color: "#9aa3af" }}>{label}:</span>{" "}
      <span style={{ fontWeight: 600 }}>{value ?? "—"}</span>
    </div>
  );
}

const cardStyle = { background: "#fff", borderRadius: 12, border: "1px solid #e6e9ee", padding: 18, marginBottom: 16, boxShadow: "0 1px 2px rgba(16,24,40,.03)" };
const h3 = { marginTop: 0, marginBottom: 12, fontSize: 13, color: "#5b6673", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const demoBtn = { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const demoBtnSecondary = { background: "#f3eefe", color: "#6d28d9", border: "1px solid #e5d9fc", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const tag = { background: "#eef2f7", color: "#5b6673", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", borderRadius: 4, padding: "2px 6px" };
const lightboxOverlay = { position: "fixed", inset: 0, background: "rgba(16,20,26,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, cursor: "zoom-out" };
