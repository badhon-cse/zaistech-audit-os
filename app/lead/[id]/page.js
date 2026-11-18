"use client";
import { useEffect, useState } from "react";

export default function LeadDetail({ params }) {
  const { id } = params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p>Loading…</p>;
  if (data.error) return <p>{data.error}</p>;

  const { lead, latestAudit, findings, strengths, metrics } = data;

  return (
    <div>
      <a href="/" style={{ color: "#2f5d8a", fontSize: 13 }}>
        ← Back to pipeline
      </a>
      <h1 style={{ marginBottom: 2 }}>{lead.company}</h1>
      <p style={{ color: "#5b6673", marginTop: 0 }}>
        {lead.domain} &middot; {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}
        {lead.title ? ` — ${lead.title}` : ""}
      </p>

      {!latestAudit && <p>No audit yet. Go back to the pipeline and press "Run audit".</p>}

      {latestAudit && (
        <>
          <section style={cardStyle}>
            <h3 style={h3}>Strengths</h3>
            <ul>
              {strengths.map((s) => (
                <li key={s.id}>{s.text}</li>
              ))}
            </ul>
          </section>

          <section style={cardStyle}>
            <h3 style={h3}>Findings</h3>
            {findings.map((f) => (
              <div key={f.id} style={{ borderBottom: "1px solid #f0f2f5", padding: "10px 0" }}>
                <div style={{ fontWeight: 600 }}>
                  [{f.area}] {f.what}
                </div>
                <div style={{ fontSize: 13, color: "#5b6673" }}>Where: {f.where_}</div>
                <div style={{ fontSize: 13, color: "#5b6673" }}>Why it costs money: {f.why}</div>
                <div style={{ fontSize: 13, color: "#5b6673" }}>Fix: {f.fix}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2f5d8a" }}>Service: {f.service}</div>
              </div>
            ))}
          </section>

          {metrics.length > 0 && (
            <section style={cardStyle}>
              <h3 style={h3}>PageSpeed</h3>
              {metrics.map((m) => (
                <div key={m.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#5b6673", marginBottom: 8, textTransform: "capitalize" }}>
                    {m.page} &middot; {m.device}
                  </div>

                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
                    <ScoreBadge label="Performance" value={m.pagespeed_score} />
                    <ScoreBadge label="SEO" value={m.seo_score} />
                    <ScoreBadge label="Accessibility" value={m.accessibility_score} />
                  </div>

                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#374151", marginBottom: m.top_opportunities?.length ? 10 : 0 }}>
                    <Metric label="LCP" value={m.lcp} />
                    <Metric label="CLS" value={m.cls} />
                    <Metric label="TBT" value={m.tbt} />
                    <Metric label="Speed Index" value={m.speed_index} />
                    {m.page_weight_kb != null && <Metric label="Page weight" value={`${m.page_weight_kb} KB`} />}
                    {m.requests != null && <Metric label="Requests" value={m.requests} />}
                  </div>

                  {m.top_opportunities?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#5b6673", marginBottom: 4 }}>
                        Top opportunities
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
                        {m.top_opportunities.map((o, i) => (
                          <li key={i}>
                            {o.title} {o.savingsMs ? `— saves ~${o.savingsMs}ms` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
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

function scoreColor(v) {
  if (v == null) return "#9aa3af";
  if (v >= 90) return "#16a34a";
  if (v >= 50) return "#d97706";
  return "#dc2626";
}

function ScoreBadge({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: `3px solid ${scoreColor(value)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 15,
          color: scoreColor(value),
          margin: "0 auto 4px",
        }}
      >
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 11, color: "#5b6673" }}>{label}</div>
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

const cardStyle = { background: "#fff", borderRadius: 10, border: "1px solid #e6e9ee", padding: 16, marginBottom: 16 };
const h3 = { marginTop: 0, fontSize: 14, color: "#5b6673", textTransform: "uppercase", letterSpacing: 0.4 };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
