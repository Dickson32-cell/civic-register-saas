// add-admins.cjs — create named admin accounts for Anlo Town (Naomi Adarkwa) + Oguaa (Cavita Asiamah Boateng).
// Passwords generated here, printed ONCE, and appended to COUNCIL-ADMIN-PW-LOCAL.txt.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");

const admins = [
  { cid: "anlotown", dir: "E:/Anlo-Town Zonal Council/anlotown-register", username: "naomi",  fullName: "Naomi Adarkwa" },
  { cid: "ogua",     dir: "E:/Ogua Zonal Council/oguaa-register",         username: "cavita", fullName: "Cavita Asiamah Boateng" },
];

(async () => {
  const out = [];
  for (const a of admins) {
    const url = fs.readFileSync(path.join(a.dir, ".env"), "utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
    const pw = crypto.randomBytes(9).toString("base64url");
    const hash = await bcrypt.hash(pw, 10);
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    const dup = await c.query("SELECT id FROM app_user WHERE username=$1", [a.username]);
    if (dup.rows.length) {
      await c.query("UPDATE app_user SET password_hash=$1, role='ADMIN', active=true, full_name=$2 WHERE username=$3", [hash, a.fullName, a.username]);
      console.log(`${a.cid}: user '${a.username}' existed — password reset, role ADMIN`);
    } else {
      await c.query(
        `INSERT INTO app_user (id, council_id, username, password_hash, full_name, role, active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ADMIN', true, now())`,
        [a.cid, a.username, hash, a.fullName]
      );
      console.log(`${a.cid}: created '${a.username}' (${a.fullName}) as ADMIN`);
    }
    const chk = await c.query("SELECT username, role, active, full_name FROM app_user WHERE username=$1", [a.username]);
    await c.end();
    console.log(`   verify:`, JSON.stringify(chk.rows[0]));
    out.push(`${a.cid},${a.username},${pw}`);
  }
  const f = "E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register/COUNCIL-ADMIN-PW-LOCAL.txt";
  fs.appendFileSync(f, "\n# Named admins (added 2026-09-25)\n" + out.join("\n") + "\n");
  console.log("---- CREDENTIALS (shown once, also in COUNCIL-ADMIN-PW-LOCAL.txt):");
  console.log("Anlo Town  https://anlotownzonalcouncil.vercel.app  ->  naomi  / " + out[0].split(",")[2]);
  console.log("Oguaa      https://oguaazonalcouncil.vercel.app     ->  cavita / " + out[1].split(",")[2]);
})().catch(e => { console.error("ERR", e.message); process.exit(1); });