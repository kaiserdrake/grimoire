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

## Deployment Modes

Grimoire supports two deployment modes using Docker Compose override files.

### Production (Unraid, home server)

Uses **pre-built images** published to GitHub Container Registry (GHCR). No local build required.

`docker-compose.yml` is the production config. Just pull and run:

```bash
docker compose pull
docker compose up -d
```

### Local Development

A `docker-compose.override.yml` file is automatically merged by Docker Compose when present. It overrides the production images with local builds so you can develop and test changes without touching the production config.

```bash
docker compose up --build -d
```

> Docker Compose automatically detects and merges `docker-compose.override.yml` — no extra flags needed.

To run **strictly production** locally (ignoring the override file):

```bash
docker compose -f docker-compose.yml up -d
```

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

# Data path
GRIMOIRE_DATA_PATH=./appdata

NODE_ENV=production

# Optional: set this when behind a reverse proxy like Nginx Proxy Manager
# If unset, the backend will auto-detect its public URL from the request
# API_PUBLIC_URL=https://grimoire.yourdomain.com
```

> **Tip:** Generate a secure JWT secret with:
> ```bash
> openssl rand -hex 32
> ```

### 3. Start the containers

**Production** (uses pre-built images from GHCR):
```bash
docker compose pull
docker compose up -d
```

**Local development** (builds from source):
```bash
docker compose up --build -d
```

### 4. Initialize the database

Run this **once** after the first start to create all tables and the admin user:

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

### Production

```bash
git pull origin main
docker compose pull
docker compose up -d
```

Docker will pull only the images that have changed. Your database data is stored in `./appdata/postgres` and is **not affected** by updates.

### Local Development

```bash
git pull origin main
docker compose up --build -d
```

### Re-initialize the database (only if schema changed)

> ⚠️ **Warning:** Running `db:init` drops and recreates all tables. Only do this if there are breaking schema changes and you are okay losing existing data, or if you are setting up from scratch.

```bash
docker compose exec grimoire-backend npm run db:init
```

For non-destructive schema changes (e.g. adding a column), write a migration manually instead — see [Adding Migrations](#adding-migrations) below.

---

## Reverse Proxy Setup (Nginx Proxy Manager)

When running behind a reverse proxy, set `API_PUBLIC_URL` in your `.env` to the public-facing URL of the backend. This ensures the frontend receives the correct URL at runtime.

```env
API_PUBLIC_URL=https://grimoire.yourdomain.com
```

> **How it works:** The frontend fetches its backend URL at runtime via `/api/config` — nothing is baked into the Docker image at build time. This makes the same image portable across environments (local, Unraid, reverse proxy, etc.).

If `API_PUBLIC_URL` is not set, the backend will auto-detect the URL from the incoming request headers, which works correctly for direct access but may return wrong results behind a proxy.

---

## Publishing Images to GitHub Container Registry

Docker images are automatically built and pushed to GHCR on every push to `main` via GitHub Actions (`.github/workflows/docker-publish.yml`).

The workflow builds:
- `ghcr.io/kaiserdrake/grimoire-backend:latest`
- `ghcr.io/kaiserdrake/grimoire-frontend:latest`

To pull images manually on your server:

```bash
# Log in to GHCR (one-time setup)
echo <your_github_token> | docker login ghcr.io -u kaiserdrake --password-stdin

# Pull latest images
docker compose pull
```

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

# Restart a single service
docker compose up -d grimoire-backend

# Open a PostgreSQL shell
docker exec -it grimoire-db psql -U grimoire_user -d grimoire_db

# Check service health
curl http://localhost:3001/api/health

# Check runtime config (API URL as seen by frontend)
curl http://localhost:3001/api/config
```

---

## Exporting Data

You can export all game and playthrough data as JSON directly from the backend container.

```bash
# Export all users' data to stdout
docker compose exec grimoire-backend npm run export

# Export a single user's data
docker compose exec grimoire-backend npm run export -- --user alice

# Save the output to a file on the host
docker compose exec grimoire-backend npm run export > games-export.json
```

The output is a JSON array — one entry per user — each containing a `user` object and a `games` array with nested `playthroughs` and `sessions`.

---

## Local Development (without Docker)

If you want to run the app locally for development without Docker:

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
IGDB credentials are configured **per user** via the app's Settings, not via environment variables.

1. Go to [https://dev.twitch.tv/console](https://dev.twitch.tv/console) and log in or create a free account.
2. Click **Register Your Application**.
3. Give it any name, set the OAuth Redirect URL to `http://localhost`, and choose **Category: Other**.
4. After creating the app, copy the **Client ID**.
5. Click **New Secret** to generate a **Client Secret**.
6. Log in to Grimoire, open **Settings → IGDB Integration**, and paste both values.

Each user configures their own credentials. Game search will not work until credentials are set.

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
| `GRIMOIRE_DATA_PATH` | ✅ | Host path where PostgreSQL data and uploads are persisted |
| `NODE_ENV` | ✅ | `development` or `production` |
| `API_PUBLIC_URL` | ❌ | Public URL of the backend. Set this when behind a reverse proxy. Auto-detected if unset. |

---

## License

MIT — free to use, modify, and build upon.
