// LICENSE PAYMENT ROUTE — council side.
// GET  /api/license/pay  -> status + (when locked & Paystack configured) a hosted checkout URL
// GET  /api/license/verify?reference=... -> poll Paystack after the browser returns from checkout
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  LICENSE_FEE_USD, CHARGE_GHS, USD_GHS_RATE,
  initLicensePayment, paystackConfigured, getLicenseRow,
} from "@/lib/paystack";
import { prisma } from "@/lib/db";
import { licenseStatus } from "@/lib/license";

const COUNCIL_ID = process.env.COUNCIL_ID || "adweso";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);

  // --- verify: browser returned from Paystack with ?reference=...
  const reference = url.searchParams.get("reference");
  if (reference) {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}` },
    });
    const data = await res.json();
    const d = data?.data;
    const row = await getLicenseRow(COUNCIL_ID);
    const alreadyUnlocked = row?.licenseKey?.startsWith(`PS|${reference}|`);
    if (data?.status && d?.status === "success" && d?.metadata?.council === COUNCIL_ID && d.metadata?.purpose === "license_unlock") {
      // Webhook is the primary unlocker; verify is a same-session fallback so
      // the council sees success immediately even if the webhook lags seconds.
      if (!alreadyUnlocked && row && d.amount >= CHARGE_GHS * 100 && d.reference === row.pendingRef) {
        const crypto = await import("crypto");
        const mac = crypto
          .createHmac("sha256", process.env.LICENSE_SECRET || "")
          .update(`${COUNCIL_ID}|${d.reference}|${d.amount}`)
          .digest("hex").slice(0, 16).toUpperCase();
        await prisma.licenseState.update({
          where: { id: COUNCIL_ID },
          data: {
            paidThrough: row.paidThrough + 100,
            licenseKey: `PS|${d.reference}|${mac}`,
            lastPaymentAt: new Date(),
            pendingRef: null,
            pendingRefAt: null,
          },
        });
        await prisma.auditLog.create({
          data: {
            councilId: COUNCIL_ID, userId: null,
            action: "LICENSE_PAYSTACK_PAID", entityType: "license_state", entityId: null,
            details: { via: "callback-verify", reference: d.reference, amountPesewas: d.amount, channel: d.channel },
          },
        }).catch(() => {});
      }
      const status = await licenseStatus();
      return NextResponse.json({ paid: true, status });
    }
    return NextResponse.json({ paid: false, error: "Payment not confirmed yet", gatewayStatus: d?.status ?? "unknown" }, { status: 402 });
  }

  // --- initiate: hand back a Paystack checkout URL
  if (!paystackConfigured()) {
    return NextResponse.json({ error: "Online payment not configured yet. Contact the system provider." }, { status: 503 });
  }
  const status = await licenseStatus();
  if (!status.locked) {
    return NextResponse.json({ error: "Register is not locked — no payment due." }, { status: 400 });
  }
  try {
    const { authorizationUrl, reference: ref } = await initLicensePayment(COUNCIL_ID);
    return NextResponse.json({ authorizationUrl, reference: ref, feeUSD: LICENSE_FEE_USD, feeGHS: CHARGE_GHS, rate: USD_GHS_RATE });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Payment initialization failed" }, { status: 502 });
  }
}