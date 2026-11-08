
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const ownerUrl = process.env.OWNER_DATABASE_URL;
const c = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const newPw = 'Own-' + crypto.randomBytes(18).toString('base64url');
  await c.query(`ALTER ROLE neondb_owner WITH PASSWORD '${newPw.replace(/'/g, "''")}'`);
  fs.appendFileSync('ROTATED-CREDENTIALS-LOCAL.txt', `neondb_owner=${newPw}\n`);
  console.log('owner password rotated (old npg_ now dead)');
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
