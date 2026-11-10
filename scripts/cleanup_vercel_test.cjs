
const {PrismaClient}=require('@prisma/client');const fs=require('fs');
const t = fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt','utf8');
const line = t.split(/\r?\n/).find(l => l.startsWith('OWNER_URL_DIRECT='));
const p=new PrismaClient({datasources:{db:{url:line.slice(line.indexOf('=')+1).replace(/"/g,'')}}});
(async()=>{
  const tenants = await p.tenant.findMany({where:{name:{in:['Vercel Live Test Ltd']}}, select:{id:true,name:true}});
  for (const o of tenants) await p.tenant.delete({where:{id:o.id}}).catch(()=>{});
  const u = await p.appUser.deleteMany({where:{username:'verceladmin'}});
  const r = await p.$executeRawUnsafe(`DELETE FROM fee_payer WHERE name = 'Vercel Probe Shop'`);
  await p.$executeRawUnsafe(`DELETE FROM serial_counter WHERE electoral_area='Riverside' AND tenant_id NOT IN (SELECT id::varchar(24) FROM tenant)`);
  console.log('test tenant removed:', tenants.length, '| test user removed:', u.count, '| test records removed:', r);
  const fin = await p.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM tenant) t, (SELECT count(*)::int FROM app_user) u, (SELECT count(*)::int FROM fee_payer) r`);
  console.log('CLEAN STATE:', JSON.stringify(fin[0]));
  await p.$disconnect();
})().catch(e=>{console.error('ERR', e.message.split('\n')[0]);});
