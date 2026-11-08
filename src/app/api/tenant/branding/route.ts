// GET  /api/tenant/branding — current branding (login page reads it without auth:
// the logo/name are public parts of the institution's sign-in screen)
// POST /api/tenant/branding — set logo (PAID service) or name/colour (free), admin only
import { NextRequest, NextResponse } from "next/server";
import { prisma, tenantId, getFullUser } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { permsFor } from "@/lib/perms";

const MAX_LOGO_BYTES = 300_000; // ~300KB decoded cap

export async function GET() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId() },
    select: { name: true, logoDataUrl: true, colour: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    name: tenant.name,
    logoDataUrl: tenant.logoDataUrl ?? null,
    colour: tenant.colour,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers)
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  try {
    const { logoDataUrl, colour, name, billHeading, billFooter } = await req.json();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId() },
      select: { brandingUnlocked: true, logoDataUrl: true },
    });

    const data: Record<string, string> = {};

    // free: institution display name
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length < 2 || n.length > 120)
        return NextResponse.json({ error: "Name must be 2-120 characters" }, { status: 400 });
      data.name = n;
    }

    // free: interface colour
    if (colour !== undefined) {
      if (typeof colour !== "string" || !/^#[0-9a-fA-F]{6}$/.test(colour))
        return NextResponse.json({ error: "Colour must be a hex value like #1c3f6e" }, { status: 400 });
      data.colour = colour;
    }

    // PAID: bill designer text fields (gate = branding service)
    if (billHeading !== undefined || billFooter !== undefined) {
      if (!tenant?.brandingUnlocked)
        return NextResponse.json(
          { error: "The bill designer is a paid service. Request it under Admin > Services." },
          { status: 403 }
        );
      if (billHeading !== undefined) {
        const h = typeof billHeading === "string" ? billHeading.trim().slice(0, 120) : "";
        data.billHeadingOverride = h; // empty string = fall back to institution name
      }
      if (billFooter !== undefined) {
        const f = typeof billFooter === "string" ? billFooter.trim().slice(0, 200) : "";
        data.billFooterNote = f;
      }
    }

    if (logoDataUrl !== undefined) {
      const isDataUrl = typeof logoDataUrl === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(logoDataUrl);
      if (!logoDataUrl) {
        // removal only allowed to replace, not strip an unlocked asset
        if (!tenant?.brandingUnlocked) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
        data.logoDataUrl = null as unknown as string;
      } else if (isDataUrl) {
        const bytes = Math.ceil(((logoDataUrl.length - (logoDataUrl.indexOf(",") + 1)) * 3) / 4);
        if (bytes > MAX_LOGO_BYTES)
          return NextResponse.json({ error: "Logo must be under 300KB (PNG/JPG)" }, { status: 400 });
        if (!tenant?.brandingUnlocked) {
          return NextResponse.json(
            { error: "Custom logo is a paid service. Request it under Admin > Services." },
            { status: 403 }
          );
        }
        data.logoDataUrl = logoDataUrl;
      } else {
        return NextResponse.json({ error: "Logo must be a PNG/JPG image" }, { status: 400 });
      }
    }

    if (colour !== undefined) {
      if (typeof colour !== "string" || !/^#[0-9a-fA-F]{6}$/.test(colour))
        return NextResponse.json({ error: "Colour must be a hex value like #1c3f6e" }, { status: 400 });
      data.colour = colour;
    }

    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    await prisma.tenant.update({ where: { id: tenantId() }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("branding update error", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
