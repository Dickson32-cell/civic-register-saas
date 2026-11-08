// GET /api/records/[id] — single record with full money detail + ledger history
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, payerTotals } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payer = await prisma.feePayer.findFirst({
    where: { id, tenantId: tenantId() },
    include: {
      fees: { orderBy: { createdAt: "asc" } },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { receivedByUser: { select: { username: true } } },
      },
    },
  });
  if (!payer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totals = await payerTotals(id);
  // Shape the payload for the client detail modal
  const payments = payer.payments.map((p) => ({
    amount: Number(p.amount),
    kind: p.receiptNo === "SETTLEMENT" ? "SETTLEMENT" : "PART",
    createdAt: p.createdAt.toISOString(),
    recordedBy: p.receivedByUser ? { username: p.receivedByUser.username } : null,
  }));
  const record = {
    serialNumber: payer.serialNumber,
    name: payer.name,
    businessName: payer.businessName,
    telephone: payer.telephone,
    electoralArea: payer.electoralArea,
    streetName: payer.streetName,
    businessType: payer.businessType || null,
    containerSize: payer.containerSize || null,
 containerCategory: payer.containerCategory || null,
    bopFee: payer.bopFee != null ? Number(payer.bopFee) : null,
    recordStatus: payer.recordStatus,
    latitude: payer.latitude ? Number(payer.latitude) : null,
    longitude: payer.longitude ? Number(payer.longitude) : null,
    createdAt: payer.createdAt.toISOString(),
    fees: payer.fees.map((f) => ({ amount: Number(f.amount), createdAt: f.createdAt.toISOString() })),
    payments,
  };
  return NextResponse.json({ record, totals });
}