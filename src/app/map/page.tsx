// /map — plot the register on a map (public-facing shell guarded by session).
// Read-only: it consumes /api/records/list (same auth + viewer-area scoping as
// the register) and writes NOTHING to the database.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "../TopBar";
import MapClient from "../MapClient";

export const metadata = { title: "Map - Adweso Zonal Council Register" };

export default async function MapPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !me.active) redirect("/login");

  const perms = permsFor(me.role, me.adminLevel);

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={perms.canReviewPasswords} />
      <main className="main">
        <MapClient isAdmin={me.role === "ADMIN"} />
      </main>
    </div>
  );
}