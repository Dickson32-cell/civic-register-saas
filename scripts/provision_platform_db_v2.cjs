/* Provision the CivicData platform database (one-time, idempotent) — v2 REWRITE.
   Creates: database civic_platform + role civic_app (full grants) + UTC timezone.
   Reads the owner password from the gitignored ROTATED-CREDENTIALS-LOCAL.txt
   in the adweso-register repo. Never prints secrets. Uses node-postgres (pg)
   because CREATE DATABASE cannot run inside Prisma's transaction wrapper. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = 'E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register';
const credsFile = path.join(repo, 'ROTATED-CREDENTIALS-LOCAL.txt');
const outCreds = 'E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt';

function readEnvVar(file, name) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(new RegExp('^\\s*' + name + '\\s*=\\s*"([^"]+)"', 'm')) ||
            t.match(new RegExp("^\\s*" + name + "\\s*=\\s*'([^']+)'", 'm')) ||
            t.match(new RegExp('^\\s*' + name + '\\s*=\\s*([^\\s#]+)', 'm'));
  return m ? m[1].trim() : null;
}
function readRolePw(file, role) {
  const t = fs.readFileSync(file, 'utf8');
  for (const line of t.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    if (s.slice(0, i).trim() === role) return s.slice(i + 1).trim();
  }
  return null;
}

const dbUrl = readEnvVar(path.join(repo, '.env'), 'DATABASE_URL');
const ownerPw = readRolePw(credsFile, 'neondb_owner');
if (!dbUrl || !ownerPw) { console.error('missing creds'); process.exit(1); }
const u = new URL(dbUrl);
const directHost = u.hostname.replace('-pooler', '');
const directPort = u.port || 5432;
const OWNER = `postgresql://neondb_owner:${ownerPw}@${directHost}:${directPort}${u.pathname}${u.search}`;
const CIVIC_DIRECT = `postgresql://neondb_owner:${ownerPw}@${directHost}:${directPort}/civic_platform${u.search}`;

async function client(url, label) {
  const { Client } = require(path.join(repo, 'node_modules', 'pg'));
  for (let i = 0; i < 3; i++) {
    const cl = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try { await cl.connect(); await cl.query('SELECT 1'); if (i) console.log(`[${label}] up (attempt ${i + 1})`); return cl; }
    catch (e) { try { await cl.end(); } catch (_) {} console.log(`[${label}] down (${i + 1}: ${e.message.slice(0, 70)}), waiting 6s`); await new Promise(r => setTimeout(r, 6000)); }
  }
  throw new Error(`cannot reach ${label}`);
}

async function main() {
  const pr = await client(OWNER, 'postgres(owner)');
  try {
    const ex = await pr.query(`SELECT 1::int AS n FROM pg_database WHERE datname='civic_platform'`);
    if (ex.rows.length) console.log('[db] civic_platform already exists');
    else { await pr.query(`CREATE DATABASE civic_platform`); console.log('[db] CREATED civic_platform'); }
  } catch (e) { console.log('[db] ' + e.message.slice(0, 160)); }
  await pr.end();

  const c = await client(CIVIC_DIRECT, 'civic_platform');
  const rolePw = 'cvk_' + crypto.randomBytes(18).toString('base64url');
  const stmts = [
    { sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='civic_app') THEN CREATE ROLE civic_app LOGIN PASSWORD '${rolePw}'; ELSE ALTER ROLE civic_app WITH LOGIN PASSWORD '${rolePw}'; END IF; END $$;`, why: 'role civic_app' },
    { sql: `GRANT ALL ON DATABASE civic_platform TO civic_app`, why: 'db grant' },
    { sql: `ALTER DATABASE civic_platform SET timezone TO 'UTC'`, why: 'tz' },
  ];
  for (const st of stmts) {
    try { await c.query(st.sql); console.log('[ok] ' + st.why); }
    catch (e) { console.log('[skip] ' + st.why + ' -> ' + e.message.slice(0, 140)); }
  }
  await c.end();

  const poolHost = u.hostname; // pooled endpoint for the app at runtime
  const poolPort = u.port || 5432;
  const lines = [
    '# CivicData platform credentials (gitignored - never commit)',
    '# App runtime connection (civic_app on civic_platform, pooled):',
    `DATABASE_URL_PLATFORM=postgresql://civic_app:${rolePw}@${poolHost}:${poolPort}/civic_platform${u.search}&pgbouncer=true&connection_limit=15&pool_timeout=20`,
    '# Migrations / provisioning (owner, direct):',
    `OWNER_URL_DIRECT=postgresql://neondb_owner:${ownerPw}@${directHost}:${directPort}/civic_platform${u.search}`,
    'PROVISIONED=2026-11-02',
  ];
  fs.writeFileSync(outCreds, lines.join('\n'), 'utf8');
  console.log('[done] creds written:', outCreds, '(folder has .gitignore entry)');
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });