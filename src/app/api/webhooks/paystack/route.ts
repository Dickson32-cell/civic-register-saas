// PAYSTACK WEBHOOK — POST /api/webhooks/paystack
// Configure in the Paystack dashboard: https://<adweso-domain>/api/webhooks/paystack
// Verifies the x-paystack-signature HMAC-SHA512 header before touching anything.
import { NextRequest, NextResponse } from "next/server";
import { handleChargeSuccess } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  const raw = await req.text(); // raw body — signature is computed over it
  const signature = req.headers.get("x-paystack-signature");
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const result = await handleChargeSuccess(body, signature);
  return NextResponse.json({ ok: result.status === 200, note: (result as any).note }, { status: result.status });
}