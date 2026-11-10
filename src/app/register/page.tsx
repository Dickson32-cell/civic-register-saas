// Staff join page — resolves the company from the shared link's ?c=<tenantId>
// and shows its name + logo, so staff always see WHOSE workspace they are joining.
import { prisma } from "@/lib/db";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const code = typeof sp.c === "string" ? sp.c : "";
  let tenantName = "";
  let logo: string | null = null;
  if (/^[a-z0-9-]{4,40}$/.test(code)) {
    const t = await prisma.tenant.findUnique({ where: { id: code }, select: { name: true, logoDataUrl: true } });
    if (t) {
      tenantName = t.name;
      logo = t.logoDataUrl ?? null;
    }
  }

  // Malformed / unknown link — never a silent dead end.
  if (!tenantName) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CivicData logo" className="logo-lg" />
          <h1>This registration link is not valid</h1>
          <p>Ask your administrator to send you the official staff sign-up link for your organisation.</p>
          <a href="/" className="btn btn-primary" style={{ width: "100%" }}>Go to CivicData</a>
        </div>
      </div>
    );
  }

  return <RegisterForm tenantName={tenantName} logoDataUrl={logo} />;
}
