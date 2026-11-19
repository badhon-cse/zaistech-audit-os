"use client";
import { useEffect, useState } from "react";

const CHANNELS = ["Email", "LinkedIn DM", "Instagram DM", "Facebook DM", "WhatsApp", "Other"];
const CHANNEL_COLORS = {
  Email: "#2f5d8a", "LinkedIn DM": "#0a66c2", "Instagram DM": "#c13584",
  "Facebook DM": "#1877f2", WhatsApp: "#25d366", Other: "#6b7280",
};
const STATUS_COLORS = {
  new: "#9aa5b1", auditing: "#f0a500", needs_review: "#d9822b", audited: "#2f5d8a",
  demo_ready: "#6b4fbb", outreach_sent: "#1f8a70", replied: "#0f766e", won: "#1a7a3c", lost: "#b3261e",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function urgency(dateStr) {
  if (!dateStr) return null;
  const today = todayISO();
  if (dateStr < today) return "overdue";
  if (dateStr === today) return "today";
  return "upcoming";
}

const URGENCY_STYLE = {
  overdue: { bg: "#fdecec", fg: "#b42318", label: "Overdue" },
  today: { bg: "#fef3e2", fg: "#9a6700", label: "Due today" },
  upcoming: { bg: "#eef2ff", fg: "#4338ca", label: "Upcoming" },
};

// This page is the one place all outreach work happens -- drafting,
// sending/logging, follow-up scheduling, and marking the outcome. The audit
// page (/lead/[id]) stays read-only findings + the "Approve audit" step;
// everything about talking to the lead lives here instead, so there's one
// clear place to work from rather than splitting it across two pages.
export default function OutreachTracker() {
  const [leads, setLeads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/outreach-tracker");
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveNextAction(leadId, patch) {
    setSavingId(leadId);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p style={{ padding: 24, color: "#5b6673" }}>Loading…</p>;

  const contacted = (leads || []).filter((l) => l.touchCount > 0);
  const notContacted = (leads || []).filter((l) => l.touchCount === 0);

  const order = { overdue: 0, today: 1, upcoming: 2, none: 3 };
  contacted.sort((a, b) => {
    const ua = order[urgency(a.next_action_date) || "none"];
    const ub = order[urgency(b.next_action_date) || "none"];
    if (ua !== ub) return ua - ub;
    if (a.next_action_date && b.next_action_date) return a.next_action_date.localeCompare(b.next_action_date);
    return 0;
  });

  const overdueCount = contacted.filter((l) => urgency(l.next_action_date) === "overdue").length;
  const todayCount = contacted.filter((l) => urgency(l.next_action_date) === "today").length;

  function toggle(leadId) {
    setExpandedId((cur) => (cur === leadId ? null : leadId));
  }

  async function onPanelChange() {
    await load();
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <a href="/" style={{ color: "#2f5d8a", fontSize: 13, textDecoration: "none" }}>← Back to pipeline</a>

      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>Outreach tracker</h1>
      <p style={{ color: "#5b6673", fontSize: 14, marginTop: 0 }}>
        Who's been contacted, on which channel, when the next follow-up is due, and the place to draft and log every
        touch. (Audits live on each lead's own page — this page is outreach only.)
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Tile n={overdueCount} label="Overdue" color="#b42318" />
        <Tile n={todayCount} label="Due today" color="#9a6700" />
        <Tile n={contacted.length} label="Contacted" color="#2f5d8a" />
        <Tile n={notContacted.length} label="Not contacted yet" color="#9aa5b1" />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9aa3af", fontSize: 11, textTransform: "uppercase" }}>
            <th style={th}>Lead</th>
            <th style={th}>Channels</th>
            <th style={th}>Last touch</th>
            <th style={th}>Status</th>
            <th style={th}>Next action</th>
            <th style={th}>Due</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {contacted.map((lead) => (
            <TrackerRow
              key={lead.id}
              lead={lead}
              onSave={saveNextAction}
              busy={savingId === lead.id}
              expanded={expandedId === lead.id}
              onToggle={() => toggle(lead.id)}
              onPanelChange={onPanelChange}
            />
          ))}
        </tbody>
      </table>

      {notContacted.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: "#5b6673", marginTop: 28 }}>Not contacted yet</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>
              {notContacted.map((lead) => (
                <NotContactedRow
                  key={lead.id}
                  lead={lead}
                  expanded={expandedId === lead.id}
                  onToggle={() => toggle(lead.id)}
                  onPanelChange={onPanelChange}
                />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function TrackerRow({ lead, onSave, busy, expanded, onToggle, onPanelChange }) {
  const [actionText, setActionText] = useState(lead.next_action || "");
  const [actionDate, setActionDate] = useState(lead.next_action_date || "");
  const u = urgency(lead.next_action_date);
  const us = u ? URGENCY_STYLE[u] : null;

  return (
    <>
      <tr style={{ borderBottom: expanded ? "none" : "1px solid #f0f2f5" }}>
        <td style={td}>
          <div style={{ fontWeight: 600 }}>{lead.company}</div>
          <div style={{ fontSize: 12, color: "#9aa3af" }}>
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}{lead.title ? ` — ${lead.title}` : ""}
          </div>
        </td>
        <td style={td}>
          {lead.channelsUsed.map((c) => (
            <span key={c} style={{ ...channelBadge, background: CHANNEL_COLORS[c] || "#6b7280", marginRight: 4 }}>{c}</span>
          ))}
        </td>
        <td style={td}>
          {lead.lastTouch ? (
            <>
              <div>{lead.lastTouch.channel} · {(lead.lastTouch.step || "first").replace(/_/g, " ")}</div>
              <div style={{ fontSize: 12, color: "#9aa3af" }}>
                {lead.lastTouch.sent_at ? new Date(lead.lastTouch.sent_at).toLocaleDateString() : "draft, not sent"}
                {lead.lastTouch.status === "replied" && <span style={{ color: "#0f766e", fontWeight: 700 }}> · replied</span>}
              </div>
            </>
          ) : (
            <span style={{ color: "#9aa3af" }}>—</span>
          )}
        </td>
        <td style={td}>
          <span style={{ ...statusBadge, background: (STATUS_COLORS[lead.status] || "#9aa5b1") + "22", color: STATUS_COLORS[lead.status] || "#9aa5b1" }}>
            {lead.status.replace("_", " ")}
          </span>
        </td>
        <td style={td}>
          <input
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            onBlur={() => actionText !== (lead.next_action || "") && onSave(lead.id, { next_action: actionText || null })}
            placeholder="e.g. Send follow-up 1"
            style={{ ...inputStyle, width: 170 }}
            disabled={busy}
          />
        </td>
        <td style={td}>
          <input
            type="date"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            onBlur={() => actionDate !== (lead.next_action_date || "") && onSave(lead.id, { next_action_date: actionDate || null })}
            style={{ ...inputStyle, width: 136 }}
            disabled={busy}
          />
          {us && (
            <div style={{ fontSize: 11, fontWeight: 700, color: us.fg, marginTop: 3 }}>{us.label}</div>
          )}
        </td>
        <td style={td}>
          <button onClick={onToggle} style={expanded ? openBtnActive : openBtn}>
            {expanded ? "Hide ▴" : "Manage ▾"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid #f0f2f5" }}>
          <td style={{ ...td, background: "#fafbfc" }} colSpan={7}>
            <LeadPanel lead={lead} onChange={onPanelChange} />
          </td>
        </tr>
      )}
    </>
  );
}

function NotContactedRow({ lead, expanded, onToggle, onPanelChange }) {
  return (
    <>
      <tr style={{ borderBottom: expanded ? "none" : "1px solid #f0f2f5" }}>
        <td style={td}>
          <div style={{ fontWeight: 600 }}>{lead.company}</div>
          <div style={{ fontSize: 12, color: "#9aa3af" }}>{lead.domain}</div>
        </td>
        <td style={td} colSpan={3}>
          <span style={{ ...statusBadge, background: (STATUS_COLORS[lead.status] || "#9aa5b1") + "22", color: STATUS_COLORS[lead.status] || "#9aa5b1" }}>
            {lead.status.replace("_", " ")}
          </span>
        </td>
        <td style={td}>
          <button onClick={onToggle} style={expanded ? openBtnActive : openBtn}>
            {expanded ? "Hide ▴" : "Manage ▾"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid #f0f2f5" }}>
          <td style={{ ...td, background: "#fafbfc" }} colSpan={5}>
            <LeadPanel lead={lead} onChange={onPanelChange} />
          </td>
        </tr>
      )}
    </>
  );
}

// Everything needed to actually work a lead: outcome, AI draft generation,
// logging a sent/draft message, and the full touch history. Ported from
// what used to live on the audit page -- that page now stays audit-only.
function LeadPanel({ lead, onChange }) {
  const [outreach, setOutreach] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ channel: "Email", customChannel: "", step: "first", subject: "", body: "", status: "sent" });
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [outcomeBusy, setOutcomeBusy] = useState(false);

  async function loadHistory() {
    setLoadingHistory(true);
    const res = await fetch(`/api/leads/${lead.id}/outreach`);
    const data = await res.json();
    setOutreach(data.outreach || []);
    setLoadingHistory(false);
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function refresh() {
    await loadHistory();
    await onChange();
  }

  async function setOutcome(status) {
    setOutcomeBusy(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refresh();
    } finally {
      setOutcomeBusy(false);
    }
  }

  async function generateDraft() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/outreach/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.outreach);
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function useDraft({ channel, step, subject, body }) {
    setForm({ channel, customChannel: "", step, subject: subject || "", body, status: "draft" });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const channel = form.channel === "Other" ? (form.customChannel || "Other") : form.channel;
      await fetch(`/api/leads/${lead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, step: form.step, subject: form.subject, body: form.body, status: form.status }),
      });
      setForm({ channel: "Email", customChannel: "", step: "first", subject: "", body: "", status: "sent" });
      setShowForm(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function markReplied(id) {
    setBusyId(id);
    try {
      await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "replied" }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeTouch(id) {
    setBusyId(id);
    try {
      await fetch(`/api/outreach/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: "6px 2px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: "#5b6673" }}>Outcome:</span>
        <span style={{ ...outcomeBadge, background: STATUS_COLORS[lead.status] || "#9aa5b1" }}>
          {lead.status.replace("_", " ")}
        </span>
        <span style={{ fontSize: 11.5, color: "#9aa3af" }}>
          (feeds the <a href="/rulebook" style={{ color: "#2f5d8a" }}>rulebook self-improvement</a> loop)
        </span>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button onClick={() => setOutcome("outreach_sent")} disabled={outcomeBusy} style={outcomeBtn}>Outreach sent</button>
          <button onClick={() => setOutcome("replied")} disabled={outcomeBusy} style={outcomeBtn}>Replied</button>
          <button onClick={() => setOutcome("won")} disabled={outcomeBusy} style={{ ...outcomeBtn, borderColor: "#1a7a3c", color: "#1a7a3c" }}>Won client</button>
          <button onClick={() => setOutcome("lost")} disabled={outcomeBusy} style={{ ...outcomeBtn, borderColor: "#b3261e", color: "#b3261e" }}>Lost / no response</button>
        </div>
      </div>

      <a href={`/lead/${lead.id}`} style={{ fontSize: 12, color: "#2f5d8a" }}>View audit findings for this lead ↗</a>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <strong style={{ fontSize: 13, color: "#374151" }}>Outreach history</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={generateDraft} disabled={generating} style={{ ...outcomeBtn, fontWeight: 600, borderColor: "#2f5d8a", color: "#2f5d8a" }}>
            {generating ? "Writing…" : "✎ Generate draft (AI)"}
          </button>
          <button onClick={() => setShowForm((s) => !s)} style={{ ...outcomeBtn, fontWeight: 600 }}>
            {showForm ? "Cancel" : "+ Log outreach"}
          </button>
        </div>
      </div>
      {genError && <p style={{ color: "#b3261e", fontSize: 13, marginTop: 8 }}>{genError}</p>}

      {draft && (
        <div style={{ background: "#fff", border: "1px solid #e6e9ee", borderRadius: 8, padding: 14, marginTop: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong style={{ fontSize: 13 }}>AI draft — review before sending</strong>
            <button onClick={() => setDraft(null)} style={linkBtnSmall}>Dismiss</button>
          </div>

          <DraftBlock
            title="Cold email — first touch"
            onUse={() => useDraft({ channel: "Email", step: "first", subject: draft.email.subject, body: draft.email.body })}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>Subject: {draft.email.subject}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13, marginTop: 4 }}>{draft.email.body}</div>
          </DraftBlock>

          <DraftBlock
            title="Email follow-up 1 (day 3)"
            onUse={() => useDraft({ channel: "Email", step: "follow_up_1", body: draft.email.followUp1 })}
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.email.followUp1}</div>
          </DraftBlock>

          <DraftBlock
            title="Email follow-up 2 (day 7)"
            onUse={() => useDraft({ channel: "Email", step: "follow_up_2", body: draft.email.followUp2 })}
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.email.followUp2}</div>
          </DraftBlock>

          <DraftBlock
            title="LinkedIn — connection note"
            onUse={() => useDraft({ channel: "LinkedIn DM", step: "first", body: draft.linkedin.connectionNote })}
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.linkedin.connectionNote}</div>
          </DraftBlock>

          <DraftBlock
            title="LinkedIn — message after accept"
            onUse={() => useDraft({ channel: "LinkedIn DM", step: "follow_up_1", body: draft.linkedin.message })}
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.linkedin.message}</div>
          </DraftBlock>

          <DraftBlock
            title="Instagram / Facebook DM"
            onUse={() => useDraft({ channel: "Instagram DM", step: "first", body: draft.instagram.dm })}
            last
          >
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{draft.instagram.dm}</div>
          </DraftBlock>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} style={{ display: "grid", gap: 8, marginBottom: 14, marginTop: 10, background: "#fff", border: "1px solid #e6e9ee", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} style={selectStyle}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {form.channel === "Other" && (
              <input placeholder="Channel name" value={form.customChannel} onChange={(e) => setForm({ ...form, customChannel: e.target.value })} style={{ ...inputStyle, maxWidth: 160 }} />
            )}
            <select value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value })} style={selectStyle}>
              <option value="first">First touch</option>
              <option value="follow_up_1">Follow-up 1</option>
              <option value="follow_up_2">Follow-up 2</option>
              <option value="follow_up_3">Follow-up 3+</option>
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={selectStyle}>
              <option value="sent">Sent</option>
              <option value="draft">Draft (not sent yet)</option>
            </select>
          </div>
          {form.channel === "Email" && (
            <input placeholder="Subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={inputStyle} />
          )}
          <textarea required placeholder="Message body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} />
          <button type="submit" disabled={saving} style={{ ...primaryBtn, width: "fit-content" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {loadingHistory ? (
        <p style={{ color: "#9aa3af", fontSize: 13.5 }}>Loading history…</p>
      ) : (
        <>
          {outreach.length === 0 && !showForm && (
            <p style={{ color: "#9aa3af", fontSize: 13.5 }}>No outreach logged yet for this lead.</p>
          )}
          {outreach.map((o) => (
            <div key={o.id} style={{ borderBottom: "1px solid #eef0f3", padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ ...channelBadge, background: CHANNEL_COLORS[o.channel] || "#6b7280" }}>{o.channel}</span>
                <span style={{ fontSize: 12, color: "#9aa3af" }}>{(o.step || "first").replace(/_/g, " ")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: o.status === "replied" ? "#0f766e" : o.status === "draft" ? "#d9822b" : "#1f8a70" }}>
                  {o.status?.toUpperCase()}
                </span>
                {o.sent_at && <span style={{ fontSize: 12, color: "#9aa3af" }}>{new Date(o.sent_at).toLocaleDateString()}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {o.status !== "replied" && (
                    <button onClick={() => markReplied(o.id)} disabled={busyId === o.id} style={linkBtnSmall}>Mark replied</button>
                  )}
                  <button onClick={() => removeTouch(o.id)} disabled={busyId === o.id} style={{ ...linkBtnSmall, color: "#b3261e" }}>Delete</button>
                </div>
              </div>
              {o.subject && <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{o.subject}</div>}
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>{o.body}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DraftBlock({ title, onUse, children, last }) {
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid #e6e9ee", padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#9aa3af", fontWeight: 700, textTransform: "uppercase" }}>{title}</span>
        <button onClick={onUse} style={linkBtnSmall}>Use this →</button>
      </div>
      {children}
    </div>
  );
}

function Tile({ n, label, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e9ee", borderRadius: 10, padding: "10px 16px", minWidth: 100 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: 12, color: "#5b6673" }}>{label}</div>
    </div>
  );
}

const th = { padding: "8px 10px", borderBottom: "1px solid #e6e9ee" };
const td = { padding: "10px 10px", verticalAlign: "top" };
const inputStyle = { border: "1px solid #cbd3dc", borderRadius: 6, padding: "6px 8px", fontSize: 12.5 };
const selectStyle = { ...inputStyle, width: "auto" };
const channelBadge = { fontSize: 10.5, fontWeight: 700, color: "#fff", borderRadius: 4, padding: "2px 6px", display: "inline-block", marginBottom: 2 };
const statusBadge = { fontSize: 11.5, fontWeight: 600, borderRadius: 5, padding: "3px 8px", textTransform: "capitalize" };
const outcomeBadge = { fontSize: 12, fontWeight: 700, color: "#fff", borderRadius: 5, padding: "3px 9px", textTransform: "capitalize" };
const outcomeBtn = { background: "#fff", border: "1px solid #cbd3dc", color: "#374151", borderRadius: 6, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" };
const linkBtnSmall = { background: "none", border: "none", color: "#2f5d8a", fontSize: 12, cursor: "pointer", padding: 0 };
const primaryBtn = { background: "#2f5d8a", color: "#fff", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const openBtn = {
  display: "inline-block", fontSize: 12, fontWeight: 600, color: "#2f5d8a", background: "#fff", border: "1px solid #cbd3dc",
  borderRadius: 6, padding: "6px 10px", textDecoration: "none", whiteSpace: "nowrap", cursor: "pointer",
};
const openBtnActive = { ...openBtn, background: "#2f5d8a", color: "#fff", borderColor: "#2f5d8a" };
