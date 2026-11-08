
const {PrismaClient}=require('@prisma/client');const fs=require('fs');
const t = fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/civic-platform/.env','utf8');
const line = t.split(/\r?\n/).find(l => l.startsWith('MASTER_DATABASE_URL'));
const p=new PrismaClient({datasources:{db:{url:line.slice(line.indexOf('=')+1).replace(/"/g,'')}}});
(async()=>{
  const real = ['civicdemo'];
  const u = await p.appUser.deleteMany({ where:{ tenantId:{ notIn: real } } });
  console.log('orphan users deleted:', u.count);
  const r = await p.feePayer.deleteMany({ where:{ tenantId:{ notIn: real } } });
  console.log('orphan records deleted:', r.count);
  const s = await p.$executeRawUnsafe(`DELETE FROM serial_counter WHERE tenant_id <> 'civicdemo'`);
  console.log('orphan serial counters deleted:', s);
  const fin = await p.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM tenant) t, (SELECT count(*)::int FROM app_user) u, (SELECT count(*)::int FROM fee_payer) r`);
  console.log('FINAL:', JSON.stringify(fin[0]));
  await p.$disconnect();
})().catch(e=>{console.error('ERR', e.message.split('\n')[0]); process.exit(1);});
