// BULK SMS — Adweso Zonal Council only (the SMS pilot council).
// Two fixed message types, no free composing:
//   THANK_YOU   — registration thank-you (once per record, ever)
//   BILL_NOTICE — bill printed & distribution notice (once per record, ever)
// The once-per-record rule is ENFORCED by a unique DB index
// (council_id, record_id, type); a FAILED send may be retried.
// Provider: Arkesel (Ghana). Sender ID: env ARKESEL_SENDER (max 11 chars).
// Secrets live ONLY in env: BULK_SMS_ENABLED, ARKESEL_API_KEY, ARKESEL_SENDER.
import crypto from "crypto";
import { prisma, councilId } from "./db";

export const SMS_SENDER_ID = String(process.env.ARKESEL_SENDER || "ADWESOZC").slice(0, 11);

export const SMS_TEXTS: Record<string, string> = {
  THANK_YOU:
    "Adweso Zonal Council: Thank you, {name}. Your shop has been successfully registered. Serial No.: {serial}. Please encourage other shop owners to register as well. They can call the Director of Adweso Zonal Council on 024 884 7819.",
  BILL_NOTICE:
    "Adweso Zonal Council: Dear {name}, your bill (Serial No.: {serial}) has been printed and will be delivered to you shortly. Kindly receive the council officer when they arrive. For enquiries, please contact the council office or the Director on 024 884 7819.",
};

export type SmsType = "THANK_YOU" | "BILL_NOTICE";
export const SMS_TYPES: SmsType[] = ["THANK_YOU", "BILL_NOTICE"];

export function smsConfigured(): boolean {
  return process.env.BULK_SMS_ENABLED === "1" && !!process.env.ARKESEL_API_KEY;
}

/** Ghana phone normalisation: 0XXXXXXXXX -> +233XXXXXXXXX; returns null when unusable. */
export function normalizePhone(raw: string): string | null {
  let s = String(raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+233")) s = s.slice(1);
  if (s.startsWith("233")) s = "+" + s;
  if (s.startsWith("0") && s.length === 10) s = "+233" + s.slice(1);
  if (!/^\+233[2350][0-9]{8}$/.test(s)) return null;
  return s;
}

export function fillTemplate(tpl: string, name: string, serial: string): string {
  return tpl.replace("{name}", name || "").replace("{serial}", serial || "");
}

export async function smsDue(council: string, type: SmsType) {
  const sent = await prisma.smsSend.findMany({
    where: { councilId: council, type, status: "SENT" },
    select: { recordId: true },
  });
  const sentIds = new Set(sent.map((s) => s.recordId));
  const rows = await prisma.feePayer.findMany({
    where: { councilId: council, recordStatus: "ACTIVE" },
    select: { id: true, name: true, serialNumber: true, telephone: true, electoralArea: true },
    orderBy: [{ electoralArea: "asc" }, { serialNumber: "asc" }],
  });
  const due = rows
    .filter((r) => !sentIds.has(r.id) && !!r.telephone)
    .filter((r) => normalizePhone(r.telephone || "") !== null);
  const noPhone = rows.filter((r) => !r.telephone);
  const badPhone = rows.filter(
    (r) => r.telephone && normalizePhone(r.telephone || "") === null && !sentIds.has(r.id) && !due.includes(r)
  );
  return { due, noPhone: noPhone.length, badPhone: badPhone.length, sentCount: sentIds.size };
}

export async function markSms(council: string, recordId: string, type: SmsType, phone: string, status: "SENT" | "FAILED") {
  await prisma.smsSend.upsert({
    where: { councilId_recordId_type: { councilId: council, recordId, type } },
    update: { status, phone, sentAt: new Date() },
    create: { id: crypto.randomBytes(11).toString("hex"), councilId: council, recordId, type, phone, status },
  });
}

/** Send via Arkesel v2 API. Returns the provider message id or throws. */
export async function arkeselSend(apiKey: string, sender: string, message: string, recipient: string): Promise<string> {
  const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, message, recipients: [recipient] }),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; data?: unknown };
  if (!res.ok || (data && data.status === "error")) throw new Error("provider rejected: " + JSON.stringify(data).slice(0, 120));
  return String(data.data ?? "accepted");
}