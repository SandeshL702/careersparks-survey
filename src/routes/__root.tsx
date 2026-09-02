import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "CareerSparks Survey";

export const Route = createRootRoute({
  errorComponent: function RootError({ error }) {
    const message = error instanceof Error ? error.message : "Server error";
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>CareerSparks</title>
        </head>
        <body
          style={{
            margin: 0,
            minHeight: "100vh",
            background: "#0C0B09",
            color: "#F6F1E4",
            fontFamily: "Figtree, system-ui, sans-serif",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <p style={{ fontSize: 13, letterSpacing: "0.2em", color: "#F5C518" }}>CAREERSPARKS</p>
            <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Site starting…</h1>
            <p style={{ color: "#A39B8A", fontSize: 14 }}>{message}</p>
            <p style={{ marginTop: 24 }}>
              <a href="/install" style={{ color: "#0C0B09", background: "#F5C518", padding: "10px 18px", borderRadius: 999, textDecoration: "none", fontWeight: 600 }}>
                Open installer
              </a>
            </p>
          </div>
        </body>
      </html>
    );
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0C0B09" },
      {
        name: "description",
        content: "CareerSparks Survey — collect and analyse responses for hiring, screening and community pulses.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#16140F",
                border: "1px solid #2A261C",
                color: "#F6F1E4",
              },
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
