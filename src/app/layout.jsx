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
                  <div className="brand-title">🏏 Cricket Studio</div>
                  <div className="brand-sub">
                    Advanced scoring • custom overs • custom wickets • custom powerplay overs • player stats
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