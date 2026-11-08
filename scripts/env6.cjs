#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ADWESO = "E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register";
const PWFILE = "C:/Users/Dickson/AppData/Local/hermes/cache/scratch/newpw.txt";
const envUrl = fs.readFileSync(path.join(ADWESO, ".env"), "utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
const host = envUrl.match(/@([^/]+)\//)[1];
const lic = fs.readFileSync(path.join(ADWESO, ".env"), "utf8").match(/^LICENSE_SECRET="?(.+?)"?$/m)[1];
const dirs = {
  oldestate: "E:/Old Estate Zonal Council/oldestate-register",
  newtown:  "E:/New Town Zonal Council/newtown-register",
  ogua:     "E:/Ogua Zonal Council/oguaa-register",
  nkukwao:  "E:/Nkukwao Zonal Council/nkukwao-register",
  betom:    "E:/Betom Zonal Council/betom-register",
  anlotown: "E:/Anlo-Town Zonal Council/anlotown-register",
};
const pws = fs.readFileSync(PWFILE, "utf8").trim().split("\n").map(l => l.split("="));
for (const [cid, pw] of pws) {
  const d = dirs[cid];
  const env =
`DATABASE_URL="postgresql://zc_${cid}:${pw}@${host}/neondb?sslmode=require"
SESSION_SECRET="${require("crypto").randomBytes(24).toString("hex")}"
COUNCIL_ID="${cid}"
LICENSE_SECRET="${lic}"
ADMIN_PASSWORD=""
`;
  fs.writeFileSync(path.join(d, ".env"), env);
  console.log("wrote .env", cid);
}
