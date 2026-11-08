
const {PrismaClient}=require('@prisma/client');const fs=require('fs');
const url=(fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/civic-platform/.env','utf8').match(/MASTER_DATABASE_URL=(.*)/)||[])[1];
const p=new PrismaClient({datasources:{db:{url}}});
(async()=>{
  await p.$executeRawUnsafe(`DELETE FROM serial_counter WHERE tenant_id NOT IN (SELECT id::varchar(24) FROM tenant)`);
  await p.$executeRawUnsafe(`DELETE FROM serial_release WHERE tenant_id NOT IN (SELECT id::varchar(24) FROM tenant)`);
  await p.$executeRawUnsafe(`DELETE FROM serial_release WHERE tenant_id IS NULL OR tenant_id = ''`);
  const left = await p.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM serial_release) AS releases, (SELECT count(*)::int FROM tenant) AS tenants, (SELECT count(*)::int FROM app_user) AS users`);
  console.log('final state:', JSON.stringify(left[0]));
  await p.$disconnect();
})().catch(e=>{console.error('ERR', e.message.split('\n')[0]); process.exit(1);});
