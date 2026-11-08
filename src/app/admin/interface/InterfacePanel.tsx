"use client";
// InterfacePanel — customize this workspace's interface.
// FREE: institution name + interface colour (applies instantly to you).
// PAID (brand service): logo upload + bill designer (bill heading/footer).
import { useCallback, useEffect, useState } from "react";

type Props = {
  name: string;
  colour: string;
  logoDataUrl: string | null;
  brandingUnlocked: boolean;
  billHeading: string;
  billFooter: string;
};

const COLOURS = ["#1c3f6e", "#3e7bfa", "#7d3cf5", "#0a6e43", "#b0322a", "#b88721"];

export default function InterfacePanel(p: Props) {
  const [name, setName] = useState(p.name);
  const [colour, setColour] = useState(p.colour);
  const [logo, setLogo] = useState<string>(p.logoDataUrl ?? "");
  const [billHeading, setBillHeading] = useState(p.billHeading);
  const [billFooter, setBillFooter] = useState(p.billFooter);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = useCallback(async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/tenant/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErr(j.error || "Could not save");
      else setMsg(okMsg);
    } finally {
      setBusy(false);
    }
  }, []);

  function fileToDataUrl(file: File | null | undefined) {
    if (!file) return;
    if (file.size > 250_000) { setErr("Logo file is over 250KB — compress it first (PNG/JPG)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      setLogo(data);
      save({ logoDataUrl: data }, "Logo saved — it now shows in the top bar, on the sign-in page and on your bills.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Your interface</h2>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Name and colour are free. Your logo and the bill designer open with the brand service
          ({msg ? "" : "request under Services if locked"}).
        </div>
      </div>

      {msg && <div style={{ margin: "0 0 10px", padding: "10px 14px", background: "var(--blue-soft)", color: "var(--navy)", borderRadius: 8, fontSize: 14 }}>{msg}</div>}
      {err && <div style={{ margin: "0 0 10px", padding: "10px 14px", background: "rgba(179,38,30,0.08)", color: "#b3261e", borderRadius: 8, fontSize: 14 }}>{err}</div>}

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Free — applies to your workspace now</h2>
        <label className="fld" style={{ display: "block", marginBottom: 12 }}>
          <span className="cap">Institution name as shown in your workspace</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
        </label>
        <div className="fld" style={{ marginBottom: 12 }}>
          <span className="cap">Interface colour</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLOURS.map((c) => (
              <button key={c} type="button" aria-label={`colour ${c}`} onClick={() => setColour(c)}
                style={{ width: 34, height: 34, borderRadius: 8, background: c, border: colour === c ? "3px solid #111" : "1px solid var(--line)", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save({ name, colour }, "Saved.")}>
          Save name &amp; colour
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Your logo</h2>
          <span style={{
            borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700,
            background: p.brandingUnlocked ? "var(--green-soft)" : "var(--gold-soft)",
            color: p.brandingUnlocked ? "var(--green)" : "var(--navy)",
          }}>{p.brandingUnlocked ? "Unlocked" : "Paid service"}</span>
        </div>
        {p.brandingUnlocked ? (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo || "/logo.jpg"} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", background: "#fff" }} />
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => fileToDataUrl(e.target.files?.[0])} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Shown in your top bar, on the sign-in page and on every bill you print. PNG/JPG up to ~250KB.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13.5, marginBottom: 10 }}>
              Show your own logo everywhere — top bar, sign-in page and bills. Attach your logo at
              {" "}<a href="/admin/services" style={{ color: "var(--blue)", fontWeight: 600 }}>Services</a> or request the unlock; after the administrator approves, upload it here.
            </div>
            <a className="btn btn-ghost btn-sm" href="/admin/services">Go to Services</a>
          </>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Bill designer</h2>
          <span style={{
            borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700,
            background: p.brandingUnlocked ? "var(--green-soft)" : "var(--gold-soft)",
            color: p.brandingUnlocked ? "var(--green)" : "var(--navy)",
          }}>{p.brandingUnlocked ? "Unlocked" : "Paid service"}</span>
        </div>
        {p.brandingUnlocked ? (
          <>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap">Heading line on your bills (optional — blank uses your institution name)</span>
              <input value={billHeading} onChange={(e) => setBillHeading(e.target.value)} maxLength={120}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 12 }}>
              <span className="cap">Footer note on your bills (optional)</span>
              <input value={billFooter} onChange={(e) => setBillFooter(e.target.value)} maxLength={200}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy}
              onClick={() => save({ billHeading, billFooter }, "Bill design saved — your next printed bills use it.")}>
              Save bill design
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13.5 }}>
            Edit the text and logo on your bills — the heading line and footer note. Opens with the brand service
            ({" "}<a href="/admin/services" style={{ color: "var(--blue)", fontWeight: 600 }}>Services</a>).
          </div>
        )}
      </div>
    </div>
  );
}
