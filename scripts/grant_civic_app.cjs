/* Grants civic_app full privileges on all current + future tables/sequences of
   civic_platform. Run once after schema push (owner connection). */
const fs = require('fs');
const path = require('path');
const repo = 'E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register';

const creds = fs.readFileSync('E:/RameTech Consultancy jobs/civic-register-saas/PLATFORM-CREDS-LOCAL.txt', 'utf8');
const ownerUrl = creds.match(/^OWNER_URL_DIRECT=(.+)$/m)[1].trim();
const { Client } = require(path.join(repo, 'node_modules', 'pg'));

async function main() {
  const c = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const stmts = [
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO civic_app`,
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO civic_app`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO civic_app`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO civic_app`,
  ];
  for (const sql of stmts) {
    try { await c.query(sql); console.log('[ok]', sql.slice(0, 60)); }
    catch (e) { console.log('[skip]', e.message.slice(0, 120)); }
  }
  await c.end();
  console.log('grants done');
}
main().catch(e => { console.error(e.message); process.exit(1); });