
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
const c = new Client({ connectionString: `postgresql://neondb_owner:${ownerPw}@${u.hostname}/neondb?sslmode=require` });
(async()=>{
  await c.connect();
  try {
    await c.query(`REVOKE ALL PRIVILEGES ON DATABASE neondb FROM civic_app`);
    await c.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM civic_app`);
    await c.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM civic_app`);
    await c.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM civic_app`);
    await c.query(`ALTER ROLE civic_app NOLOGIN`);
    await c.query(`DROP ROLE civic_app`);
    console.log('civic_app role DROPPED from councils project');
  } catch (e) {
    console.log('role drop note:', e.message.split('\n')[0]);
    // if it still owns something in a dropped db — force via pg_terminate + reassign is overkill;
    // check remaining dependencies
    const dep = await c.query(`SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname='civic_app'`);
    console.log('role state:', dep.rows[0] ? JSON.stringify(dep.rows[0]) : 'gone entirely');
  }
  const dbs = await c.query(`SELECT count(*)::int AS n FROM pg_database WHERE datname='civic_platform'`);
  console.log('civic_platform databases remaining on councils project:', dbs.rows[0].n);
  await c.end();
})().catch(e=>{ console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
