// MASTER ONLY — service requests from every tenant + decisions.
// GET   /api/master/services — all requests, PENDING first
// PATCH /api/master/services — approve (apply entitlements) or reject
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { masterPrisma } from "@/lib/master-db";

const ALL_TENANTS_FALLBACK: string[] = [];

async function requirePrimaryAdmin() {
  const session = await getSession();
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.username !== "admin")
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const masterTenant = process.env.MASTER_COUNCIL;
  const thisTenant = process.env.TENANT_ID;
  if (!masterTenant || masterTenant !== thisTenant)
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { session };
}

export async function GET() {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  const rows = await masterPrisma.serviceRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { tenant: { select: { name: true } } },
  });

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name ?? r.tenantId,
      kind: r.kind,
      seats: r.seats,
      note: r.note,
      contactPhone: r.contactPhone,
      status: r.status,
      decidedNote: r.decidedNote,
      createdAt: r.createdAt,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requirePrimaryAdmin();
  if (gate.err) return gate.err;

  try {
    const { requestId, action, seats, note } = await req.json();
    if (!requestId || !["approve", "reject"].includes(action))
      return NextResponse.json({ error: "requestId and action required" }, { status: 400 });

    const row = await masterPrisma.serviceRequest.findFirst({ where: { id: requestId } });
    if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (row.status !== "PENDING")
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });

    if (action === "approve") {
      if (row.kind === "STAFF_SEATS") {
        const n = Number(seats ?? row.seats ?? 0);
        if (!Number.isInteger(n) || n <= 2)
          return NextResponse.json({ error: "Give a seat count greater than the free 2" }, { status: 400 });
        await masterPrisma.tenant.update({ where: { id: row.tenantId }, data: { staffSeatLimit: n } });
      } else if (row.kind === "BRANDING") {
        await masterPrisma.tenant.update({ where: { id: row.tenantId }, data: { brandingUnlocked: true } });
      }
    }

    await masterPrisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        decidedBy: "platform-admin",
        decidedNote: typeof note === "string" ? note.trim().slice(0, 300) : null,
        decidedAt: new Date(),
        ...(action === "approve" && row.kind === "STAFF_SEATS" && seats ? { seats: Number(seats) } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("master services decision error", e);
    return NextResponse.json({ error: "Decision failed" }, { status: 500 });
  }
}
