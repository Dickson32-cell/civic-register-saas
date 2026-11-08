// GET /api/export — Excel (.xlsx) report with 3 sheets:
//   Register | Area Summary | Grand Totals
// Mirrors the current filter view (area / status / search).
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";
import { licenseStatus } from "@/lib/license";

import { BASIC_RATE_2027 } from "@/lib/frrRates";
const GHS = (n: number) => n.toFixed(2);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // LICENSE GATE: Excel export requires an unlocked register (payment made).
  const license = await licenseStatus();
  if (license.locked)
    return NextResponse.json({ error: "EXPORT LOCKED", license }, { status: 402 });

    const sp = req.nextUrl.searchParams;
  
  const _role = (session as { role?: string }).role;
  const isAdmin = _role === "ADMIN";
  let moneyVisible = isAdmin;
  let viewerScope: string[] = [];
  if (isAdmin) {
    const _me = await getFullUser(session);
    moneyVisible = (_me?.adminLevel || "FULL") === "FULL";
    if (_me && _me.adminLevel === "VIEWER" && Array.isArray(_me.viewerAreas))
      viewerScope = _me.viewerAreas.filter((a) => typeof a === "string" && a.length > 0);
  }
  const area = sp.get("area") || "";
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "").trim();

  const where: Record<string, unknown> = { recordStatus: "ACTIVE", councilId: councilId() };
  if (area) where.electoralArea = area;
  if (viewerScope.length) {
    if (area) where.electoralArea = viewerScope.includes(area) ? area : { in: [] };
    else where.electoralArea = { in: viewerScope };
  }
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { businessName: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { streetName: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.feePayer.findMany({
    where,
    orderBy: [{ electoralArea: "asc" }, { serialNumber: "asc" }],
    include: {
      fees: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  // Serial order must be NUMERIC (1, 2, ..., 10, ..., 101) inside each area —
  // text ordering of the serial would put 101 right after 10.
  const serialNum = (s: string) => {
    const m = /(\d+)\s*$/.exec(s || "");
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  rows.sort((a, b) =>
    (a.electoralArea || "").localeCompare(b.electoralArea || "") ||
    serialNum(a.serialNumber) - serialNum(b.serialNumber) ||
    (a.serialNumber || "").localeCompare(b.serialNumber || "")
  );

  const records = rows.map((r) => {
    const bopAmt = r.bopFee != null ? Number(r.bopFee) : 0;
    const billed = r.fees.reduce((s, f) => s + Number(f.amount), 0) + bopAmt + BASIC_RATE_2027;
    const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number((billed - paid).toFixed(2)));
    const lat = r.latitude ? Number(r.latitude) : null;
    const lng = r.longitude ? Number(r.longitude) : null;
    return {
      "Serial No": r.serialNumber,
      Name: r.name,
      "Business Name": r.businessName,
      Telephone: r.telephone,
      "Electoral Area": r.electoralArea,
      "Street Name": r.streetName,
      "Business Type": r.businessType || "",
      "Container Size": r.containerSize || "",
      "Container Category": r.containerCategory || "",
      "BOP Fee (GHS)": r.bopFee != null ? Number(r.bopFee) : "",
      "GPS Latitude": lat,
      "GPS Longitude": lng,
      "Google Maps Link": lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : "",
      "Fee (GHS)": Number(r.fee),
      "Balance (GHS)": r.status === "PAID" ? 0 : balance,
      "Total (GHS)": r.status === "PAID" ? 0 : Number(billed.toFixed(2)),
      Status: r.status,
    };
  });

  // Area summary
  const byArea: Record<string, { count: number; billed: number; collected: number; outstanding: number }> = {};
  rows.forEach((r) => {
    const bopAmt = r.bopFee != null ? Number(r.bopFee) : 0;
    const billed = r.fees.reduce((s, f) => s + Number(f.amount), 0) + bopAmt + BASIC_RATE_2027;
    const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    if (!byArea[r.electoralArea])
      byArea[r.electoralArea] = { count: 0, billed: 0, collected: 0, outstanding: 0 };
    const a = byArea[r.electoralArea];
    a.count += 1;
    a.billed = Number((a.billed + billed).toFixed(2));
    a.collected = Number((a.collected + paid).toFixed(2));
    a.outstanding = Number((a.outstanding + Math.max(0, billed - paid)).toFixed(2));
  });
  // Money aggregates (billed/collected/outstanding) are visible to administrators only.
  const summary = moneyVisible
    ? Object.entries(byArea).map(([k, v]) => ({
        "Electoral Area": k,
        "Records": v.count,
        "Total Billed (GHS)": v.billed,
        "Collected (GHS)": v.collected,
        "Outstanding (GHS)": v.outstanding,
      }))
    : Object.entries(byArea).map(([k, v]) => ({
        "Electoral Area": k,
        "Records": v.count,
      }));

  const grand = moneyVisible
    ? {
        "Total Records": records.length,
        "Grand Total Billed (GHS)": Number(records.reduce((s, r) => s + r["Total (GHS)"], 0).toFixed(2)),
        "Grand Total Collected (GHS)": Number(
          Object.values(byArea).reduce((s, v) => s + v.collected, 0).toFixed(2)
        ),
        "Grand Total Outstanding (GHS)": Number(records.reduce((s, r) => s + r["Balance (GHS)"], 0).toFixed(2)),
      }
    : {
        "Total Records": records.length,
      };

  // Build workbook
  const wb = XLSX.utils.book_new();

  const wsRegister = XLSX.utils.json_to_sheet(records);
  // Money columns format
  wsRegister["!cols"] = [{ wch: 13 }, { wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, wsRegister, "Register");

  const wsSummary = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Area Summary");

  if (moneyVisible) {
    const wsGrand = XLSX.utils.json_to_sheet([grand]);
    XLSX.utils.book_append_sheet(wb, wsGrand, "Grand Totals");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const stamp = new Date().toISOString().slice(0, 10);
  const areaPart = area ? area.replace(/[^a-zA-Z0-9]/g, "-") : "All-Areas";
  const filename = `Adweso-Register-${areaPart}-${stamp}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}