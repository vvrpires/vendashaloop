import fs from "node:fs";
import pg from "pg";
const env = Object.fromEntries(fs.readFileSync("/opt/haloop-vendas/.env","utf8").split("\n").filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)]; }));
const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query("select length(regexp_replace(coalesce(ie,''), '\\D', '', 'g')) as digitos, crt, ambiente from empresa where id = 1");
console.log(JSON.stringify(rows[0]));
await client.end();
