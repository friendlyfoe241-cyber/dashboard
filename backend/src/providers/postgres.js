// PostgreSQL data provider.
//
// Stores each store collection (editors, submissions, …) as a single JSONB row
// in one table, mirroring the document-style shape the in-memory store works
// with. It exposes the same { load, persist } contract as the Sheets provider,
// so switching DATA_PROVIDER=postgres needs no route/UI changes. All querying
// stays in the store; Postgres is purely the durability layer.
//
// Required: DATABASE_URL (e.g. Render Postgres' connection string).
// load() returns null on an empty database; the store then seeds and the first
// persist() writes that baseline — no separate seeding step.

import pg from 'pg';

const TABLE = 'app_state';

// SSL: managed hosts (Render external URLs, Heroku, …) need it but use certs
// that don't verify against public CAs; local/internal hosts don't speak SSL
// at all (Render's internal hostnames are dot-less, e.g. "dpg-xxx-a").
// Override with PGSSLMODE=disable / PGSSLMODE=require.
function sslFor(url) {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'disable') return false;
  if (mode) return { rejectUnauthorized: false };
  try {
    const host = new URL(url).hostname;
    const local = host === 'localhost' || host.startsWith('127.') || host === '::1' || !host.includes('.');
    return local ? false : { rejectUnauthorized: false };
  } catch {
    return false;
  }
}

export async function createPostgresProvider() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required when DATA_PROVIDER=postgres');

  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), max: 5 });
  pool.on('error', (e) => console.error('[postgres] idle client error:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      collection  text PRIMARY KEY,
      data        jsonb NOT NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  return {
    name: 'postgres',
    pool,

    async load() {
      const { rows } = await pool.query(`SELECT collection, data FROM ${TABLE}`);
      if (!rows.length) return null; // fresh database — the store seeds it
      return Object.fromEntries(rows.map((r) => [r.collection, r.data]));
    },

    // Upsert every collection in one transaction so a crash mid-write can't
    // leave the snapshot half old / half new.
    async persist(db) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [collection, data] of Object.entries(db)) {
          await client.query(
            `INSERT INTO ${TABLE} (collection, data, updated_at) VALUES ($1, $2::jsonb, now())
             ON CONFLICT (collection) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            [collection, JSON.stringify(data)],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
