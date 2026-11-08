import { PrismaClient } from "@prisma/client";

// MASTER-VIEWER CONNECTION — used ONLY by /api/master and /api/master/export.
// Read-only Postgres role (master_viewer): BYPASSRLS so the owner's console
// sees every council's rows, but the role physically cannot INSERT/UPDATE/
// DELETE (verified: permission denied). Council deployments never get this
// env var, so their staff/admin paths keep full RLS isolation.
declare global {
  // eslint-disable-next-line no-var
  var masterPrisma: PrismaClient | undefined;
}

export const masterPrisma =
  global.masterPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url: process.env.MASTER_DATABASE_URL?.includes("connection_limit")
          ? process.env.MASTER_DATABASE_URL
          : process.env.MASTER_DATABASE_URL + "&connection_limit=5&pool_timeout=20",
      },
    },
  });

if (process.env.NODE_ENV !== "production") global.masterPrisma = masterPrisma;
