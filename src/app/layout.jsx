import "@/app/globals.css";
import Providers from "@/components/providers";
import AuthNav from "@/components/auth-nav";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CricChatbot from "@/components/CricChatbot";
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
              <div className="topbar-inner mobile-header-layout">
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
  </div>
</div>
                </div>
                <AuthNav />
              </div>
            </header>

            <main className="page-container">{children}</main>
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
        <CricChatbot />
      </body>
    </html>
  );
}