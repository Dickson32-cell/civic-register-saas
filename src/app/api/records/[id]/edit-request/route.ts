// POST /api/records/[id]/edit-request — staff propose identity-field edits.
// Nothing changes on the record yet; the request waits for admin approval.
// Admin edits applied directly via PATCH /api/records/[id] still work.
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";

const EDITABLE = ["name", "businessName", "telephone", "streetName", "electoralArea", "businessType", "containerSize", "containerCategory", "bopFee", "fee"] as const;
const PHONE_RE = /^0\d{9}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const me = await getFullUser(session);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payer = await prisma.feePayer.findFirst({ where: { id, tenantId: tenantId() } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });

    // OWNERSHIP: staff may only propose edits on their OWN entries.
    if (me.role !== "ADMIN" && payer.createdBy && payer.createdBy !== session.sub)
      return NextResponse.json(
        { error: "This entry belongs to another staff member. Only they can edit it." },
        { status: 403 }
      );

    // Collect only the fields the user actually changed
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    const errors: string[] = [];

    // GPS edits travel through the same approval flow.
    const NUM_GPS = /^-?\d{1,3}(\.\d{1,7})?$/;
    const latRaw = typeof body.latitude === "string" ? body.latitude.trim() : "";
    const lngRaw = typeof body.longitude === "string" ? body.longitude.trim() : "";
    const curLat = payer.latitude != null ? String(Number(payer.latitude)) : "";
    const curLng = payer.longitude != null ? String(Number(payer.longitude)) : "";
    if (latRaw && latRaw !== curLat) {
      if (!NUM_GPS.test(latRaw) || Math.abs(Number(latRaw)) > 90)
        errors.push("Latitude must be a number between -90 and 90, e.g. 5.123456");
      else {
        before.latitude = curLat;
        after.latitude = latRaw;
      }
    }
    if (lngRaw && lngRaw !== curLng) {
      if (!NUM_GPS.test(lngRaw) || Math.abs(Number(lngRaw)) > 180)
        errors.push("Longitude must be a number between -180 and 180, e.g. -0.987654");
      else {
        before.longitude = curLng;
        after.longitude = lngRaw;
      }
    }

    for (const f of EDITABLE) {
      const incoming = body[f];
      if (typeof incoming !== "string" || !incoming.trim()) continue;
      const current = String((payer as unknown as Record<string, unknown>)[f]);
      if (incoming.trim() === current) continue; // unchanged — skip
      before[f] = current;
      after[f] = incoming.trim();
      if (f === "telephone" && !PHONE_RE.test(incoming.trim()))
        errors.push("Telephone must be 10 digits starting with 0");
      if (f === "containerSize" && !["Small", "Medium", "Large", "Double Container", "Wooden"].includes(incoming.trim()))
        errors.push("Container size must be Small, Medium, Large, Double Container or Wooden");
      if (f === "containerSize" && ["Small", "Medium", "Large", "Double Container", "Wooden"].includes(incoming.trim()) && !(typeof body.containerCategory === "string" && body.containerCategory.trim()))
        errors.push("Include the container category when changing the container type");
      if (f === "containerCategory") {
        const effSize = (typeof body.containerSize === "string" && body.containerSize.trim()) ? body.containerSize.trim() : (payer.containerSize ?? "");
        const catSet = effSize === "Wooden" ? ["Small", "Medium", "Large"] : ["CAT A", "CAT B", "CAT C"];
        if (!catSet.includes(incoming.trim()))
          errors.push("Container category does not match the container type");
      }
      if (f === "bopFee" && !Number.isFinite(Number(incoming.trim())))
        errors.push("BOP fee must be a valid amount in GHS");
      if (f === "fee" && (!Number.isFinite(Number(incoming.trim())) || Number(incoming.trim()) <= 0))
        errors.push("Fee must be a positive amount in GHS");
    }
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    if (Object.keys(after).length === 0)
      return NextResponse.json({ errors: ["No changes were made"] }, { status: 400 });

    const pending = await prisma.$transaction(async (tx) => {
      const created = await tx.pendingEdit.create({
        data: {
          tenantId: tenantId(),
          feePayerId: id,
          before: before as object,
          after: after as object,
          status: "PENDING",
          requestedBy: session.sub,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenantId(),
        
          userId: session.sub,
          action: "EDIT_REQUESTED",
          entityType: "pending_edit",
          entityId: created.id,
          details: { feePayerId: id, serial: payer.serialNumber, before, after },
        },
      });
      return created;
    });

    return NextResponse.json({
      ok: true,
      editId: pending.id,
      message: "Edit submitted for administrator approval. No changes applied yet.",
    });
  } catch (e) {
    console.error("edit-request error", e);
    return NextResponse.json({ error: "Could not submit edit" }, { status: 500 });
  }
}