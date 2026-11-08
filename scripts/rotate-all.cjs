
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const ownerUrl = process.env.OWNER_DATABASE_URL;
const roles = ['zc_adweso','zc_newtown','zc_ogua','zc_nkukwao','zc_betom','zc_srodae','zc_oldestate','zc_anlotown','master_viewer'];
const c = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const out = [];
  for (const role of roles) {
    const pw = 'Rl-' + crypto.randomBytes(15).toString('base64url');
    await c.query(`ALTER ROLE ${role} WITH PASSWORD '${pw.replace(/'/g, "''")}'`);
    out.push(`${role}=${pw}`);
    console.log('rotated:', role);
  }
  fs.writeFileSync('ROTATED-CREDENTIALS-LOCAL.txt', out.join('\n') + '\n' + new Date().toISOString() + '\n');
  console.log('new credentials written to ROTATED-CREDENTIALS-LOCAL.txt (gitignored)');
  await c.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
