import "@/app/globals.css";
import Providers from "@/components/providers";
import AuthNav from "@/components/auth-nav";

export const metadata = {
  title: "Cricket Studio",
  description: "Advanced cricket scoring app"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
            <header className="topbar">
              <div className="topbar-inner">
                <div>
<div className="brand-section">
  <div className="brand-title">
    🏏 Cricket Studio
  </div>

  <div
    style={{
      marginTop: 4,
      fontSize: "0.9rem",
      color: "#64748b",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span>💡</span>
    <span>
      New here? Open the <strong>Help </strong>
      tab for a step-by-step guide.
    </span>
  </div>
</div>
                </div>
                <AuthNav />
              </div>
            </header>

            <main className="page-container">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}