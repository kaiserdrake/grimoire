import { query } from '../src/db.js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitForDatabase = async () => {
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
  await query('DROP TABLE IF EXISTS map_pins CASCADE;');
  await query('DROP TABLE IF EXISTS game_maps CASCADE;');
  await query('DROP TABLE IF EXISTS game_notes CASCADE;');
  await query('DROP TABLE IF EXISTS games CASCADE;');
  await query('DROP TABLE IF EXISTS users CASCADE;');
  await query("DROP TYPE IF EXISTS user_role;");
  await query("DROP TYPE IF EXISTS game_status;");

  console.log('INIT: Creating tables...');

  await query(`CREATE TYPE user_role AS ENUM ('Admin', 'Normal User');`);
  await query(`CREATE TYPE game_status AS ENUM ('backlog', 'playing', 'completed', 'dropped');`);

  await query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'Normal User',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE games (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      igdb_id INTEGER,
      title TEXT NOT NULL,
      cover_url TEXT,
      summary TEXT,
      genres TEXT[],
      platforms TEXT[],
      release_date DATE,
      status game_status NOT NULL DEFAULT 'backlog',
      rating INTEGER CHECK (rating BETWEEN 1 AND 10),
      personal_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE game_notes (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(game_id, user_id)
    );
  `);

  await query(`
    CREATE TABLE game_maps (
      id SERIAL PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      image_data TEXT,
      image_mime TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE map_pins (
      id SERIAL PRIMARY KEY,
      map_id INTEGER NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
      x_percent FLOAT NOT NULL,
      y_percent FLOAT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('INIT: Schema created successfully.');
};

const createAdminUser = async () => {
  const adminName = process.env.ADMIN_NAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminName || !adminPassword) {
    throw new Error('ADMIN_NAME and ADMIN_PASSWORD must be set in .env');
  }
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);
  const adminEmail = `${adminName.toLowerCase()}@internal.local`;
  await query(
    "INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, 'Admin', $3)",
    [adminEmail, adminName, passwordHash]
  );
  console.log(`INIT: Admin user '${adminName}' created.`);
};

const main = async () => {
  try {
    await waitForDatabase();
    await query('BEGIN');
    try {
      await createTables();
      await createAdminUser();
      await query('COMMIT');
      console.log('INIT: Database initialization complete!');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('INIT: Fatal error:', err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
