// POST /api/signup-request — public; creates an ONBOARDING service request for
// the platform administrator. Rate-limited (same family as staff registration).
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, audit } from "@/lib/db";
import { loginRateCheck } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const org = String(body.org ?? "").trim();
    const contact = String(body.contact ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const note = String(body.note ?? "").trim().slice(0, 300);

    const errors: string[] = [];
    if (org.length < 3 || org.length > 120) errors.push("Institution name is required");
    if (contact.length < 3 || contact.length > 120) errors.push("Contact name is required");
    if (!/^[0-9+\s()-]{9,20}$/.test(phone)) errors.push("A valid phone number is required");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = loginRateCheck(`signup|${ip}`);
    if (!rl.ok)
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInMin} minutes.` },
        { status: 429 }
      );

    // dedupe: an institution's PENDING request is enough — no stacked rows
    const existing = await prisma.serviceRequest.findFirst({
      where: { kind: "ONBOARDING", status: "PENDING", note: `ORG:${org.toUpperCase()}` },
    });
    if (existing)
      return NextResponse.json(
        { error: "A request for this institution is already waiting with the platform administrator." },
        { status: 400 }
      );

    const r = await prisma.serviceRequest.create({
      data: {
        tenantId: tenantId(), // requests register to the master tenant; console reads all
        kind: "ONBOARDING",
        note: `ORG:${org.toUpperCase()} · CONTACT:${contact} · AREAS:${note.replace(/^Areas:\s*/i, "")}`,
        contactPhone: phone,
      },
    });

    await audit(null, "SIGNUP_REQUESTED", "service_request", r.id, { org, contact, ip });

    return NextResponse.json({
      ok: true,
      requestId: r.id,
      message:
        "Request received. The platform administrator will set up your workspace and send your admin login to this phone.",
    });
  } catch (e) {
    console.error("signup request error", e);
    return NextResponse.json({ error: "Could not send request" }, { status: 500 });
  }
}
