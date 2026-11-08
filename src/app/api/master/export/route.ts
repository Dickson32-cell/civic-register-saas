// GET /api/master/export — PRIMARY ADMIN ONLY (username 'admin').
// One Excel workbook with EVERY council's complete register + payments
// from the shared multi-council database. Only the primary admin sees this.
//
// Sheet layout (v2 — grouped, full details):
//   "Council Summary"     — one row per council: counts + money
//   "Area Breakdown"      — one row per (council × electoral area): grouped counts + money
//   "<council> register"  — every field of every record, sorted by area then serial
//   "<council> payments"  — payment history per council
//   "<council> area totals" — per-area subtotal block for that council
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { masterPrisma } from "@/lib/master-db";
import { COUNCIL_NAMES } from "@/lib/councils";
import * as XLSX from "xlsx";

const GHS = (n: number) => n.toFixed(2);
const ALL_COUNCILS = ["adweso", "newtown", "ogua", "nkukwao", "betom", "srodae", "oldestate", "anlotown"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.username !== "admin")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const masterCouncil = process.env.MASTER_COUNCIL;
  if (!masterCouncil || masterCouncil !== process.env.COUNCIL_ID)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payers = await masterPrisma.feePayer.findMany({
    orderBy: [{ councilId: "asc" }, { electoralArea: "asc" }, { serialNumber: "asc" }],
    include: { payments: { orderBy: { receivedAt: "asc" }, include: { receivedByUser: { select: { username: true } } } } },
  });

  type AreaAgg = { area: string; active: number; total: number; billed: number; collected: number; outstanding: number };

  const registerSheets: { name: string; rows: Record<string, unknown>[] }[] = [];
  const paymentSheets: { name: string; rows: Record<string, unknown>[] }[] = [];
  const areaTotalsSheets: { name: string; rows: Record<string, unknown>[] }[] = [];
  const areaBreakdown: Record<string, unknown>[] = [];
  const councilSummary: Record<string, unknown>[] = [];

  for (const c of ALL_COUNCILS) {
    const rows = payers.filter((p) => p.councilId === c);
    if (!rows.length) continue;
    const cname = COUNCIL_NAMES[c] ?? c;

    // Full-detail register: every field, grouped by area (rows already sorted area→serial)
    const register = rows.map((p) => {
      const paid = p.payments.reduce((s, x) => s + Number(x.amount), 0);
      const fee = Number(p.fee);
      const balance = p.status === "PAID" ? 0 : Math.max(0, fee - paid);
      return {
        "Serial": p.serialNumber,
        "Electoral Area": p.electoralArea,
        "Name": p.name,
        "Business Name": p.businessName,
        "Telephone": p.telephone,
        "Street": p.streetName,
        "GPS Latitude": p.latitude != null ? Number(p.latitude) : "",
        "GPS Longitude": p.longitude != null ? Number(p.longitude) : "",
        "Google Maps": p.latitude != null && p.longitude != null ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : "",
        "Fee (GHS)": GHS(fee),
        "Paid Total (GHS)": GHS(paid),
        "Balance (GHS)": GHS(balance),
        "Status": p.status,
        "Record": p.recordStatus,
        "Registered On": p.createdAt.toISOString().slice(0, 10),
      };
    });

    // Per-area aggregation with FULL detail kept in the register sheet
    const areas = new Map<string, AreaAgg>();
    for (const p of rows) {
      const paid = p.payments.reduce((s, x) => s + Number(x.amount), 0);
      const fee = Number(p.fee);
      const balance = p.status === "PAID" ? 0 : Math.max(0, fee - paid);
      const a = areas.get(p.electoralArea) ?? { area: p.electoralArea, active: 0, total: 0, billed: 0, collected: 0, outstanding: 0 };
      a.total += 1;
      if (p.recordStatus === "ACTIVE") { a.active += 1; a.billed += fee; a.collected += paid; a.outstanding += balance; }
      areas.set(p.electoralArea, a);
    }
    const areaRows = [...areas.values()]
      .sort((x, y) => x.area.localeCompare(y.area))
      .map((a) => ({
        "Electoral Area": a.area,
        "Active Records": a.active,
        "Total Records (incl. deleted)": a.total,
        "Billed (GHS)": GHS(a.billed),
        "Collected (GHS)": GHS(a.collected),
        "Outstanding (GHS)": GHS(a.outstanding),
      }));
    const cBilled = [...areas.values()].reduce((t, a) => t + a.billed, 0);
    const cCollected = [...areas.values()].reduce((t, a) => t + a.collected, 0);

    areaTotalsSheets.push({ name: `${c} area totals`, rows: areaRows });
    for (const a of areas.values()) {
      areaBreakdown.push({
        "Council": cname,
        "Electoral Area": a.area,
        "Active Records": a.active,
        "Billed (GHS)": GHS(a.billed),
        "Collected (GHS)": GHS(a.collected),
        "Outstanding (GHS)": GHS(a.outstanding),
      });
    }
    councilSummary.push({
      "Council": cname,
      "Electoral Areas": areas.size,
      "Active Records": [...areas.values()].reduce((t, a) => t + a.active, 0),
      "Total Records": rows.length,
      "Billed (GHS)": GHS(cBilled),
      "Collected (GHS)": GHS(cCollected),
      "Outstanding (GHS)": GHS(cBilled - cCollected),
    });

    const payments = rows.flatMap((p) =>
      p.payments.map((x) => ({
        "Serial": p.serialNumber,
        "Name": p.name,
        "Electoral Area": p.electoralArea,
        "Date": x.receivedAt.toISOString().slice(0, 10),
        "Amount (GHS)": GHS(Number(x.amount)),
        "Kind": x.receiptNo === "SETTLEMENT" ? "SETTLEMENT" : x.method,
        "Recorded by": x.receivedByUser?.username ?? "-",
      }))
    );

    registerSheets.push({ name: `${c} register`, rows: register });
    paymentSheets.push({ name: `${c} payments`, rows: payments });
  }

  const wb = XLSX.utils.book_new();
  if (councilSummary.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(councilSummary), "Council Summary");
  if (areaBreakdown.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaBreakdown), "Area Breakdown");
  for (const s of [...registerSheets, ...areaTotalsSheets, ...paymentSheets])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="All-Councils-Register-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}