// Shared design tokens + inline-style objects for the UI pages.
//
// The app styles everything with inline `style={{}}` objects; this module is
// the single place those values live so the pages stop drifting apart. It is
// deliberately plain JS (no components): import a style object and spread it,
// adding per-instance overrides after the spread, e.g.
//   <button style={{ ...secondaryBtn, marginTop: 8 }}>
// Helpers that depend on data (status/channel badges) are small functions that
// return a style object, so the same spread-and-override pattern still works.

// ---- Scale ---------------------------------------------------------------

export const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export const FONT = { xs: 11, sm: 12.5, md: 14, lg: 16, xl: 20, xxl: 24 };

export const RADIUS = { sm: 6, md: 8, lg: 12, pill: 999 };

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// ---- Colors --------------------------------------------------------------

export const COLORS = {
  primary: "#2f5d8a", // action color: primary buttons and links only
  text: "#1b2430",
  textSecondary: "#5b6673",
  body: "#374151",
  // Small secondary text. #6b7280 is ~4.8:1 on white (WCAG AA for small
  // text); the old #9aa3af / #9aa5b1 was only ~2.5:1.
  muted: "#6b7280",
  border: "#e6e9ee",
  borderStrong: "#cbd3dc",
  divider: "#f0f2f5",
  pageBg: "#f6f7f9",
  panelBg: "#fafbfc",
  surface: "#fff",
  danger: "#b3261e",
  success: "#1e7a43",
  warning: "#d9822b",
};

// Lead status colors. Used as text on a light tint of the same color, so each
// must be dark enough to read as text. `audited` is deliberately NOT the
// primary-button blue (badges shouldn't look clickable), and the three
// "positive" outreach states are spread across hue: cyan (sent) -> emerald
// (replied) -> clear green (won).
export const STATUS_COLORS = {
  new: "#6b7280",
  auditing: "#f0a500",
  needs_review: "#d9822b",
  audited: "#4338ca",
  demo_ready: "#a21caf",
  outreach_sent: "#0e7490",
  replied: "#047857",
  won: "#2e7d32",
  lost: "#b3261e",
  failed: "#7f1d1d",
};

export function statusColor(status) {
  return STATUS_COLORS[status] || COLORS.muted;
}

// Channel badges are white text on a solid color. LinkedIn uses its darker
// brand navy so it doesn't blur into Facebook's bright blue, and Email is a
// neutral slate rather than the primary-button blue.
export const CHANNELS = ["Email", "LinkedIn DM", "Instagram DM", "Facebook DM", "WhatsApp", "Other"];
export const CHANNEL_COLORS = {
  Email: "#475569",
  "LinkedIn DM": "#004182",
  "Instagram DM": "#c13584",
  "Facebook DM": "#1877f2",
  WhatsApp: "#075e54",
  Other: "#6b7280",
};

export function channelColor(channel) {
  return CHANNEL_COLORS[channel] || COLORS.muted;
}

// ---- Surfaces ------------------------------------------------------------

export const cardStyle = {
  background: COLORS.surface,
  borderRadius: RADIUS.lg,
  border: `1px solid ${COLORS.border}`,
  padding: SPACE.lg,
};

export const tileStyle = {
  background: COLORS.surface,
  borderRadius: RADIUS.lg,
  border: `1px solid ${COLORS.border}`,
  padding: "12px 16px",
  minWidth: 100,
};

// ---- Text ----------------------------------------------------------------

export const mutedText = { fontSize: FONT.sm, color: COLORS.muted };

export const linkStyle = { color: COLORS.primary, textDecoration: "none" };

export const backLink = { color: COLORS.primary, fontSize: FONT.sm, textDecoration: "none" };

export const h1Style = { fontSize: FONT.xxl, margin: "10px 0 4px" };

export const errorText = { color: COLORS.danger, fontSize: FONT.sm, marginTop: SPACE.sm };

// ---- Buttons -------------------------------------------------------------

const btnBase = {
  fontFamily: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-block",
  lineHeight: 1.3,
};

export const primaryBtn = {
  ...btnBase,
  background: COLORS.primary,
  color: "#fff",
  border: `1px solid ${COLORS.primary}`,
  borderRadius: RADIUS.md,
  padding: "8px 14px",
  fontSize: FONT.sm,
};

export const primaryBtnLg = { ...primaryBtn, padding: "10px 16px", fontSize: FONT.md };

// Neutral bordered button (outcome buttons, "+ Log outreach", etc).
export const secondaryBtn = {
  ...btnBase,
  fontWeight: 500,
  background: COLORS.surface,
  color: COLORS.body,
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: RADIUS.sm,
  padding: "6px 10px",
  fontSize: FONT.sm,
};

// Bordered button in the action color (secondary-but-emphasized).
export const outlineBtn = {
  ...secondaryBtn,
  fontWeight: 600,
  color: COLORS.primary,
  borderColor: COLORS.primary,
};

export const dangerBtn = {
  ...secondaryBtn,
  color: COLORS.danger,
  borderColor: COLORS.danger,
};

// Compact bordered button for in-row actions ("Mark replied", "Copy").
export const smallBtn = {
  ...secondaryBtn,
  fontWeight: 600,
  color: COLORS.primary,
  padding: "3px 8px",
  fontSize: FONT.xs,
};

export const smallDangerBtn = { ...smallBtn, color: COLORS.danger, borderColor: COLORS.danger };

// Toggle button (e.g. "Manage ▾" / "Hide ▴").
export const toggleBtn = { ...secondaryBtn, fontWeight: 600, color: COLORS.primary };
export const toggleBtnActive = { ...toggleBtn, background: COLORS.primary, color: "#fff", borderColor: COLORS.primary };

// Bare text button -- only for low-risk actions like "Dismiss".
export const linkBtn = {
  fontFamily: "inherit",
  background: "none",
  border: "none",
  color: COLORS.primary,
  fontSize: FONT.sm,
  cursor: "pointer",
  padding: 0,
};

export function disabledStyle(disabled) {
  return disabled ? { opacity: 0.6, cursor: "not-allowed" } : null;
}

// ---- Badges --------------------------------------------------------------

export const badgeBase = {
  display: "inline-block",
  fontSize: FONT.xs,
  fontWeight: 700,
  borderRadius: RADIUS.pill,
  padding: "3px 10px",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

// Status pill: colored text on a light tint of the same color.
export function statusBadge(status) {
  const c = statusColor(status);
  return { ...badgeBase, background: c + "22", color: c };
}

// Solid pill with white text (outcome badge on the lead panel).
export function solidBadge(color) {
  return { ...badgeBase, background: color, color: "#fff" };
}

export function channelBadge(channel) {
  return {
    ...badgeBase,
    textTransform: "none",
    borderRadius: RADIUS.sm,
    padding: "2px 7px",
    background: channelColor(channel),
    color: "#fff",
  };
}

// Small uppercase tag (finding area labels etc).
export const tagStyle = {
  background: "#eef2f7",
  color: COLORS.textSecondary,
  fontSize: FONT.xs,
  fontWeight: 700,
  textTransform: "uppercase",
  borderRadius: RADIUS.sm,
  padding: "2px 6px",
};

// ---- Tables --------------------------------------------------------------

export const th = {
  padding: "8px 10px",
  fontWeight: 600,
  textAlign: "left",
  borderBottom: `1px solid ${COLORS.border}`,
};

export const td = { padding: "10px 10px" };

export const tdTop = { ...td, verticalAlign: "top" };

export const rowDivider = { borderBottom: `1px solid ${COLORS.divider}` };

// ---- Forms ---------------------------------------------------------------

export const inputStyle = {
  fontFamily: "inherit",
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: RADIUS.sm,
  padding: "7px 9px",
  fontSize: FONT.sm,
  color: COLORS.text,
  background: COLORS.surface,
  boxSizing: "border-box",
};

export const selectStyle = { ...inputStyle, width: "auto" };

// Small but visible field label; pair with htmlFor/id.
export const labelStyle = {
  display: "block",
  fontSize: FONT.xs,
  fontWeight: 600,
  color: COLORS.textSecondary,
  marginBottom: 3,
};
