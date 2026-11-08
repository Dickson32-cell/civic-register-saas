// GET /api/serial-preview?area=Adweso%20Town
// Shows staff the serial the NEXT record in that area will receive.
// Read-only preview — the real number is allocated transactionally on save.
import { NextRequest, NextResponse } from "next/server";
import { prisma, areaCode, tenantId, formatSerial } from "@/lib/db";
import { sTid, getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const area = req.nextUrl.searchParams.get("area") || "";
  // Code comes from THIS company's own area list (fallback to a short form)
  const theTenant = await prisma.tenant.findUnique({ where: { id: sTid(session) }, select: { areas: true } });
  const knownAreas: { area: string; code?: string | null }[] = Array.isArray(theTenant?.areas)
    ? (theTenant.areas as { area: string; code?: string | null }[])
    : [];
  const code = String(knownAreas.find((a) => a.area === area)?.code || areaCode(area) || "AREA");

  const counter = await prisma.serialCounter.findUnique({
    where: { tenantId_electoralArea: { tenantId: sTid(session), electoralArea: area } },
  });
  const next = (counter?.lastNumber ?? 0) + 1;
  return NextResponse.json({ serial: formatSerial(code, next), nextNumber: next });
}