// POST /api/signup-request — public; creates a workspace request for the
// platform administrator, with the institution's interface choices attached
// (name, colour, optional logo). Rate-limited (same family as staff registration).
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, audit } from "@/lib/db";
import { loginRateCheck } from "@/lib/rateLimit";

const MAX_LOGO_BYTES = 300_000;

function logoBytes(logoDataUrl: string): number {
  const base64 = logoDataUrl.slice(logoDataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const org = String(body.org ?? "").trim();
    const contact = String(body.contact ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const areas = String(body.areas ?? "").trim().slice(0, 200);
    const colour = String(body.colour ?? "").trim();
    const logoDataUrl = typeof body.logoDataUrl === "string" ? body.logoDataUrl.trim() : "";

    const errors: string[] = [];
    if (org.length < 3 || org.length > 120) errors.push("Institution name is required");
    if (contact.length < 3 || contact.length > 120) errors.push("Contact name is required");
    if (!/^[0-9+\s()-]{9,20}$/.test(phone)) errors.push("A valid phone number is required");
    if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour)) errors.push("Colour must be a hex value like #1c3f6e");
    if (logoDataUrl) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(logoDataUrl)) errors.push("Logo must be a PNG/JPG image");
      else if (logoBytes(logoDataUrl) > MAX_LOGO_BYTES) errors.push("Logo must be under 300KB");
    }
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = loginRateCheck(`signup|${ip}`);
    if (!rl.ok)
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInMin} minutes.` },
        { status: 429 }
      );

    // dedupe: one open request per institution
    const key = `ORG:${org.toUpperCase()}`;
    const existing = await prisma.serviceRequest.findFirst({
      where: { status: "PENDING", note: { contains: key } },
    });
    if (existing)
      return NextResponse.json(
        { error: "A request for this institution is already waiting with the platform administrator." },
        { status: 400 }
      );

    const noteParts = [`ORG:${org.toUpperCase()}`, `CONTACT:${contact}`];
    if (colour) noteParts.push(`COLOUR:${colour}`);
    if (areas) noteParts.push(`AREAS:${areas}`);

    const r = await prisma.serviceRequest.create({
      data: {
        tenantId: tenantId(),
        kind: logoDataUrl ? "BRANDING" : "ONBOARDING",
        note: noteParts.join(" · "),
        contactPhone: phone,
        assetDataUrl: logoDataUrl || null,
      },
    });

    await audit(null, "SIGNUP_REQUESTED", "service_request", r.id, { org, contact, ip });

    return NextResponse.json({
      ok: true,
      requestId: r.id,
      message:
        "Request received. The platform administrator will set up your workspace with your colours" +
        (logoDataUrl ? ", your logo " : " ") +
        "and send your admin login to this phone.",
    });
  } catch (e) {
    console.error("signup request error", e);
    return NextResponse.json({ error: "Could not send request" }, { status: 500 });
  }
}
