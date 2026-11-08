#!/usr/bin/env node
// FINALIZE CLONES — for each council folder: sync RegisterTable AREAS from db.ts,
// fix export filename, install deps, create .env placeholder. Run from adweso-register.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const COUNCILS = [
  { dir: "E:/New Town Zonal Council/newtown-register",     id: "newtown",   name: "New Town Zonal Council" },
  { dir: "E:/Ogua Zonal Council/ogua-register",            id: "ogua",      name: "Ogua Zonal Council" },
  { dir: "E:/Nkukwao Zonal Council/nkukwao-register",      id: "nkukwao",   name: "Nkukwao Zonal Council" },
  { dir: "E:/Betom Zonal Council/betom-register",          id: "betom",     name: "Betom Zonal Council" },
  { dir: "E:/Srodae Zonal Council/srodae-register",        id: "srodae",    name: "Srodae Zonal Council" },
  { dir: "E:/Old Estate Zonal Council/oldestate-register", id: "oldestate", name: "Old Estate Zonal Council" },
  { dir: "E:/Anlo-Town Zonal Council/anlotown-register",   id: "anlotown",  name: "Anlo-Town Zonal Council" },
];

for (const c of COUNCILS) {
  const db = fs.readFileSync(path.join(c.dir, "src/lib/db.ts"), "utf-8");
  const areas = [...db.matchAll(/\{ area: "([^"]+)", code: "([^"]+)" \}/g)];
  // RegisterTable AREAS sync
  const rtPath = path.join(c.dir, "src/app/RegisterTable.tsx");
  let rt = fs.readFileSync(rtPath, "utf-8");
  const newList = "const AREAS = [\n" + areas.map(m => `  "${m[1]}",`).join("\n") + "\n];";
  rt = rt.replace(/const AREAS = \[[\s\S]*?\];/, newList);
  fs.writeFileSync(rtPath, rt);
  // export filename
  const exPath = path.join(c.dir, "src/app/api/export/route.ts");
  let ex = fs.readFileSync(exPath, "utf-8");
  ex = ex.replace(/Adweso-Register-/g, "Register-");
  fs.writeFileSync(exPath, ex);
  // README stamp
  const rd = `# ${c.name} — Temporal Structures Register\n\nCloned from the Adweso system. Same design, same integrity model\n(transaction-locked per-area serials, settlement ledger, audit log,\nrole tiers, GPS, Excel export, 30s auto-refresh).\n\n## Licensing\nFree for the first 100 registrations. At 100 the register locks\n(no new entries, no Excel export) until the US$5 licence fee is paid\nto RAMEDIC Consultancy & Creative Ltd (MTN MoMo 0595 726 252).\nAn unlock key is then issued; locks again at each further 100.\n\nCOUNCIL_ID: ${c.id}\nElectoral areas: ${areas.map(m => m[1]).join(", ")}\n\n## Setup\n1. Create a Neon database -> put DATABASE_URL in .env\n2. .env also needs SESSION_SECRET, COUNCIL_ID=${c.id}, LICENSE_SECRET, ADMIN_PASSWORD\n3. npm install && npx prisma db push && node prisma/seed.js\n4. npm run build && deploy (Vercel) -> set the same env vars on Vercel\n\nElectoral areas and codes are defined in src/lib/db.ts — editable anytime.\n`;
  fs.writeFileSync(path.join(c.dir, "README.md"), rd);
  console.log(`${c.name}: areas synced (${areas.length}), README written`);
}
console.log("ALL 7 FINALIZED (source-level). npm install per folder when deploying.");