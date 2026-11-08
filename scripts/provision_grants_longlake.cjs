
const fs = require('fs');
const { Client } = require('pg');
const credsFile = 'E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt';
function readVar(name){
  const t = fs.readFileSync(credsFile,'utf8');
  const m = t.match(new RegExp('^\\s*'+name+'\\s*=\\s*"([^"]+)"','m'));
  return m ? m[1].trim() : null;
}
const pooledCivic = readVar('NEW_OWNER_POOLED').replace('/neondb', '/civic_platform');
(async()=>{
  const c = new Client({ connectionString: pooledCivic });
  await c.connect();
  await c.query(`GRANT USAGE ON SCHEMA public TO civic_app`);
  await c.query(`GRANT CONNECT ON DATABASE civic_platform TO civic_app`);
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO civic_app`);
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON SEQUENCES TO civic_app`);
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO civic_app`);
  await c.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO civic_app`);
  console.log('grants done on civic_platform via pooled endpoint');
  const who = await c.query('SELECT current_user, current_database()');
  console.log('connected as', who.rows[0].current_user, 'on', who.rows[0].current_database);
  await c.end();
})().catch(e=>{ console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
