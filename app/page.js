"use client";
import { useEffect, useState } from "react";

const STATUS_COLORS = {
  new: "#9aa5b1",
  auditing: "#f0a500",
  needs_review: "#d9822b",
  audited: "#2f5d8a",
  demo_ready: "#6b4fbb",
  outreach_sent: "#1f8a70",
  replied: "#0f766e",
  won: "#1a7a3c",
  lost: "#b3261e",
};

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ company: "", domain: "", firstName: "", lastName: "", title: "" });
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addLead(e) {
    e.preventDefault();
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ company: "", domain: "", firstName: "", lastName: "", title: "" });
    setShowNew(false);
    load();
  }

  async function runAudit(leadId) {
    setBusyId(leadId);
    try {
      const res = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Audit failed: " + err.error);
      }
    } finally {
      setBusyId(null);
      load();
    }
  }

  const counts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(counts).map(([status, n]) => (
          <div key={status} style={tileStyle}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 12, color: "#5b6673", textTransform: "capitalize" }}>
              {status.replace("_", " ")}
            </div>
          </div>
        ))}
        {leads.length === 0 && !loading && (
          <div style={{ color: "#5b6673" }}>No leads yet -- add one to run your first audit.</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Pipeline</h2>
        <button style={primaryBtn} onClick={() => setShowNew((s) => !s)}>
          + New lead
        </button>
      </div>

      {showNew && (
        <form onSubmit={addLead} style={{ ...cardStyle, marginBottom: 16, display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <input required placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
          <input required placeholder="Domain (e.g. example.com)" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} style={inputStyle} />
          <input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={inputStyle} />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={inputStyle} />
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          <button type="submit" style={primaryBtn}>Save lead</button>
        </form>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#5b6673", borderBottom: "1px solid #e6e9ee" }}>
              <th style={th}>Company</th>
              <th style={th}>Domain</th>
              <th style={th}>Contact</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                <td style={td}>
                  <a href={`/lead/${l.id}`} style={{ color: "#2f5d8a", textDecoration: "none", fontWeight: 600 }}>
                    {l.company}
                  </a>
                </td>
                <td style={td}>{l.domain}</td>
                <td style={td}>{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td style={td}>
                  <span style={{ ...badge, background: (STATUS_COLORS[l.status] || "#9aa5b1") + "22", color: STATUS_COLORS[l.status] || "#5b6673" }}>
                    {l.status.replace("_", " ")}
                  </span>
                </td>
                <td style={td}>
                  <button
                    disabled={busyId === l.id}
                    onClick={() => runAudit(l.id)}
                    style={{ ...primaryBtn, opacity: busyId === l.id ? 0.6 : 1 }}
                  >
                    {busyId === l.id ? "Running…" : "Run audit"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tileStyle = { background: "#fff", borderRadius: 10, padding: "12px 16px", border: "1px solid #e6e9ee", minWidth: 90 };
const cardStyle = { background: "#fff", borderRadius: 10, border: "1px solid #e6e9ee", padding: 16 };
const th = { padding: "8px 10px", fontWeight: 600 };
const td = { padding: "10px 10px" };
const badge = { padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: "capitalize" };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const inputStyle = { padding: "8px 10px", borderRadius: 7, border: "1px solid #d7dce2", fontSize: 14 };
