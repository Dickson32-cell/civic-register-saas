// GET  /api/tenant/services — this tenant's service requests + entitlements (institution admin)
// POST /api/tenant/services — request a paid service: STAFF_SEATS or BRANDING
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

const KINDS = ["STAFF_SEATS", "BRANDING"] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId() },
    select: {
      id: true, name: true,
      staffSeatLimit: true, brandingUnlocked: true, logoDataUrl: true,
    },
  });
  const activeStaff = await prisma.appUser.count({
    where: { tenantId: tenantId(), role: "STAFF", active: true, approvedAt: { not: null } },
  });
  const requests = await prisma.serviceRequest.findMany({
    where: { tenantId: tenantId() },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    plan: {
      freeStaffSeats: tenant?.staffSeatLimit ?? 2,
      activeStaff,
      brandingUnlocked: tenant?.brandingUnlocked ?? false,
      hasLogo: Boolean(tenant?.logoDataUrl),
    },
    requests: requests.map((r) => ({
      id: r.id, kind: r.kind, seats: r.seats, note: r.note,
      status: r.status, decidedNote: r.decidedNote,
      createdAt: r.createdAt, decidedAt: r.decidedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  try {
    const { kind, seats, note, contactPhone } = await req.json();
    if (!kind || !KINDS.includes(kind))
      return NextResponse.json({ error: "Choose a service to request" }, { status: 400 });
    if (kind === "STAFF_SEATS") {
      const n = Number(seats);
      if (!Number.isInteger(n) || n < 3 || n > 200)
        return NextResponse.json({ error: "Seats must be a whole number from 3 to 200" }, { status: 400 });
    }
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 300) : null;
    const cleanPhone = typeof contactPhone === "string" ? contactPhone.trim().slice(0, 20) : null;

    // one open request per service keeps the queue honest (no stacked duplicates)
    const open = await prisma.serviceRequest.findFirst({
      where: { tenantId: tenantId(), kind, status: "PENDING" },
    });
    if (open)
      return NextResponse.json(
        { error: "A request for this service is already waiting with the platform administrator." },
        { status: 400 }
      );

    const r = await prisma.serviceRequest.create({
      data: {
        tenantId: tenantId(),
        kind,
        seats: kind === "STAFF_SEATS" ? Number(seats) : null,
        note: cleanNote,
        contactPhone: cleanPhone,
      },
    });
    return NextResponse.json({
      ok: true,
      requestId: r.id,
      message:
        "Request sent. The platform administrator will contact you about payment; once paid, it is approved and the service opens.",
    });
  } catch (e) {
    console.error("service request error", e);
    return NextResponse.json({ error: "Could not send request" }, { status: 500 });
  }
}
