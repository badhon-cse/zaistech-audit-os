import { COLORS, FONT, FONT_FAMILY, RADIUS } from "../lib/ui.js";

export const metadata = {
  title: "Zaistech Audit OS",
  description: "Automated site audits and outreach tracking for Zaistech",
};

// The system font stack is the one font used everywhere (Manrope was named
// here before but never actually loaded, so it only ever fell back anyway).
// This wrapper is the single page-width constraint -- pages don't add their own.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: FONT_FAMILY,
          background: COLORS.pageBg,
          color: COLORS.text,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
          <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: RADIUS.md, background: COLORS.primary,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: FONT.md,
              }}
            >
              Z
            </div>
            <a href="/" style={{ fontWeight: 700, fontSize: FONT.lg, color: COLORS.text, textDecoration: "none" }}>
              Zaistech Audit OS
            </a>
            <nav style={{ display: "flex", gap: 16, marginLeft: 20 }}>
              <a href="/today" style={navLink}>Today</a>
              <a href="/outreach" style={navLink}>Outreach</a>
              <a href="/rulebook" style={navLink}>Rulebook</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

const navLink = { fontSize: FONT.sm, fontWeight: 600, color: COLORS.textSecondary, textDecoration: "none" };
