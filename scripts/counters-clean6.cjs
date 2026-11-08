#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const {Client}=require("pg");
const ADWESO="E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register";
const envUrl=fs.readFileSync(path.join(ADWESO,".env"),"utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
const host=envUrl.match(/@([^/]+)\//)[1];
const ownerPw=fs.readFileSync(path.join(ADWESO,"ROTATED-CREDENTIALS-LOCAL.txt"),"utf8").match(/neondb_owner=(\S+)/)[1];
const ownerUrl=`postgresql://neondb_owner:${encodeURIComponent(ownerPw)}@${host}/neondb?sslmode=require`;
const keep={
 oldestate:["Old Estate West","Old Estate East","Nyamekrom"],
 newtown:["Community A&B","Community C","Community D","Ada"],
 ogua:["Oguaa","Residential","Sempoamiensa"],
 nkukwao:["Railway Station","Nsukwao Abotanso","Tanoso","Nsukwaoso"],
 betom:["Ohemaa Park","Adontua","School Town","Anglican","Asuofiri"],
 anlotown:["Anlo Town South","Anlo Town North","Central Hospital","Klu Town/Kyeremah"],
};
(async()=>{
 const c=new Client({connectionString:ownerUrl,ssl:{rejectUnauthorized:false}});
 await c.connect();
 for (const [cid,areas] of Object.entries(keep)) {
  const r=await c.query("DELETE FROM serial_counter WHERE council_id=$1 AND NOT (electoral_area = ANY($2))",[cid,areas]);
  const left=await c.query("SELECT electoral_area FROM serial_counter WHERE council_id=$1 ORDER BY electoral_area",[cid]);
  console.log(cid,"deleted",r.rowCount,"-> left:",left.rows.map(x=>x.electoral_area).join(", "));
 }
 await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
