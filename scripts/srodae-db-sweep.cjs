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
 const tables=await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
 for (const {table_name:t} of tables.rows) {
   // every text column, ILIKE srodae
   const cols=await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND data_type IN ('text','character varying','character')`);
   for (const {column_name:col} of cols.rows) {
     const r=await c.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "${col}" ILIKE '%srodae%'`);
     if (r.rows[0].n>0) console.log(`HIT ${t}.${col}: ${r.rows[0].n} rows`);
   }
 }
 console.log("DB sweep done");
 await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
