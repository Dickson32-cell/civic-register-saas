// POST /api/tenant/services/unlock — apply an OFFLINE-ISSUED service key.
// A company pays the platform team directly (MoMo/bank), the owner issues an
// HMAC key for THAT company + service, and the key is pasted here. The system
// never holds money; the key is the authority.
//   { kind: "BRANDING", key }                   -> logo + bill designer
//   { kind: "STAFF_SEATS", targetSeats, key }   -> raise staff seats to targetSeats
import { NextRequest, NextResponse } from "next/server";
import { getFullUser, prisma } from "@/lib/db";
import { sTid, getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";
import { applyServiceKey, verifyServiceKey } from "@/lib/license";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { kind, targetSeats, key } = await req.json().catch(() => ({ kind: "", targetSeats: 0, key: "" }));
  const tid = sTid(session);

  if (String(kind) === "BRANDING") {
    if (!key || typeof key !== "string")
      return NextResponse.json({ error: "Enter the unlock key you were issued" }, { status: 400 });
    const r = await applyServiceKey(tid, "BRANDING", String(key));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 });
    return NextResponse.json({ ok: true, message: r.entitlement });
  }

  if (String(kind) === "STAFF_SEATS") {
    const n = Number(targetSeats);
    if (!Number.isInteger(n) || n < 3 || n > 500)
      return NextResponse.json(
        { error: "Enter the seat count the key was issued for (a whole number, 3-500)" },
        { status: 400 }
      );
    if (!key || typeof key !== "string")
      return NextResponse.json({ error: "Enter the unlock key you were issued" }, { status: 400 });

    if (!verifyServiceKey(tid, "STAFF_SEATS", n, String(key))) {
      await prisma.auditLog
        .create({
          data: {
            tenantId: tid, userId: null, action: "SERVICE_KEY_REJECTED",
            entityType: "tenant", entityId: null,
            details: { kind: "STAFF_SEATS", targetSeats: n, reason: "invalid-key" },
          },
        })
        .catch(() => {});
      return NextResponse.json(
        { error: "Invalid key. Check the seat count and the key with the system provider." },
        { status: 403 }
      );
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: tid }, select: { staffSeatLimit: true } });
    const current = tenant?.staffSeatLimit ?? 2;
    if (n <= current)
      return NextResponse.json(
        { error: `Your plan already covers ${current} seats. Keys raise the limit only.` },
        { status: 400 }
      );
    await prisma.tenant.update({ where: { id: tid }, data: { staffSeatLimit: n } });
    await prisma.auditLog
      .create({
        data: {
          tenantId: tid, userId: null, action: "SERVICE_KEY_APPLIED",
          entityType: "tenant", entityId: null,
          details: { kind: "STAFF_SEATS", seats: n },
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, message: `Staff seats raised to ${n}` });
  }

  return NextResponse.json({ error: "Choose the service you are unlocking" }, { status: 400 });
}
