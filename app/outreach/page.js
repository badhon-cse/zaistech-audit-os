"use client";
import { useEffect, useId, useState } from "react";
import {
  COLORS, FONT, RADIUS, CHANNELS, STATUS_COLORS, statusColor, statusBadge, solidBadge, channelBadge,
  th, tdTop as td, rowDivider, inputStyle, selectStyle, labelStyle, errorText, backLink, h1Style, tileStyle,
  primaryBtnLg, secondaryBtn, outlineBtn, dangerBtn, smallBtn, smallDangerBtn, toggleBtn, toggleBtnActive, linkBtn,
} from "../../lib/ui.js";

// Today's date as YYYY-MM-DD in the *viewer's local timezone*. This page runs
// in the operator's browser (Bangladesh, UTC+6), so "due today"/"overdue"
// must follow their calendar day -- toISOString() would give UTC's date,
// which is still "yesterday" for the first 6 hours of every local day.
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Reads the server's { error } message from a failed response, falling back
// to the HTTP status text if the body isn't JSON.
async function errorMessage(res) {
  const data = await res.json().catch(() => ({}));
  return data.error || res.statusText || "Request failed (" + res.status + ")";
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
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) alert("Could not save next action: " + (await errorMessage(res)));
      await load();
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p style={{ color: COLORS.textSecondary }}>Loading…</p>;

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
    <div>
      <a href="/" style={backLink}>← Back to pipeline</a>

      <h1 style={h1Style}>Outreach tracker</h1>
      <p style={{ color: COLORS.textSecondary, fontSize: FONT.md, marginTop: 0 }}>
        Who's been contacted, on which channel, when the next follow-up is due, and the place to draft and log every
        touch. (Audits live on each lead's own page — this page is outreach only.)
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Tile n={overdueCount} label="Overdue" color="#b42318" />
        <Tile n={todayCount} label="Due today" color="#9a6700" />
        <Tile n={contacted.length} label="Contacted" color={STATUS_COLORS.outreach_sent} />
        <Tile n={notContacted.length} label="Not contacted yet" color={COLORS.muted} />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FONT.md }}>
        <thead>
          <tr style={{ color: COLORS.muted, fontSize: FONT.xs, textTransform: "uppercase" }}>
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
          <h3 style={{ fontSize: FONT.md, color: COLORS.textSecondary, marginTop: 28 }}>Not contacted yet</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FONT.md }}>
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
  const fid = useId();

  return (
    <>
      <tr style={expanded ? undefined : rowDivider}>
        <td style={td}>
          <div style={{ fontWeight: 600 }}>{lead.company}</div>
          <div style={{ fontSize: FONT.sm, color: COLORS.muted }}>
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}{lead.title ? ` — ${lead.title}` : ""}
          </div>
        </td>
        <td style={td}>
          {lead.channelsUsed.map((c) => (
            <span key={c} style={{ ...channelBadge(c), marginRight: 4, marginBottom: 2 }}>{c}</span>
          ))}
        </td>
        <td style={td}>
          {lead.lastTouch ? (
            <>
              <div>{lead.lastTouch.channel} · {(lead.lastTouch.step || "first").replace(/_/g, " ")}</div>
              <div style={{ fontSize: FONT.sm, color: COLORS.muted }}>
                {lead.lastTouch.sent_at ? new Date(lead.lastTouch.sent_at).toLocaleDateString() : "draft, not sent"}
                {lead.lastTouch.status === "replied" && <span style={{ color: STATUS_COLORS.replied, fontWeight: 700 }}> · replied</span>}
              </div>
            </>
          ) : (
            <span style={{ color: COLORS.muted }}>—</span>
          )}
        </td>
        <td style={td}>
          <span style={statusBadge(lead.status)}>
            {lead.status.replace("_", " ")}
          </span>
        </td>
        <td style={td}>
          <label htmlFor={`${fid}-action`} style={labelStyle}>Next action</label>
          <input
            id={`${fid}-action`}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            onBlur={() => actionText !== (lead.next_action || "") && onSave(lead.id, { next_action: actionText || null })}
            placeholder="e.g. Send follow-up 1"
            style={{ ...inputStyle, width: 170 }}
            disabled={busy}
          />
        </td>
        <td style={td}>
          <label htmlFor={`${fid}-date`} style={labelStyle}>Due date</label>
          <input
            id={`${fid}-date`}
            type="date"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            onBlur={() => actionDate !== (lead.next_action_date || "") && onSave(lead.id, { next_action_date: actionDate || null })}
            style={{ ...inputStyle, width: 136 }}
            disabled={busy}
          />
          {us && (
            <div style={{ fontSize: FONT.xs, fontWeight: 700, color: us.fg, marginTop: 3 }}>{us.label}</div>
          )}
        </td>
        <td style={td}>
          <button onClick={onToggle} style={expanded ? toggleBtnActive : toggleBtn}>
            {expanded ? "Hide ▴" : "Manage ▾"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={rowDivider}>
          <td style={{ ...td, background: COLORS.panelBg }} colSpan={7}>
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
      <tr style={expanded ? undefined : rowDivider}>
        <td style={td}>
          <div style={{ fontWeight: 600 }}>{lead.company}</div>
          <div style={{ fontSize: FONT.sm, color: COLORS.muted }}>{lead.domain}</div>
        </td>
        <td style={td} colSpan={3}>
          <span style={statusBadge(lead.status)}>
            {lead.status.replace("_", " ")}
          </span>
        </td>
        <td style={td}>
          <button onClick={onToggle} style={expanded ? toggleBtnActive : toggleBtn}>
            {expanded ? "Hide ▴" : "Manage ▾"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr style={rowDivider}>
          <td style={{ ...td, background: COLORS.panelBg }} colSpan={5}>
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
  const [actionError, setActionError] = useState(null);
  const fid = useId();

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
    if (status === "lost" && !window.confirm(`Mark ${lead.company} as lost / no response? This clears any scheduled follow-up.`)) return;
    setOutcomeBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) setActionError("Could not set outcome: " + (await errorMessage(res)));
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
    setActionError(null);
    try {
      const channel = form.channel === "Other" ? (form.customChannel || "Other") : form.channel;
      const res = await fetch(`/api/leads/${lead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, step: form.step, subject: form.subject, body: form.body, status: form.status }),
      });
      if (!res.ok) {
        // Keep the form open with what was typed so nothing is lost.
        setActionError("Could not log outreach: " + (await errorMessage(res)));
        return;
      }
      setForm({ channel: "Email", customChannel: "", step: "first", subject: "", body: "", status: "sent" });
      setShowForm(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function markReplied(id) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "replied" }),
      });
      if (!res.ok) setActionError("Could not mark replied: " + (await errorMessage(res)));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeTouch(id) {
    if (!window.confirm("Delete this logged outreach touch? This can't be undone.")) return;
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/outreach/${id}`, { method: "DELETE" });
      if (!res.ok) setActionError("Could not delete outreach: " + (await errorMessage(res)));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: "6px 2px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: FONT.sm, color: COLORS.textSecondary }}>Outcome:</span>
        <span style={solidBadge(statusColor(lead.status))}>
          {lead.status.replace("_", " ")}
        </span>
        <span style={{ fontSize: FONT.xs, color: COLORS.muted }}>
          (feeds the <a href="/rulebook" style={{ color: COLORS.primary }}>rulebook self-improvement</a> loop)
        </span>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button onClick={() => setOutcome("outreach_sent")} disabled={outcomeBusy} style={secondaryBtn}>Outreach sent</button>
          <button onClick={() => setOutcome("replied")} disabled={outcomeBusy} style={secondaryBtn}>Replied</button>
          <button onClick={() => setOutcome("won")} disabled={outcomeBusy} style={{ ...secondaryBtn, borderColor: STATUS_COLORS.won, color: STATUS_COLORS.won }}>Won client</button>
          <button onClick={() => setOutcome("lost")} disabled={outcomeBusy} style={dangerBtn}>Lost / no response</button>
        </div>
      </div>

      <a href={`/lead/${lead.id}`} style={{ fontSize: FONT.sm, color: COLORS.primary }}>View audit findings for this lead ↗</a>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <strong style={{ fontSize: FONT.sm, color: COLORS.body }}>Outreach history</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={generateDraft} disabled={generating} style={outlineBtn}>
            {generating ? "Writing…" : "✎ Generate draft (AI)"}
          </button>
          <button onClick={() => setShowForm((s) => !s)} style={{ ...secondaryBtn, fontWeight: 600 }}>
            {showForm ? "Cancel" : "+ Log outreach"}
          </button>
        </div>
      </div>
      {genError && <p style={errorText}>{genError}</p>}
      {actionError && <p style={errorText}>{actionError}</p>}

      {draft && (
        <div style={{ ...panelStyle, padding: 14, marginTop: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong style={{ fontSize: FONT.sm }}>AI draft — review before sending</strong>
            <button onClick={() => setDraft(null)} style={linkBtn}>Dismiss</button>
          </div>

          {/* Copy gives the full text for pasting elsewhere; the first-touch
              email has a subject, so it's included as a "Subject:" line. */}
          <DraftBlock
            title="Cold email — first touch"
            onUse={() => useDraft({ channel: "Email", step: "first", subject: draft.email.subject, body: draft.email.body })}
            copyText={`Subject: ${draft.email.subject}\n\n${draft.email.body}`}
          >
            <div style={{ fontWeight: 600, fontSize: FONT.sm }}>Subject: {draft.email.subject}</div>
            <div style={{ ...draftText, marginTop: 4 }}>{draft.email.body}</div>
          </DraftBlock>

          <DraftBlock
            title="Email follow-up 1 (day 3)"
            onUse={() => useDraft({ channel: "Email", step: "follow_up_1", body: draft.email.followUp1 })}
            copyText={draft.email.followUp1}
          >
            <div style={draftText}>{draft.email.followUp1}</div>
          </DraftBlock>

          <DraftBlock
            title="Email follow-up 2 (day 7)"
            onUse={() => useDraft({ channel: "Email", step: "follow_up_2", body: draft.email.followUp2 })}
            copyText={draft.email.followUp2}
          >
            <div style={draftText}>{draft.email.followUp2}</div>
          </DraftBlock>

          <DraftBlock
            title="LinkedIn — connection note"
            onUse={() => useDraft({ channel: "LinkedIn DM", step: "first", body: draft.linkedin.connectionNote })}
            copyText={draft.linkedin.connectionNote}
          >
            <div style={draftText}>{draft.linkedin.connectionNote}</div>
          </DraftBlock>

          <DraftBlock
            title="LinkedIn — message after accept"
            onUse={() => useDraft({ channel: "LinkedIn DM", step: "follow_up_1", body: draft.linkedin.message })}
            copyText={draft.linkedin.message}
          >
            <div style={draftText}>{draft.linkedin.message}</div>
          </DraftBlock>

          <DraftBlock
            title="Instagram / Facebook DM"
            onUse={() => useDraft({ channel: "Instagram DM", step: "first", body: draft.instagram.dm })}
            copyText={draft.instagram.dm}
            last
          >
            <div style={draftText}>{draft.instagram.dm}</div>
          </DraftBlock>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} style={{ ...panelStyle, display: "grid", gap: 8, marginBottom: 14, marginTop: 10, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label htmlFor={`${fid}-channel`} style={labelStyle}>Channel</label>
              <select id={`${fid}-channel`} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} style={selectStyle}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.channel === "Other" && (
              <div>
                <label htmlFor={`${fid}-custom`} style={labelStyle}>Channel name</label>
                <input id={`${fid}-custom`} placeholder="e.g. TikTok" value={form.customChannel} onChange={(e) => setForm({ ...form, customChannel: e.target.value })} style={{ ...inputStyle, maxWidth: 160 }} />
              </div>
            )}
            <div>
              <label htmlFor={`${fid}-step`} style={labelStyle}>Step</label>
              <select id={`${fid}-step`} value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value })} style={selectStyle}>
                <option value="first">First touch</option>
                <option value="follow_up_1">Follow-up 1</option>
                <option value="follow_up_2">Follow-up 2</option>
                <option value="follow_up_3">Follow-up 3+</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${fid}-status`} style={labelStyle}>Status</label>
              <select id={`${fid}-status`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={selectStyle}>
                <option value="sent">Sent</option>
                <option value="draft">Draft (not sent yet)</option>
              </select>
            </div>
          </div>
          {form.channel === "Email" && (
            <div>
              <label htmlFor={`${fid}-subject`} style={labelStyle}>Subject line</label>
              <input id={`${fid}-subject`} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
            </div>
          )}
          <div>
            <label htmlFor={`${fid}-body`} style={labelStyle}>Message body *</label>
            <textarea id={`${fid}-body`} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <button type="submit" disabled={saving} style={{ ...primaryBtnLg, width: "fit-content" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {loadingHistory ? (
        <p style={{ color: COLORS.muted, fontSize: FONT.md }}>Loading history…</p>
      ) : (
        <>
          {outreach.length === 0 && !showForm && (
            <p style={{ color: COLORS.muted, fontSize: FONT.md }}>No outreach logged yet for this lead.</p>
          )}
          {outreach.map((o) => (
            <div key={o.id} style={{ ...rowDivider, padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={channelBadge(o.channel)}>{o.channel}</span>
                <span style={{ fontSize: FONT.sm, color: COLORS.muted }}>{(o.step || "first").replace(/_/g, " ")}</span>
                <span style={{ fontSize: FONT.xs, fontWeight: 700, color: o.status === "replied" ? STATUS_COLORS.replied : o.status === "draft" ? COLORS.warning : STATUS_COLORS.outreach_sent }}>
                  {o.status?.toUpperCase()}
                </span>
                {o.sent_at && <span style={{ fontSize: FONT.sm, color: COLORS.muted }}>{new Date(o.sent_at).toLocaleDateString()}</span>}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {o.status !== "replied" && (
                    <button onClick={() => markReplied(o.id)} disabled={busyId === o.id} style={smallBtn}>Mark replied</button>
                  )}
                  <button onClick={() => removeTouch(o.id)} disabled={busyId === o.id} style={smallDangerBtn}>Delete</button>
                </div>
              </div>
              {o.subject && <div style={{ fontWeight: 600, fontSize: FONT.md, marginTop: 4 }}>{o.subject}</div>}
              <div style={{ fontSize: FONT.sm, color: COLORS.body, marginTop: 4, whiteSpace: "pre-wrap" }}>{o.body}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DraftBlock({ title, onUse, copyText, children, last }) {
  const [copyState, setCopyState] = useState(null); // null | "copied" | "failed"

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText || "");
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState(null), 1500);
  }

  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${COLORS.border}`, padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: FONT.xs, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>{title}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={copy} style={copyState === "failed" ? smallDangerBtn : smallBtn}>
            {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Copy failed" : "Copy"}
          </button>
          <button type="button" onClick={onUse} style={smallBtn}>Use this →</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Tile({ n, label, color }) {
  return (
    <div style={tileStyle}>
      <div style={{ fontSize: FONT.xxl, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary }}>{label}</div>
    </div>
  );
}

const panelStyle = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md };
const draftText = { whiteSpace: "pre-wrap", fontSize: FONT.sm };
