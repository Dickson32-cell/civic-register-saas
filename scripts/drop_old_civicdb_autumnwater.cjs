
/* Drop civic_platform + civic_app from the OLD councils' project — as the
   project OWNER (creds from ROTATED-CREDENTIALS-LOCAL.txt, host from the .env). */
const fs = require('fs');
const { Client } = require('pg');
const repo = 'E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register';
const envT = fs.readFileSync(repo + '/.env', 'utf8');
const base = envT.match(/^DATABASE_URL=.*$/m)[0].split('=').slice(1).join('=').replace(/"/g,'').trim();
const u = new URL(base);
function readRolePw(file, role){
  const t = fs.readFileSync(file,'utf8');
  for (const line of t.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    if (s.slice(0,i).trim() === role) return s.slice(i+1).trim();
  }
  return null;
}
const ownerPw = readRolePw(repo + '/ROTATED-CREDENTIALS-LOCAL.txt', 'neondb_owner');
const ownerDsn = `postgresql://neondb_owner:${ownerPw}@${u.hostname}/neondb?sslmode=require`;
(async()=>{
  const c = new Client({ connectionString: ownerDsn });
  await c.connect();
  const who = await c.query('SELECT current_user');
  console.log('connected as:', who.rows[0].current_user);
  const ex = await c.query(`SELECT 1 FROM pg_database WHERE datname='civic_platform'`);
  if (ex.rowCount) {
    await c.query(`DROP DATABASE civic_platform WITH (FORCE)`);
    console.log('civic_platform DROPPED from councils project');
  } else console.log('civic_platform already gone');
  const rx = await c.query(`SELECT 1 FROM pg_roles WHERE rolname='civic_app'`);
  if (rx.rowCount) {
    await c.query(`DROP OWNED BY civic_app`);
    await c.query(`DROP ROLE civic_app`);
    console.log('civic_app role DROPPED');
  } else console.log('civic_app role already gone');
  await c.end();
})().catch(e=>{ console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
