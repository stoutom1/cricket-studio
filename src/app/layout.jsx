import "@/app/globals.css";
import "@/app/spectator-mobile-safety.css";
import "@/app/ios-native.css";
import Providers from "@/components/providers";
import AuthNav from "@/components/auth-nav";
import NativeRuntimeBootstrap from "@/components/native-runtime-bootstrap";
import NativeAppLifecycle from "@/components/native-app-lifecycle";
import NativePushRuntime from "@/components/native-push-runtime";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CricChatbot from "@/components/CricChatbot";
import SiteFooter from "@/components/site-footer";

export const metadata = {
  title: "Cric4All",
  description: "Cricket scoring, live scores, league management and player statistics.",
  applicationName: "Cric4All",
  appleWebApp: {
    capable: true,
    title: "Cric4All",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NativeRuntimeBootstrap />
          <NativeAppLifecycle />
          <NativePushRuntime />

          <div className="app-shell cric4all-desktop-zoom">
            <header className="topbar">
              <div className="topbar-inner mobile-header-layout">
                <div>
                  <div className="brand-section">
                    <div className="brand-title">🏏 Cric4All</div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.9rem",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    />
                  </div>
                </div>
                <AuthNav />
              </div>
            </header>

            <main className="page-container cric4all-page-shell">
              {children}
            </main>
          </div>
        </Providers>

        <Analytics />
        <SpeedInsights />
        <CricChatbot />
        <SiteFooter />
      </body>
    </html>
  );
}
