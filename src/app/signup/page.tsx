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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [logo, setLogo] = useState<string>("");
  const [colour, setColour] = useState<string>("");

  const COLOURS = ["#1c3f6e", "#3e7bfa", "#7d3cf5", "#0a6e43", "#b0322a", "#b88721"];

  const SU_STYLE = `
.su-card { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
.su-card h1 { font-size: 17px; font-weight: 800; letter-spacing: 0.2px; }
.su-card .su-sub { font-size: 12.5px; color: #5b6b7a; margin: 3px 0 0; line-height: 1.45; }
.su-card label.su-fld { display: block; margin-bottom: 12px; }
.su-card .su-cap { display: block; font-size: 12.5px; font-weight: 700; color: #33414e; margin-bottom: 6px; letter-spacing: 0.2px; }
.su-card .su-in {
  width: 100%; padding: 12px 14px; min-height: 48px; font-size: 16px;
  border: 1.5px solid #c7d0da; border-radius: 10px; background: #fff; color: #22303c;
  outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
  -webkit-appearance: none; appearance: none;
}
.su-card .su-in:focus { border-color: #1c3f6e; box-shadow: 0 0 0 3px rgba(28,63,110,0.15); }
.su-card .su-in::placeholder { color: #9aa7b3; }
.su-btn {
  width: 100%; min-height: 50px; border: none; border-radius: 10px; cursor: pointer;
  background: #1c3f6e; color: #fff; font-size: 16px; font-weight: 700; letter-spacing: 0.2px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 1px 3px rgba(12,30,60,0.35); transition: background 0.15s ease, transform 0.05s ease;
}
.su-btn:active { transform: translateY(1px); background: #254f87; }
.su-btn:disabled { opacity: 0.6; cursor: default; }
.su-banner-blue { padding: 12px 14px; background: #eaf1fb; border: 1px solid #c7d8f0; color: #1c3f6e; border-radius: 10px; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
.su-banner-red { padding: 12px 14px; background: #fdecec; border: 1px solid #f2c4c4; color: #a12626; border-radius: 10px; font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
.su-note { font-size: 11px; color: #5b6b7a; margin-top: 12px; text-align: center; line-height: 1.5; }
`;

  function fileToDataUrl(file: File | null | undefined) {
    if (!file) { setLogo(""); return; }
    // Phone photos arrive as 2-6MB — downscale to max 512px before attaching
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 512 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); setLogo(""); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setLogo(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setErr("That logo file could not be read — try a PNG or JPG image."); };
    img.src = url;
  }

  // Workspace signup — account is created instantly with the company's own
  // password; the response signs the administrator in right away.
  function showErrors(j: { errors?: string[]; error?: string }) {
    setErr(j.errors ? j.errors.join(" · ") : (j.error || "Could not create the workspace — try again."));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await fetch("/api/workspace/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org, contact, phone, areas, colour, logoDataUrl: logo, username, password, password2 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { showErrors(j); return; }
      // Signed in already (cookie set by the response) — straight to the workspace
      setDone(true);
      setMsg(j.message || "Workspace ready.");
      setTimeout(() => { window.location.href = "/"; }, 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f2f6fb", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{SU_STYLE}</style>
      <form className="card su-card" onSubmit={submit} style={{ width: "100%", maxWidth: 520, padding: "22px 22px 26px", borderRadius: 14, boxShadow: "0 6px 24px rgba(12,30,60,0.10)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CivicData" style={{ width: 46, height: 46, borderRadius: 10 }} />
          <div>
            <h1 style={{ margin: 0 }}>Create your workspace</h1>
            <p className="su-sub">
              Your company gets its own private workspace now — you choose the username and password. Nobody else sees your data, ever.
            </p>
          </div>
        </div>

        {done ? (
          <>
            <div className="su-banner-blue">
              {msg} Taking you to your workspace…
            </div>
          </>
        ) : (
          <>
            <label className="su-fld">
              <span className="su-cap">Institution / company name</span>
              <input className="su-in" value={org} onChange={(e) => setOrg(e.target.value)} required minLength={3} maxLength={120} placeholder="e.g. New Hope Chapel, Koforidua" />
            </label>
            <label className="su-fld">
              <span className="su-cap">Your name (the administrator)</span>
              <input className="su-in" value={contact} onChange={(e) => setContact(e.target.value)} required minLength={3} maxLength={120} placeholder="Who we will contact" />
            </label>
            <label className="su-fld">
              <span className="su-cap">Phone number</span>
              <input className="su-in" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="e.g. 024 000 0000" />
            </label>
            <label className="su-fld">
              <span className="su-cap">Areas / branches you record (optional)</span>
              <input className="su-in" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="e.g. Central, Riverside, East" />
            </label>

            <div style={{ borderTop: "1px solid #e3e9f0", margin: "16px 0 14px" }} />
            <div className="su-cap" style={{ fontSize: 14, fontWeight: 800, color: "#1c3f6e", marginBottom: 10 }}>Your secure sign-in</div>
            <label className="su-fld">
              <span className="su-cap">Choose a username</span>
              <input className="su-in" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} autoComplete="username" placeholder="Used every time you sign in" />
            </label>
            <label className="su-fld">
              <span className="su-cap">Create a password (8+ characters)</span>
              <input className="su-in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Only you should know it" />
            </label>
            <label className="su-fld">
              <span className="su-cap">Repeat the password</span>
              <input className="su-in" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Same password again" />
            </label>

            <div className="su-cap" style={{ margin: "2px 0 8px", fontSize: 12.5, fontWeight: 700 }}>Make it yours</div>
            <div style={{ marginBottom: 14 }}>
              <div className="su-cap">Interface colour</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLOURS.map((c) => (
                  <button key={c} type="button" onClick={() => setColour(c)} aria-label={`colour ${c}`}
                    style={{ width: 38, height: 38, minHeight: 38, borderRadius: 10, background: c, border: colour === c ? "3px solid #1c3f6e" : "1.5px solid #c7d0da", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <label className="su-fld">
              <span className="su-cap">Your logo (optional part of the paid brand service)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="su-in"
                style={{ minHeight: 44, fontSize: 13.5, backgroundImage: "none", padding: 9, color: "#33414e" }}
                onChange={(e) => fileToDataUrl(e.target.files?.[0])} />
            </label>

            {err && <div className="su-banner-red">{err}</div>}
            <button type="submit" className="su-btn" disabled={busy}>
              {busy ? "Creating your workspace…" : "Create my workspace"}
            </button>
            <div className="su-note">
              Data collection is free forever, your account opens immediately, and no other company can ever see your records.
            </div>
          </>
        )}
      </form>
    </div>
  );
}
