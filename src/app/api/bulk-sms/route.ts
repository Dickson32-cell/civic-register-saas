// Bulk SMS API — Adweso Zonal Council ONLY.
// GET  -> preview: due/sent counts + the fixed texts (needs a FULL admin).
// POST { type, area? } -> send the fixed message of that type to everyone due
//     (optionally within one electoral area). One message per record; a person
//     can never receive the same type twice (DB unique rule). FAILED sends are
//     marked and may be retried; SENT can never be re-sent.
// Gates: council must be 'adweso' (404 otherwise); sender must be a FULL admin
// (403 otherwise); the module must be configured via env (400 'not configured').
import { NextRequest, NextResponse } from "next/server";
import { sTid, getSession } from "@/lib/auth";
import { getFullUser, tenantId, prisma } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import {
  SMS_TYPES, SMS_TEXTS, SMS_SENDER_ID, SmsType, smsConfigured,
  smsDue, normalizePhone, fillTemplate, markSms, arkeselSend,
} from "@/lib/bulkSms";

const SMS_COUNCIL = "adweso";
const MAX_PER_PRESS = 40; // keep each press well under the serverless timeout; the marks make repeats safe

async function guard() {
  const session = await getSession();
  if (!session) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (sTid(session) !== SMS_COUNCIL)
    return { err: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const me = await getFullUser(session);
  if (!me || me.role !== "ADMIN" || permsFor(me.role, me.adminLevel).canManageUsers !== true)
    return { err: NextResponse.json({ error: "Only FULL administrators can use SMS" }, { status: 403 }) };
  return { me, sub: session.sub, session };
}

export async function GET() {
  const g = await guard();
  if (g.err) return g.err;
  const configured = smsConfigured();
  const types: Record<string, unknown> = {};
  const areas = new Set<string>();
  for (const t of SMS_TYPES) {
    const d = await smsDue(SMS_COUNCIL, t);
    for (const r of d.due) areas.add(r.electoralArea);
    types[t] = {
      text: SMS_TEXTS[t],
      dueCount: d.due.length,
      sentCount: d.sentCount,
      skips: { noPhone: d.noPhone, badPhone: d.badPhone },
      due: d.due.slice(0, 300).map((r) => ({ id: r.id, name: r.name, serialNumber: r.serialNumber, telephone: r.telephone, electoralArea: r.electoralArea })),
    };
  }
  return NextResponse.json({ configured, senderId: SMS_SENDER_ID, areas: Array.from(areas).sort(), types });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.err) return g.err;
  const me = g.me!;
  if (!smsConfigured())
    return NextResponse.json({ error: "SMS is not configured yet — add the provider key on the server" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || "");
  if (!SMS_TYPES.includes(type as SmsType))
    return NextResponse.json({ error: "Unknown SMS type" }, { status: 400 });
  const area = String(body.area || "").trim();
  const dryRun = body.dryRun === true;

  // Single-record send: same fixed messages, same once-per-record rule.
  if (body.recordId) {
    const rid = String(body.recordId);
    const rec = await prisma.feePayer.findFirst({
      where: { tenantId: SMS_COUNCIL, id: rid, recordStatus: "ACTIVE" },
      select: { id: true, name: true, serialNumber: true, telephone: true, electoralArea: true },
    });
    if (!rec) return NextResponse.json({ error: "Record not found in this register" }, { status: 404 });
    const st = await prisma.smsSend.findUnique({ where: { tenantId_recordId_type: { tenantId: SMS_COUNCIL, recordId: rid, type } } });
    if (st && st.status === "SENT" && !dryRun)
      return NextResponse.json({ error: "This record already received this message (each record gets a type once)" }, { status: 409 });
    const phone = normalizePhone(rec.telephone || "");
    if (!phone) return NextResponse.json({ error: "This record has no usable phone number" }, { status: 400 });
    const message = fillTemplate(SMS_TEXTS[type], rec.name, rec.serialNumber);
    if (dryRun) return NextResponse.json({ ok: true, type, senderId: SMS_SENDER_ID, result: { preview: true, wouldSend: 1, skipped: 0, message } });
    let s: "SENT" | "FAILED";
    let errText = "";
    try {
      await arkeselSend(process.env.ARKESEL_API_KEY as string, SMS_SENDER_ID, message, phone);
      s = "SENT";
    } catch (e) {
      s = "FAILED"; errText = String(e).slice(0, 90);
    }
    await markSms(SMS_COUNCIL, rid, type as SmsType, phone, s);
    await prisma.auditLog.create({
      data: {
        tenantId: sTid(g.session),
        userId: g.sub,
        action: "SINGLE_SMS",
        entityType: "fee_payer",
        entityId: rid,
        details: { type, status: s, phone, error: errText, by: me.username },
      },
    });
    return NextResponse.json({
      ok: s === "SENT",
      type,
      senderId: SMS_SENDER_ID,
      result: s === "SENT"
        ? { sent: [{ id: rid, serial: rec.serialNumber, phone, name: rec.name }], failed: [], skipped: 0 }
        : { sent: [], failed: [{ id: rid, serial: rec.serialNumber, phone, error: errText }], skipped: 0 },
    });
  }

  const d = await smsDue(SMS_COUNCIL, type as SmsType);
  let due = d.due;
  if (area) due = due.filter((r) => r.electoralArea === area);
  const skipped: Array<{ id: string; serial: string | null; reason: string }> = [];
  const sent: Array<{ id: string; serial: string | null; phone: string; name: string }> = [];
  const failed: Array<{ id: string; serial: string | null; phone: string; error: string }> = [];
  const existing = await prisma.smsSend.findMany({
    where: { tenantId: SMS_COUNCIL, type },
    select: { recordId: true, status: true },
  });
  const state = new Map(existing.map((s) => [s.recordId, s.status]));
  const apiKey = process.env.ARKESEL_API_KEY as string;

  for (const r of (area ? due : d.due).slice(0, MAX_PER_PRESS)) {
    const phone = normalizePhone(r.telephone || "");
    if (state.get(r.id) === "SENT" && !body.force) { skipped.push({ id: r.id, serial: r.serialNumber, reason: "already had this message" }); continue; }
    if (!phone) { skipped.push({ id: r.id, serial: r.serialNumber, reason: "no usable phone number" }); continue; }
    const message = fillTemplate(SMS_TEXTS[type], r.name, r.serialNumber);
    if (dryRun) { sent.push({ id: r.id, serial: r.serialNumber, phone, name: r.name }); continue; }
    try {
      let sent1 = false;
      let lastErr = "";
      for (let attempt = 0; attempt < 2 && !sent1; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
        try {
          await arkeselSend(apiKey, SMS_SENDER_ID, message, phone);
          sent1 = true;
        } catch (e) {
          lastErr = String(e).slice(0, 90);
          if (attempt === 0 && !dryRun) await new Promise((r) => setTimeout(r, 250)); // pace before retry
        }
      }
      if (!sent1) throw new Error(lastErr);
      await markSms(SMS_COUNCIL, r.id, type as SmsType, phone, "SENT");
      sent.push({ id: r.id, serial: r.serialNumber, phone, name: r.name });
    } catch (e) {
      await markSms(SMS_COUNCIL, r.id, type as SmsType, phone, "FAILED");
      failed.push({ id: r.id, serial: r.serialNumber, phone, error: String(e).slice(0, 120) });
    }
    if (!dryRun) await new Promise((r) => setTimeout(r, 120)); // keep batches under provider pace limits
  }

  await prisma.auditLog.create({
    data: {
      tenantId: sTid(g.session),
      userId: g.sub,
      action: "BULK_SMS",
      entityType: "fee_payer",
      entityId: null,
      details: { type, area: area || "ALL", sentCount: sent.length, failedCount: failed.length, skippedCount: skipped.length, by: me.username },
    },
  });
  const remainingAfter = (await smsDue(SMS_COUNCIL, type as SmsType))
    .due.filter((r) => !area || r.electoralArea === area).length;
  return NextResponse.json({
    ok: true,
    type,
    senderId: SMS_SENDER_ID,
    result: dryRun ? { preview: true, wouldSend: sent.length, skipped: skipped.length } : { sent, failed, skipped },
    remainingAfter: dryRun ? null : remainingAfter,
  });
}