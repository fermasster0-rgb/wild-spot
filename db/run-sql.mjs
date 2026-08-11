// Führt eine .sql-Datei direkt gegen die Supabase-Datenbank aus.
// Aufruf:  node db/run-sql.mjs db/schema.sql
//
// Die Zugangsdaten kommen aus .env.local (steht in .gitignore, landet nie auf GitHub).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// .env.local einlesen — bewusst ohne Zusatzpaket, das sind fünf Zeilen.
function loadEnv() {
  const path = resolve(projectRoot, '.env.local');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`\nEs fehlt die Datei .env.local im Projektordner.\n` +
      `Sie muss eine Zeile enthalten:\n\n  DATABASE_URL=postgresql://...\n`);
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Rechnet den Zeichen-Offset aus einer Postgres-Fehlermeldung in Zeile/Spalte um.
function locate(sql, position) {
  const before = sql.slice(0, Number(position) - 1);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  return { line, col, text: sql.split('\n')[line - 1] };
}

const file = process.argv[2];
if (!file) {
  console.error('Aufruf: node db/run-sql.mjs <datei.sql>');
  process.exit(1);
}

loadEnv();
const sql = readFileSync(resolve(projectRoot, file), 'utf8');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Verbunden. Führe ${file} aus (${sql.split('\n').length} Zeilen) ...`);
  await client.query(sql);
  console.log('\nErfolgreich durchgelaufen.');
} catch (err) {
  console.error(`\nFEHLER: ${err.message}`);
  if (err.position) {
    const { line, col, text } = locate(sql, err.position);
    console.error(`Zeile ${line}, Spalte ${col}:`);
    console.error(`  ${text}`);
  }
  if (err.hint) console.error(`Hinweis: ${err.hint}`);
  if (err.detail) console.error(`Detail: ${err.detail}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
