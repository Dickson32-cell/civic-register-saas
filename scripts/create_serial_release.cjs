
const {PrismaClient}=require('@prisma/client');const fs=require('fs');
const url=(fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt','utf8').match(/^OWNER_URL_DIRECT=["']?([^"'\r\n]+)["']?/m)||[])[1];
const p=new PrismaClient({datasources:{db:{url}}});
(async()=>{
  await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS serial_release (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id varchar(24) NOT NULL,
    electoral_area varchar(40) NOT NULL,
    serial_number varchar(30) NOT NULL,
    number integer NOT NULL DEFAULT 0,
    status varchar(12) NOT NULL DEFAULT 'AVAILABLE',
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS serial_release_unique_serial ON serial_release (tenant_id, serial_number)`);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS serial_release_lookup ON serial_release (tenant_id, electoral_area, status)`);
  console.log('serial_release table ready in civic_platform');
  await p.$disconnect();
})().catch(e=>{console.error('ERR', e.message.split('\n')[0]); process.exit(1);});
