// GET    /api/tenant/areas — this company's areas (the dropdown + serial codes)
// POST   /api/tenant/areas — add an area (FULL admins; creates its serial counter)
// DELETE /api/tenant/areas — remove an area (only when no active records use it)
// Server truth is Tenant.areas — every form, export and serial reads from it.
import { NextRequest, NextResponse } from "next/server";
import { prisma, getFullUser } from "@/lib/db";
import { sTid, getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenant = await prisma.tenant.findUnique({
    where: { id: sTid(session) },
    select: { areas: true },
  });
  const rows: { area: string; code: string | null }[] = Array.isArray(tenant?.areas)
    ? ((tenant.areas as unknown) as { area: string; code?: string | null }[]).map((a) => ({ area: a.area, code: a.code ?? null }))
    : [];
  return NextResponse.json({ areas: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const tid = sTid(session);
  const { area } = (await req.json().catch(() => ({}))) as { area?: string };
  const name = String(area || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40)
    return NextResponse.json({ error: "Area name must be 2-40 characters" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tid }, select: { areas: true } });
  const rows: { area: string; code: string | null }[] = Array.isArray(tenant?.areas)
    ? (tenant.areas as { area: string; code?: string | null }[]).map((a) => ({ area: a.area, code: a.code ?? null }))
    : [];
  if (rows.some((r) => r.area.toLowerCase() === name.toLowerCase()))
    return NextResponse.json({ error: "That area already exists" }, { status: 400 });
  const short = name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const code =
    (short.split(/\s+/).map((w) => w[0] || "").join("").toUpperCase() || "AREA").slice(0, 4);
  rows.push({ area: name, code });

  await prisma.tenant.update({ where: { id: tid }, data: { areas: rows } });
  await prisma.serialCounter.upsert({
    where: { tenantId_electoralArea: { tenantId: tid, electoralArea: name } },
    update: {},
    create: { tenantId: tid, electoralArea: name, lastNumber: 0 },
  });
  await prisma.auditLog.create({
    data: {
      tenantId: tid,
      userId: session.sub,
      action: "AREA_ADDED",
      entityType: "tenant",
      entityId: null,
      details: { area: name, code },
    },
  });
  return NextResponse.json({ ok: true, areas: rows });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const tid = sTid(session);
  const { area } = (await req.json().catch(() => ({}))) as { area?: string };
  const name = String(area || "").trim();
  if (!name) return NextResponse.json({ error: "Area name required" }, { status: 400 });

  const active = await prisma.feePayer.count({
    where: { tenantId: tid, electoralArea: name, recordStatus: "ACTIVE" },
  });
  if (active > 0)
    return NextResponse.json(
      { error: active + " active record(s) use this area - move them first, then remove it." },
      { status: 400 }
    );

  const tenant = await prisma.tenant.findUnique({ where: { id: tid }, select: { areas: true } });
  const rows: { area: string; code: string | null }[] = Array.isArray(tenant?.areas)
    ? (tenant.areas as { area: string; code?: string | null }[]).map((a) => ({ area: a.area, code: a.code ?? null }))
    : [];
  const next = rows.filter((r) => r.area !== name);
  if (next.length === rows.length) return NextResponse.json({ error: "Area not found" }, { status: 404 });
  await prisma.tenant.update({ where: { id: tid }, data: { areas: next } });
  // the serial counter row stays: retired serials keep their meaning forever
  await prisma.auditLog.create({
    data: {
      tenantId: tid,
      userId: session.sub,
      action: "AREA_REMOVED",
      entityType: "tenant",
      entityId: null,
      details: { area: name },
    },
  });
  return NextResponse.json({ ok: true, areas: next });
}
