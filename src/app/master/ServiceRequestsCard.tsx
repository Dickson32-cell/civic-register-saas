"use client";
// ServiceRequestsCard — master console section: approve/reject every tenant's
// paid-service requests (staff seats, logo/branding).
import { useCallback, useEffect, useState } from "react";

type Srv = {
  id: string;
  tenantId: string;
  tenantName: string;
  kind: "STAFF_SEATS" | "BRANDING" | "ONBOARDING";
  seats?: number | null;
  note?: string | null;
  contactPhone?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedNote?: string | null;
  createdAt: string;
};

export default function ServiceRequestsCard() {
  const [rows, setRows] = useState<Srv[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [seatFor, setSeatFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/master/services");
    if (r.ok) setRows(((await r.json()) as { requests: Srv[] }).requests);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(row: Srv, action: "approve" | "reject") {
    setBusy(row.id); setErr("");
    try {
      const body: Record<string, unknown> = { requestId: row.id, action };
      if (action === "approve" && row.kind === "STAFF_SEATS") {
        const n = Number(seatFor[row.id] ?? row.seats ?? 0);
        body.seats = n;
      }
      const res = await fetch("/api/master/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErr(j.error || "Decision failed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <div style={{ marginTop: 26, fontSize: 13, color: "var(--muted)" }}>Loading service requests…</div>;

  const pending = rows.filter((r) => r.status === "PENDING");
  const done = rows.filter((r) => r.status !== "PENDING");

  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Service requests (approve after payment)</h2>
      <p className="sub" style={{ fontSize: 12.5 }}>
        Institutions ask for paid services here; you agree the price with them, receive payment outside the system, then approve — the service opens instantly for them.
      </p>
      {err && <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 8 }}>{err}</div>}
      {pending.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>No requests waiting.</div>
      ) : (
        pending.map((r) => (
          <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b>{r.tenantName}</b>
              <span style={{
                borderRadius: 999, fontSize: 12, padding: "2px 9px", fontWeight: 700,
                background: "var(--gold-soft)", color: "var(--navy)",
              }}>
                {r.kind === "STAFF_SEATS" ? `Staff seats: ${r.seats}` : r.kind === "ONBOARDING" ? "New workspace request" : "Logo & branding"}
              </span>
              {r.contactPhone && <span style={{ fontSize: 13 }}>📞 {r.contactPhone}</span>}
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            {r.note && <div style={{ fontSize: 13, marginTop: 4 }}>Note: {r.note}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              {r.kind === "STAFF_SEATS" && (
                <input
                  type="number"
                  placeholder={"Approve seats"}
                  value={seatFor[r.id] ?? ""}
                  onChange={(e) => setSeatFor((s) => ({ ...s, [r.id]: e.target.value }))}
                  style={{ width: 150, padding: "8px 10px", border: "1px solid var(--line-strong)", borderRadius: 8, fontSize: 14 }}
                />
              )}
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => decide(r, "approve")}>
                Approve — unlock it
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => decide(r, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))
      )}
      {done.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 13, cursor: "pointer", color: "var(--muted)" }}>Decided requests ({done.length})</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {done.slice(0, 15).map((r) => (
              <div key={r.id} style={{ fontSize: 13, color: "var(--muted)" }}>
                <b>{r.tenantName}</b> · {r.kind === "STAFF_SEATS" ? `seats ${r.seats}` : "branding"} — {r.status}
                {r.decidedNote ? ` — ${r.decidedNote}` : ""}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
