// Set srodae admin password (owner-connection tool; password passed via env var)
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const c = new Client({ connectionString: process.env.OWNER_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const hash = await bcrypt.hash(process.env.NEW_PW, 10);
  const r = await c.query(
    "UPDATE app_user SET password_hash = $1 WHERE council_id = 'srodae' AND username = 'admin' RETURNING id, username",
    [hash]
  );
  if (!r.rows.length) { console.error("srodae admin not found"); process.exit(1); }
  console.log("srodae admin password updated:", r.rows[0].username);
  // audit trail
  await c.query(
    "INSERT INTO audit_log (council_id, user_id, action, entity_type, entity_id, details) VALUES ('srodae', $1, 'ADMIN_PASSWORD_SET', 'app_user', $2, $3)",
    [r.rows[0].id, r.rows[0].id, JSON.stringify({ by: "owner-tool", council: "srodae" })]
  );
  console.log("audit logged");
  await c.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });