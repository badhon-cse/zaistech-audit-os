"use client";
import { useEffect, useId, useState } from "react";
import {
  COLORS, FONT, cardStyle, tileStyle, th, td, rowDivider, statusBadge,
  primaryBtn, outlineBtn, disabledStyle, inputStyle, labelStyle, linkStyle,
} from "../lib/ui.js";

// Matches AUDIT_STALE_MS in lib/audit.js: a lead stuck on "auditing" longer
// than this is assumed to be from a run that died, so re-running is allowed.
const AUDIT_STALE_MS = 10 * 60 * 1000;
function isAuditRunning(lead) {
  if (lead.status !== "auditing") return false;
  const startedAt = lead.updated_at ? new Date(lead.updated_at).getTime() : 0;
  return Date.now() - startedAt < AUDIT_STALE_MS;
}

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ company: "", domain: "", firstName: "", lastName: "", title: "" });
  const [busyId, setBusyId] = useState(null);
  const fid = useId();

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
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Could not add lead: " + (err.error || res.statusText));
      return;
    }
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
        const err = await res.json().catch(() => ({}));
        alert("Audit failed: " + (err.error || res.statusText));
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
            <div style={{ fontSize: FONT.xxl, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, textTransform: "capitalize" }}>
              {status.replace("_", " ")}
            </div>
          </div>
        ))}
        {leads.length === 0 && !loading && (
          <div style={{ color: COLORS.textSecondary }}>No leads yet -- add one to run your first audit.</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: FONT.lg }}>Pipeline</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/outreach" style={primaryBtn}>
            Outreach tracker
          </a>
          <a href="/rulebook" style={{ ...outlineBtn, padding: primaryBtn.padding, borderRadius: primaryBtn.borderRadius }}>
            Rulebook self-improvement
          </a>
          <button style={primaryBtn} onClick={() => setShowNew((s) => !s)}>
            + New lead
          </button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={addLead} style={{ ...cardStyle, marginBottom: 16, display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", alignItems: "end" }}>
          {[
            { key: "company", label: "Company", placeholder: "Acme Store", required: true },
            { key: "domain", label: "Domain", placeholder: "example.com", required: true },
            { key: "firstName", label: "First name", placeholder: "" },
            { key: "lastName", label: "Last name", placeholder: "" },
            { key: "title", label: "Title", placeholder: "e.g. Founder" },
          ].map((f) => (
            <div key={f.key}>
              <label htmlFor={`${fid}-${f.key}`} style={labelStyle}>
                {f.label}{f.required ? " *" : ""}
              </label>
              <input
                id={`${fid}-${f.key}`}
                required={f.required}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          ))}
          <button type="submit" style={{ ...primaryBtn, justifySelf: "start" }}>Save lead</button>
        </form>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FONT.md }}>
          <thead>
            <tr style={{ color: COLORS.textSecondary }}>
              <th style={th}>Company</th>
              <th style={th}>Domain</th>
              <th style={th}>Contact</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} style={rowDivider}>
                <td style={td}>
                  <a href={`/lead/${l.id}`} style={{ ...linkStyle, fontWeight: 600 }}>
                    {l.company}
                  </a>
                </td>
                <td style={td}>{l.domain}</td>
                <td style={td}>{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td style={td}>
                  <span style={statusBadge(l.status)}>
                    {l.status.replace("_", " ")}
                  </span>
                </td>
                <td style={td}>
                  {(() => {
                    // Disabled while this tab's request is in flight AND while the
                    // server says an audit is running (survives a page refresh).
                    const running = busyId === l.id || isAuditRunning(l);
                    return (
                      <button
                        disabled={running}
                        onClick={() => runAudit(l.id)}
                        style={{ ...primaryBtn, ...disabledStyle(running) }}
                      >
                        {running ? "Running…" : l.status === "failed" ? "Retry audit" : "Run audit"}
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
