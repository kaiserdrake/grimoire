# Grimoire

A personal video game journal. Track your backlog, write markdown notes, and annotate game maps with pins — all in one self-hosted app.

![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Chakra UI](https://img.shields.io/badge/Chakra_UI-2-teal)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)

---

## Features

- **Backlog** — Add games via IGDB search or manually. Filter by status: Backlog, Playing, Completed, Dropped.
- **Notes** — Per-game markdown editor with live inline preview and auto-save.
- **Maps** — Upload a game map image and place annotated pins with labels, descriptions, and colors.

---

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | Next.js 14, Chakra UI v2, React 18      |
| Backend   | Express.js (Node 18, ESM)              |
| Database  | PostgreSQL 15                           |
| Auth      | JWT via HttpOnly cookies                |
| Theming   | CSS custom properties (`globals.css`)  |
| Deploy    | Docker Compose                          |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A Twitch / IGDB developer account for game search (free) — [get credentials here](https://dev.twitch.tv/console)

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone git@github.com:kaiserdrake/grimoire.git
cd grimoire
```

### 2. Create your environment file

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set each value:

```env
# Database — change these to something secure
POSTGRES_USER=grimoire_user
POSTGRES_PASSWORD=a_strong_password_here
POSTGRES_DB=grimoire_db
DB_HOST=grimoire-db

# Auth — use a long random string (e.g. run: openssl rand -hex 32)
JWT_SECRET=replace_with_a_long_random_secret

# Admin account — created automatically on first run
ADMIN_NAME=admin
ADMIN_PASSWORD=your_admin_password

# IGDB — from https://dev.twitch.tv/console
IGDB_CLIENT_ID=your_twitch_client_id
IGDB_CLIENT_SECRET=your_twitch_client_secret

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
GRIMOIRE_DATA_PATH=./appdata

NODE_ENV=production
```

> **Tip:** Generate a secure JWT secret with:
> ```bash
> openssl rand -hex 32
> ```

### 3. Build and start the containers

```bash
docker compose up --build -d
```

This builds all three containers (database, backend, frontend) and starts them in the background.

### 4. Initialize the database

Run this **once** after the first build to create all tables and the admin user:

```bash
docker compose exec grimoire-backend npm run db:init
```

You should see:
```
INIT: Database connection established.
INIT: Schema created successfully.
INIT: Admin user 'admin' created.
INIT: Database initialization complete!
```

### 5. Open the app

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:8089  |
| Backend  | http://localhost:3001  |

Sign in with the `ADMIN_NAME` and `ADMIN_PASSWORD` you set in `.env`.

---

## Updating the App

When you pull new changes from the repository:

### 1. Pull the latest code

```bash
git pull origin main
```

### 2. Rebuild and restart

```bash
docker compose up --build -d
```

Docker Compose will only rebuild containers whose source has changed. Your database data is stored in `./appdata/postgres` and is **not affected** by rebuilds.

### 3. Re-initialize the database (only if schema changed)

> ⚠️ **Warning:** Running `db:init` drops and recreates all tables. Only do this if there are breaking schema changes and you are okay losing existing data, or if you are setting up from scratch.

```bash
docker compose exec grimoire-backend npm run db:init
```

For non-destructive schema changes (e.g. adding a column), write a migration manually instead — see [Adding Migrations](#adding-migrations) below.

---

## Common Commands

```bash
# Start all services (detached)
docker compose up -d

# Stop all services
docker compose down

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f grimoire-backend
docker compose logs -f grimoire-frontend

# Restart a single service after a code change
docker compose up --build -d grimoire-backend

# Open a PostgreSQL shell
docker exec -it grimoire-db psql -U grimoire_user -d grimoire_db

# Check service health
curl http://localhost:3001/api/health
```

---

## Local Development (without Docker)

If you want to run the app locally for development:

### Backend

```bash
cd backend
npm install
# Make sure a local PostgreSQL instance is running and .env is configured
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:3000` and the backend on `http://localhost:3001`.

---

## IGDB / Twitch API Setup

Grimoire uses the [IGDB API](https://api-docs.igdb.com/) (powered by Twitch) to search for games.

1. Go to [https://dev.twitch.tv/console](https://dev.twitch.tv/console) and log in or create a free account.
2. Click **Register Your Application**.
3. Give it any name, set the OAuth Redirect URL to `http://localhost`, and choose **Category: Other**.
4. After creating the app, copy the **Client ID**.
5. Click **New Secret** to generate a **Client Secret**.
6. Add both to your `.env`:
   ```env
   IGDB_CLIENT_ID=your_client_id
   IGDB_CLIENT_SECRET=your_client_secret
   ```
7. Restart the backend: `docker compose up --build -d grimoire-backend`

---

## Adding Migrations

If you need to add a column or table without resetting the database:

```bash
# Open a psql shell
docker exec -it grimoire-db psql -U grimoire_user -d grimoire_db

# Run your migration manually, e.g.:
ALTER TABLE games ADD COLUMN playtime_hours INTEGER;

# Exit
\q
```

For larger projects, consider adding a migration tool like [node-pg-migrate](https://github.com/salsita/node-pg-migrate).

---

## User Management

The first admin account is created by `db:init` using the `ADMIN_NAME` and `ADMIN_PASSWORD` values from `.env`.

As an admin you can:
- Create additional user accounts (a one-time password is generated and shown once)
- Reset any user's password
- Delete users

Access user management via the **navbar menu → Manage Users** (visible to admins only).

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | ✅ | Database username |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `POSTGRES_DB` | ✅ | Database name |
| `DB_HOST` | ✅ | Database host (use `grimoire-db` in Docker) |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens — keep this long and random |
| `ADMIN_NAME` | ✅ | Username for the first admin account |
| `ADMIN_PASSWORD` | ✅ | Password for the first admin account |
| `IGDB_CLIENT_ID` | ✅ | Twitch app Client ID for IGDB game search |
| `IGDB_CLIENT_SECRET` | ✅ | Twitch app Client Secret for IGDB game search |
| `NEXT_PUBLIC_API_URL` | ✅ | URL the frontend uses to reach the backend |
| `GRIMOIRE_DATA_PATH` | ✅ | Host path where PostgreSQL data is persisted |
| `NODE_ENV` | ✅ | `development` or `production` |

---

## License

MIT — free to use, modify, and build upon.
