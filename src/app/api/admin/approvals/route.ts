// GET /api/admin/approvals — ONE dashboard for the tenant admin:
// staff signups waiting for approval + pending edit requests + pending password requests.
// role ADMIN only, tenant-scoped, counts for the TopBar badge.
import { NextResponse } from "next/server";
import { prisma, tenantId, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const me = await getFullUser(session);
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 403 });
  const perms = permsFor(me.role, me.adminLevel);

  const [staff, edits, passwords] = await Promise.all([
    prisma.appUser.findMany({
      where: { tenantId: tenantId(), approvedAt: null, role: "STAFF" },
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, fullName: true, createdAt: true },
    }),
    perms.canReviewEdits
      ? prisma.pendingEdit.findMany({
          where: { tenantId: tenantId(), status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, createdAt: true,
            feePayer: { select: { serialNumber: true, name: true, businessName: true } },
          },
        })
      : Promise.resolve([]),
    perms.canReviewPasswords
      ? prisma.passwordChangeRequest.findMany({
          where: { tenantId: tenantId(), status: "PENDING" },
          orderBy: { requestedAt: "desc" },
          select: {
            id: true, requestedAt: true,
            user: { select: { username: true, fullName: true, active: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    perms: {
      manageUsers: perms.canManageUsers,
      reviewEdits: perms.canReviewEdits,
      reviewPasswords: perms.canReviewPasswords,
    },
    counts: { staff: staff.length, edits: edits.length, passwords: passwords.length, total: staff.length + edits.length + passwords.length },
    staff: staff.map((u) => ({
      kind: "staff", id: u.id, username: u.username, fullName: u.fullName,
      requestedAt: u.createdAt,
      desc: `${u.fullName} (username: ${u.username}) wants a work account`,
    })),
    edits: (edits as Array<{ id: string; createdAt: Date; feePayer: { serialNumber: string; name: string; businessName: string | null } }>).map((e) => ({
      kind: "edit", id: e.id, requestedAt: e.createdAt,
      desc: `Edit request on ${e.feePayer.serialNumber} — ${e.feePayer.name}${e.feePayer.businessName ? ` (${e.feePayer.businessName})` : ""}`,
    })),
    passwords: (passwords as Array<{ id: string; requestedAt: Date; user: { username: string; fullName: string; active: boolean } }>).map((r) => ({
      kind: "password", id: r.id, requestedAt: r.requestedAt,
      desc: `Password change request from ${r.user.fullName} (${r.user.username})`,
      accountActive: r.user.active,
    })),
  });
}
