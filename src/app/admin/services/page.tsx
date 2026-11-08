// Admin page — Services: what's free, what each paid service does, request buttons,
// and the status of every request this institution has made.
import { redirect } from "next/navigation";
import { getSession, sTid } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import ServicesPanel from "./ServicesPanel";

export default async function AdminServicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers) redirect("/");

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={permsFor(me.role, me.adminLevel).canReviewPasswords} />
      <main className="main">
        <ServicesPanel tenantId={sTid(session)} />
      </main>
    </div>
  );
}
