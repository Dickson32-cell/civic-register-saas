// PATCH /api/records/[id] — edit identity fields, or select status PAID.
// Admin (FULL/EDITOR) only — staff use the edit-request workflow.
// Marking PAID auto-writes a settlement payment for the outstanding remainder,
// so Balance AND Total both read GH₵ 0.00 (Dickson's confirmed behaviour)
// while the cash ledger stays truthful.
import { NextRequest, NextResponse } from "next/server";
import { prisma, councilId, payerTotals, audit, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

const PHONE_RE = /^0\d{9}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership model:
  //   ADMIN (FULL/EDITOR) - can edit ANY record directly.
  //   STAFF - can edit their OWN records directly (no approval needed);
  //           foreign records are rejected.
  const isStaff = me.role !== "ADMIN";
  if (isStaff && !permsFor(me.role, me.adminLevel).canEditRecords) {
    // staff: check ownership after loading the record (below)
  }
  if (!isStaff && !permsFor(me.role, me.adminLevel).canEditRecords)
    return NextResponse.json(
      { error: "Your account cannot edit records directly" },
      { status: 403 }
    );

  const { id } = await params;
  try {
    const body = await req.json();
    const payer = await prisma.feePayer.findFirst({ where: { id, councilId: councilId() } });
    if (!payer || payer.recordStatus !== "ACTIVE")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    // STAFF RULE: only payment settlement travels PATCH; every field edit
    // goes through the administrator approval queue (edit-request).
    if (isStaff) {
      const fieldKeys = Object.keys(body ?? {}).filter((k) => !["status", "receiptNo"].includes(k));
      if (body?.status !== "PAID" || fieldKeys.length > 0) {
        return NextResponse.json(
          { error: "Staff edits go to the administrator for approval. Use Edit and choose Submit for Approval." },
          { status: 403 }
        );
      }
    }
    if (isStaff && payer.createdBy && payer.createdBy !== session.sub)
      return NextResponse.json(
        { error: "This entry belongs to another staff member. Only they can edit it." },
        { status: 403 }
      );

    // --- Case 1: staff selects "PAID" → settle in full ---
    if (body.status === "PAID") {
      const totals = await payerTotals(id);
      const outstanding = Number(totals.balance.toFixed(2));
      if (payer.status === "PAID") {
        return NextResponse.json({ ok: true, alreadyPaid: true, totals });
      }
      await prisma.$transaction(async (tx) => {
        if (outstanding > 0) {
          await tx.payment.create({
            data: {
              feePayerId: id,
              amount: outstanding.toFixed(2),
              method: "CASH",
              receivedBy: session.sub,
              receiptNo: body.receiptNo || null,
            },
          });
        }
        await tx.feePayer.update({ where: { id }, data: { status: "PAID" } });
        await tx.auditLog.create({
        data: {
          councilId: councilId(),
        
            userId: session.sub,
            action: "MARK_PAID",
            entityType: "fee_payer",
            entityId: id,
            details: { settled: outstanding },
          },
        });
      });
      const after = await payerTotals(id);
      return NextResponse.json({ ok: true, totals: after, status: "PAID" });
    }

    // --- Case 2: revert to UNPAID (admin correction) ---
    if (body.status === "UNPAID") {
      await prisma.$transaction(async (tx) => {
        await tx.feePayer.update({ where: { id }, data: { status: "UNPAID" } });
        await tx.auditLog.create({
        data: {
          councilId: councilId(),
        
            userId: session.sub,
            action: "MARK_UNPAID",
            entityType: "fee_payer",
            entityId: id,
            details: {},
          },
        });
      });
      const after = await payerTotals(id);
      return NextResponse.json({ ok: true, totals: after, status: "UNPAID" });
    }

    // --- Case 3: edit identity fields ---
    const errors: string[] = [];
    if (body.telephone && !PHONE_RE.test(body.telephone))
      errors.push("Telephone must be 10 digits starting with 0");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const data: Record<string, string> = {};
    for (const f of ["name", "businessName", "telephone", "streetName", "electoralArea", "businessType"]) {
      if (typeof body[f] === "string" && body[f].trim()) data[f] = body[f].trim();
    }

    // GPS: staff changes always route through the administrator approval queue.
    const NUM_GPS = /^-?\d{1,3}(\.\d{1,7})?$/;
    const latRaw = typeof body.latitude === "string" ? body.latitude.trim() : "";
    const lngRaw = typeof body.longitude === "string" ? body.longitude.trim() : "";
    if (latRaw || lngRaw) {
      if (isStaff)
        return NextResponse.json(
          { errors: ["GPS changes require administrator approval. Use the Edit (GPS) request."] },
          { status: 400 }
        );
      if (latRaw) {
        const cur = payer.latitude != null ? String(Number(payer.latitude)) : "";
        if (latRaw !== cur) {
          if (!NUM_GPS.test(latRaw) || Math.abs(Number(latRaw)) > 90)
            errors.push("Latitude must be a number between -90 and 90, e.g. 5.123456");
          else data.latitude = latRaw;
        }
      }
      if (lngRaw) {
        const cur = payer.longitude != null ? String(Number(payer.longitude)) : "";
        if (lngRaw !== cur) {
          if (!NUM_GPS.test(lngRaw) || Math.abs(Number(lngRaw)) > 180)
            errors.push("Longitude must be a number between -180 and 180, e.g. -0.987654");
          else data.longitude = lngRaw;
        }
      }
      if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    }

    // Container size + BOP fee (staff may set both on their own entries)
    const CONTAINER_TYPES = ["Small", "Medium", "Large", "Double Container", "Wooden"];
    const nextSizeRaw = typeof body.containerSize === "string" ? body.containerSize.trim() : "";
    if (nextSizeRaw && !CONTAINER_TYPES.includes(nextSizeRaw))
      errors.push("Container size must be Small, Medium, Large, Double Container or Wooden");
    else if (nextSizeRaw) data.containerSize = nextSizeRaw;
    const nextCatRaw = typeof body.containerCategory === "string" ? body.containerCategory.trim() : "";
    if (nextSizeRaw && !nextCatRaw)
      errors.push("Include the container category when changing the container type");
    if (nextCatRaw) {
      const eff = nextSizeRaw || (payer.containerSize ?? "");
      const catSet = eff === "Wooden" ? ["Small", "Medium", "Large"] : ["CAT A", "CAT B", "CAT C"];
      if (!catSet.includes(nextCatRaw))
        errors.push("Container category does not match the container type");
      else data.containerCategory = nextCatRaw;
    }
    if (typeof body.bopFee === "string" && body.bopFee.trim()) {
      const bop = Number(body.bopFee.trim());
      if (!Number.isFinite(bop) || bop < 0)
        errors.push("BOP fee must be a positive amount in GHS");
      else data.bopFee = bop.toFixed(2);
    }
    // Fee edit (admin direct): positive amount only; staff fee edits ride the approval queue
    if (typeof body.fee === "string" && body.fee.trim()) {
      const feeNew = Number(body.fee.trim());
      if (!Number.isFinite(feeNew) || feeNew <= 0)
        errors.push("Fee must be a positive amount in GHS");
      else data.fee = feeNew.toFixed(2);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.feePayer.update({ where: { id }, data });
      // A fee edit rides the ledger: keep the fee row equal to the header fee
      if (data.fee != null) {
        const frows = await tx.fee.findMany({ where: { feePayerId: id, councilId: councilId() } });
        const fsum = frows.reduce((s, f) => s + Number(f.amount), 0);
        if (Math.abs(fsum - Number(data.fee)) > 0.005) {
          if (frows.length === 1)
            await tx.fee.update({ where: { id: frows[0].id }, data: { amount: data.fee } });
          else if (frows.length === 0)
            await tx.fee.create({ data: { councilId: councilId(), feePayerId: id, amount: data.fee, description: "Opening fee (temporal structure)", createdBy: session.sub } });
        }
      }
      await tx.auditLog.create({
        data: {
          councilId: councilId(),
        
          userId: session.sub,
          action: "UPDATE_RECORD",
          entityType: "fee_payer",
          entityId: id,
          details: { before: { ...payer }, after: { ...r } },
        },
      });
      return r;
    });

    const totals = await payerTotals(id);
    return NextResponse.json({ ok: true, record: updated, totals });
  } catch (e) {
    console.error("update record error", e);
    return NextResponse.json({ error: "Could not update record" }, { status: 500 });
  }
}