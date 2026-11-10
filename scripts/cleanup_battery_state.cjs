const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: process.env.DSN } }, log: [] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  for (let i = 1; i <= 40; i++) {   // ~40 min of patience, then give up quietly
    try {
      const t = await p.tenant.findUnique({ where: { id: "exportprobe" } });
      await p.tenant.update({ where: { id: "civicdemo" }, data: { staffSeatLimit: 2 } });
      if (t) {
        await p.feePayer.deleteMany({ where: { tenantId: "exportprobe" } });
        await p.serialCounter.deleteMany({ where: { tenantId: "exportprobe" } });
        await p.serialRelease.deleteMany({ where: { tenantId: "exportprobe" } });
        const u = await p.appUser.findFirst({ where: { username: "exportprobe" } });
        if (u) await p.appUser.delete({ where: { id: u.id } });
        await p.tenant.delete({ where: { id: "exportprobe" } });
        console.log("BATTERY-CLEANUP-DONE-THROWAWAY-REMOVED");
      }
      console.log("SEATS-RESTORED-2; app_users", await p.appUser.count(), "tenants", await p.tenant.count());
      await p.$disconnect();
      process.exit(0);
    } catch (e) {
      console.log(`attempt ${i}: unreachable, waiting...`);
      await sleep(60000);
    }
  }
  console.log("BATTERY-CLEANUP-ABANDONED");
  process.exit(1);
})();
