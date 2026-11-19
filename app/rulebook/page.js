"use client";
import { useEffect, useMemo, useState } from "react";
import {
  COLORS, FONT, RADIUS, cardStyle, primaryBtnLg, dangerBtn, linkBtn, backLink, h1Style, errorText, mutedText,
  solidBadge, disabledStyle,
} from "../../lib/ui.js";
import { diffLines, collapseUnchanged, diffStats } from "../../lib/lineDiff.js";

export default function RulebookProposals() {
  const [proposals, setProposals] = useState([]);
  const [progress, setProgress] = useState(null);
  const [liveVersion, setLiveVersion] = useState(null);
  const [baseTexts, setBaseTexts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [actError, setActError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/rulebook/proposals");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setProposals(data.proposals || []);
      setProgress(data.progress || null);
      setLiveVersion(data.liveVersion || null);
      setBaseTexts(data.baseTexts || {});
      setLoadError(null);
    } catch (e) {
      setLoadError("Could not load proposals: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/rulebook/proposals", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      load();
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function act(p, action) {
    if (action === "approve") {
      const stale = liveVersion && p.based_on_version && p.based_on_version !== liveVersion;
      const msg = stale
        ? `This proposal was drafted from rulebook version ${p.based_on_version}, but the live version is now ${liveVersion}. Approving replaces the WHOLE rulebook with the proposed text, discarding anything changed since. Approve anyway?`
        : "Approve this proposal? Its text becomes the live rulebook used by every new audit and outreach draft.";
      if (!window.confirm(msg)) return;
    }
    setBusyId(p.id);
    setActError(null);
    try {
      const res = await fetch(`/api/rulebook/proposals/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewedBy: "you" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActError(`Could not ${action} proposal: ` + (data.error || res.statusText));
      }
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
      <a href="/" style={backLink}>← Back to pipeline</a>

      <h1 style={h1Style}>Rulebook self-improvement</h1>
      <p style={{ color: COLORS.textSecondary, fontSize: FONT.md, marginTop: 0, maxWidth: 620 }}>
        Looks at leads whose outcome you've marked on the{" "}
        <a href="/outreach" style={{ color: COLORS.primary }}>outreach tracker</a> (replied / won / lost) plus any
        findings you pulled from outreach on a lead's audit page, and proposes edits to the rulebook. Nothing here goes
        live on its own — review each proposal and approve or reject it.
      </p>

      {progress && <ProgressCard progress={progress} />}

      <button onClick={generate} disabled={generating} style={{ ...primaryBtnLg, marginTop: 14, ...disabledStyle(generating) }}>
        {generating ? "Analyzing outcomes…" : "Generate new proposal"}
      </button>
      {genError && <p style={errorText}>{genError}</p>}
      {loadError && <p style={errorText}>{loadError}</p>}
      {actError && <p style={errorText}>{actError}</p>}

      {loading && <p style={{ color: COLORS.textSecondary, marginTop: 20 }}>Loading…</p>}

      {!loading && pending.length === 0 && (
        <p style={{ color: COLORS.textSecondary, marginTop: 20 }}>No pending proposals.</p>
      )}

      {pending.map((p) => (
        <PendingProposal
          key={p.id}
          p={p}
          baseText={p.based_on_version ? baseTexts[p.based_on_version] : undefined}
          liveVersion={liveVersion}
          busy={busyId === p.id}
          onAct={(action) => act(p, action)}
        />
      ))}

      {decided.length > 0 && (
        <>
          <h3 style={{ fontSize: FONT.lg, marginTop: 28, color: COLORS.body }}>History</h3>
          {decided.map((p) => (
            <section key={p.id} style={{ ...cardStyle, marginTop: 10, opacity: 0.8 }}>
              <span style={solidBadge(p.status === "approved" ? COLORS.success : COLORS.danger)}>{p.status}</span>
              <span style={{ ...mutedText, marginLeft: 8 }}>{new Date(p.created_at).toLocaleString()}</span>
              <p style={{ fontSize: FONT.md, marginTop: 8, marginBottom: 0 }}>{p.summary}</p>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

// "6 of 8 outcome-tagged leads collected" -- progress toward the minimum
// sample generateProposal() needs (MIN_OUTCOME_LEADS in lib/selfImprove.js).
function ProgressCard({ progress }) {
  const { outcomeLeads, minOutcomeLeads } = progress;
  if (outcomeLeads == null) {
    return <p style={{ ...mutedText, marginTop: 14 }}>Couldn't count outcome-tagged leads right now.</p>;
  }
  const ready = outcomeLeads >= minOutcomeLeads;
  const pct = Math.min(100, Math.round((outcomeLeads / minOutcomeLeads) * 100));
  return (
    <section style={{ ...cardStyle, marginTop: 14 }}>
      <div style={{ fontSize: FONT.md, fontWeight: 600 }}>
        {outcomeLeads} of {minOutcomeLeads} outcome-tagged leads collected
      </div>
      <div style={{ height: 8, background: COLORS.divider, borderRadius: RADIUS.pill, marginTop: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: ready ? COLORS.success : COLORS.primary }} />
      </div>
      <div style={{ ...mutedText, marginTop: 6 }}>
        {ready
          ? "Enough outcomes to generate a proposal."
          : `${minOutcomeLeads - outcomeLeads} more audited lead${minOutcomeLeads - outcomeLeads === 1 ? "" : "s"} marked replied / won / lost needed before a proposal can be generated.`}
      </div>
    </section>
  );
}

function PendingProposal({ p, baseText, liveVersion, busy, onAct }) {
  const [view, setView] = useState("diff"); // "diff" | "full" | null
  const ops = useMemo(() => (baseText != null ? diffLines(baseText, p.proposed_text) : null), [baseText, p.proposed_text]);
  const stats = ops ? diffStats(ops) : null;
  const stale = liveVersion && p.based_on_version && p.based_on_version !== liveVersion;

  return (
    <section style={{ ...cardStyle, marginTop: 16, borderColor: COLORS.warning }}>
      <div>
        <span style={solidBadge(COLORS.warning)}>pending</span>
        <span style={{ ...mutedText, marginLeft: 8 }}>
          based on {p.lead_count} outcome-tagged leads · {new Date(p.created_at).toLocaleString()}
        </span>
      </div>
      <p style={{ fontSize: FONT.md, marginTop: 10 }}>{p.summary}</p>

      {p.evidence?.length > 0 && (
        <div style={{ fontSize: FONT.sm, color: COLORS.textSecondary, marginTop: 8 }}>
          Evidence: {p.evidence.map((e) => `${e.company} (${e.outcome})`).join(", ")}
        </div>
      )}

      {stale && (
        <p style={{ ...errorText, fontWeight: 600 }}>
          Drafted from version {p.based_on_version}, but the live rulebook is now {liveVersion}. The diff below is against
          the version it was drafted from; approving would discard changes made since.
        </p>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        {ops && (
          <button onClick={() => setView(view === "diff" ? null : "diff")} style={linkBtn}>
            {view === "diff" ? "Hide changes" : "Show changes"}
          </button>
        )}
        <button onClick={() => setView(view === "full" ? null : "full")} style={linkBtn}>
          {view === "full" ? "Hide full proposed text" : "Show full proposed text"}
        </button>
        {stats && (
          <span style={mutedText}>
            <span style={{ color: COLORS.success, fontWeight: 700 }}>+{stats.added}</span>{" "}
            <span style={{ color: COLORS.danger, fontWeight: 700 }}>−{stats.removed}</span> lines
          </span>
        )}
      </div>

      {!ops && (
        <p style={{ ...mutedText, marginTop: 8 }}>
          Can't show a diff: the version this proposal was based on ({p.based_on_version || "unknown"}) wasn't found.
          Review the full proposed text instead.
        </p>
      )}
      {view === "diff" && ops && <DiffView ops={ops} />}
      {view === "full" && <pre style={preStyle}>{p.proposed_text}</pre>}

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={() => onAct("approve")}
          disabled={busy}
          style={{ ...primaryBtnLg, background: COLORS.success, borderColor: COLORS.success, ...disabledStyle(busy) }}
        >
          {busy ? "…" : "Approve & go live"}
        </button>
        <button
          onClick={() => onAct("reject")}
          disabled={busy}
          style={{ ...dangerBtn, padding: "10px 16px", fontSize: FONT.md, fontWeight: 600, ...disabledStyle(busy) }}
        >
          {busy ? "…" : "Reject"}
        </button>
      </div>
    </section>
  );
}

const DIFF_STYLE = {
  add: { background: "#e7f6ec", color: "#14532d", prefix: "+ " },
  del: { background: "#fdecec", color: "#7f1d1d", prefix: "− ", textDecoration: "line-through" },
  same: { background: "transparent", color: COLORS.body, prefix: "  " },
};

function DiffView({ ops }) {
  const rows = useMemo(() => collapseUnchanged(ops, 3), [ops]);
  if (!rows.some((r) => r.type === "add" || r.type === "del")) {
    return <p style={{ ...mutedText, marginTop: 8 }}>No line changes compared to the version it was based on.</p>;
  }
  return (
    <div style={{ ...preStyle, padding: 0 }}>
      {rows.map((r, i) => {
        if (r.type === "skip") {
          return (
            <div key={i} style={{ padding: "2px 12px", color: COLORS.muted, background: COLORS.divider, fontStyle: "italic" }}>
              ⋯ {r.count} unchanged line{r.count === 1 ? "" : "s"}
            </div>
          );
        }
        const st = DIFF_STYLE[r.type];
        return (
          <div
            key={i}
            style={{
              padding: "0 12px", whiteSpace: "pre-wrap", wordBreak: "break-word",
              background: st.background, color: st.color, textDecoration: st.textDecoration,
            }}
          >
            {st.prefix}{r.text || " "}
          </div>
        );
      })}
    </div>
  );
}

const preStyle = {
  whiteSpace: "pre-wrap", fontSize: FONT.sm, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: COLORS.panelBg, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md,
  padding: 12, maxHeight: 480, overflowY: "auto", marginTop: 8,
};
