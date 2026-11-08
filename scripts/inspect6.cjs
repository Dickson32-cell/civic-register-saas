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
  // What newtown test data exists across tables?
  for (const t of ["fee_payer","fee","payment","serial_counter","app_user","audit_log","license_state","pending_edit","password_change_request"]) {
    const r = await c.query(`SELECT COUNT(*)::int n FROM ${t} WHERE council_id='newtown'`);
    console.log(t, "=", r.rows[0].n);
  }
  const ls = await c.query("SELECT id FROM license_state WHERE id='newtown'");
  console.log("license_state newtown row:", ls.rows.length);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
