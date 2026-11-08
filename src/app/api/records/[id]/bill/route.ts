// GET /api/records/[id]/bill — bill data for the printable Assembly-style bill.
// Returns everything the bill page needs; BOP stays 0 until a mandate says otherwise.
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId } from "@/lib/db";
import { sTid, getSession } from "@/lib/auth";
import { COUNCIL_NAMES } from "@/lib/tenants";

import { BASIC_RATE_2027 } from "@/lib/frrRates";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const r = await prisma.feePayer.findFirst({
    where: { id, tenantId: sTid(session), recordStatus: "ACTIVE" },
    include: {
      fees: { orderBy: { billedAt: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bopAmt = r.bopFee != null ? Number(r.bopFee) : 0;
  const billed = r.fees.reduce((s, f) => s + Number(f.amount), 0) + bopAmt + BASIC_RATE_2027;
  const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = r.status === "PAID" ? 0 : Math.max(0, Number((billed - paid).toFixed(2)));

  const cid = sTid(session);
  const tenant = await prisma.tenant.findUnique({
    where: { id: cid },
    select: { name: true, logoDataUrl: true, brandingUnlocked: true, billHeadingOverride: true, billFooterNote: true, billTitle: true, billLegal1: true, billLegal2: true, billStampCaption: true },
  });
  return NextResponse.json({
    tenantId: cid,
    councilName: COUNCIL_NAMES[cid] ?? "Zonal Council",
    brand: tenant?.brandingUnlocked
      ? {
          logoDataUrl: tenant.logoDataUrl ?? null,
          heading: tenant.billHeadingOverride?.trim() ? tenant.billHeadingOverride : null,
          footer: tenant.billFooterNote?.trim() ? tenant.billFooterNote : null,
          title: tenant.billTitle?.trim() ? tenant.billTitle : null,
          legal1: tenant.billLegal1?.trim() ? tenant.billLegal1 : null,
          legal2: tenant.billLegal2?.trim() ? tenant.billLegal2 : null,
          stamp: tenant.billStampCaption?.trim() ? tenant.billStampCaption : null,
          fallbackName: tenant.name,
        }
      : null,
    customer: {
      id: r.serialNumber,
      name: r.name,
      businessName: r.businessName,
      telephone: r.telephone,
      electoralArea: r.electoralArea,
      streetName: r.streetName,
    },
    bill: {
      structureRate: Number(r.fee.toFixed(2)),
      bop: r.bopFee != null ? Number(r.bopFee) : null, // shows when staff enter the BOP fee
      basicRate: 1.0,
      rent: 0,
      arrears: 0,
      payment: Number(paid.toFixed(2)),
      totalDue,
      status: r.status,
      description: r.businessName || r.name,
    },
    printedOn: new Date().toISOString(),
  });
}