"use client";
import { useEffect, useState } from "react";

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

export default function OutreachTracker() {
  const [leads, setLeads] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

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

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <a href="/" style={{ color: "#2f5d8a", fontSize: 13, textDecoration: "none" }}>← Back to pipeline</a>

      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>Outreach tracker</h1>
      <p style={{ color: "#5b6673", fontSize: 14, marginTop: 0 }}>
        Who's been contacted, on which channel, and when the next follow-up is due.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Tile n={overdueCount} label="Overdue" color="#b42318" />
        <Tile n={todayCount} label="Due today" color="#9a6700" />
        <Tile n={contacted.length} label="Contacted" color="#2f5d8a" />
        <Tile n={notContacted.length} label="Not contacted yet" color="#9aa5b1" />
      </div>

      <p style={{ color: "#9aa3af", fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
        This page is the overview. To draft or log an actual message, click "Open lead →" to go to that lead's page.
      </p>

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
            <TrackerRow key={lead.id} lead={lead} onSave={saveNextAction} busy={savingId === lead.id} />
          ))}
        </tbody>
      </table>

      {notContacted.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, color: "#5b6673", marginTop: 28 }}>Not contacted yet</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>
              {notContacted.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
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
                    <a href={`/lead/${lead.id}`} style={openBtn}>Open lead →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function TrackerRow({ lead, onSave, busy }) {
  const [actionText, setActionText] = useState(lead.next_action || "");
  const [actionDate, setActionDate] = useState(lead.next_action_date || "");
  const u = urgency(lead.next_action_date);
  const us = u ? URGENCY_STYLE[u] : null;

  return (
    <tr style={{ borderBottom: "1px solid #f0f2f5" }}>
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
        <a href={`/lead/${lead.id}`} style={openBtn}>Open lead →</a>
      </td>
    </tr>
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
const channelBadge = { fontSize: 10.5, fontWeight: 700, color: "#fff", borderRadius: 4, padding: "2px 6px", display: "inline-block", marginBottom: 2 };
const statusBadge = { fontSize: 11.5, fontWeight: 600, borderRadius: 5, padding: "3px 8px", textTransform: "capitalize" };
const openBtn = {
  display: "inline-block", fontSize: 12, fontWeight: 600, color: "#fff", background: "#2f5d8a",
  borderRadius: 6, padding: "6px 10px", textDecoration: "none", whiteSpace: "nowrap",
};
