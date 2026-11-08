// GET /api/records — the register list with computed money columns,
// area filters, search, per-area summaries AND GRAND TOTALS.
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, getFullUser } from "@/lib/db";
import { sTid, getSession } from "@/lib/auth";

import { BASIC_RATE_2027 } from "@/lib/frrRates";
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const area = sp.get("area") || "";
  const q = (sp.get("q") || "").trim();
  const status = (sp.get("status") || "").trim(); // UNPAID | PAID | ""
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

  const where: Record<string, unknown> = { recordStatus: "ACTIVE", tenantId: sTid(session) };
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
      createdByUser: { select: { username: true } },
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
    const totalBilled = r.fees.reduce((s, f) => s + Number(f.amount), 0) + bopAmt + BASIC_RATE_2027;
    const totalPaid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(0, Number((totalBilled - totalPaid).toFixed(2)));
    const lat = r.latitude ? Number(r.latitude) : null;
    const lng = r.longitude ? Number(r.longitude) : null;
    return {
      id: r.id,
      serialNumber: r.serialNumber,
      createdByUsername: r.createdByUser?.username || null,
      name: r.name,
      businessName: r.businessName,
      telephone: r.telephone,
      electoralArea: r.electoralArea,
      streetName: r.streetName,
      businessType: r.businessType || null,
      containerSize: r.containerSize || null,
      containerCategory: r.containerCategory || null,
      bopFee: r.bopFee != null ? Number(r.bopFee) : null,
      latitude: lat,
      longitude: lng,
      hasGps: lat != null && lng != null,
      mapsUrl:
        lat != null && lng != null
          ? `https://www.google.com/maps?q=${lat},${lng}`
          : null,
      fee: Number(r.fee),
      total: Number(totalBilled.toFixed(2)),
      paid: Number(totalPaid.toFixed(2)),
      balance,
      status: r.status,
    };
  });

  // Per-area summaries + GRAND TOTAL
  const byArea: Record<string, { count: number; billed: number; collected: number; outstanding: number }> = {};
  for (const r of records) {
    if (!byArea[r.electoralArea])
      byArea[r.electoralArea] = { count: 0, billed: 0, collected: 0, outstanding: 0 };
    const a = byArea[r.electoralArea];
    a.count += 1;
    a.billed = Number((a.billed + r.total).toFixed(2));
    a.collected = Number((a.collected + r.paid).toFixed(2));
    a.outstanding = Number((a.outstanding + r.balance).toFixed(2));
  }
  const grand = {
    records: records.length,
    billed: Number(records.reduce((s, r) => s + r.total, 0).toFixed(2)),
    collected: Number(records.reduce((s, r) => s + r.paid, 0).toFixed(2)),
    outstanding: Number(records.reduce((s, r) => s + r.balance, 0).toFixed(2)),
  };

  // Money aggregates (billed/collected/outstanding) are visible to FULL administrators only.
  const safeByArea = moneyVisible
    ? byArea
    : Object.fromEntries(Object.entries(byArea).map(([k, v]) => [k, { count: v.count }]));
  const safeGrand = moneyVisible
    ? grand
    : { records: grand.records, billed: null, collected: null, outstanding: null };
  return NextResponse.json({
    records,
    byArea: safeByArea,
    grand: safeGrand,
    moneyHidden: !moneyVisible,
  });
}