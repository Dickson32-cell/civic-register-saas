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
  currentBillTitle: string;
  currentBillLegal1: string;
  currentBillLegal2: string;
  currentBillStamp: string;
};

const COLOURS = ["#1c3f6e", "#3e7bfa", "#7d3cf5", "#0a6e43", "#b0322a", "#b88721"];

export default function InterfacePanel(p: Props) {
  const [name, setName] = useState(p.name);
  const [colour, setColour] = useState(p.colour);
  const [logo, setLogo] = useState<string>(p.logoDataUrl ?? "");
  const [billHeading, setBillHeading] = useState(p.billHeading);
  const [billFooter, setBillFooter] = useState(p.billFooter);
  const [billTitle, setBillTitle] = useState(p.currentBillTitle);
  const [billLegal1, setBillLegal1] = useState(p.currentBillLegal1);
  const [billLegal2, setBillLegal2] = useState(p.currentBillLegal2);
  const [billStamp, setBillStamp] = useState(p.currentBillStamp);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);


  // Areas — typed and managed by the institution's administrators
  const [areaList, setAreaList] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [areaMsg, setAreaMsg] = useState("");

  const loadAreas = useCallback(async () => {
    const r = await fetch("/api/tenant/areas");
    const j = (await r.json().catch(() => ({}))) as { areas?: { area: string }[] };
    setAreaList((j.areas || []).map((a) => a.area));
  }, []);
  useEffect(() => { void loadAreas(); }, [loadAreas]);

  async function addArea() {
    const a = newArea.trim();
    if (!a) return;
    setErr(""); setAreaMsg("");
    const r = await fetch("/api/tenant/areas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: a }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; areas?: { area: string }[] };
    if (!r.ok) { setErr(j.error || "Could not add the area"); return; }
    setAreaList((j.areas || []).map((x) => x.area));
    setNewArea("");
    setAreaMsg(a + " added - it now appears in the registration form.");
    setTimeout(() => setAreaMsg(""), 3500);
  }

  async function removeArea(a: string) {
    setErr(""); setAreaMsg("");
    const r = await fetch("/api/tenant/areas", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: a }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; areas?: { area: string }[] };
    if (!r.ok) { setErr(j.error || "Could not remove the area"); return; }
    setAreaList((j.areas || []).map((x) => x.area));
    setAreaMsg(a + " removed.");
    setTimeout(() => setAreaMsg(""), 3500);
  }

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
        <h2 style={{ margin: "0 0 4px" }}>Areas / branches</h2>
        <div style={{ fontSize: 12.5, color: "#5b6b7a", marginBottom: 10 }}>
          Type the areas, branches or zones your team records here. They appear in the registration form and get their own serial codes (e.g. RIV/ 01).
        </div>
        {areaList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {areaList.map((a) => (
              <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#eef3fb", border: "1px solid #c7d8f0", color: "#1c3f6e", borderRadius: 999, padding: "5px 10px", fontSize: 13 }}>
                {a}
                <button type="button" aria-label={"Remove " + a} onClick={() => void removeArea(a)} style={{ border: "none", background: "transparent", color: "#b0322a", fontWeight: 800, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>x</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newArea} onChange={(e) => setNewArea(e.target.value)}
            placeholder="e.g. Riverside" style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #c7d0da", borderRadius: 10, fontSize: 15, minHeight: 44 }} />
          <button type="button" onClick={() => void addArea()} style={{ border: "none", background: "#1c3f6e", color: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", minHeight: 44 }}>Add</button>
        </div>
        {areaMsg && <div style={{ fontSize: 12.5, color: "#1c6e43", marginTop: 8 }}>{areaMsg}</div>}
      </div><div className="card" style={{ marginBottom: 12 }}>
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
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap">Title line (default: TEMPORAL STRUCTURES BILL — write your own, e.g. MEMBERSHIP DUES)</span>
              <input value={billTitle} onChange={(e) => setBillTitle(e.target.value)} maxLength={60}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap">Footer note on your bills (optional)</span>
              <input value={billFooter} onChange={(e) => setBillFooter(e.target.value)} maxLength={200}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap">Legal note 1 — what this bill is for (default keeps the council wording)</span>
              <textarea value={billLegal1} onChange={(e) => setBillLegal1(e.target.value)} maxLength={700} rows={4}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 10 }}>
              <span className="cap">Legal note 2 — payment instructions (default keeps the council wording)</span>
              <textarea value={billLegal2} onChange={(e) => setBillLegal2(e.target.value)} maxLength={700} rows={4}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 14 }} />
            </label>
            <label className="fld" style={{ display: "block", marginBottom: 12 }}>
              <span className="cap">Stamp caption (default: ZONAL COUNCIL STAMP — e.g. OFFICIAL STAMP)</span>
              <input value={billStamp} onChange={(e) => setBillStamp(e.target.value)} maxLength={40}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }} />
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy}
              onClick={() => save({ billHeading, billFooter, billTitle, billLegal1, billLegal2, billStamp }, "Bill design saved — your next printed bills use it.")}>
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
