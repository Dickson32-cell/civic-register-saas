#!/usr/bin/env node
const fs=require("fs"),path=require("path");
const {Client}=require("pg");
const ADWESO="E:/Adweso Zonal Council Database System for Termpoal Structures/adweso-register";
const envUrl=fs.readFileSync(path.join(ADWESO,".env"),"utf8").match(/^DATABASE_URL="?(.+?)"?$/m)[1];
const host=envUrl.match(/@([^/]+)\//)[1];
const ownerPw=fs.readFileSync(path.join(ADWESO,"ROTATED-CREDENTIALS-LOCAL.txt"),"utf8").match(/neondb_owner=(\S+)/)[1];
const ownerUrl=`postgresql://neondb_owner:${encodeURIComponent(ownerPw)}@${host}/neondb?sslmode=require`;
(async()=>{
 const c=new Client({connectionString:ownerUrl,ssl:{rejectUnauthorized:false}});
 await c.connect();
 const r=await c.query("SELECT council_id, name, street_name FROM fee_payer WHERE name ILIKE '%srodae%' OR street_name ILIKE '%srodae%'");
 console.log(JSON.stringify(r.rows, null, 1));
 await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
