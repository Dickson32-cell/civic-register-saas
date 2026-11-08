
/* Provision civic_platform DB + civic_app role on the NEW Neon project
   (long-lake-21391387). Reads owner creds from PLATFORM-CREDS-LOCAL.txt
   (gitignored). Never prints secrets. CREATE DATABASE needs pg outside tx. */
const fs = require('fs'); const crypto = require('crypto');
const { Client } = require('pg');
const credsFile = 'E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt';
function readVar(name){
  const t = fs.readFileSync(credsFile,'utf8');
  const m = t.match(new RegExp('^\\s*'+name+'\\s*=\\s*"([^"]+)"','m'));
  return m ? m[1].trim() : null;
}
function upsertVar(name, val){
  let t = fs.readFileSync(credsFile,'utf8');
  const re = new RegExp('^\\s*'+name+'\\s*=.*$','m');
  const line = name+'="'+val+'"';
  if (re.test(t)) t = t.replace(re, line); else t = t.trimEnd()+'\n'+line+'\n';
  fs.writeFileSync(credsFile, t);
}
const direct = readVar('NEW_OWNER_URL_DIRECT');
const pw = 'civ_'+crypto.randomBytes(12).toString('hex');
(async()=>{
  const c = new Client({connectionString: direct});
  await c.connect();
  const dbExists = await c.query("SELECT 1 FROM pg_database WHERE datname='civic_platform'");
  if (!dbExists.rowCount) { await c.query('CREATE DATABASE civic_platform'); console.log('DB civic_platform created'); }
  else console.log('DB civic_platform exists');
  const roleExists = await c.query("SELECT 1 FROM pg_roles WHERE rolname='civic_app'");
  if (roleExists.rowCount) {
    await c.query(`ALTER ROLE civic_app LOGIN PASSWORD '${pw}'`);
    console.log('role civic_app exists: password rotated');
  } else {
    await c.query(`CREATE ROLE civic_app LOGIN PASSWORD '${pw}'`);
    console.log('role civic_app created');
  }
  await c.end();
  // grants must run inside the new database
  const c2 = new Client({connectionString: direct.replace('/neondb','/civic_platform')});
  await c2.connect();
  await c2.query(`GRANT USAGE ON SCHEMA public TO civic_app`);
  await c2.query(`GRANT CONNECT ON DATABASE civic_platform TO civic_app`);
  await c2.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO civic_app`);
  await c2.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON SEQUENCES TO civic_app`);
  await c2.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO civic_app`);
  await c2.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO civic_app`);
  console.log('grants done');
  await c2.end();
  // write app + owner URLs for the new project (pooler for app runtime, direct for schema work)
  upsertVar('DATABASE_URL_PLATFORM', `postgresql://civic_app:${pw}@ep-icy-wind-bdfabv5f-pooler.c-8.us-east-2.aws.neon.tech/civic_platform?sslmode=require`);
  upsertVar('OWNER_URL_DIRECT', `postgresql://neondb_owner:${direct.replace(/^postgresql:\/\/neondb_owner:([^@]+)@.*$/, '$1')}@ep-icy-wind-bdfabv5f.c-8.us-east-2.aws.neon.tech/civic_platform?sslmode=require`);
  console.log('creds file updated: DATABASE_URL_PLATFORM + OWNER_URL_DIRECT now point at the NEW project');
})().catch(e=>{ console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
