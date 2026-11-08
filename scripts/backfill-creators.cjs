// Backfill: set createdBy=admin for existing adweso records (created before the ownership model)
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const admin = await p.appUser.findFirst({ where: { username: "admin", councilId: "adweso" } });
  const upd = await p.feePayer.updateMany({ where: { createdBy: null, councilId: "adweso" }, data: { createdBy: admin.id } });
  console.log("backfilled to admin:", upd.count);
  await p.$disconnect();
})();