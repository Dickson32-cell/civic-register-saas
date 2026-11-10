#!/usr/bin/env node
// issue_keys.cjs — THE PLATFORM OWNER'S KEY GENERATOR (runs only on the
// owner's machine, reads LICENSE_SECRET from the local .env, never from the
// app). After a company pays you directly (MoMo/bank), generate the key for
// THAT company and send it to them. Usage:
//
//   node scripts/issue_keys.cjs <tenantId> branding
//   node scripts/issue_keys.cjs <tenantId> seats <newLimit>
//       (branding = logo + bill designer, one-time; seats = raise limit to N)
//   node scripts/issue_keys.cjs <tenantId> register
//       (extra 100 registrations — reads current tier from the database)
//
// Example: node scripts/issue_keys.cjs civicdemo branding
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
function envVal(k) {
  const t = fs.readFileSync(envPath, "utf8");
  let m = t.match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\r\\n#]*)`, "m"));
  if (m && m[1].trim()) return m[1].trim();
  return "";
}
const SECRET = process.env.LICENSE_SECRET || envVal("LICENSE_SECRET");
if (!SECRET) { console.error("LICENSE_SECRET missing (load .env or export it)"); process.exit(1); }
const DBURL = process.env.DATABASE_URL || envVal("DATABASE_URL");

function fmt(mac) { return mac.toUpperCase().replace(/(.{4})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4"); }
function key(tid, stamp) {
  return fmt(crypto.createHmac("sha256", SECRET).update(stamp).digest("hex").slice(0, 16));
}

const [, , tid, kind, extra] = process.argv;
if (!tid || !kind) { console.log("Usage: node scripts/issue_keys.cjs <tenantId> branding | seats <limit> | register"); process.exit(1); }

(async () => {
  if (kind === "branding") {
    console.log(`Logo + bill designer key for ${tid}:`);
    console.log(key(tid, `${tid}:BRANDING:1`));
    console.log("Give this to the company admin (Admin > Services > Unlock with a key).");
  } else if (kind === "seats") {
    const n = Number(extra);
    if (!Number.isInteger(n) || n < 3 || n > 500) { console.error("Seat limit must be a whole number 3-500"); process.exit(1); }
    console.log(`Staff seats -> ${n} key for ${tid}:`);
    console.log(key(tid, `${tid}:STAFF_SEATS:${n}`));
    console.log("The admin enters that seat count + the key (Admin > Services > Unlock with a key).");
  } else if (kind === "register") {
    if (!DBURL) { console.error("DATABASE_URL missing from .env (needed to read the current tier)"); process.exit(1); }
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient({ datasources: { db: { url: DBURL } } });
    const st = await p.licenseState.findUnique({ where: { id: tid } });
    const target = (st?.paidThrough ?? 0) + 100;
    await p.$disconnect();
    console.log(`Register key (unlocks through ${target}) for ${tid}:`);
    console.log(key(tid, `${tid}:${target}`));
  } else {
    console.error("Unknown kind — use branding | seats <limit> | register");
    process.exit(1);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
