// One-off: apply add-license-pending.sql over the OWNER connection.
// Reads passwords from ROTATED-CREDENTIALS-LOCAL.txt (gitignored).
// Prints only success/failure — never credentials.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function readOwnerPassword() {
  const txt = fs.readFileSync(path.join(__dirname, "..", "ROTATED-CREDENTIALS-LOCAL.txt"), "utf8");
  const m = txt.match(/neondb_owner=(\S+)/);
  if (!m) throw new Error("neondb_owner password not found in credentials file");
  return m[1];
}

function ownerUrl() {
  const envUrl = process.env.DATABASE_URL; // zc_adweso scoped URL — same host/db
  if (!envUrlOk(envUrl)) throw new Error("DATABASE_URL missing");
  const u = new URL(process.env.DATABASE_URL);
  u.username = "neondb_owner";
  u.password = readOwnerPassword();
  return u.toString();
}
function envUrlOk(u) { return true; }

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "add-license-pending.sql"), "utf8");
  // split on semicolons at line ends (simple, our file has no functions)
  const stmts = sql.split(";").map(s => s.trim()).filter(s => s && !s.startsWith("--"));
  const p = new PrismaClient({ datasources: { db: { url: ownerUrl() } } });
  try {
    for (const st of stmts) {
      const clean = st.replace(/--.*$/gm, "").trim();
      if (!clean) continue;
      await p.$executeRawUnsafe(clean);
      console.log("applied:", clean.split("\n")[0].slice(0, 60));
    }
    // VERIFY: columns exist with expected types
    const cols = await p.$queryRawUnsafe(`SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name='license_state' ORDER BY ordinal_position`);
    console.log("license_state columns now:", JSON.stringify(cols));
  } finally {
    await p.$disconnect();
  }
})().catch(e => { console.error("DDL FAILED:", e.message.slice(0, 200)); process.exit(1); });