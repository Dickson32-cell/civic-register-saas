import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { themeColor: "#0a3b2a" };

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Adweso" },
  other: { google: "notranslate" },
  title: "Adweso Zonal Council — Temporal Structures Register",
  description: "Fee register for temporal structures, Adweso Zonal Council",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var p=location.pathname;if(p.indexOf('/bill')!==0){var t=null;try{t=localStorage.getItem('zc-theme')}catch(e){}if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}try{var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content',t==='dark'?'#0d1411':'#0a3b2a')}catch(e){}}}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}