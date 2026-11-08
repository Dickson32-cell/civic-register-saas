
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
const pooled = new URL(readVar('NEW_OWNER_POOLED'));
const pw = 'civ_'+crypto.randomBytes(12).toString('hex');
(async()=>{
  const mk = (db) => new Client({ host: pooled.hostname, port: 5432,
    user: decodeURIComponent(pooled.username), password: decodeURIComponent(pooled.password),
    database: db, ssl: { rejectUnauthorized: false } });
  // admin on neondb: rotate/create civic_app
  const a = await mk('neondb'); await a.connect();
  const exists = await a.query("SELECT 1 FROM pg_roles WHERE rolname='civic_app'");
  if (exists.rowCount) { await a.query(`ALTER ROLE civic_app LOGIN PASSWORD '${pw}'`); console.log('civic_app password rotated'); }
  else { await a.query(`CREATE ROLE civic_app LOGIN PASSWORD '${pw}'`); console.log('civic_app created'); }
  await a.end();
  // grants on the target db
  const b = await mk('civic_platform'); await b.connect();
  for (const q of [
    `GRANT USAGE ON SCHEMA public TO civic_app`,
    `GRANT CONNECT ON DATABASE civic_platform TO civic_app`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO civic_app`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO civic_app`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO civic_app`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO civic_app`,
  ]) await b.query(q);
  console.log('grants applied on civic_platform');
  await b.end();
  upsertVar('DATABASE_URL_PLATFORM', `postgresql://civic_app:${pw}@ep-icy-wind-bdfabv5f-pooler.c-8.us-east-2.aws.neon.tech/civic_platform?sslmode=require`);
  upsertVar('OWNER_URL_DIRECT', `postgresql://neondb_owner:${decodeURIComponent(pooled.password)}@ep-icy-wind-bdfabv5f.c-8.us-east-2.aws.neon.tech/civic_platform?sslmode=require`);
  console.log('creds updated: DATABASE_URL_PLATFORM (civic_app pooler) + OWNER_URL_DIRECT (owner direct) -> NEW project');
})().catch(e=>{ console.error('ERR:', e.message.split('\n')[0]); process.exit(1); });
