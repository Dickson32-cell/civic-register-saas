// Home — signed-out visitors get the public landing; signed-in users get the register.
import { redirect } from "next/navigation";
import { sTid, getSession } from "@/lib/auth";
import { getFullUser, tenantId, prisma } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import RegisterTable from "./RegisterTable";
import SmsPanel from "./SmsPanel";
import LicenseGate from "./LicenseGate";
import TopBar from "./TopBar";
import Landing from "./Landing";

export default async function HomePage() {
  const session = await getSession();

  // PUBLIC LANDING — the product is shown first; sign-in and staff signup
  // surface where they belong, not as a wall.
  if (!session) return <Landing />;

  const me = await getFullUser(session);
  if (!me || !me.active) redirect("/login");

  const perms = permsFor(me.role, me.adminLevel);
  const tenant = (await prisma.tenant.findUnique({
    where: { id: sTid(session) },
    select: { logoDataUrl: true, areas: true },
  })) ?? null;

  const rawAreas: { area: string; code?: string | null }[] =
    tenant && Array.isArray((tenant as { areas?: unknown }).areas)
      ? ((tenant as { areas: unknown }).areas as { area: string; code?: string | null }[]).map((a) => ({ area: a.area, code: a.code ?? null }))
      : [];
  const areasForRegister = rawAreas.length ? rawAreas : [];
  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={perms.canReviewPasswords} logoDataUrl={tenant?.logoDataUrl ?? null} />
      <main className="main">
        {sTid(session) === "adweso" && perms.canManageUsers === true && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <SmsPanel allowed={true} />
          </div>
        )}
        <RegisterTable
          areas={areasForRegister}
          isAdmin={me.role === "ADMIN"}
          moneyVisible={perms.canViewMoneyTotals}
          canDelete={perms.canDeleteRecords}
          canEditDirect={perms.canEditRecords}
          canCreate={perms.canCreateRecords}
          canPay={perms.canRecordPayments}
          smsSendable={sTid(session) === "adweso" && perms.canManageUsers === true}
          currentUsername={me.username}
        />
        <LicenseGate />
      </main>
    </div>
  );
}