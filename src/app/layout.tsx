import type { Metadata, Viewport } from "next";
import { getSession, sTid } from "@/lib/auth";
import { prisma } from "@/lib/db";
import "./globals.css";

export const viewport: Viewport = { themeColor: "#1c3f6e" };

// Every page labels its browser tab with THE COMPANY the user is signed into —
// no two companies see identical, anonymous tab titles.
export async function generateMetadata(): Promise<Metadata> {
  let base = {
    manifest: "/manifest.webmanifest",
    other: { google: "notranslate" },
    description: "Data collection your institution can trust — CivicData",
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
  try {
    const session = await getSession();
    if (session) {
      const t = await prisma.tenant.findUnique({ where: { id: sTid(session) }, select: { name: true } });
      if (t?.name) {
        return {
          ...base,
          title: `${t.name} — CivicData`,
          appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: t.name },
        };
      }
    }
  } catch {
    // fall through to the public default
  }
  return {
    ...base,
    title: "CivicData — Data Collection Platform",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CivicData" },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var p=location.pathname;if(p.indexOf('/bill')!==0){var t=null;try{t=localStorage.getItem('zc-theme')}catch(e){}if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}try{var m=document.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute('content',t==='dark'?'#0d1411':'#1c3f6e')}catch(e){}}}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}