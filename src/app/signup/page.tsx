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
  const [logo, setLogo] = useState<string>("");
  const [colour, setColour] = useState<string>("");

  const COLOURS = ["#1c3f6e", "#3e7bfa", "#7d3cf5", "#0a6e43", "#b0322a", "#b88721"];

  function fileToDataUrl(file: File | null | undefined) {
    if (!file) { setLogo(""); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, contact, phone, areas, colour, logoDataUrl: logo }),
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
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Areas / branches you record (optional)</span>
              <input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="e.g. Central, Riverside, East"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>

            <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 8px" }}>Make it yours</div>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Interface colour</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {COLOURS.map((c) => (
                  <button key={c} type="button" onClick={() => setColour(c)} aria-label={`colour ${c}`}
                    style={{ width: 34, height: 34, borderRadius: 8, background: c, border: colour === c ? "3px solid #111" : "1px solid var(--line)", cursor: "pointer" }} />
                ))}
              </div>
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 14 }}>
              <span className="cap" style={{ fontSize: 13, fontWeight: 600 }}>Your logo (optional — part of the paid brand service)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => fileToDataUrl(e.target.files?.[0])}
                style={{ fontSize: 13, marginTop: 4 }} />
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
