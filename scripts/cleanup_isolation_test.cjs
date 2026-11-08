
const {PrismaClient}=require('@prisma/client');const fs=require('fs');
const url=(fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/civic-platform/.env','utf8').match(/MASTER_DATABASE_URL=(.*)/)||[])[1];
const p=new PrismaClient({datasources:{db:{url}}});
(async()=>{
  const t = await p.tenant.findUnique({ where:{id:'isolationtestco'} });
  if (t) { await p.tenant.delete({ where:{id:'isolationtestco'} }); console.log('partial tenant B deleted (cascade)'); }
  else console.log('no partial tenant');
  const u = await p.appUser.deleteMany({ where:{username:{in:['beeadmin','beestaff1','beestaff9','beestaffx','xadmin1']}} });
  console.log('stray users deleted:', u.count);
  const sr = await p.serviceRequest.deleteMany({ where:{note:{contains:'Isolation Test'}} });
  console.log('stray service requests deleted:', sr.count);
  await p.$disconnect();
})();
