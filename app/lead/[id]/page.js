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
                <div key={m.id}>
                  {m.page} ({m.device}): score {m.pagespeed_score}, LCP {m.lcp}, CLS {m.cls}, TBT {m.tbt}
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

const cardStyle = { background: "#fff", borderRadius: 10, border: "1px solid #e6e9ee", padding: 16, marginBottom: 16 };
const h3 = { marginTop: 0, fontSize: 14, color: "#5b6673", textTransform: "uppercase", letterSpacing: 0.4 };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
