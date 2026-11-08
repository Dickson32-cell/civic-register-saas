// Admin page — Interface: this workspace's look. Name + colour are free;
// logo and the bill designer open with the paid brand service.
import { redirect } from "next/navigation";
import { sTid, getSession } from "@/lib/auth";
import { getFullUser, prisma, tenantId } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import InterfacePanel from "./InterfacePanel";

export default async function AdminInterfacePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers) redirect("/");

  const tenant = (await prisma.tenant.findUnique({
    where: { id: sTid(session) },
    select: { name: true, colour: true, logoDataUrl: true, brandingUnlocked: true, billHeadingOverride: true, billFooterNote: true, billTitle: true, billLegal1: true, billLegal2: true, billStampCaption: true },
  })) ?? null;

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={permsFor(me.role, me.adminLevel).canReviewPasswords} />
      <main className="main">
        <InterfacePanel
          name={tenant?.name ?? ""}
          colour={tenant?.colour ?? "#1c3f6e"}
          logoDataUrl={tenant?.logoDataUrl ?? null}
          brandingUnlocked={tenant?.brandingUnlocked ?? false}
          billHeading={tenant?.billHeadingOverride ?? ""}
          billFooter={tenant?.billFooterNote ?? ""}
          currentBillTitle={tenant?.billTitle ?? ""}
          currentBillLegal1={tenant?.billLegal1 ?? ""}
          currentBillLegal2={tenant?.billLegal2 ?? ""}
          currentBillStamp={tenant?.billStampCaption ?? ""}
        />
      </main>
    </div>
  );
}
