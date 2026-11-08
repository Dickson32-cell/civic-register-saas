/* Newtown count drift check — READ ONLY.
   Verifies: ACTIVE vs INACTIVE record counts, soft-deleted rows, DELETE audit trail
   (who/when/what serials), recent create growth, serial counters, license state. */
const fs = require('fs');
const path = require('path');

const repo = 'E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register';

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
const ownerPw = readRolePw(path.join(repo, 'ROTATED-CREDENTIALS-LOCAL.txt'), 'neondb_owner');
if (!dbUrl || !ownerPw) { console.error('missing dbUrl or ownerPw', !!dbUrl, !!ownerPw); process.exit(1); }

// rebuild owner URL: keep host/db/path/search, swap user to neondb_owner
const u = new URL(dbUrl);
const OWNER = `postgresql://neondb_owner:${ownerPw}@${u.hostname}:${u.port || 5432}${u.pathname}${u.search}&pgbouncer=true`;

async function main() {
  const { PrismaClient } = require(path.join(repo, 'node_modules', '@prisma', 'client'));
  let pr;
  try { pr = new PrismaClient({ datasourceUrl: OWNER }); }
  catch (e) { pr = new PrismaClient({ datasources: { db: { url: OWNER } } }); }
  const q = async (sql, params) => (await pr.$queryRawUnsafe(sql, ...(params || [])));

  console.log('=== 1. fee_payer record_status counts (newtown) ===');
  console.log(JSON.stringify(await q(`
    SELECT record_status, count(*)::int AS n FROM fee_payer WHERE council_id='newtown' GROUP BY record_status ORDER BY record_status`)));

  console.log('=== 2. INACTIVE newtown rows (soft-deleted) ===');
  const inactive = await q(`
    SELECT serial_number, name, electoral_area, record_status FROM fee_payer
    WHERE council_id='newtown' AND record_status <> 'ACTIVE'
    ORDER BY serial_number LIMIT 40`);
  inactive.forEach(r => console.log(` ${r.serial_number} | ${r.name} | ${r.electoral_area} | ${r.record_status}`));
  console.log(' inactive total rows shown:', inactive.length);

  console.log('=== 3. audit_log columns ===');
  const cols = await q(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name='audit_log' ORDER BY ordinal_position`);
  console.log(cols.map(c => `${c.column_name}:${c.data_type}`).join(' | '));

  console.log('=== 4. DELETE-family audit rows for newtown (who/when/what) ===');
  const dels = await q(`
    SELECT a.created_at, a.action, a.user_id, a.entity_id::text AS entity_id, a.details
    FROM audit_log a WHERE a.council_id='newtown' AND a.action ILIKE '%DELETE%'
    ORDER BY a.created_at DESC LIMIT 25`);
  const users = await q(`SELECT id::text AS id, username, full_name FROM app_user WHERE council_id='newtown'`);
  const umap = {}; users.forEach(u => umap[u.id] = `${u.username} (${u.full_name || ''})`);
  dels.forEach(d => console.log(` ${d.created_at} | ${d.action} | ${d.user_id ? (umap[d.user_id] || d.user_id) : 'unknown'} | entity=${d.entity_id} | ${JSON.stringify(d.details).slice(0, 150)}`));
  console.log(' delete-audit rows shown:', dels.length);

  console.log('=== 5. CREATE_RECORD growth by day (newtown, last 12 days) ===');
  const creates = await q(`
    SELECT date_trunc('day', created_at) AS day, count(*)::int AS n
    FROM audit_log WHERE council_id='newtown' AND action='CREATE_RECORD'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
  creates.forEach(c => console.log(` ${new Date(c.day).toISOString().slice(0, 10)} +${c.n}`));

  console.log('=== 6. serial_counter (newtown) ===');
  console.log(JSON.stringify(await q(`SELECT electoral_area, last_number FROM serial_counter WHERE council_id='newtown' ORDER BY electoral_area`)));

  console.log('=== 7. license_state (newtown) ===');
  console.log(JSON.stringify(await q(`SELECT id, paid_through, license_key IS NOT NULL AS has_key, last_payment_at FROM license_state WHERE id='newtown'`)));

  console.log('=== 8. pending_edit queue (newtown) ===');
  const pe = await q(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='PENDING')::int AS pending FROM pending_edit WHERE council_id='newtown'`);
  console.log(JSON.stringify(pe));

  console.log('=== 9. distinct active electoral areas + active counts (newtown) ===');
  console.log(JSON.stringify(await q(`
    SELECT electoral_area, count(*)::int AS n FROM fee_payer
    WHERE council_id='newtown' AND record_status='ACTIVE' GROUP BY 1 ORDER BY 2 DESC`)));

  await pr.$disconnect();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });