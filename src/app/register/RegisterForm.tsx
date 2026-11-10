"use client";
// Staff self-registration form — client logic; the JOIN page (server) supplies the company identity.
import { useState } from "react";

export default function RegisterForm({ tenantName, logoDataUrl }: { tenantName: string; logoDataUrl?: string | null }) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr([]);
    setDone("");
    if (password !== confirm) {
      setErr(["Passwords do not match"]);
      return;
    }
    setBusy(true);
    try {
      // CRITICAL: carry ?c=<tenantId> from the shared link into the POST —
      // the server routes the account into THAT company. Without it the
      // registration can never resolve a company.
      const res = await fetch("/api/auth/register" + (typeof window !== "undefined" ? window.location.search : ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.errors || [data.error || "Registration failed"]);
        return;
      }
      setDone(data.message || "Registration received — awaiting administrator approval.");
      setUsername(""); setFullName(""); setPassword(""); setConfirm("");
    } catch {
      setErr(["Network error — try again"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl || "/logo.jpg"} alt="Logo" className="logo-lg" />
        <h1>Staff registration</h1>
        <p>
          You are joining <b>{tenantName}</b> — your account activates after their administrator approves it.
        </p>

        {err.length > 0 && (
          <div className="alert alert-err" role="alert">
            {err.map((x, i) => (
              <div key={i}>{x}</div>
            ))}
          </div>
        )}
        {done && (
          <div className="alert alert-ok" role="status">
            {done}
          </div>
        )}

        <label className="fld">
          <span className="cap">Username</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>

        <label className="fld">
          <span className="cap">
            Full name <span className="req">*</span>
          </span>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        </label>

        <label className="fld">
          <span className="cap">Password</span>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                border: "none", background: "none", cursor: "pointer",
                fontSize: 13, color: "#1c3f6e", minHeight: 44, minWidth: 34, padding: "0 6px",
              }}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="fld">
          <span className="cap">Confirm password</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>

        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} type="submit">
          {busy ? "Sending…" : "Register"}
        </button>
        <p style={{ fontSize: 12, color: "#8a94a6", marginTop: 14, marginBottom: 0 }}>
          Already approved & have an account? <a href="/login" style={{ color: "#1c3f6e", fontWeight: 600 }}>Sign in</a>
        </p>
      </form>
    </div>
  );
}
