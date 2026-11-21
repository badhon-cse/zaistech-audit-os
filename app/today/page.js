"use client";
import { useEffect, useState } from "react";
import {
  COLORS, FONT, STATUS_COLORS, cardStyle, tileStyle, statusBadge, channelBadge, smallBtn, errorText, backLink, h1Style,
} from "../../lib/ui.js";
import { bucketLeadsForToday, primaryFollowup, URGENCY_STYLE } from "../../lib/urgency.js";

// The morning view: everything that needs a human today, most urgent first.
// Uses the same data (/api/outreach-tracker) and the same bucketing logic
// (bucketLeadsForToday in lib/urgency.js) as /api/today-summary, so the
// page and any daily digest built from that endpoint always agree. "Today"
// here is the viewer's local calendar day.
export default function Today() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/outreach-tracker");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        setRows(data.leads || []);
      } catch (e) {
        setError("Could not load today's list: " + e.message);
        setRows([]);
      }
    })();
  }, []);

  if (!rows) return <p style={{ color: COLORS.textSecondary }}>Loading…</p>;

  const b = bucketLeadsForToday(rows);
  const total = b.overdue.length + b.dueToday.length + b.notContacted.length;

  return (
    <div style={{ maxWidth: 880 }}>
      <a href="/" style={backLink}>← Back to pipeline</a>
      <h1 style={h1Style}>Today</h1>
      <p style={{ color: COLORS.textSecondary, fontSize: FONT.md, marginTop: 0 }}>
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} — everything waiting
        on you, most urgent first.
      </p>
      {error && <p style={errorText}>{error}</p>}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Tile n={b.overdue.length} label="Overdue" color={URGENCY_STYLE.overdue.fg} />
        <Tile n={b.dueToday.length} label="Due today" color={URGENCY_STYLE.today.fg} />
        <Tile n={b.notContacted.length} label="Approved, not contacted" color={STATUS_COLORS.audited} />
      </div>

      {total === 0 && !error && (
        <section style={cardStyle}>
          <p style={{ margin: 0, color: COLORS.textSecondary }}>
            Nothing due today. Upcoming follow-ups are on the <a href="/outreach" style={{ color: COLORS.primary }}>outreach tracker</a>.
          </p>
        </section>
      )}

      <Section
        title="Overdue follow-ups"
        hint="Past their due date — send these first."
        leads={b.overdue}
        render={(lead) => <FollowupItem lead={lead} />}
      />
      <Section
        title="Due today"
        leads={b.dueToday}
        render={(lead) => <FollowupItem lead={lead} />}
      />
      <Section
        title="Approved, not contacted yet"
        hint="Audit approved but no real (non-draft) outreach touch sent."
        leads={b.notContacted}
        render={(lead) => (
          <Item lead={lead} href={`/outreach?lead=${lead.id}`} action="Write outreach →">
            <span style={statusBadge(lead.status)}>{lead.status.replace("_", " ")}</span>
            {lead.touchCount > 0 && <span style={{ fontSize: FONT.xs, color: COLORS.warning, fontWeight: 700 }}>draft saved</span>}
            <WaitingSince lead={lead} />
          </Item>
        )}
      />
    </div>
  );
}

function Section({ title, hint, leads, render }) {
  if (!leads.length) return null;
  return (
    <section style={{ ...cardStyle, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 2px", fontSize: FONT.md }}>
        {title} <span style={{ color: COLORS.muted, fontWeight: 500 }}>({leads.length})</span>
      </h3>
      {hint && <div style={{ fontSize: FONT.sm, color: COLORS.muted, marginBottom: 6 }}>{hint}</div>}
      {leads.map((lead) => <div key={lead.id}>{render(lead)}</div>)}
    </section>
  );
}

function Item({ lead, href, action, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: `1px solid ${COLORS.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{lead.company}</div>
        <div style={{ fontSize: FONT.sm, color: COLORS.muted }}>
          {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.domain}
          {lead.title ? ` — ${lead.title}` : ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>{children}</div>
      </div>
      <a href={href} style={smallBtn}>{action}</a>
    </div>
  );
}

function FollowupItem({ lead }) {
  const p = primaryFollowup(lead);
  const others = (lead.followups || []).filter((f) => f.channel !== p.channel && (f.next_action || f.next_action_date));
  return (
    <Item lead={lead} href={`/outreach?lead=${lead.id}`} action="Open →">
      {p.channel && <span style={channelBadge(p.channel)}>{p.channel}</span>}
      <span style={{ fontSize: FONT.sm, color: COLORS.body }}>{p.next_action || "Follow up"}</span>
      {p.next_action_date && <span style={{ fontSize: FONT.xs, color: COLORS.muted }}>due {p.next_action_date}</span>}
      {others.length > 0 && (
        <span style={{ fontSize: FONT.xs, color: COLORS.muted }}>
          · also {others.map((f) => f.channel + (f.next_action_date ? ` (${f.next_action_date})` : "")).join(", ")}
        </span>
      )}
    </Item>
  );
}

function WaitingSince({ lead }) {
  if (!lead.updated_at) return null;
  const days = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
  return (
    <span style={{ fontSize: FONT.xs, color: days >= 3 ? COLORS.warning : COLORS.muted }}>
      {days <= 0 ? "since today" : `waiting ${days} day${days === 1 ? "" : "s"}`}
    </span>
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
