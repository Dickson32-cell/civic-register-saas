#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
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
  for (const [cid, d] of Object.entries(dirs)) {
    const url = fs.readFileSync(path.join(d, ".env"), "utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
    try {
      const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await c.connect();
      const me = await c.query("SELECT current_user");
      const rows = await c.query("SELECT COUNT(*)::int n FROM fee_payer");
      const own = await c.query("SELECT COUNT(*)::int n FROM fee_payer WHERE council_id=$1", [cid]);
      console.log(`${cid}: connected as ${me.rows[0].current_user}, visible fee_payer=${rows.rows[0].n} (own ${own.rows[0].n})`);
      await c.end();
    } catch (e) { console.error(`${cid}: CONNECT FAIL ${e.message}`); }
  }
})();
