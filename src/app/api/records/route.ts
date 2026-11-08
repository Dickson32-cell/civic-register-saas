// POST /api/records — create a fee payer record.
// The serial number is allocated TRANSACTIONALLY (per-area counter).
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  prisma,
  ELECTORAL_AREAS,
  areaCode,
  tenantId,
  formatSerial,
  getFullUser,
} from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";
import { withRetry } from "@/lib/retry";
import { assertCanCreate } from "@/lib/license";

const PHONE_RE = /^0\d{9}$/;

type Tx = Prisma.TransactionClient;

// ATOMIC serial allocation — one single UPDATE statement, auto-committed.
// PostgreSQL serializes concurrent updates to the same row internally;
// no long-held transaction lock, so 5+ staff saving simultaneously all
// succeed. If the record insert afterwards fails, the serial is skipped
// (never reused — council register integrity).
async function allocateSerialAtomic(area: string): Promise<string> {
  const code = areaCode(area);
  if (!code) throw new Error("Unknown area");

  // Released serials first (deleted records re-offered by the office's release queue)
  const released = await prisma.$queryRawUnsafe<{ serial_number: string }[]>(
    `UPDATE serial_release SET status = 'USED', used_at = now()
       WHERE id = (SELECT id FROM serial_release
                    WHERE tenant_id = $1 AND electoral_area = $2 AND status = 'AVAILABLE'
                    ORDER BY number LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING serial_number`,
    tenantId(), area
  );
  if (released.length > 0) return released[0].serial_number;
  const updated = await prisma.serialCounter.update({
    where: { tenantId_electoralArea: { tenantId: tenantId(), electoralArea: area } },
    data: { lastNumber: { increment: 1 } },
  });
  return formatSerial(code, updated.lastNumber);
}

// Kept for reference/rollback: transactional version (causes P2028 under load)
async function generateSerialInTx(tx: Tx, area: string): Promise<string> {
  const code = areaCode(area);
  if (!code) throw new Error("Unknown area");
  const updated = await tx.serialCounter.update({
    where: { tenantId_electoralArea: { tenantId: tenantId(), electoralArea: area } },
    data: { lastNumber: { increment: 1 } },
  });
  return formatSerial(code, updated.lastNumber);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canCreateRecords)
    return NextResponse.json(
      { error: "Your account does not have permission to create records" },
      { status: 403 }
    );

  // pendingId: dedupe key sent by devices syncing offline-captured records.
  // Checked BEFORE the license gate so a lost-response retry always resolves
  // to the record that already exists instead of being blocked by a lock.
  let pendingId = "";
  try {
    const body = await req.json();
    const { name, businessName, telephone, electoralArea, streetName, fee } = body;

    // Validation
    const errors: string[] = [];
    if (!name?.trim()) errors.push("Name is required");
    if (!businessName?.trim()) errors.push("Business Name is required");
    if (!telephone || !PHONE_RE.test(telephone))
      errors.push("Telephone must be 10 digits starting with 0 (e.g. 0241234567)");
    if (!ELECTORAL_AREAS.some((a) => a.area === electoralArea))
      errors.push("Electoral Area is invalid");
    if (!streetName?.trim()) errors.push("Street Name is required");
    const feeNum = Number(fee);
    if (!Number.isFinite(feeNum) || feeNum <= 0)
      errors.push("Fee must be a positive amount in GH\u20B5");

    // GPS (optional) — Ghana bounding box keeps typos/garbage out
    let lat: number | null = null;
    let lng: number | null = null;
    if (body.latitude != null && body.longitude != null) {
      lat = Number(body.latitude);
      lng = Number(body.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < 4.4 || lat > 11.5 || lng < -3.6 || lng > 1.8) {
        errors.push("GPS coordinates look invalid (must be within Ghana)");
      }
    }
    // Container type + category pairing
    const containerSizeVal = ["Small", "Medium", "Large", "Double Container", "Wooden"].includes(body.containerSize) ? body.containerSize as string : null;
    const catRaw = body.containerCategory ? String(body.containerCategory).trim() : "";
    const catSet = containerSizeVal === "Wooden" ? ["Small", "Medium", "Large"] : ["CAT A", "CAT B", "CAT C"];
    const containerCategoryVal = catRaw && catSet.includes(catRaw) ? catRaw : null;
    // Offline-captured payloads from before the category field existed carry a
    // size but no category — accept those (same as legacy DB rows); reject only
    // a category that was actually sent and doesn't match the container type.
    if (containerSizeVal && catRaw && !containerCategoryVal)
      errors.push("Container category does not match the container type");
    if (errors.length) {
      // Diagnostic breadcrumb (no customer names printed).
      console.log(JSON.stringify({ op: "CREATE_REJECTED", council: tenantId(), errors,
        fieldShapes: { telephoneLen: telephone ? String(telephone).length : 0,
          telephoneHead: telephone ? String(telephone).slice(0, 3) : "", area: electoralArea || "",
          feeRaw: fee === undefined ? "absent" : String(fee), hasBusinessName: !!String(businessName || "").trim(),
          hasStreet: !!String(streetName || "").trim(), hasGps: body.latitude != null || body.longitude != null,
          lat: body.latitude == null ? null : Number(body.latitude), lng: body.longitude == null ? null : Number(body.longitude),
          containerSize: body.containerSize ?? null, containerCategory: body.containerCategory ?? null,
          pendingIdShape: /^[A-Za-z0-9._:-]{8,64}$/.test(String(body.pendingId || "")) ? "valid" : "invalid-or-missing" } }));
      return NextResponse.json({ errors }, { status: 400 });
    }

    // OFFLINE DEDUPE: a retry (lost/duplicate sync) returns the record that already
    // exists. Combined with the (tenant_id, pending_id) unique index, double entries
    // are impossible even on flaky networks.
    const pendingIdRaw = body.pendingId ? String(body.pendingId) : "";
    pendingId = /^[A-Za-z0-9._:-]{8,64}$/.test(pendingIdRaw) ? pendingIdRaw : "";
    if (pendingId) {
      const dup = await prisma.feePayer.findFirst({ where: { tenantId: tenantId(), pendingId } });
      if (dup)
        return NextResponse.json(
          { ok: true, duplicate: true, record: { id: dup.id, serialNumber: dup.serialNumber, name: dup.name } },
          { status: 200 }
        );
    }

    // LICENSE GATE: locked at every 100 registrations until the US$6.99 fee
    // is paid and an unlock key is applied. 402 = Payment Required.
    const license = await assertCanCreate();
    if (license)
      return NextResponse.json({ error: "REGISTER LOCKED", license }, { status: 402 });

    // Concurrency-safe create:
    // 1. ATOMIC serial allocation (single UPDATE — row lock held for
    //    microseconds, so 5+ staff at once never block each other into
    //    transaction timeouts)
    // 2. Short transaction for record + fee + audit (withRetry absorbs
    //    Neon transient connection errors)
    const serial = await withRetry(() => allocateSerialAtomic(electoralArea), "allocate-serial");

    const record = await withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.feePayer.create({
            data: {
              tenantId: tenantId(),
              pendingId: pendingId || null,
              createdBy: session.sub,
              serialNumber: serial,
              electoralArea,
              name: name.trim(),
              businessName: businessName.trim(),
              telephone,
              streetName: streetName.trim(),
              businessType: body.businessType && String(body.businessType).trim()
                ? String(body.businessType).trim().slice(0, 80)
                : null,
              containerSize: containerSizeVal,
              containerCategory: containerCategoryVal,
              latitude: lat != null ? lat.toFixed(7) : null,
              longitude: lng != null ? lng.toFixed(7) : null,
              fee: feeNum.toFixed(2),
              status: "UNPAID",
            },
          });

          // Opening billing entry (the typed fee) — keeps the ledger truthful
          await tx.fee.create({
            data: {
              tenantId: tenantId(),
              feePayerId: created.id,
              amount: feeNum.toFixed(2),
              description: "Opening fee (temporal structure)",
              createdBy: session.sub,
            },
          });

          await tx.auditLog.create({
            data: {
              tenantId: tenantId(),
              userId: session.sub,
              action: "CREATE_RECORD",
              entityType: "fee_payer",
              entityId: created.id,
              details: { serial, name, businessName, electoralArea, fee: feeNum, offline: Boolean(pendingId) },
            },
          });

          return created;
        }),
      "create-record"
    );

    return NextResponse.json({
      ok: true,
      record: {
        id: record.id,
        serialNumber: record.serialNumber,
        name: record.name,
        businessName: record.businessName,
        telephone: record.telephone,
        electoralArea: record.electoralArea,
        streetName: record.streetName,
        businessType: record.businessType || null,
        containerSize: record.containerSize || null,
      containerCategory: record.containerCategory || null,
        latitude: record.latitude ? Number(record.latitude) : null,
        longitude: record.longitude ? Number(record.longitude) : null,
        fee: Number(record.fee),
        status: record.status,
        balance: Number(record.fee),
        total: Number(record.fee),
      },
    });
  } catch (e) {
    // Two retries (or two devices) racing with the same pendingId: the unique
    // index stops the second insert — resolve it to the first record instead.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      pendingId
    ) {
      const dup = await prisma.feePayer
        .findFirst({ where: { tenantId: tenantId(), pendingId } })
        .catch(() => null);
      if (dup)
        return NextResponse.json(
          { ok: true, duplicate: true, record: { id: dup.id, serialNumber: dup.serialNumber, name: dup.name } },
          { status: 200 }
        );
    }
    console.error("create record error", e);
    return NextResponse.json({ error: "Could not create record" }, { status: 500 });
  }
}