"use client";
// ServicesPanel — the institution's Services screen:
// free plan facts, request buttons for paid services, request history.
import { useCallback, useEffect, useState } from "react";

type Req = {
  id: string;
  kind: "STAFF_SEATS" | "BRANDING";
  seats?: number | null;
  note?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedNote?: string | null;
  createdAt: string;
  decidedAt?: string | null;
};

type Data = {
  plan: { freeStaffSeats: number; activeStaff: number; brandingUnlocked: boolean; hasLogo: boolean };
  requests: Req[];
};

export default function ServicesPanel({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/services");
    if (r.ok) setData((await r.json()) as Data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function request(kind: "STAFF_SEATS" | "BRANDING") {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/tenant/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "STAFF_SEATS" ? { kind, seats: Number(seats), contactPhone: phone } : { kind }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) setErr(j.error || "Could not send request");
      else {
        setMsg(j.message || "Request sent.");
        setSeats("");
        setPhone("");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="card" style={{ padding: 16 }}>Loading services…</div>;

  const { plan, requests } = data;

  return (
    <div>
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Adding staff?</h2>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Send each new staff member this sign-up link (e.g. on WhatsApp) — their account waits
            for your approval under <a href="/admin/approvals" style={{ color: "var(--blue)", fontWeight: 600 }}>Approvals</a>:
          </div>
          <code style={{ display: "inline-block", marginTop: 6, fontSize: 13, background: "var(--blue-soft)", padding: "6px 10px", borderRadius: 6 }}>
            {typeof window !== "undefined" ? `${window.location.origin}/register?c=${encodeURIComponent(tenantId)}` : `/register?c=${encodeURIComponent(tenantId)}`}
          </code>
        </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Services</h2>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Data collection is free. Paid services are unlocked by the platform administrator after payment.
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap", fontSize: 14 }}>
          <span>Staff accounts: <b>{plan.activeStaff} of {plan.freeStaffSeats}</b> (free seats)</span>
          <span>Custom logo: <b>{plan.brandingUnlocked ? "unlocked" : "locked"}</b>{plan.hasLogo ? " (logo in use)" : ""}</span>
        </div>
      </div>

      {msg && <div style={{ margin: "0 0 10px", padding: "10px 14px", background: "var(--blue-soft)", color: "var(--navy)", borderRadius: 8, fontSize: 14 }}>{msg}</div>}
      {err && <div style={{ margin: "0 0 10px", padding: "10px 14px", background: "rgba(179,38,30,0.08)", color: "#b3261e", borderRadius: 8, fontSize: 14 }}>{err}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>More staff accounts</h2>
            <span style={{ background: "var(--gold-soft)", color: "var(--navy)", borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700 }}>Paid</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            Your free plan holds {plan.freeStaffSeats} staff. Ask for more seats — we agree the price, you pay, the platform administrator approves, one approval message later.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min={3}
              max={200}
              placeholder="How many staff seats do you need?"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              style={{ flex: "1 1 240px", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }}
            />
            <input
              type="tel"
              placeholder="Phone for the payment contact"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: "1 1 220px", padding: "10px 12px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 15 }}
            />
            <button className="btn btn-primary" disabled={busy || !seats || Number(seats) <= plan.freeStaffSeats} onClick={() => request("STAFF_SEATS")}>
              Request seats
            </button>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Your logo &amp; branding</h2>
            <span style={{ background: "var(--gold-soft)", color: "var(--navy)", borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700 }}>Paid</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {plan.brandingUnlocked
              ? "Unlocked — upload your logo from the workspace settings; it shows in the top bar and on the sign-in page."
              : "Show your own logo on the sign-in page and top bar. Request the unlock, pay, and it opens."}
          </div>
          {!plan.brandingUnlocked && (
            <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={() => request("BRANDING")}>
              Request logo &amp; branding
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>My requests</h2>
        {requests.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--muted)" }}>No requests yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {requests.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b>{r.kind === "STAFF_SEATS" ? `Staff seats: ${r.seats}` : "Logo & branding"}</b>
                  <span style={{
                    borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700,
                    background: r.status === "PENDING" ? "var(--gold-soft)" : r.status === "APPROVED" ? "var(--green-soft)" : "rgba(179,38,30,0.08)",
                    color: r.status === "PENDING" ? "var(--navy)" : r.status === "APPROVED" ? "var(--green)" : "#b3261e",
                  }}>{r.status}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {new Date(r.createdAt).toLocaleString()}{r.decidedAt ? ` → decided ${new Date(r.decidedAt).toLocaleString()}` : ""}
                  </span>
                </div>
                {r.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Your note: {r.note}</div>}
                {r.decidedNote && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Platform note: {r.decidedNote}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
