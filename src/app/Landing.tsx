"use client";
// Landing — what a visitor sees on the platform root before any account exists.
// Collect free; the paid services list is right there so companies know what
// unlocks later. Sign-in is a quiet button, not a wall.
// PRIVACY LAW: the landing is product-only — no institution names or logos of
// customers appear here; their interfaces live behind their logins.
import { useEffect, useState } from "react";

const PAID = [
  ["More staff seats", "Free plan holds 2 staff. Add seats when your team grows."],
  ["Your logo & branding", "Your logo in the register, on the sign-in page and on your bills."],
  ["Bill designer", "Edit the text and logo on your printable bills."],
  ["Full services", "Bills, approval workflows and everything a working office needs."],
];

export default function Landing() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--navy)", color: "#fff", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CivicData logo" style={{ width: 40, height: 40, borderRadius: 8, background: "#fff" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>CivicData</div>
            <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>DATA COLLECTION PLATFORM</div>
          </div>
        </div>
        <a href="/login" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, padding: "8px 16px", fontSize: 14, textDecoration: "none" }}>
          Sign in
        </a>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "34px 22px", flex: 1 }}>
        <h1 style={{ fontSize: 30, lineHeight: 1.25, marginBottom: 10 }}>
          Collect data the way the big assemblies do — free.
        </h1>
        <p style={{ fontSize: 15.5, opacity: 0.9, maxWidth: 640, lineHeight: 1.6 }}>
          CivicData runs the register engine trusted by eight zonal councils for two years:
          people and businesses are recorded with serials that can never collide or repeat,
          every change is audited, and you can work from any phone even with weak network.
        </p>

        <div style={{ display: "flex", gap: 12, margin: "22px 0 30px", flexWrap: "wrap" }}>
          <a href="/signup" className="btn btn-primary" style={{ background: "#fff", color: "var(--navy)", padding: "12px 22px", fontSize: 15, textDecoration: "none", borderRadius: 8 }}>
            Start collecting data — free
          </a>
          <a href="/login" style={{ alignSelf: "center", fontSize: 14, color: "#fff", opacity: 0.8 }}>
            Already have an account? Sign in
          </a>
        </div>

        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            Data collection is free. Full-services unlocks, with the platform administrator&apos;s approval:
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {PAID.map(([t, d]) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ minWidth: 8, height: 8, borderRadius: 8, background: "#3e7bfa", marginTop: 6 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12.5, opacity: 0.75 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 12 }}>
            Money is never held inside the system — the administrator agrees the price with you directly; approval happens after payment.
          </div>
        </div>
      </main>

      <footer style={{ padding: "16px 22px", fontSize: 12, opacity: 0.6, display: "flex", justifyContent: "space-between" }}>
        <span>Powered by CivicData — records only, never custody. Your data is visible only through your own logins.</span>
        <span />
      </footer>
    </div>
  );
}
