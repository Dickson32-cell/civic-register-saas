#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const ADWESO = "E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register";
const envUrl = fs.readFileSync(path.join(ADWESO, ".env"), "utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
const host = envUrl.match(/@([^/]+)\//)[1];
const ownerPw = fs.readFileSync(path.join(ADWESO, "ROTATED-CREDENTIALS-LOCAL.txt"), "utf8").match(/neondb_owner=(\S+)/)[1];
const ownerUrl = `postgresql://neondb_owner:${encodeURIComponent(ownerPw)}@${host}/neondb?sslmode=require`;
(async () => {
  const c = new Client({ connectionString: ownerUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  // order matters (fee references payer); delete children first
  await c.query("DELETE FROM fee WHERE council_id='newtown'");
  await c.query("DELETE FROM payment WHERE council_id='newtown'");
  await c.query("DELETE FROM fee_payer WHERE council_id='newtown'");
  await c.query("DELETE FROM audit_log WHERE council_id='newtown'");
  // keep serial_counter rows? They were seeded with OLD area names (New Town, New Town Market...). Delete — seed.js will create correct ones.
  await c.query("DELETE FROM serial_counter WHERE council_id='newtown'");
  // test user
  await c.query("DELETE FROM app_user WHERE council_id='newtown'");
  // license_state keyed by id: check and remove stale
  const ls = await c.query("DELETE FROM license_state WHERE id='newtown'");
  console.log("newtown test data wiped. license_state removed rows:", ls.rowCount);
  // verify all six are empty
  for (const cid of ["oldestate","newtown","ogua","nkukwao","betom","anlotown"]) {
    const r = await c.query("SELECT COUNT(*)::int n FROM fee_payer WHERE council_id=$1", [cid]);
    console.log(cid, "fee_payer now:", r.rows[0].n);
  }
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
