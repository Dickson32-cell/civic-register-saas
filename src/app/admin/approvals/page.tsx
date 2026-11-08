// Admin page — the APPROVALS CENTER: one screen for every queue that needs a decision.
// Staff signups (needs canManageUsers), record-edit requests (canReviewEdits),
// password-change requests (canReviewPasswords). ADMIN only.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import ApprovalsCenter from "./ApprovalsCenter";

export default async function AdminApprovalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || me.role !== "ADMIN") redirect("/");

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={permsFor(me.role, me.adminLevel).canReviewPasswords} />
      <main className="main">
        <ApprovalsCenter />
      </main>
    </div>
  );
}
