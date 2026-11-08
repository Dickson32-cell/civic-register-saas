"use client";
// SmsPanel — BULK SMS for the Adweso Zonal Council pilot. FULL admins only.
// Two fixed message types; no free composing; each record receives a type at
// most once (server-enforced). The panel is HIDDEN unless the server says the
// SMS module is configured (BULK_SMS_ENABLED=1 + ARKESEL_API_KEY present).
import { useCallback, useEffect, useState } from "react";

type TypeKey = "THANK_YOU" | "BILL_NOTICE";
type TypeInfo = {
  text: string;
  dueCount: number;
  sentCount: number;
  skips: { noPhone: number; badPhone: number };
  due: Array<{ id: string; name: string; serialNumber: string; telephone: string; electoralArea: string }>;
};

const TYPE_LABELS: Record<TypeKey, string> = {
  THANK_YOU: "Registration Thank-You",
  BILL_NOTICE: "Bill Printing & Distribution Notice",
};

export default function SmsPanel({ allowed }: { allowed: boolean }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ configured: boolean; senderId: string; areas: string[]; types: Record<string, TypeInfo> } | null>(null);
  const [area, setArea] = useState("");
  const [busyType, setBusyType] = useState<"" | TypeKey>("");
  const [result, setResult] = useState<string>("");
  const [err, setErr] = useState("");
  const [singleType, setSingleType] = useState<TypeKey>("THANK_YOU");
  const [singleRec, setSingleRec] = useState("");
  const [sq, setSq] = useState("");

  const load = useCallback(async () => {
    setErr(""); 
    const res = await fetch("/api/bulk-sms");
    if (!res.ok) { setErr(res.status === 404 ? "" : "Failed to load SMS panel"); return; }
    setInfo(await res.json());
  }, []);

  useEffect(() => { if (open && !info) load(); }, [open, info, load]);

  useEffect(() => {
    if (!open) return;
    const onOnline = () => { /* refresh counts when the connection returns */ load(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [open, load]);

  async function send(type: TypeKey, dryRun: boolean, recordId?: string) {
    setBusyType(type); setResult(""); setErr("");
    try {
      const res = await fetch("/api/bulk-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordId ? { type, dryRun, recordId } : { type, area, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Send failed"); return; }
      if (dryRun) setResult(`Preview: ${data.result.wouldSend} message(s) would go out, ${data.result.skipped} skipped.`);
      else {
        const r = data.result;
        const rem = data.remainingAfter;
        const firstErrs = (r.failed || []).slice(0, 2).map((f: { error?: string }) => String(f.error || "").replace(/^Error: provider rejected: /, "").slice(0, 90));
        const errLine = firstErrs.length ? ` Reason: ${firstErrs.join(" | ")}` : "";
        setResult(`Sent to ${r.sent.length} number(s). Failed: ${r.failed.length}. Skipped: ${r.skipped.length}.` + errLine + (rem > 0 ? ` Remaining: ${rem} — press Send again for the next batch (no duplicates possible).` : " All done for this selection."));
        load();
      }
    } catch {
      setErr("Network problem — the messages were NOT sent; nothing will double-send later because sent records are marked.");
    } finally {
      setBusyType("");
    }
  }

  if (!allowed) return null;

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen((o) => !o); }}>
        Bulk SMS
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,12,.45)", zIndex: 70, display: "grid", placeItems: "center" }} onClick={() => setOpen(false)}>
          <div style={{ background: "var(--white,#fff)", color: "var(--ink,#111827)", border: "1px solid var(--line,#e5e7eb)", borderRadius: 14, padding: 18, width: "min(560px, 94vw)", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,.28)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px" }}>Bulk SMS — Adweso Zonal Council</h2>
            {err && <div className="err">{err}</div>}
            <p className="sub">Only FULL administrators send SMS. Two fixed messages; each record receives a message type at most once. Sender ID: <b>{info?.senderId || "—"}</b>.</p>
            {result && <div className="ok-msg" style={{ marginTop: 8 }}>{result}</div>}
            {info && !info.configured && (
              <div className="err" style={{ marginTop: 10 }}>
                SMS is not configured yet — the owner must set the provider key on the server first.
              </div>
            )}
            {info && (
              <>
                <label className="fld" style={{ margin: "10px 0" }}>
                  <span className="cap">Send by electoral area — or All areas</span>
                  <select value={area} onChange={(e) => setArea(e.target.value)}>
                    <option value="">All areas</option>
                    {(info.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label style={{ display: "block", margin: "10px 0", fontSize: 12.5, color: "var(--muted,#6b7280)" }}>
                  Each message goes out with that person's own name and serial filled in.
                </label>
                {(["THANK_YOU", "BILL_NOTICE"] as TypeKey[]).map((t) => {
                  const d = info.types[t];
                  return (
                    <div key={t} style={{ border: "1px solid var(--line,#e5e7eb)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{TYPE_LABELS[t]}</div>
                      <div style={{ fontSize: 13, color: "var(--muted,#6b7280)", whiteSpace: "pre-wrap", background: "var(--paper,#f4f8f5)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                        {d ? d.text : "…"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted,#6b7280)", marginBottom: 8 }}>
                        {d ? (
                          <>Due: <b>{d.dueCount}</b> · Sent before: <b>{d.sentCount}</b> · No phone: <b>{d.skips.noPhone}</b> · Unusable number: <b>{d.skips.badPhone}</b></>
                        ) : "…"}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busyType === t || !info.configured} onClick={() => send(t, true)}>Preview count</button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyType === t || !info.configured || (d ? d.dueCount === 0 : true)} onClick={() => send(t, false)}>
                          {busyType === t ? "Sending…" : `Send to ${d ? d.dueCount : 0}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const d = info.types[singleType];
                  const matches = (d ? d.due : []).filter((r) => {
                    const q = sq.trim().toLowerCase();
                    return !q || (r.serialNumber || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q);
                  }).slice(0, 40);
                  return (
                    <div style={{ border: "1px solid var(--line,#e5e7eb)", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>Single SMS (one person)</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        {(["THANK_YOU", "BILL_NOTICE"] as TypeKey[]).map((t) => (
                          <button key={t} type="button" className={singleType === t ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                            onClick={() => { setSingleType(t); setSingleRec(""); }}>{TYPE_LABELS[t]}</button>
                        ))}
                      </div>
                      <label className="fld" style={{ marginBottom: 8 }}>
                        <span className="cap">Search by name or serial</span>
                        <input type="text" value={sq} onChange={(e) => { setSq(e.target.value); setSingleRec(""); }} placeholder="e.g. Kwesi or ADA/ 45" />
                      </label>
                      {sq.trim() !== "" && (
                        <select aria-label="Pick the record" value={singleRec} onChange={(e) => setSingleRec(e.target.value)} style={{ marginBottom: 8 }}>
                          <option value="">— pick from {matches.length} match(es) —</option>
                          {matches.map((r) => (
                            <option key={r.id} value={r.id}>{r.name} — {r.serialNumber} ({r.electoralArea})</option>
                          ))}
                        </select>
                      )}
                      {singleRec && (() => {
                        const picked = (d ? d.due : []).find((r) => r.id === singleRec);
                        return picked ? (
                          <p className="sub" style={{ margin: "0 0 8px" }}>
                            To: <b>{picked.name}</b> · {picked.telephone || "(no phone on record)"} — the fixed {TYPE_LABELS[singleType].toLowerCase()} with {picked.serialNumber} filled in.
                          </p>
                        ) : null;
                      })()}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyType === singleType || !info.configured || !singleRec || !sq.trim()}
                          onClick={() => send(singleType, false, singleRec)}>
                          {busyType === singleType ? "Sending…" : "Send to this one"}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted,#6b7280)", marginTop: 8 }}>
                        The once-per-record rule holds here too: a person who already received this type cannot get it again.
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}