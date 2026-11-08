#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const {Client}=require("pg");
const dirs={
 oldestate:"E:/Old Estate Zonal Council/oldestate-register",
 newtown:"E:/New Town Zonal Council/newtown-register",
 ogua:"E:/Ogua Zonal Council/oguaa-register",
 nkukwao:"E:/Nkukwao Zonal Council/nkukwao-register",
 betom:"E:/Betom Zonal Council/betom-register",
 anlotown:"E:/Anlo-Town Zonal Council/anlotown-register",
};
(async()=>{
 for (const [cid,d] of Object.entries(dirs)) {
  const url=fs.readFileSync(path.join(d,".env"),"utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
  const c=new Client({connectionString:url,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const fp=await c.query("SELECT COUNT(*)::int n FROM fee_payer");           // what this council's app can see
  const sr=await c.query("SELECT COUNT(*)::int n FROM fee_payer WHERE council_id ILIKE '%srodae%'");
  const lu=await c.query("SELECT COUNT(*)::int n FROM app_user");
  const sc=await c.query("SELECT COUNT(*)::int n FROM serial_counter");
  console.log(`${cid}: visible fee_payer=${fp.rows[0].n}, srodae-tagged=${sr.rows[0].n}, users=${lu.rows[0].n}, counters=${sc.rows[0].n}`);
  await c.end();
 }
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
