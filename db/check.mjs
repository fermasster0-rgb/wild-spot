// Einmalige Kontrolle nach dem Einspielen des Schemas.
import { readFileSync } from 'node:fs';
import pg from 'pg';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const q = async (label, sql) => {
  const r = await c.query(sql);
  console.log(`\n--- ${label} ---`);
  console.table(r.rows);
};

console.log('PostGIS:', (await c.query('select postgis_version() v')).rows[0].v);

await q('Tabellen, RLS und Policies', `
  select t.tablename as tabelle,
         case when t.rowsecurity then 'an' else 'AUS!' end as rls,
         (select count(*) from pg_policies p
           where p.schemaname='public' and p.tablename=t.tablename) as policies
  from pg_tables t where t.schemaname='public' order by t.tablename`);

await q('Funktionen', `
  select p.proname as funktion
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' order by 1`);

await q('Geo-Indizes', `
  select indexname as index, tablename as tabelle
  from pg_indexes where schemaname='public' and indexdef like '%gist%' order by 1`);

await q('Bbox-Abfrage Oesterreich (muss leer sein, darf nicht krachen)',
  'select * from public.spots_in_bbox(46.3, 9.5, 49.1, 17.2)');

await q('Wasserstellen', 'select count(*) as anzahl from public.water_points');

await c.end();
