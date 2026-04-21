import { query } from '../src/db.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDb = async () => {
  const maxRetries = 30;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await query('SELECT 1');
      console.log('INIT: Database connection established.');
      return;
    } catch {
      retries++;
      console.log(`INIT: Waiting for database... (${retries}/${maxRetries})`);
      await sleep(2000);
    }
  }
  throw new Error('INIT: Could not connect to database after maximum retries');
};

const createTables = async () => {
  console.log('INIT: Dropping existing tables...');

  await query('DROP TABLE IF EXISTS bulletin_posts CASCADE;');
  await query('DROP TABLE IF EXISTS map_pins CASCADE;');
  await query('DROP TABLE IF EXISTS game_maps CASCADE;');
  await query('DROP TABLE IF EXISTS game_attachments CASCADE;');
  await query('DROP TABLE IF EXISTS note_files CASCADE;');
  await query('DROP TABLE IF EXISTS game_notes CASCADE;');
  await query('DROP TABLE IF EXISTS user_settings CASCADE;');
  await query('DROP TABLE IF EXISTS playthrough_sessions CASCADE;');
  await query('DROP TABLE IF EXISTS playthroughs CASCADE;');
  await query('DROP TABLE IF EXISTS games CASCADE;');
  await query('DROP TABLE IF EXISTS users CASCADE;');
  await query("DROP TYPE IF EXISTS user_role;");
  await query("DROP TYPE IF EXISTS game_tag;");
  await query("DROP TYPE IF EXISTS game_list_status;");
  await query("DROP TYPE IF EXISTS playthrough_status;");

  console.log('INIT: Creating tables...');

  await query(`CREATE TYPE user_role AS ENUM ('Admin', 'Normal User');`);
  await query(`CREATE TYPE game_tag AS ENUM ('wishlist', 'backlog', 'favorite', 'dropped');`);
  await query(`CREATE TYPE playthrough_status AS ENUM ('playing', 'completed', 'pend', 'dropped');`);

  await query(`
    CREATE TABLE users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      name          VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          user_role NOT NULL DEFAULT 'Normal User',
      igdb_client_id     TEXT,
      igdb_client_secret TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE games (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      igdb_id      INTEGER,
      title        TEXT NOT NULL,
      cover_url    TEXT,
      summary      TEXT,
      genres       TEXT[],
      series       TEXT,
      developer    TEXT,
      publisher    TEXT,
      time_to_beat INTEGER,
      releases     JSONB,
      tag          game_tag,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE playthroughs (
      id         SERIAL PRIMARY KEY,
      game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform   TEXT NOT NULL,
      label      TEXT,
      status     playthrough_status NOT NULL DEFAULT 'pend',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE playthrough_sessions (
      id             SERIAL PRIMARY KEY,
      playthrough_id INTEGER NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date     DATE NOT NULL,
      end_date       DATE,
      status         playthrough_status NOT NULL DEFAULT 'playing',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE note_files (
      id             SERIAL PRIMARY KEY,
      playthrough_id INTEGER NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title          TEXT NOT NULL DEFAULT 'Untitled',
      content        TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE user_settings (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, key)
    );
  `);

  // ── Attachments ────────────────────────────────────────────────────────────
  // Stores uploaded files (map images, note images) on disk.
  // set_type: 'maps' | 'notes'
  // source:   'upload' (local file) | 'url' (fetched from remote URL)
  await query(`
    CREATE TABLE game_attachments (
      id            SERIAL PRIMARY KEY,
      game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      set_type      TEXT NOT NULL,
      filename      TEXT NOT NULL,
      original_name TEXT,
      mime_type     TEXT NOT NULL,
      file_path     TEXT NOT NULL,
      url           TEXT NOT NULL,
      source        TEXT NOT NULL DEFAULT 'upload',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Maps ───────────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE game_maps (
      id             SERIAL PRIMARY KEY,
      game_id        INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      playthrough_id INTEGER NOT NULL REFERENCES playthroughs(id) ON DELETE CASCADE,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attachment_id  INTEGER REFERENCES game_attachments(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE map_pins (
      id          SERIAL PRIMARY KEY,
      map_id      INTEGER NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
      x_percent   FLOAT NOT NULL,
      y_percent   FLOAT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT,
      color       TEXT NOT NULL DEFAULT 'blue',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

    // ── Bulletin board ─────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE bulletin_posts (
      id            SERIAL PRIMARY KEY,
      note_file_id  INTEGER NOT NULL REFERENCES note_files(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      cover_url     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('INIT: Schema created successfully.');
};

const createAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  const adminEmail = `${adminName}@grimoire.local`;

  const existing = await query('SELECT id FROM users WHERE name = $1', [adminName]);
  if (existing.rows.length > 0) {
    console.log(`INIT: Admin user '${adminName}' already exists.`);
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 12);
  await query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'Admin')`,
    [adminEmail, adminName, hash]
  );
  console.log(`INIT: Admin user '${adminName}' created.`);
};

const main = async () => {
  try {
    await waitForDb();
    await createTables();
    await createAdmin();
    console.log('INIT: Database initialization complete!');
    process.exit(0);
  } catch (err) {
    console.error('INIT ERROR:', err);
    process.exit(1);
  }
};

main();
