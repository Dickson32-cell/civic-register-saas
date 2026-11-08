// PAYSTACK — payment flow for the register license fee (US$6.99 ≈ GHS 105).
// A council pays to unlock the next 100 registrations. Paystack takes the
// payment; on webhook confirmation the council's license unlocks itself —
// no manual key from the owner needed (the manual key path stays as fallback).
//
// Keys live ONLY in env (this repo is public — Neon scans it). The ledger
// is LicenseState itself: no schema change needed.
import crypto from "crypto";
import { prisma } from "./db";

export const LICENSE_FEE_USD = 6.99; // price per 100 registrations
export const USD_GHS_RATE = Number(process.env.USD_GHS_RATE || 15.5);
export const CHARGE_GHS = Math.round(LICENSE_FEE_USD * USD_GHS_RATE); // ≈ GHS 108

function secret(): string {
  const s = process.env.PAYSTACK_SECRET_KEY;
  if (!s) throw new Error("PAYSTACK_SECRET_KEY not configured on server");
  return s;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// Receipt stamp stored in LicenseState.licenseKey:
//   PS|<ref>|<hmac16>   hmac16 = HMAC-SHA256(LICENSE_SECRET, `${id}|${ref}`)
// Proves the unlock came from a verified Paystack payment, not a typed key.
// ---------------------------------------------------------------------------
function receiptStamp(councilId: string, ref: string, amountPesewas: number): string {
  const mac = crypto
    .createHmac("sha256", process.env.LICENSE_SECRET || "")
    .update(`${councilId}|${ref}|${amountPesewas}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `PS|${ref}|${mac}`;
}

type LicenseRow = { id: string; paidThrough: number; licenseKey: string | null; pendingRef: string | null; pendingRefAt: Date | null };

export async function getLicenseRow(council: string): Promise<LicenseRow | null> {
  // raw select: pendingRef/pendingRefAt are new columns (see note at bottom)
  return (prisma as any).licenseState.findUnique({ where: { id: council } });
}

// ---------------------------------------------------------------------------
// Initiate a transaction: POST https://api.paystack.co/transaction/initialize
// ---------------------------------------------------------------------------
export async function initLicensePayment(council: string) {
  const state = await getLicenseRow(council);
  const fresh =
    state?.pendingRef &&
    state.pendingRefAt &&
    Date.now() - new Date(state.pendingRefAt).getTime() < 30 * 60 * 1000;
  const reference =
    fresh && state?.pendingRef
      ? state.pendingRef
      : `ZC-${council.toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: CHARGE_GHS * 100, // pesewas
      email: process.env.PAYSTACK_NOTICE_EMAIL || "payments@zonal-councils.invalid",
      currency: "GHS",
      reference,
      callback_url: `${process.env.PUBLIC_BASE_URL || ""}/license`,
      channels: ["mobile_money", "card"],
      metadata: { council, purpose: "license_unlock", fee_usd: LICENSE_FEE_USD },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.status) throw new Error(data?.message || "Paystack initialize failed");

  await prisma.licenseState.update({
    where: { id: council },
    data: { pendingRef: reference, pendingRefAt: new Date() },
  });
  return { authorizationUrl: data.data.authorization_url as string, reference };
}

// ---------------------------------------------------------------------------
// Webhook handler: event=charge.success, metadata.purpose=license_unlock.
// Signature: HMAC-SHA512 of the raw body with the secret key (Paystack spec).
// Idempotent: re-deliveries see the PS| receipt already stamped and no-op.
// ---------------------------------------------------------------------------
export async function handleChargeSuccess(body: any, signature: string | null) {
  if (!signature || !verifySignature(JSON.stringify(body), signature)) {
    return { status: 401 as const, note: "bad signature" };
  }
  if (body.event !== "charge.success") return { status: 200 as const, note: "ignored event" };
  const d = body.data || {};
  const council: string | undefined = d.metadata?.council;
  if (d.metadata?.purpose !== "license_unlock" || !council) {
    return { status: 200 as const, note: "not a license payment" };
  }
  const amountPesewas = Number(d.amount);
  if (!Number.isFinite(amountPesewas) || amountPesewas < CHARGE_GHS * 100) {
    return { status: 200 as const, note: "amount below fee" };
  }

  const state = await getLicenseRow(council);
  if (!state) return { status: 200 as const, note: "unknown council" };
  // Only honor a reference we issued (blocks replayed foreign events)
  if (d.reference !== state.pendingRef) {
    return { status: 200 as const, note: "unknown reference" };
  }
  // Idempotency: already unlocked by this ref?
  if (state.licenseKey?.startsWith(`PS|${d.reference}|`)) {
    return { status: 200 as const, note: "already processed" };
  }

  const target = state.paidThrough + 100;
  const stamp = receiptStamp(council, d.reference, amountPesewas);
  await prisma.licenseState.update({
    where: { id: council },
    data: {
      paidThrough: target,
      licenseKey: stamp,
      lastPaymentAt: new Date(),
      pendingRef: null,
      pendingRefAt: null,
    },
  });
  await prisma.auditLog.create({
    data: {
      councilId: council,
      userId: null,
      action: "LICENSE_PAYSTACK_PAID",
      entityType: "license_state",
      entityId: null,
      details: { reference: d.reference, amountPesewas, channel: d.channel, unlockedThrough: target },
    },
  }).catch(() => {});
  return { status: 200 as const, note: "unlocked", council, target };
}

function verifySignature(raw: string, signature: string | null): boolean {
  if (!signature) return false;
  const hash = crypto.createHmac("sha512", secret()).update(raw, "utf8").digest("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// SCHEMA NOTE: pendingRef / pendingRefAt do not exist in the committed Prisma
// schema yet. They are added via raw SQL (see scripts/add-license-pending.sql)
// because prisma db push cannot run under RLS-scoped roles. The prisma client
// is regenerated so the fields typecheck; getLicenseRow uses the typed client.
// ---------------------------------------------------------------------------