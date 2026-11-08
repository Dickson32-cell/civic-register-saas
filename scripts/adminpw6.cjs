#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const dirs = {
  oldestate: "E:/Old Estate Zonal Council/oldestate-register",
  newtown:  "E:/New Town Zonal Council/newtown-register",
  ogua:     "E:/Ogua Zonal Council/oguaa-register",
  nkukwao:  "E:/Nkukwao Zonal Council/nkukwao-register",
  betom:    "E:/Betom Zonal Council/betom-register",
  anlotown: "E:/Anlo-Town Zonal Council/anlotown-register",
};
(async () => {
  const lines = ["# Zonal council admin passwords — generated " + new Date().toISOString(), "# CouncilID,LoginURL,Username,Password"];
  for (const [cid, d] of Object.entries(dirs)) {
    const url = fs.readFileSync(path.join(d, ".env"), "utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
    const pw = crypto.randomBytes(9).toString("base64url");
    const hash = await bcrypt.hash(pw, 10);
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    await c.query("UPDATE app_user SET password_hash=$1 WHERE role='ADMIN' AND username='admin'", [hash]);
    const n = await c.query("SELECT COUNT(*)::int n FROM app_user");
    await c.end();
    lines.push(`${cid},https://${cid}-register.vercel.app (TBD exact),admin,${pw}`);
    console.log(cid, "admin password set; users:", n.rows[0].n);
  }
  fs.writeFileSync(path.join(dirs.oldestate, "..", "..", "Adweso Zonal Council Database System for Termpoal Structures", "adweso-register", "COUNCIL-ADMIN-PW-LOCAL.txt"), lines.join("\n"));
  console.log("saved to adweso-register/COUNCIL-ADMIN-PW-LOCAL.txt (gitignored)");
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
