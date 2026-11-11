import type { Metadata } from "next";

// Privacy — required for the Play Store listing and honest for every company.
// Plain language: what CivicData stores, who can see it, what never leaves.
export const metadata: Metadata = {
  title: "Privacy — CivicData",
  description: "What CivicData stores, who can see it, and what never leaves the system.",
};

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "What we collect",
    p: [
      "When a company creates a workspace, CivicData stores the company name, the administrator's username and a hashed password (never the password itself), and the areas the company types in. When staff or officers record a taxpayer or member, CivicData stores what the company's own staff type: names, business names, telephone numbers, streets, areas, serial numbers, bills and payments.",
      "We do not collect anything for advertising. There are no tracking pixels and no third-party analytics on this platform.",
    ],
  },
  {
    h: "Who can see a company's data",
    p: [
      "Every company's workspace is isolated. Data can only be reached by signing in with that company's own accounts, and staff roles see only what their administrator allows. Excel exports include only the signed-in company's records — no company can export or view another company's data.",
      "The platform team operates the system. They can access the service only for maintenance and support tasks, and they do not sell or share any company's data.",
    ],
  },
  {
    h: "Money",
    p: [
      "CivicData never holds payments. Bills recorded here describe amounts owed; actual payments are received by the company itself, outside this system. Paid extras (extra staff seats, custom logo and the bill designer) are agreed directly with the platform team and unlocked with a key after payment.",
    ],
  },
  {
    h: "Data location and retention",
    p: [
      "Records live in an encrypted cloud database in the United States. A company can request deletion of its whole workspace at any time by contacting the platform team; deletions of single records inside a company are controlled by its own administrators, and deleted records are retired rather than erased so serial numbers stay trustworthy.",
    ],
  },
  {
    h: "Contact",
    p: [
      "Questions, export copies or workspace deletion: reach the platform team on the support line printed on your invoices, receipts and unlock messages. A public support email is published before any app-store listing.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 780, width: "100%", boxSizing: "border-box", margin: "0 auto", padding: "30px 22px 50px" }}>
      <h1 style={{ fontSize: 24, color: "#122447", marginBottom: 4 }}>Privacy</h1>
      <p style={{ fontSize: 13.5, color: "#5b6b86", marginBottom: 22 }}>Plain language, last updated 11 November 2026.</p>
      {SECTIONS.map((s) => (
        <section key={s.h} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, color: "#1c3f6e", marginBottom: 6 }}>{s.h}</h2>
          {s.p.map((x, i) => (
            <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: "#33415c", marginBottom: 8 }}>
              {x}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
