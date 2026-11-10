// POST /api/workspace/signup — SELF-SERVE workspace creation.
// A company creates its own account with its own secured password — instantly,
// with no approval step and no platform console. Each company lands in its own
// isolated workspace: users, records and branding never cross companies.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, createSessionToken, audit } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { loginRateCheck } from "@/lib/rateLimit";

function slugOf(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "workspace";
  return base;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { org, contact, phone, areas, colour, logoDataUrl, username, password, password2 } = body;

    const errors: string[] = [];
    const cleanOrg = typeof org === "string" ? org.trim() : "";
    const cleanContact = typeof contact === "string" ? contact.trim() : "";
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    const cleanUser = typeof username === "string" ? username.trim() : "";
    if (!cleanOrg || cleanOrg.length < 3 || cleanOrg.length > 120)
      errors.push("Company / institution name must be 3-120 characters");
    if (!cleanContact || cleanContact.length < 3 || cleanContact.length > 120)
      errors.push("Administrator name is required");
    if (!cleanPhone || !/^[0-9+\s()-]{9,20}$/.test(cleanPhone))
      errors.push("A valid phone number is required (your login details go there)");
    if (!cleanUser || !/^[a-zA-Z0-9._-]{3,30}$/.test(cleanUser))
      errors.push("Choose a username of 3-30 characters (letters, numbers, . _ -)");
    if (!password || typeof password !== "string" || password.length < 8)
      errors.push("Password must be at least 8 characters");
    if (password !== password2)
      errors.push("The two passwords do not match");
    if (typeof logoDataUrl === "string" && logoDataUrl.length > 400_000)
      errors.push("Logo must be under about 300KB — try a smaller image");
    if (colour && !/^#[0-9a-fA-F]{6}$/.test(colour))
      errors.push("Choose one of the interface colours");
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = loginRateCheck(`ws|${ip}`);
    if (!rl.ok)
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${rl.retryInMin} minutes.` },
        { status: 429 }
      );

    const existing = await prisma.appUser.findUnique({ where: { username: cleanUser } });
    if (existing)
      return NextResponse.json({ errors: ["That username is already taken — pick another"] }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);
    const colourFixed = typeof colour === "string" ? colour : "#1c3f6e";

    // Build the tenant id from the organisation name; uniqueness is guaranteed
    // by the Prisma primary key (suffix on collision).
    let tenantIdNew = slugOf(cleanOrg);
    if (await prisma.tenant.findUnique({ where: { id: tenantIdNew } })) {
      tenantIdNew = `${tenantIdNew.slice(0, 8)}-${Date.now().toString(36).slice(-5)}`;
    }

    // Areas: accept a comma/newline string (the form's own text field) OR an
    // array of strings / {area} objects from integrations — never "[object Object]".
    const areaList: string[] = (
      Array.isArray(areas)
        ? areas.map((a: unknown) => (typeof a === "string" ? a : (a as { area?: string })?.area ?? ""))
        : String(areas || "")
            .split(/[,;\n]/)
    )
      .map((a: unknown) => String(a ?? "").trim())
      .filter(Boolean)
      .slice(0, 40);
    // Areas live on the tenant (areas JSON) and each gets a serial counter so
    // every serial code (e.g. CENT/ 01) exists from the first record.
    const areaEntries = areaList.map((a) => {
      const short = a.replace(/[^a-zA-Z ]/g, "").trim();
      const code = (short.split(/\s+/).map((w: string) => w[0] || "").join("").toUpperCase() || "AREA").slice(0, 4);
      return { area: a, code };
    });

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantIdNew,
        name: cleanOrg,
        template: "FEE_REGISTER",
        colour: colourFixed,
        ownerName: cleanContact,
        status: "ACTIVE", // self-serve: workspace lives from day one; data collection is free forever
        areas: areaEntries,
        staffSeatLimit: 2,
        brandingUnlocked: false,
      },
    });


    await prisma.serialCounter.createMany({
      data: areaEntries.map((e) => ({ tenantId: tenant.id, electoralArea: e.area, lastNumber: 0 })),
    });

    const user = await prisma.appUser.create({
      data: {
        tenantId: tenant.id,
        username: cleanUser,
        passwordHash: hash,
        fullName: cleanContact,
        role: "ADMIN",
        adminLevel: "FULL",
        active: true,
        approvedAt: new Date(),
      },
    });

    if (typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:image/")) {
      // The company already sent its logo — park it as a branding upgrade request
      // so the team can unlock the paid brand service after payment; nothing is
      // applied to the workspace until then.
      await prisma.serviceRequest.create({
        data: {
          tenantId: tenant.id,
          kind: "BRANDING",
          note: `ORG:${cleanOrg} · CONTACT:${cleanContact}`,
          contactPhone: cleanPhone,
          assetDataUrl: logoDataUrl,
        },
      });
    }

    await audit(null, "WORKSPACE_CREATED", "tenant", null, { org: cleanOrg, tenantId: tenant.id, username: cleanUser, ip }, tenant.id);

    const token = await createSessionToken(user.id, user.username, user.role, user.tenantId);
    const res = NextResponse.json({
      ok: true,
      message: "Workspace ready. You are signed in as its administrator — start collecting, it is free.",
      tenant: { id: tenant.id, name: tenant.name },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return res;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002")
      return NextResponse.json({ errors: ["That username is already taken — pick another"] }, { status: 400 });
    console.error("workspace signup error", e);
    return NextResponse.json({ error: "Could not create the workspace" }, { status: 500 });
  }
}
