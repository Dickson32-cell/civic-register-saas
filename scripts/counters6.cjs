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
  const r=await c.query("SELECT electoral_area,last_number FROM serial_counter ORDER BY electoral_area");
  console.log(cid+"("+r.rows.length+"):", r.rows.map(x=>x.electoral_area+"="+x.last_number).join(", "));
  await c.end();
 }
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
