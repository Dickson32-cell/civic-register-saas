"use client";
// Signup request — an institution asks for its own workspace (free data collection
// or paid services later). The platform administrator processes every request in
// the Master Console; nothing is created automatically.
import { useState } from "react";

export default function SignupPage() {
  const [org, setOrg] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [areas, setAreas] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, contact, phone, note: `Areas: ${areas}` }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error || "Could not send — try again.");
      else {
        setDone(true);
        setMsg(j.message || "Request received.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form className="card" onSubmit={submit} style={{ width: "100%", maxWidth: 520, padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CivicData" style={{ width: 44, height: 44, borderRadius: 8 }} />
          <div>
            <h1 style={{ fontSize: 19, margin: 0 }}>Start collecting — free</h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
              Set up takes minutes. The platform administrator confirms your workspace and contacts your admin login.
            </p>
          </div>
        </div>

        {done ? (
          <>
            <div style={{ padding: "12px 14px", background: "var(--blue-soft)", color: "var(--navy)", borderRadius: 8, fontSize: 14, marginBottom: 12 }}>
              {msg} We will reach you on the phone you gave.
            </div>
            <a href="/" style={{ color: "var(--navy)", fontSize: 14 }}>Back to welcome</a>
          </>
        ) : (
          <>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Institution / company name</span>
              <input value={org} onChange={(e) => setOrg(e.target.value)} required minLength={3} maxLength={120}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Your name (the administrator)</span>
              <input value={contact} onChange={(e) => setContact(e.target.value)} required minLength={3} maxLength={120}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Phone (for your login details)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 14 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Areas / branches you record (optional)</span>
              <input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="e.g. Central, Riverside, East"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            {err && <div style={{ marginBottom: 10, fontSize: 13.5, color: "#b3261e" }}>{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy} style={{ width: "100%", padding: "12px 0", fontSize: 15 }}>
              {busy ? "Sending…" : "Send my request"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
