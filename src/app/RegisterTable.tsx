"use client";
// RegisterTable — the register: filters, Dickson's exact column order,
// per-area summary, GRAND TOTAL row, New Record form, payment modal.
import { useCallback, useEffect, useState, useRef } from "react";
import { listPending, putPending, deletePending, markPendingError, type PendingRecord } from "@/lib/pendingRecords";

import { BASIC_RATE_2027, bopFee2027, structureFee2027 } from "@/lib/frrRates";
const BIZ_TYPES = ["Retail Shop", "Provision Store", "Table-Top / Open-Stall Trader", "Food Joint / Chop Bar", "Bar / Pub / Spot", "Mobile Food & Drinks", "Tailoring & Fashion", "Hairdressing & Barbering", "Phone / Electronics Repair", "Mobile Money / Banking Agent", "Pharmacy / Chemist", "Metal Works / Welding", "Carpentry / Wood Works", "Auto Repairs / Fitting", "Fabric / Textiles", "Agro Inputs / Farm Produce", "Other"];
const CONTAINER_TYPES = ["Small", "Medium", "Large", "Double Container", "Wooden"];
const CATS_ABC = ["CAT A", "CAT B", "CAT C"];
const CATS_WOOD = ["Small", "Medium", "Large"];
const CATS_FOR = (t2: string) => (t2 === "Wooden" ? CATS_WOOD : CATS_ABC);
const ctrTxt = (size?: string | null, cat?: string | null) => size ? (cat ? size + " — " + cat : size) : "—"; // CONTAINER-CATS
const CONTAINER_SIZES = ["Small", "Medium", "Large"];
const AREAS = [
  "Adweso Estate",
  "Adweso Town",
  "Two Streams",
  "Nyerede North",
  "Nyerede South",
  "Osabene Mile 50",
];

const GHS = (n: number) =>
  "GH₵ " + (Number.isFinite(n) ? n : 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Row = {
  id: string; serialNumber: string; name: string; businessName: string;
  telephone: string; electoralArea: string; streetName: string;
  businessType: string | null;
  containerSize: string | null;
  containerCategory: string | null;
  bopFee: number | null;
  latitude: number | null; longitude: number | null; hasGps: boolean;
  mapsUrl: string | null;
  fee: number; total: number; paid: number; balance: number; status: string;
  createdByUsername?: string | null;
};
type Grand = { records: number; billed: number; collected: number; outstanding: number };
type AreaSum = { count: number; billed: number; collected: number; outstanding: number };

export default function RegisterTable({
  isAdmin = false,
  moneyVisible = false,
  canDelete = true,
  canEditDirect = true,
  canCreate = true,
  canPay = true,
  smsSendable = false,
  currentUsername = "",
}: {
  isAdmin?: boolean;
  moneyVisible?: boolean;
  canDelete?: boolean;
  canEditDirect?: boolean;
  canCreate?: boolean;
  canPay?: boolean;
  smsSendable?: boolean;
  currentUsername?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [byArea, setByArea] = useState<Record<string, AreaSum>>({});
  const [grand, setGrand] = useState<Grand>({ records: 0, billed: 0, collected: 0, outstanding: 0 });
  // Register list collapsed by default — click to show, searching re-opens it.
  const [listOpen, setListOpen] = useState(false);
  const toggleList = () => setListOpen((v) => !v);
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { if (q && !listOpen) setListOpen(true); }, [q, listOpen]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // New-record form state
  const [showForm, setShowForm] = useState(false);
  const [serialPreview, setSerialPreview] = useState("");
  const [form, setForm] = useState({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "", businessType: "", otherType: "", containerSize: "", containerCategory: "" });
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [formErr, setFormErr] = useState<string[]>([]);
  const [formOk, setFormOk] = useState("");
  const [busy, setBusy] = useState(false);

  // Pick GPS location — uses the phone/browser geolocation while standing
  // at the structure. Requires HTTPS (Vercel) or localhost; user permission
  // is requested by the browser on first use.
  function pickGps() {
    setGpsErr("");
    if (!("geolocation" in navigator)) {
      setGpsErr("This device does not support GPS");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: Number(pos.coords.latitude.toFixed(7)), lng: Number(pos.coords.longitude.toFixed(7)) });
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setGpsErr(
          err.code === 1
            ? "GPS permission denied — allow location access in your browser"
            : err.code === 3
              ? "GPS timed out — step outside and try again"
              : "GPS unavailable right now — try again"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Edit-side GPS pick — fills the EDIT form's latitude/longitude (a record
  // whose GPS was skipped at creation can be located later).
  function pickGpsEdit() {
    setGpsErr("");
    if (!("geolocation" in navigator)) {
      setGpsErr("This device does not support GPS");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditForm((f) => ({ ...f, latitude: Number(pos.coords.latitude.toFixed(7)).toString(), longitude: Number(pos.coords.longitude.toFixed(7)).toString() }));
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setGpsErr(
          err.code === 1
            ? "GPS permission denied — allow location access in your browser"
            : err.code === 3
              ? "GPS timed out — step outside and try again"
              : "GPS unavailable right now — try again"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Payment modal state
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSel((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const printSelected = () => { if (sel.size) window.open(`/bill/print?ids=${[...sel].join(",")}`, "_blank"); };
  const printAllFiltered = () => { if (rows.length) window.open(`/bill/print?ids=${rows.map((r) => r.id).join(",")}`, "_blank"); };

  // OWNERSHIP: staff can only act on records they created themselves.
  // Admins can act on everything. A record with no creator is admin-only.
  const isOwner = (r: Row) =>
    isAdmin || (!!r.createdByUsername && r.createdByUsername === currentUsername);
  const canTouch = (r: Row) => isOwner(r);
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState("");

  // Record detail view (staff + admin can both open)
  type Detail = {
    record: {
      serialNumber: string; name: string; businessName: string; telephone: string;
      electoralArea: string; streetName: string; businessType: string | null;
      containerSize: string | null; containerCategory: string | null; bopFee: number | null; recordStatus: string; fee: number;
      latitude: number | null; longitude: number | null;
      createdAt: string;
      fees: { amount: number; createdAt: string }[];
      payments: { amount: number; kind: string; createdAt: string; recordedBy?: { username?: string } | null }[];
    };
    totals: { totalBilled: number; totalPaid: number; balance: number };
  };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const [detailRow, setDetailRow] = useState<Row | null>(null);

  async function openDetail(r: Row) {
    setDetailRow(r);
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/records/${r.id}/detail`);
      if (res.ok) setDetail(await res.json());
      else setDetail(null);
    } finally {
      setDetailBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const res = await fetch(`/api/records/list?${p}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.records);
      setByArea(data.byArea);
      setGrand(data.grand);
    }
    setLoading(false);
  }, [area, q, status]);

  useEffect(() => { load(); }, [load]);

  // MAP FOCUS: the map page hands over a serial via sessionStorage when the
  // teller presses "Open record" on a pin; once rows land, open that detail.
  useEffect(() => {
    const s = window.sessionStorage.getItem("mapFocusSerial");
    if (!s || rows.length === 0) return;
    const r = rows.find((x) => x.serialNumber === s);
    if (r) {
      window.sessionStorage.removeItem("mapFocusSerial");
      void openDetail(r);
    }
  }, [rows]);

  // AUTO-REFRESH: re-fetch the register every 30 seconds so staff see each
  // other's new records and payments without pressing anything. The
  // interval is cleared when the tab is hidden and resumes when visible
  // again (no wasted data, no battery drain on phones in pockets).
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  // Live serial preview when the Electoral Area is picked
  async function onAreaPick(a: string) {
    setForm((f) => ({ ...f, electoralArea: a }));
    setFormErr([]);
    if (!a) { setSerialPreview(""); return; }
    const res = await fetch(`/api/serial-preview?area=${encodeURIComponent(a)}`);
    if (res.ok) {
      const d = await res.json();
      setSerialPreview(d.serial);
    }
  }

  const [pendingCount, setPendingCount] = useState(0);
  const [pendingListOpen, setPendingListOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingRecord[]>([]);
  const [pendingSyncing, setPendingSyncing] = useState(false);
  const pendingSyncingRef = useRef(false);
  // Adweso SMS pilot: one-tap send at registration time (FULL admins only)
  const [lastCreated, setLastCreated] = useState<{ id: string; name: string; serialNumber: string } | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsNote, setSmsNote] = useState("");

  async function sendOneSms(type: "THANK_YOU" | "BILL_NOTICE", rec: { id: string }) {
    if (smsBusy) return;
    setSmsBusy(true); setSmsNote("");
    try {
      const res = await fetch("/api/bulk-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recordId: rec.id }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (res.ok) setSmsNote(type === "THANK_YOU" ? "Thank-you message sent (2 credits)." : "Bill notice sent (2 credits).");
      else if (res.status === 409) setSmsNote("This record already received that message — nothing was double-sent.");
      else setSmsNote(data.error || `Could not send (${res.status}).`);
    } catch {
      setSmsNote("Network problem — nothing went out; try again.");
    } finally { setSmsBusy(false); }
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setFormErr([]); setFormOk(""); setBusy(true);
    const payload = {
      ...form,
      businessType: form.otherType.trim() || form.businessType,
      ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
    };
    const resetForm = () => {
      setForm({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "", businessType: "", otherType: "", containerSize: "", containerCategory: "" });
      setSerialPreview("");
      setGps(null);
    };
    let res: Response | null = null;
    try {
      res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { res = null; }
    if (res === null) {
      // No network — keep the entry on this phone; it uploads on its own.
      const pendingId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `pend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await putPending({ pendingId, payload, createdAt: new Date().toISOString(), note: "" });
      const n = (await listPending()).length;
      setPendingCount(n); setBusy(false); resetForm();
      setFormOk(`Saved on phone — ${n} pending. It uploads by itself once the network returns (serial assigned then).`);
      void syncPending();
      return;
    }
    if (res.status === 402) {
      // Register locked (license) — the entry waits on this phone until the key is applied.
      const pendingId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `pend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await putPending({ pendingId, payload, createdAt: new Date().toISOString(), note: "Waiting for the unlock key (register is locked)" });
      const n = (await listPending()).length;
      setPendingCount(n); setBusy(false); resetForm();
      setFormErr(["Register is locked — your entry is saved on this phone and will upload automatically after the unlock key is entered."]);
      return;
    }
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setFormErr(data.errors || [data.error]); return; }
    setFormOk(`Saved — ${data.record.serialNumber} (${data.record.name})` + (gps ? " with GPS location" : ""));
    if (smsSendable) setLastCreated({ id: data.record.id, name: data.record.name, serialNumber: data.record.serialNumber });
    resetForm();
    load();
    void syncPending();
  }

  async function syncPending() {
    if (pendingSyncingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    pendingSyncingRef.current = true; setPendingSyncing(true);
    let uploaded = 0;
    try {
      const items = await listPending();
      for (const it of items) {
        let res: Response | null = null;
        try {
          res = await fetch("/api/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...it.payload, pendingId: it.pendingId }),
          });
        } catch { res = null; }
        if (res === null) break;          // still offline — resume on the next trigger
        if (res.status === 402) break;    // register locked — waits for the unlock key
        const data = await res.json().catch(() => ({}) as { errors?: string[]; error?: string });
        if (res.ok) { await deletePending(it.pendingId); uploaded += 1; continue; }
        if (res.status >= 400 && res.status < 500) {
          const why = (data.errors && data.errors.join("; ")) || data.error || `Rejected (${res.status})`;
          await markPendingError(it.pendingId, why);
        } else {
          await markPendingError(it.pendingId, "Server hiccup — will retry automatically");
        }
      }
    } finally {
      pendingSyncingRef.current = false;
      const x = await listPending();
      setPendingCount(x.length); setPendingItems(x); setPendingSyncing(false);
      if (uploaded > 0) load();
    }
  }

  useEffect(() => {
    listPending().then((x) => { setPendingCount(x.length); setPendingItems(x); });
    const onOnline = () => { void syncPending(); };
    window.addEventListener("online", onOnline);
    const onVis = () => { if (document.visibilityState === "visible") void syncPending(); };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => { void syncPending(); }, 60000);
    return () => { window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVis); window.clearInterval(iv); };
  }, []);

  async function markPaid(row: Row) {
    if (!confirm(`Mark ${row.name} (${row.serialNumber}) as PAID?\nBalance GH₵ ${row.balance.toFixed(2)} will be recorded as fully settled.`)) return;
    const res = await fetch(`/api/records/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) load();
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payFor) return;
    setPayErr("");
    const res = await fetch(`/api/records/${payFor.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmt) }),
    });
    const data = await res.json();
    if (!res.ok) { setPayErr((data.errors && data.errors[0]) || data.error || "Failed"); return; }
    setPayFor(null); setPayAmt("");
    load();
  }

  // Edit modal state
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: "", businessName: "", telephone: "", streetName: "", electoralArea: "", latitude: "", longitude: "", businessType: "", otherType: "", containerSize: "", containerCategory: "", bopFee: "", fee: "" });
  const [editErr, setEditErr] = useState<string[]>([]);
  const [editMsg, setEditMsg] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  function openEdit(row: Row) {
    setEditFor(row);
    setEditForm({
      name: row.name, businessName: row.businessName, telephone: row.telephone,
      streetName: row.streetName, electoralArea: row.electoralArea,
      latitude: row.latitude != null ? String(row.latitude) : "",
      businessType: row.businessType || "",
      containerSize: row.containerSize || "",
    containerCategory: row.containerCategory || "",
      bopFee: row.bopFee != null ? String(row.bopFee) : String(bopFee2027(row.businessType || "") ?? ""),
      fee: row.fee != null ? String(row.fee) : "",
      longitude: row.longitude != null ? String(row.longitude) : "",
          otherType: "",
    });
    setEditErr([]); setEditMsg("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFor) return;
    setEditErr([]); setEditMsg(""); setEditBusy(true);

    if (canEditDirect) {
      // Admin (FULL/EDITOR) edits apply immediately (audit-logged)
      const res = await fetch(`/api/records/${editFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, businessType: editForm.otherType.trim() || editForm.businessType }),
      });
      const data = await res.json();
      setEditBusy(false);
      if (!res.ok) { setEditErr(data.errors || [data.error]); return; }
      if (detail && data.record && detailRow && detailRow.id === editFor.id)
        setDetail({ ...detail, record: { ...detail.record, ...data.record } });
      setEditFor(null);
      setFormOk(`Record ${editFor.serialNumber} updated`);
      load();
    } else {
      // Staff edits go to the approval queue
      const res = await fetch(`/api/records/${editFor.id}/edit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, businessType: editForm.otherType.trim() || editForm.businessType }),
      });
      const data = await res.json();
      setEditBusy(false);
      if (!res.ok) { setEditErr(data.errors || [data.error]); return; }
      setEditMsg(data.message || "Edit submitted for administrator approval.");
      setEditFor(null);
      setFormOk("Edit submitted for administrator approval — the record changes after the administrator approves it.");
    }
  }
  function exportExcel() {
    // Download the filtered view as a real .xlsx (3 sheets incl. grand totals)
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    window.location.href = `/api/export?${p.toString()}`;
  }

  async function deleteRecord(row: Row) {
    if (
      !confirm(
        `Delete ${row.name} (${row.serialNumber})?\n\n` +
          `This removes the record from the register. The serial number is retired ` +
          `and will NOT be reused. This action is audit-logged.`
      )
    )
      return;
    const res = await fetch(`/api/records/${row.id}/delete`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    setFormOk(`Deleted ${row.serialNumber} (${row.name})`);
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Temporal Structures Register</h2>
        <p className="sub">Official fee register — Adweso Zonal Council, New Juaben South Municipal Assembly</p>
          {pendingCount > 0 && (
            <div style={{ margin: "8px 0" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { listPending().then((x) => { setPendingItems(x); setPendingListOpen(true); }); }}>
                Pending ({pendingCount}) {pendingSyncing ? "— syncing…" : "— uploads by itself when network returns"}
              </button>
            </div>
          )}
          {pendingListOpen && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 130, padding: 14 }}>
              <div className="card modal-card" style={{ width: 500, maxWidth: "100%", maxHeight: "86vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: 18 }}>Pending records ({pendingCount})</h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPendingListOpen(false)}>Close</button>
                </div>
                <p className="sub" style={{ fontSize: 12.5 }}>Captured while offline. They upload automatically, oldest first — the server refuses duplicates so nothing can double-count. Serials are assigned at upload.</p>
                {pendingItems.slice().reverse().map((p) => (
                  <div key={p.pendingId} style={{ border: "1px solid var(--line, #cde3d5)", borderRadius: 8, padding: "8px 10px", margin: "6px 0", fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{String(p.payload?.name ?? "")} — {String(p.payload?.businessName ?? "")}</div>
                    <div style={{ color: "var(--muted)" }}>
                      {String(p.payload?.electoralArea ?? "")} · {String(p.payload?.streetName ?? "")} · GH₵{String(p.payload?.fee ?? "")} · saved {new Date(p.createdAt).toLocaleString()}
                    </div>
                    {p.note ? <div style={{ color: "var(--danger, #b91c1c)", marginTop: 2 }}>{p.note}</div> : null}
                    <div style={{ marginTop: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={async () => { await deletePending(p.pendingId); const x = await listPending(); setPendingItems(x); setPendingCount(x.length); }}>Remove</button>
                    </div>
                  </div>
                ))}
                {pendingItems.length === 0 ? <p className="sub">Nothing pending — everything is synced.</p> : null}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setPendingListOpen(false); void syncPending(); }}>
                    {pendingSyncing ? "Syncing…" : "Sync now"}
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="filters only-desktop">
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Electoral Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
          </div>
          <div className="f grow">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Search</span>
              <input type="text" placeholder="Name, business, serial or street..." value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setFormOk(""); }}>New Record</button>}
          <button className="btn btn-ghost" onClick={exportExcel}>Export Excel</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
          <button className="btn btn-ghost" onClick={printSelected} disabled={sel.size === 0} title="Print bills for ticked clients">
            Print Bills ({sel.size})
          </button>
          <button className="btn btn-ghost" onClick={printAllFiltered} title="Print a bill for every client in the current filter">
            Bills for All ({rows.length})
          </button>
        </div>

        {/* Phones: sticky compact filter bar */}
        <div className="m-filters only-mobile">
          <div className="m-row1">
            <input
              type="text"
              placeholder="Search name, serial, street…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search records"
            />
            <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Electoral area">
              <option value="">Area</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="m-chips" role="group" aria-label="Status filter">
            <button type="button" className={"m-chip" + (status === "" ? " on" : "")} onClick={() => setStatus("")}>All</button>
            <button type="button" className={"m-chip chip-unpaid" + (status === "UNPAID" ? " on" : "")} onClick={() => setStatus("UNPAID")}>Unpaid</button>
            <button type="button" className={"m-chip chip-paid" + (status === "PAID" ? " on" : "")} onClick={() => setStatus("PAID")}>Paid</button>
          </div>
        </div>

        {/* Phones: register actions — print bills & export within thumb reach */}
        <div className="m-actions only-mobile">
          <button className="btn btn-green" disabled={sel.size === 0} onClick={printSelected}>
            Print Bills ({sel.size})
          </button>
          <button className="btn btn-ghost" onClick={printAllFiltered}>
            Bills for All ({rows.length})
          </button>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setFormOk(""); }}>
              New Record
            </button>
          )}
          <div className="m-actions-row2">
            <button className="btn btn-ghost btn-sm" onClick={exportExcel}>Export Excel</button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print List</button>
          </div>
        </div>

        {smsSendable && lastCreated && (
          <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 13 }}>
              <b style={{ fontSize: 14 }}>{lastCreated.serialNumber}</b> — {lastCreated.name}:
            </span>
            <button type="button" className="btn btn-green btn-sm" disabled={smsBusy} onClick={() => sendOneSms("THANK_YOU", lastCreated)}>Send Thank You SMS</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={smsBusy} onClick={() => sendOneSms("BILL_NOTICE", lastCreated)}>Send Bill Notice SMS</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLastCreated(null); setSmsNote(""); }}>Dismiss</button>
            {smsNote && <span style={{ fontSize: 12.5 }}>{smsNote}</span>}
          </div>
        )}

        {showForm && (
          <form onSubmit={saveRecord} className="card" style={{ background: "var(--white)" }}>
            <h2>New Record</h2>
            <p className="sub">Serial number is generated automatically when you select the Electoral Area.</p>

            {formErr.length > 0 && <div className="err">{formErr.map((x, i) => <div key={i}>{x}</div>)}</div>}
            {formOk && <div className="ok-msg">{formOk}</div>}

            <div style={{ marginBottom: 14 }}>
              <span className="cap" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 5 }}>
                Serial Number <span style={{ color: "var(--muted)", fontWeight: 400 }}>(automatic)</span>
              </span>
              {serialPreview
                ? <span className="serial-preview"><span className="lbl">Will receive:</span> {serialPreview}</span>
                : <span className="serial-preview" style={{ opacity: 0.55 }}><span className="lbl">Select an Electoral Area to generate</span></span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
              <label className="fld"><span className="cap">Name <span className="req">*</span></span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Business Name <span className="req">*</span></span>
                <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Telephone <span className="req">*</span></span>
                <input type="tel" placeholder="0241234567" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Electoral Area <span className="req">*</span></span>
                <select value={form.electoralArea} onChange={(e) => onAreaPick(e.target.value)} required>
                  <option value="">Select area...</option>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select></label>
              <label className="fld"><span className="cap">Street Name <span className="req">*</span></span>
                <input type="text" value={form.streetName} onChange={(e) => setForm({ ...form, streetName: e.target.value })} required /></label>
                <label className="fld"><span className="cap">Type of Business</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} style={{ flex: 1 }}>
                      <option value="">—</option>
                      {BIZ_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <input type="text" placeholder="or type a business type" value={form.otherType} onChange={(e) => setForm({ ...form, otherType: e.target.value })} maxLength={80} /></label>
                  <label className="fld"><span className="cap">Container Type</span>
                    <select value={form.containerSize} onChange={(e) => { const size = e.target.value; const s = structureFee2027(size); setForm((f) => ({ ...f, containerSize: size, containerCategory: "", fee: !f.fee && s !== null ? String(s) : f.fee })); }}>
                      <option value="">—</option>
                      {CONTAINER_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  {form.containerSize && (
                    <label className="fld"><span className="cap">Category <span className="req">*</span></span>
                      <select value={form.containerCategory} onChange={(e) => setForm({ ...form, containerCategory: e.target.value })}>
                        <option value="">— pick —</option>
                        {CATS_FOR(form.containerSize).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  )}

              <label className="fld">
                <span className="cap">GPS Location <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional — stand at the structure and pick)</span></span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {gps ? (
                    <>
                      <span className="serial-preview" style={{ fontSize: 13 }}>
                        {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGps(null)}>Clear</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={pickGps} disabled={gpsBusy}>
                      {gpsBusy ? "Locating..." : "Pick GPS Location"}
                    </button>
                  )}
                </div>
                {gpsErr && <span className="err" style={{ marginTop: 6, display: "block", fontSize: 12 }}>{gpsErr}</span>}
              </label>
              <label className="fld"><span className="cap">Fee (GH₵) <span className="req">*</span></span>
                <input type="number" step="0.01" min="0.01" placeholder="e.g. 50" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required /></label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save Record"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setSerialPreview(""); }}>Cancel</button>
            </div>
          </form>
        )}

        {/* The long list is hidden until needed — totals and summary stay visible */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "12px 0 4px" }}>
          <button className="btn btn-ghost" onClick={toggleList} style={{ justifyContent: "center" }}>
            {listOpen ? "Hide the register list" : `Show the register list (${rows.length})`}
          </button>
          {!listOpen && rows.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              the record list is hidden to keep the page short — click the button to view all {rows.length}
            </span>
          )}
        </div>
        {listOpen && (
          <>
        <div className="tbl-wrap only-desktop">
          <table className="tbl">
            <thead>
              <tr>
                <th className="no-print" style={{ width: 30 }} title="Tick to select clients for bill printing"></th>
                <th>Serial No</th>
                <th>Name</th>
                <th>Business Name</th>
                <th>Telephone</th>
                <th>Electoral Area</th>
                <th>Street Name</th>
                <th>GPS</th>
                <th style={{ textAlign: "right" }}>Fee (GH₵)</th>
                <th style={{ textAlign: "right" }}>Balance (GH₵)</th>
                <th style={{ textAlign: "right" }}>Total (GH₵)</th>
                <th>Status</th>
                <th className="no-print">Business Type</th>
                <th className="no-print">Container</th>
                <th className="no-print">BOP (GHS)</th>
                {isAdmin && <th className="no-print">Created By</th>}
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>Loading...</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>No records match the current filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="no-print" style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} aria-label={`Select bill for ${r.name}`} />
                  </td>
                  <td className="serial">{r.serialNumber}</td>
                  <td><button className="linklike" title="View details" onClick={() => openDetail(r)}>{r.name}</button></td>
                  <td>{r.businessName}</td>
                  <td>{r.telephone}</td>
                  <td>{r.electoralArea}</td>
                  <td>{r.streetName}</td>
                  <td>
                    {r.hasGps ? (
                      <a href={r.mapsUrl || "#"} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: "3px 8px", fontSize: 12 }}>
                        Map
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>-</span>
                    )}
                  </td>
                  <td className="num">{r.fee.toFixed(2)}</td>
                  <td className="num"><b>{r.status === "PAID" ? "0.00" : r.balance.toFixed(2)}</b></td>
                  <td className="num">{r.status === "PAID" ? "0.00" : r.total.toFixed(2)}</td>
                  <td><span className={`badge ${r.status === "PAID" ? "paid" : "unpaid"}`}>{r.status === "PAID" ? "PAID" : "UNPAID"}</span></td>
                  <td className="no-print">{r.businessType || "—"}</td>
                  <td className="no-print">{ctrTxt(r.containerSize, r.containerCategory)}</td>
                  <td className="no-print">{r.bopFee != null ? r.bopFee.toFixed(2) : "—"}</td>
                  {isAdmin && <td className="no-print">{r.createdByUsername || "—"}</td>}
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    {canTouch(r) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    )}
                    {r.status !== "PAID" && canPay && canTouch(r) && (
                      <>
                        {" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setPayFor(r); setPayAmt(""); setPayErr(""); }}>Pay</button>
                        {" "}
                        <button className="btn btn-green btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                      </>
                    )}
                    {" "}
                    {isAdmin && canDelete && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: stacked record cards */}
        <div className="only-mobile">
          {loading && <p style={{ color: "var(--muted)", textAlign: "center" }}>Loading…</p>}
          {!loading && rows.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center" }}>No records match the current filters.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="user-card user-card-tap" onClick={() => openDetail(r)}>
              <div className="user-card-head">
                <div>
                  <div className="serial" style={{ fontSize: 14 }}>{r.serialNumber}</div>
                  <div style={{ fontWeight: 700 }}><button className="linklike" onClick={(e) => { e.stopPropagation(); openDetail(r); }}>{r.name}</button></div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.businessName}</div>
                </div>
                <span className={`badge ${r.status === "PAID" ? "paid" : "unpaid"}`}>{r.status === "PAID" ? "PAID" : "UNPAID"}</span>
              </div>
              <div className={"user-card-balance" + (r.status === "PAID" ? " is-paid" : "")}>
                <span className="b-label">BALANCE</span>
                <span className="b-value">GH₵ {r.status === "PAID" ? "0.00" : r.balance.toFixed(2)}</span>
                <span className="b-note">fee {r.fee.toFixed(2)} · total {r.status === "PAID" ? "0.00" : r.total.toFixed(2)}</span>
              </div>
              <div className="user-card-meta">
                <label className="bill-tick" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} />
                  Bill
                </label>
                <span>{r.telephone} · {r.electoralArea} · {r.streetName} · <i>{r.businessType || "—"}</i> · {ctrTxt(r.containerSize, r.containerCategory)}</span>
              </div>
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                {r.hasGps && (
                  <a href={r.mapsUrl || "#"} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    Map
                  </a>
                )}
                {canTouch(r) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                )}
                {r.status !== "PAID" && canPay && canTouch(r) && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setPayFor(r); setPayAmt(""); setPayErr(""); }}>Pay</button>
                    <button className="btn btn-green btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                  </>
                )}
                {isAdmin && canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
          </>
        )}

        {/* Grand totals — money visible to administrators only */}
        <div className="grand">
          <div className="tag">GRAND TOTALS</div>
          <div className="g"><div className="k">RECORDS</div><div className="v">{grand.records}</div></div>
          {moneyVisible ? (
            <>
              <div className="g"><div className="k">TOTAL BILLED</div><div className="v">{GHS(grand.billed)}</div></div>
              <div className="g"><div className="k">TOTAL COLLECTED</div><div className="v">{GHS(grand.collected)}</div></div>
              <div className="g"><div className="k">OUTSTANDING</div><div className="v">{GHS(grand.outstanding)}</div></div>
            </>
          ) : null}
        </div>
      </div>

      {/* Per-area summary */}
      <div className="card">
        <h2>Per-Area Summary</h2>
        <p className="sub">Counts and totals computed by the system for the current filter view.</p>
        <div className="summary-grid">
          {Object.entries(byArea).map(([a, s]) => (
            <div className="sum-card" key={a}>
              <div className="k">{a}</div>
              <div className="v">{s.count} record{s.count === 1 ? "" : "s"}</div>
              {moneyVisible ? (
                <>
                  <div className="k" style={{ marginTop: 6 }}>Billed {GHS(s.billed)} · Collected {GHS(s.collected)}</div>
                  <div className="k">Outstanding {GHS(s.outstanding)}</div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12, overflowY: "auto" }} onClick={() => setEditFor(null)}>
          <form className="card modal-card" style={{ width: 460, margin: "20px 0" }} onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2>Edit Record — {editFor.serialNumber}</h2>
            <p className="sub">
              {canEditDirect
                ? "Your changes apply immediately (audit-logged)."
                : "Your changes will be submitted for administrator approval. The record stays unchanged until approved."}
            </p>
            {editErr.length > 0 && <div className="err">{editErr.map((x, i) => <div key={i}>{x}</div>)}</div>}

            <label className="fld"><span className="cap">Name</span>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
            <label className="fld"><span className="cap">Business Name</span>
              <input type="text" value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} /></label>
            <label className="fld"><span className="cap">Telephone</span>
              <input type="tel" value={editForm.telephone} onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} /></label>
            <label className="fld"><span className="cap">Electoral Area</span>
              <select value={editForm.electoralArea} onChange={(e) => setEditForm({ ...editForm, electoralArea: e.target.value })}>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select></label>
            <label className="fld"><span className="cap">Street Name</span>
              <input type="text" value={editForm.streetName} onChange={(e) => setEditForm({ ...editForm, streetName: e.target.value })} /></label>
              <label className="fld"><span className="cap">Type of Business</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={editForm.businessType} onChange={(e) => { const bt = e.target.value; const b = bopFee2027(bt); setEditForm((f) => ({ ...f, businessType: bt, bopFee: !f.bopFee && b !== null ? String(b) : f.bopFee })); }} style={{ flex: 1 }}>
                    <option value="">—</option>
                    {BIZ_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="or type a business type" value={editForm.otherType} onChange={(e) => setEditForm({ ...editForm, otherType: e.target.value })} maxLength={80} /></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <label className="fld" style={{ flex: 1 }}><span className="cap">Container Type</span>
                    <select value={editForm.containerSize} onChange={(e) => { const size = e.target.value; const s = structureFee2027(size); setEditForm((f) => ({ ...f, containerSize: size, containerCategory: "", fee: !f.fee && s !== null ? String(s) : f.fee })); }}>
                      <option value="">—</option>
                      {CONTAINER_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="fld" style={{ flex: 1 }}><span className="cap">Category <span className="req">*</span></span>
                    <select value={editForm.containerCategory} onChange={(e) => setEditForm({ ...editForm, containerCategory: e.target.value })}>
                      <option value="">— pick —</option>
                      {CATS_FOR(editForm.containerSize).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="fld" style={{ flex: 1 }}><span className="cap">BOP Fee (GHS)</span>
                    <input type="text" inputMode="decimal" placeholder="e.g. 50" value={editForm.bopFee} onChange={(e) => setEditForm({ ...editForm, bopFee: e.target.value })} /></label>
                </div>
                <label className="fld"><span className="cap">Fee (GHS)</span>
                  <input type="text" inputMode="decimal" placeholder="e.g. 120" value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} />
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>2027 FRR: Wooden 60.68 · Containers/Sealed Metal 120 — picking the structure auto-fills this when empty.</span>
                </label>
            {!canEditDirect && (
              <p className="sub" style={{ margin: "2px 0 0" }}>
                GPS changes are sent to the administrator for approval before they take effect.
              </p>
            )}
            {gpsErr && (
              <p className="sub" style={{ color: "var(--danger,#b3261e)", margin: "2px 0 0" }}>{gpsErr}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={pickGpsEdit} disabled={gpsBusy} style={{ alignSelf: "flex-end", whiteSpace: "nowrap" }}>
                {gpsBusy ? "Locating..." : "Pick GPS Again"}
              </button>
              <label className="fld" style={{ flex: 1 }}><span className="cap">GPS Latitude</span>
                <input type="text" inputMode="decimal" placeholder="e.g. 5.123456" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} /></label>
              <label className="fld" style={{ flex: 1 }}><span className="cap">GPS Longitude</span>
                <input type="text" inputMode="decimal" placeholder="e.g. -0.987654" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} /></label>
            </div>
            {editForm.latitude && editForm.longitude && !isNaN(Number(editForm.latitude)) && !isNaN(Number(editForm.longitude)) && (
              <p className="sub"><a href={`https://www.google.com/maps?q=${editForm.latitude},${editForm.longitude}`} target="_blank" rel="noopener noreferrer">Preview GPS on Google Maps</a></p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={editBusy}>
                {editBusy ? "Submitting..." : canEditDirect ? "Save Changes" : "Submit for Approval"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Record detail modal — staff and admin both use this */}
      {detailBusy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="card modal-card" style={{ margin: 0, padding: "18px 22px" }}>Loading details…</div>
        </div>
      )}
      {detail && !detailBusy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12 }} onClick={() => setDetail(null)}>
          <div className="card modal-card" style={{ width: 440, maxWidth: "100%", margin: 0, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>Record Details</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
              {isAdmin && canDelete && detailRow && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => { setDetail(null); deleteRecord(detailRow); }}>Delete record</button>
              )}
            </h2>
            <p className="sub" style={{ marginBottom: 10 }}><b style={{ fontSize: 16 }}>{detail.record.serialNumber}</b> — {detail.record.name}</p>
            {smsSendable && detailRow && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <button type="button" className="btn btn-green btn-sm" disabled={smsBusy} onClick={() => sendOneSms("THANK_YOU", detailRow)}>Send Thank You SMS</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={smsBusy} onClick={() => sendOneSms("BILL_NOTICE", detailRow)}>Send Bill Notice SMS</button>
                {smsNote && <span style={{ fontSize: 12.5 }}>{smsNote}</span>}
              </div>
            )}
            <table className="kv" style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Business Name</td><td style={{ padding: "4px 0", fontWeight: 600 }}>{detail.record.businessName || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Telephone</td><td style={{ padding: "4px 0" }}>{detail.record.telephone || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Electoral Area</td><td style={{ padding: "4px 0" }}>{detail.record.electoralArea}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Street</td><td style={{ padding: "4px 0" }}>{detail.record.streetName || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Business Type</td><td style={{ padding: "4px 0" }}>{detail.record.businessType || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Container</td><td style={{ padding: "4px 0" }}>{ctrTxt(detail.record.containerSize, detail.record.containerCategory)}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Structure Fee</td><td style={{ padding: "4px 0" }}>GH₵ {Number(detail.record.fee).toFixed(2)}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>BOP Fee</td><td style={{ padding: "4px 0" }}>{detail.record.bopFee != null ? "GH₵ " + detail.record.bopFee.toFixed(2) : "GH₵ 0.00"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}><b>Total (Fee + BOP + Basic)</b></td><td style={{ padding: "4px 0" }}><b>GH₵ {(Number(detail.record.fee) + (detail.record.bopFee != null ? detail.record.bopFee : 0) + BASIC_RATE_2027).toFixed(2)}</b></td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Registered</td><td style={{ padding: "4px 0" }}>{new Date(detail.record.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Location</td><td style={{ padding: "4px 0" }}>
                  {detail.record.latitude != null && detail.record.longitude != null ? (
                    <a href={`https://www.google.com/maps?q=${detail.record.latitude},${detail.record.longitude}`} target="_blank" rel="noopener noreferrer">View on map ({detail.record.latitude.toFixed(5)}, {detail.record.longitude.toFixed(5)})</a>
                  ) : "—"}
                </td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Status</td><td style={{ padding: "4px 0" }}><span className={`badge ${detail.totals.balance <= 0 ? "paid" : "unpaid"}`}>{detail.totals.balance <= 0 ? "PAID" : "UNPAID"}</span></td></tr>
              </tbody>
            </table>

            <h3 style={{ margin: "16px 0 6px", fontSize: 14.5 }}>Money</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>TOTAL BILLED</div>
                <div className="v" style={{ fontWeight: 700 }}>{GHS(detail.totals.totalBilled)}</div>
              </div>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>PAID SO FAR</div>
                <div className="v" style={{ fontWeight: 700 }}>{GHS(detail.totals.totalPaid)}</div>
              </div>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", background: "var(--paper)" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>BALANCE</div>
                <div className="v" style={{ fontWeight: 800, color: detail.totals.balance > 0 ? "var(--danger, #b91c1c)" : "var(--ok, #065c37)" }}>{GHS(detail.totals.balance)}</div>
              </div>
            </div>

            <h3 style={{ margin: "16px 0 6px", fontSize: 14.5 }}>Payment history</h3>
            {detail.record.payments.length === 0 ? (
              <p className="sub">No payments recorded yet.</p>
            ) : (
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "3px 8px 3px 0" }}>Date</th>
                    <th style={{ padding: "3px 8px 3px 0" }}>Type</th>
                    <th style={{ padding: "3px 8px 3px 0" }}>Recorded by</th>
                    <th style={{ padding: "3px 0", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.record.payments.map((p, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "5px 8px 5px 0" }}>{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: "5px 8px 5px 0" }}>{p.kind === "SETTLEMENT" ? "Full settlement" : "Part payment"}</td>
                      <td style={{ padding: "5px 8px 5px 0" }}>{p.recordedBy?.username || "—"}</td>
                      <td style={{ padding: "5px 0", textAlign: "right", fontWeight: 600 }}>{GHS(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setPayFor(null)}>
          <form className="card modal-card" style={{ width: 380, margin: 0 }} onClick={(e) => e.stopPropagation()} onSubmit={savePayment}>
            <h2>Record Cash Payment</h2>
            <p className="sub">{payFor.serialNumber} — {payFor.name} ({payFor.businessName})<br />Outstanding balance: <b>{GHS(payFor.balance)}</b></p>
            {payErr && <div className="err">{payErr}</div>}
            <label className="fld"><span className="cap">Amount paid now (GH₵)</span>
              <input type="number" step="0.01" min="0.01" max={payFor.balance} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus required /></label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Save Payment</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}