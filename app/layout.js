export const metadata = {
  title: "Zaistech Audit OS",
  description: "Automated site audits and outreach tracking for Zaistech",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Manrope, 'Source Sans 3', system-ui, sans-serif",
          background: "#f6f7f9",
          color: "#1b2430",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
          <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 7, background: "#2f5d8a",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14,
              }}
            >
              Z
            </div>
            <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "#1b2430", textDecoration: "none" }}>
              Zaistech Audit OS
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
