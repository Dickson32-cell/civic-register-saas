// GET  /api/license — current license status (any logged-in user)
// POST /api/license — submit an unlock key (any logged-in user; the key itself
//                      is the authority — it only works if genuinely issued for
//                      THIS company's registration tier)
import { NextRequest, NextResponse } from "next/server";
import { licenseStatus, applyUnlockKey } from "@/lib/license";
import { paystackConfigured } from "@/lib/paystack";
import { getSession, sTid } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ...(await licenseStatus(sTid(session))), onlinePay: paystackConfigured() });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await req.json().catch(() => ({ key: "" }));
  if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });
  const result = await applyUnlockKey(sTid(session), String(key));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true, paidThrough: result.paidThrough, status: await licenseStatus(sTid(session)) });
}
