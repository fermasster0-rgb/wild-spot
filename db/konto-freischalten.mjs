// ============================================================================
// Ein Konto von Hand freischalten
//
// Aufruf:  node db/konto-freischalten.mjs max@beispiel.at
//          node db/konto-freischalten.mjs --liste     (alle Konten anzeigen)
//
// Wozu:
// Supabase verlangt zurzeit, dass jede neue E-Mail-Adresse per Klick auf einen
// Link in einer Bestätigungsmail freigeschaltet wird. Der kostenlose Mailversand
// von Supabase ist aber streng begrenzt (wenige Mails pro Stunde) und landet
// gern im Spam. Wenn jemand aus deinem Freundeskreis nicht reinkommt, schaltest
// du sein Konto hiermit direkt frei.
//
// Der saubere Dauerweg ist, die Bestätigungspflicht im Supabase-Dashboard
// abzuschalten: Authentication → Sign In / Providers → Email →
// "Confirm email" aus. Dann braucht es dieses Skript gar nicht mehr.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const line of readFileSync(resolve(projectRoot, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const arg = process.argv[2];
if (!arg) {
  console.error('\nAufruf:  node db/konto-freischalten.mjs <e-mail>');
  console.error('         node db/konto-freischalten.mjs --liste\n');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  if (arg === '--liste') {
    const r = await client.query(`
      select u.email,
             case when u.email_confirmed_at is null then 'nein' else 'ja' end as bestaetigt,
             p.username,
             to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as angelegt
      from auth.users u
      left join public.profiles p on p.id = u.id
      order by u.created_at desc`);

    if (!r.rows.length) console.log('\nNoch keine Konten.\n');
    else console.table(r.rows);

  } else {
    const r = await client.query(
      `update auth.users
          set email_confirmed_at = coalesce(email_confirmed_at, now())
        where lower(email) = lower($1)
        returning email, email_confirmed_at`,
      [arg]
    );

    if (!r.rows.length) {
      console.log(`\nKein Konto mit der Adresse ${arg} gefunden.`);
      console.log('Alle Konten anzeigen:  node db/konto-freischalten.mjs --liste\n');
      process.exitCode = 1;
    } else {
      console.log(`\n${r.rows[0].email} ist freigeschaltet — die Anmeldung geht jetzt.\n`);
    }
  }
} catch (err) {
  console.error(`\nFEHLER: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
