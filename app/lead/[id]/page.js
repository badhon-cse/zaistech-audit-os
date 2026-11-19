"use client";
import { useEffect, useState } from "react";
import {
  COLORS, FONT, RADIUS, cardStyle as baseCard, tagStyle as tag, primaryBtnLg as primaryBtn, linkBtn, backLink,
  smallBtn, smallDangerBtn, disabledStyle,
} from "../../../lib/ui.js";

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
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "audited" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Could not approve audit: " + (err.error || res.statusText));
    }
    load();
  }

  // Pull a finding from outreach (included=false) or put it back. A pulled
  // finding is skipped by the AI draft generator and counts as a "weak
  // finding" signal for the rulebook self-improvement loop.
  const [findingBusyId, setFindingBusyId] = useState(null);
  async function toggleIncluded(f) {
    const included = f.included === false; // pulled -> keep, kept -> pull
    setFindingBusyId(f.id);
    try {
      const res = await fetch(`/api/findings/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Could not update finding: " + (err.error || res.statusText));
        return;
      }
      setData((d) => ({ ...d, findings: d.findings.map((x) => (x.id === f.id ? { ...x, included } : x)) }));
    } finally {
      setFindingBusyId(null);
    }
  }

  if (loading) return <p style={{ color: COLORS.textSecondary }}>Loading…</p>;
  if (data.error) return <p>{data.error}</p>;

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
    // Narrower than the layout's 1100px on purpose: this is a long reading
    // page. Left-aligned so it lines up with the header.
    <div style={{ maxWidth: 880 }}>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={lightboxOverlay}>
          <img src={lightbox} alt="Full screenshot" style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: RADIUS.md, boxShadow: "0 20px 60px rgba(0,0,0,.4)" }} />
        </div>
      )}

      <a href="/" style={backLink}>
        ← Back to pipeline
      </a>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 10, marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 2px", fontSize: FONT.xxl }}>{lead.company}</h1>
          <p style={{ color: COLORS.textSecondary, margin: 0, fontSize: FONT.md }}>
            {lead.domain} &middot; {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}
            {lead.title ? ` — ${lead.title}` : ""}
          </p>
        </div>
        {topScore != null && (
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <ScoreRing value={topScore} size={60} />
            <div style={{ fontSize: FONT.xs, color: COLORS.muted, marginTop: 2 }}>Site speed score</div>
          </div>
        )}
      </div>

      <p style={{ fontSize: FONT.sm, color: COLORS.muted, margin: "0 0 20px" }}>
        This page is the audit only. Outreach, drafts, and outcome (replied / won / lost) are on the{" "}
        <a href="/outreach" style={{ color: COLORS.primary }}>outreach tracker</a>.
      </p>

      {!latestAudit && (
        <p style={{ color: COLORS.textSecondary }}>No audit yet. Go back to the pipeline and press "Run audit".</p>
      )}

      {latestAudit && (
        <>
          <ChatWidgetCard appsDetected={latestAudit.apps_detected || []} />

          {strengths.length > 0 && (
            <section style={{ ...cardStyle, background: "#f4faf6", border: "1px solid #d7ecdf" }}>
              <h3 style={{ ...h3, color: COLORS.success }}>✓ Strengths</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {strengths.map((s) => (
                  <li key={s.id} style={{ marginBottom: 4, fontSize: FONT.md }}>{s.text}</li>
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
                      style={{ width: 150, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, cursor: "zoom-in", flexShrink: 0 }}
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
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: FONT.sm, color: COLORS.body, marginBottom: 10 }}>
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
                        <LiveEmailTestControls leadId={id} onChange={load} />
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
                    {pageFindings.map((f) => (
                      <FindingRow key={f.id} f={f} metric={metric} onZoom={setLightbox} onToggleIncluded={toggleIncluded} busy={findingBusyId === f.id} />
                    ))}
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
                return <FindingRow key={f.id} f={f} metric={m} onZoom={setLightbox} onToggleIncluded={toggleIncluded} busy={findingBusyId === f.id} />;
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

function FindingRow({ f, metric, onZoom, onToggleIncluded, busy }) {
  const pulled = f.included === false;
  // A crop is only shown when a real Lighthouse-flagged element matched this
  // finding (see matchCropRect in lib/audit.js) -- pure CSS crop of the
  // full-page screenshot, no image processing needed.
  const hasCrop = f.crop_rect && metric?.screenshot_base64 && metric.screenshot_width && metric.screenshot_height;
  const crop = hasCrop ? f.crop_rect : null;
  const thumbW = 110;
  const thumbH = crop ? Math.max(46, Math.min(130, Math.round((thumbW * crop.height) / crop.width))) : 0;

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.divider}`, padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {crop && (
          <div
            onClick={() => onZoom?.(metric.screenshot_base64)}
            title="Click to see full page screenshot"
            style={{
              width: thumbW,
              height: thumbH,
              flexShrink: 0,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
              cursor: "zoom-in",
              backgroundImage: `url(${metric.screenshot_base64})`,
              backgroundSize: `${metric.screenshot_width}px ${metric.screenshot_height}px`,
              backgroundPosition: `-${crop.left}px -${crop.top}px`,
              backgroundRepeat: "no-repeat",
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0, opacity: pulled ? 0.6 : 1 }}>
          <div style={{ fontWeight: 600, fontSize: FONT.md }}>
            <span style={{ ...tag, marginRight: 6 }}>{f.area}</span>
            {f.what}
          </div>
          <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 3 }}>Why it costs money: {f.why}</div>
          <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary }}>Fix: {f.fix}</div>
          <div style={{ fontSize: FONT.sm, fontWeight: 600, color: COLORS.primary, marginTop: 2 }}>Service: {f.service}</div>
          {pulled && (
            <div style={{ fontSize: FONT.xs, fontWeight: 700, color: COLORS.danger, marginTop: 4 }}>
              Pulled from outreach — AI drafts skip this finding
            </div>
          )}
        </div>
        {onToggleIncluded && (
          <button
            onClick={() => onToggleIncluded(f)}
            disabled={busy}
            title={pulled
              ? "Put this finding back into outreach drafts"
              : "Not good enough to send: skip it in AI drafts and flag it as a weak finding for rulebook self-improvement"}
            style={{ ...(pulled ? smallBtn : smallDangerBtn), flexShrink: 0, ...disabledStyle(busy) }}
          >
            {busy ? "…" : pulled ? "Keep" : "Remove from outreach"}
          </button>
        )}
      </div>
    </div>
  );
}

function IssueList({ title, items }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: FONT.sm, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: FONT.sm, color: COLORS.body }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

// Which detected apps (from scan.homepage.apps, saved as audits.apps_detected
// -- see APP_SIGNATURES in lib/scan.js) are chat/support widgets, and which of
// those count as "has real chat" vs "basic, no AI" (Shopify Inbox is the
// classic basic case the rulebook calls out by name -- see db/rulebook.md
// section B, "No chat, or a basic chat with no AI (e.g. Shopify Inbox)").
const CHAT_APP_LABELS = {
  tidio: "Tidio", zendesk: "Zendesk Chat", intercom: "Intercom",
  richpanel: "Richpanel", reamaze: "Re:amaze", shopifyInbox: "Shopify Inbox",
};
const BASIC_CHAT_APPS = new Set(["shopifyInbox"]);

function ChatWidgetCard({ appsDetected }) {
  const detected = (appsDetected || []).filter((a) => CHAT_APP_LABELS[a]);
  const names = detected.map((a) => CHAT_APP_LABELS[a]);
  const onlyBasic = detected.length > 0 && detected.every((a) => BASIC_CHAT_APPS.has(a));

  let verdict, note;
  if (detected.length === 0) {
    verdict = "missing";
    note = "No chat/support widget detected on the homepage — ZAIS Chat 7-day free-trial opportunity (lowest-friction pitch: zero risk to them).";
  } else if (onlyBasic) {
    verdict = "weak";
    note = `Only ${names.join(", ")} detected — basic chat, no AI. Still a ZAIS Chat opportunity.`;
  } else {
    verdict = "good";
    note = `Chat tool detected: ${names.join(", ")}.`;
  }

  return (
    <section style={cardStyle}>
      <h3 style={h3}>Chat & live support</h3>
      <VerdictRow label="Chat widget" verdict={verdict} note={note} />
    </section>
  );
}

function LiveEmailTestControls({ leadId, onChange }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/shopper-test`).then((r) => r.json()).then(setInfo);
  }, [leadId]);

  async function trigger(kind) {
    setBusy(kind);
    try {
      await fetch(`/api/leads/${leadId}/shopper-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      onChange();
    } finally {
      setBusy(null);
    }
  }

  if (!info) return null;

  if (!info.configured) {
    return (
      <p style={{ fontSize: FONT.sm, color: COLORS.muted, margin: "4px 0 0" }}>
        Live inbox confirmation isn't set up yet (needs AUDIT_INBOX_EMAIL / AUDIT_INBOX_APP_PASSWORD).
      </p>
    );
  }

  return (
    <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 4 }}>
      Test email for this lead: <code style={{ background: COLORS.divider, padding: "1px 5px", borderRadius: RADIUS.sm }}>{info.testEmail}</code>
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button onClick={() => trigger("welcome")} disabled={busy} style={linkBtn}>
          {busy === "welcome" ? "…" : "Mark welcome signup just done"}
        </button>
        <button onClick={() => trigger("abandoned_cart")} disabled={busy} style={linkBtn}>
          {busy === "abandoned_cart" ? "…" : "Mark cart abandoned just now"}
        </button>
      </div>
    </div>
  );
}

function VerdictRow({ label, verdict, note }) {
  const colors = {
    missing: { bg: "#fdecec", fg: "#b42318", text: "Missing" },
    unconfirmed: { bg: "#fef3e2", fg: "#9a6700", text: "Tool detected — needs manual check" },
    unconfirmed_pending: { bg: "#eef2ff", fg: "#4338ca", text: "Live test running — awaiting result" },
    present: { bg: "#e7f6ec", fg: "#1e7a43", text: "Present" },
    good: { bg: "#e7f6ec", fg: "#1e7a43", text: "Good" },
    weak: { bg: "#fef3e2", fg: "#9a6700", text: "Weak" },
    not_applicable: { bg: "#f0f2f5", fg: "#5b6673", text: "N/A" },
  };
  const c = colors[verdict] || colors.not_applicable;
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontWeight: 600, fontSize: FONT.md }}>{label}: </span>
      <span style={{ background: c.bg, color: c.fg, borderRadius: RADIUS.sm, padding: "2px 8px", fontSize: FONT.xs, fontWeight: 600 }}>{c.text}</span>
      {note && <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function scoreColor(v) {
  if (v == null) return COLORS.muted;
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
      <div style={{ fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span style={{ color: COLORS.muted }}>{label}:</span>{" "}
      <span style={{ fontWeight: 600 }}>{value ?? "—"}</span>
    </div>
  );
}

const cardStyle = { ...baseCard, padding: 18, marginBottom: 16, boxShadow: "0 1px 2px rgba(16,24,40,.03)" };
const h3 = { marginTop: 0, marginBottom: 12, fontSize: FONT.sm, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 };
const lightboxOverlay = { position: "fixed", inset: 0, background: "rgba(16,20,26,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, cursor: "zoom-out" };
