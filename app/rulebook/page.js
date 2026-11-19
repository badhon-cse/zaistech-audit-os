"use client";
import { useEffect, useState } from "react";
import { COLORS } from "../../lib/ui.js";

export default function RulebookProposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/rulebook/proposals");
    const data = await res.json();
    setProposals(data.proposals || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/rulebook/proposals", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function act(id, action) {
    setBusyId(id);
    try {
      await fetch(`/api/rulebook/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewedBy: "you" }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const decided = proposals.filter((p) => p.status !== "pending");

  return (
    // Narrower than the layout's 1100px on purpose (reading page); the layout
    // supplies the outer padding and font.
    <div style={{ maxWidth: 860 }}>
      <a href="/" style={{ color: "#2f5d8a", fontSize: 13, textDecoration: "none" }}>
        ← Back to pipeline
      </a>

      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>Rulebook self-improvement</h1>
      <p style={{ color: "#5b6673", fontSize: 14, marginTop: 0, maxWidth: 620 }}>
        Looks at leads whose outcome you've marked (replied / won / lost) plus any findings
        you pulled before sending, and proposes edits to the rulebook. Nothing here goes live
        on its own — review each proposal and approve or reject it.
      </p>

      <button onClick={generate} disabled={generating} style={primaryBtn}>
        {generating ? "Analyzing outcomes…" : "Generate new proposal"}
      </button>
      {genError && <p style={{ color: "#b3261e", fontSize: 13, marginTop: 8 }}>{genError}</p>}

      {loading && <p style={{ color: "#5b6673", marginTop: 20 }}>Loading…</p>}

      {!loading && pending.length === 0 && (
        <p style={{ color: "#5b6673", marginTop: 20 }}>No pending proposals.</p>
      )}

      {pending.map((p) => (
        <section key={p.id} style={{ ...cardStyle, marginTop: 16, border: "1px solid #d9822b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <span style={badgeStyle}>PENDING</span>
              <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>
                based on {p.lead_count} outcome-tagged leads · {new Date(p.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 14, marginTop: 10 }}>{p.summary}</p>

          {p.evidence?.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#5b6673", marginTop: 8 }}>
              Evidence: {p.evidence.map((e) => `${e.company} (${e.outcome})`).join(", ")}
            </div>
          )}

          <button
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            style={{ ...linkBtn, marginTop: 10 }}
          >
            {expanded === p.id ? "Hide full proposed text" : "Show full proposed text"}
          </button>
          {expanded === p.id && (
            <pre style={preStyle}>{p.proposed_text}</pre>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => act(p.id, "approve")} disabled={busyId === p.id} style={approveBtn}>
              {busyId === p.id ? "…" : "Approve & go live"}
            </button>
            <button onClick={() => act(p.id, "reject")} disabled={busyId === p.id} style={rejectBtn}>
              {busyId === p.id ? "…" : "Reject"}
            </button>
          </div>
        </section>
      ))}

      {decided.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginTop: 28, color: "#374151" }}>History</h3>
          {decided.map((p) => (
            <section key={p.id} style={{ ...cardStyle, marginTop: 10, opacity: 0.8 }}>
              <span style={{ ...badgeStyle, background: p.status === "approved" ? "#1a7a3c" : "#b3261e" }}>
                {p.status.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>
                {new Date(p.created_at).toLocaleString()}
              </span>
              <p style={{ fontSize: 13.5, marginTop: 8 }}>{p.summary}</p>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

const cardStyle = { background: "#fff", border: "1px solid #e6e9ee", borderRadius: 10, padding: 16 };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer", marginTop: 14 };
const approveBtn = { ...primaryBtn, marginTop: 0, background: "#1a7a3c" };
const rejectBtn = { ...primaryBtn, marginTop: 0, background: "#fff", color: "#b3261e", border: "1px solid #b3261e" };
const linkBtn = { background: "none", border: "none", color: "#2f5d8a", fontSize: 13, cursor: "pointer", padding: 0, display: "block" };
const badgeStyle = { fontSize: 11, fontWeight: 700, background: "#d9822b", color: "#fff", borderRadius: 4, padding: "2px 6px" };
const preStyle = { whiteSpace: "pre-wrap", fontSize: 12, background: "#f7f8fa", border: "1px solid #e6e9ee", borderRadius: 8, padding: 12, maxHeight: 400, overflowY: "auto", marginTop: 8 };
