import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fetch from 'node-fetch';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { query } from './db.js';
import { isAuthenticated, isAdmin } from './auth.js';

dotenv.config();

const app = express();
const PORT = 3001;

// ── UPLOAD DIR SETUP ──────────────────────────────────────────────────────────
const DATA_PATH = '/data';
const UPLOADS_ROOT = path.join(DATA_PATH, 'uploads');
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

// multer instance — destination resolved per-request in the route handlers
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const { gameId, set } = req.params;
      const dir = path.join(UPLOADS_ROOT, 'games', String(gameId), set);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:8087',
    'http://localhost:8087',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://grimoire-frontend:3000',
    'http://grimoire.laeradsphere.com'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

// ── STATIC FILE SERVING ───────────────────────────────────────────────────────
// Serves uploaded files at /uploads/games/{gameId}/{set}/{filename}
app.use('/uploads', express.static(UPLOADS_ROOT));

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ── CONFIG ────────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const apiUrl = process.env.API_PUBLIC_URL
    || `${req.protocol}://${req.headers.host}`;
  res.json({ apiUrl });
});

// ── IGDB TOKEN CACHE (per user) ───────────────────────────────────────────────
const igdbTokenCache = new Map(); // userId -> { token, expiry }

const getIgdbToken = async (clientId, clientSecret, userId) => {
  const cached = igdbTokenCache.get(userId);
  if (cached && Date.now() < cached.expiry) return cached.token;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to obtain IGDB token');
  const data = await res.json();
  igdbTokenCache.set(userId, {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  });
  return data.access_token;
};

// ── IGDB CREDENTIALS ──────────────────────────────────────────────────────────
app.get('/api/igdb/credentials', isAuthenticated, async (req, res) => {
  try {
    const result = await query(
      'SELECT igdb_client_id, igdb_client_secret FROM users WHERE id=$1',
      [req.user.id]
    );
    const row = result.rows[0];
    res.json({
      igdb_client_id:     row.igdb_client_id     || null,
      // Never send the secret back in full — just signal whether it's set
      igdb_client_secret: row.igdb_client_secret ? '••••••••' : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/igdb/credentials', isAuthenticated, async (req, res) => {
  const { igdb_client_id, igdb_client_secret } = req.body;
  try {
    await query(
      'UPDATE users SET igdb_client_id=$1, igdb_client_secret=$2 WHERE id=$3',
      [igdb_client_id || null, igdb_client_secret || null, req.user.id]
    );
    // Invalidate cached token for this user since credentials changed
    igdbTokenCache.delete(req.user.id);
    res.json({ message: 'IGDB credentials updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── IGDB SEARCH PROXY ─────────────────────────────────────────────────────────
app.get('/api/igdb/search', isAuthenticated, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Query must be at least 2 characters.' });
  }

  // ── Resolve user's IGDB credentials ──────────────────────────────────────
  const credResult = await query(
    'SELECT igdb_client_id, igdb_client_secret FROM users WHERE id=$1',
    [req.user.id]
  ).catch(() => null);
  const clientId     = credResult?.rows[0]?.igdb_client_id     || null;
  const clientSecret = credResult?.rows[0]?.igdb_client_secret || null;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ message: 'IGDB credentials not configured. Please set them in Settings.' });
  }

  // ── ID lookup: "id:XXXXX" ─────────────────────────────────────────────────
  const idMatch = q.trim().match(/^id:(\d+)$/i);

  if (idMatch) {
    const igdbId = parseInt(idMatch[1], 10);
    try {
      const token = await getIgdbToken(clientId, clientSecret, req.user.id);
      const igdbRes = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: `
          fields id, name, summary, cover.url,
                 genres.name, franchises.name,
                 involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
                 release_dates.platform.name, release_dates.date, release_dates.human,
                 game_modes.name,
                 hypes;
          where id = ${igdbId};
          limit 1;
        `,
      });
      if (!igdbRes.ok) throw new Error('IGDB API error');
      const games = await igdbRes.json();

      let ttbMap = {};
      if (games.length > 0) {
        try {
          const ttbRes = await fetch('https://api.igdb.com/v4/game_time_to_beats', {
            method: 'POST',
            headers: {
              'Client-ID': process.env.IGDB_CLIENT_ID,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'text/plain',
            },
            body: `fields game_id, normally; where game_id = (${igdbId}); limit 1;`,
          });
          if (ttbRes.ok) {
            const ttbData = await ttbRes.json();
            ttbData.forEach((t) => { ttbMap[t.game_id] = t.normally ? Math.round(t.normally / 3600) : null; });
          }
        } catch { /* ttb is optional */ }
      }

      const formatted = games.map((g) => {
        const developers = g.involved_companies?.filter((c) => c.developer).map((c) => c.company.name) || [];
        const publishers = g.involved_companies?.filter((c) => c.publisher).map((c) => c.company.name) || [];
        const releases = g.release_dates?.map((rd) => ({
          platform: rd.platform?.name || null,
          date: rd.date ? new Date(rd.date * 1000).toISOString().split('T')[0] : null,
          human: rd.human || null,
        })) || [];
        return {
          igdb_id: g.id,
          title: g.name,
          summary: g.summary || null,
          cover_url: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null,
          genres: g.genres?.map((x) => x.name) || [],
          series: g.franchises?.[0]?.name || null,
          developer: developers[0] || null,
          publisher: publishers[0] || null,
          time_to_beat: ttbMap[g.id] || null,
          releases,
        };
      });
      return res.json(formatted);
    } catch (err) {
      console.error('IGDB ID lookup error:', err);
      return res.status(500).json({ message: 'Failed to fetch game by IGDB ID.' });
    }
  }
  try {
    const token = await getIgdbToken(clientId, clientSecret, req.user.id);
    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `
        search "${q.trim().replace(/"/g, '')}";
        fields id, name, summary, cover.url,
               genres.name, franchises.name,
               involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
               release_dates.platform.name, release_dates.date, release_dates.human,
               game_modes.name,
               hypes;
        limit 10;
        where version_parent = null;
      `,
    });
    if (!igdbRes.ok) throw new Error('IGDB API error');
    const games = await igdbRes.json();

    // Fetch time_to_beat separately (different endpoint)
    const igdbIds = games.map((g) => g.id).filter(Boolean);
    let ttbMap = {};
    if (igdbIds.length > 0) {
      try {
        const ttbRes = await fetch('https://api.igdb.com/v4/game_time_to_beats', {
          method: 'POST',
          headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: `fields game_id, normally; where game_id = (${igdbIds.join(',')}); limit 10;`,
        });
        if (ttbRes.ok) {
          const ttbData = await ttbRes.json();
          ttbData.forEach((t) => { ttbMap[t.game_id] = t.normally ? Math.round(t.normally / 3600) : null; });
        }
      } catch { /* ttb is optional */ }
    }

    const formatted = games.map((g) => {
      const developers = g.involved_companies?.filter((c) => c.developer).map((c) => c.company.name) || [];
      const publishers = g.involved_companies?.filter((c) => c.publisher).map((c) => c.company.name) || [];
      const releases = g.release_dates?.map((rd) => ({
        platform: rd.platform?.name || null,
        date: rd.date ? new Date(rd.date * 1000).toISOString().split('T')[0] : null,
        human: rd.human || null,
      })) || [];

      return {
        igdb_id: g.id,
        title: g.name,
        summary: g.summary || null,
        cover_url: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null,
        genres: g.genres?.map((x) => x.name) || [],
        series: g.franchises?.[0]?.name || null,
        developer: developers[0] || null,
        publisher: publishers[0] || null,
        time_to_beat: ttbMap[g.id] || null,
        releases,
      };
    });
    res.json(formatted);
  } catch (err) {
    console.error('IGDB search error:', err);
    res.status(500).json({ message: 'Failed to search IGDB. Check API credentials.' });
  }
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: 'Username/email and password are required.' });
  }
  try {
    const field = usernameOrEmail.includes('@') ? 'email' : 'name';
    const result = await query(`SELECT * FROM users WHERE ${field} = $1`, [usernameOrEmail]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials.' });

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '72h' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({ message: 'Login successful.', user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful.' });
});

app.get('/api/me', isAuthenticated, (req, res) => {
  res.json({ user: req.user });
});

// ── USERS (admin) ─────────────────────────────────────────────────────────────
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/users', isAuthenticated, isAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required.' });
  try {
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [name, email, hash, role || 'Normal User']
    );
    res.status(201).json({ ...result.rows[0], tempPassword });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Username or email already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account.' });
  try {
    const result = await query('DELETE FROM users WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/users/:id/password', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  if (req.user.role !== 'Admin' && parseInt(id) !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden.' });
  }
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  try {
    const result = await query('SELECT password_hash FROM users WHERE id=$1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const user = result.rows[0];
    if (req.user.role !== 'Admin') {
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, id]);
    res.json({ message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GAMES ─────────────────────────────────────────────────────────────────────
app.get('/api/games', isAuthenticated, async (req, res) => {
  const { tag } = req.query;
  const userId = req.user.id;
  try {
    let q = `
      SELECT g.*,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id',         p.id,
              'platform',   p.platform,
              'label',      p.label,
              'status',     p.status,
              'created_at', p.created_at,
              'updated_at', p.updated_at,
              'sessions',   COALESCE((
                SELECT json_agg(s.* ORDER BY s.start_date, s.created_at)
                FROM playthrough_sessions s
                WHERE s.playthrough_id = p.id
              ), '[]')
            ) ORDER BY p.created_at
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS playthroughs
      FROM games g
      LEFT JOIN playthroughs p ON p.game_id = g.id AND p.user_id = g.user_id
      WHERE g.user_id = $1
    `;
    const params = [userId];
    if (tag && ['wishlist', 'backlog', 'favorite', 'dropped'].includes(tag)) {
      q += ` AND g.tag = $2`;
      params.push(tag);
    }
    q += ` GROUP BY g.id ORDER BY g.updated_at DESC`;
    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/games', isAuthenticated, async (req, res) => {
  const { igdb_id, title, cover_url, summary, genres, series, developer, publisher, time_to_beat, releases, tag } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required.' });
  const userId = req.user.id;
  try {
    const result = await query(
      `INSERT INTO games (user_id, igdb_id, title, cover_url, summary, genres, series, developer, publisher, time_to_beat, releases, tag)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId, igdb_id || null, title, cover_url || null, summary || null,
        genres || [], series || null, developer || null, publisher || null,
        time_to_beat || null,
        releases ? JSON.stringify(releases) : null,
        tag || null,
      ]
    );
    res.status(201).json({ ...result.rows[0], playthroughs: [] });
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/games/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      `SELECT g.*,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id',         p.id,
              'platform',   p.platform,
              'label',      p.label,
              'status',     p.status,
              'created_at', p.created_at,
              'updated_at', p.updated_at,
              'sessions',   COALESCE((
                SELECT json_agg(s.* ORDER BY s.start_date, s.created_at)
                FROM playthrough_sessions s
                WHERE s.playthrough_id = p.id
              ), '[]')
            ) ORDER BY p.created_at
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS playthroughs
      FROM games g
      LEFT JOIN playthroughs p ON p.game_id = g.id AND p.user_id = g.user_id
      WHERE g.id = $1 AND g.user_id = $2
      GROUP BY g.id`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/games/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { title, cover_url, summary, genres, series, developer, publisher, time_to_beat, releases } = req.body;
  const userId = req.user.id;
  if (!title) return res.status(400).json({ message: 'Title is required.' });
  try {
    const result = await query(
      `UPDATE games SET title=$1, cover_url=$2, summary=$3, genres=$4, series=$5, developer=$6,
       publisher=$7, time_to_beat=$8, releases=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [title, cover_url || null, summary || null, genres || [], series || null, developer || null,
       publisher || null, time_to_beat || null, releases ? JSON.stringify(releases) : null, id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/games/:id/tag', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { tag } = req.body;
  const userId = req.user.id;
  if (tag !== null && !['wishlist', 'backlog', 'favorite', 'dropped'].includes(tag)) {
    return res.status(400).json({ message: 'Invalid tag.' });
  }
  try {
    const result = await query(
      'UPDATE games SET tag=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id, tag',
      [tag, id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/games/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await query('DELETE FROM games WHERE id=$1 AND user_id=$2 RETURNING id', [id, userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json({ message: 'Game deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PLAYTHROUGHS ──────────────────────────────────────────────────────────────
app.get('/api/games/:id/playthroughs', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    const result = await query(
      `SELECT p.*,
              COALESCE(json_agg(s.* ORDER BY s.start_date, s.created_at) FILTER (WHERE s.id IS NOT NULL), '[]') AS sessions
       FROM playthroughs p
       LEFT JOIN playthrough_sessions s ON s.playthrough_id = p.id
       WHERE p.game_id=$1 AND p.user_id=$2
       GROUP BY p.id
       ORDER BY p.created_at`,
      [id, userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/games/:id/playthroughs', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { platform, status, label } = req.body;
  const userId = req.user.id;
  if (!platform) return res.status(400).json({ message: 'Platform is required.' });
  const ptStatus = status || 'pend';
  if (!['playing', 'completed', 'pend', 'dropped'].includes(ptStatus)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [id]);

    const result = await query(
      'INSERT INTO playthroughs (game_id, user_id, platform, status, label) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, userId, platform, ptStatus, label || null]
    );
    res.status(201).json({ ...result.rows[0], sessions: [] });
  } catch (err) {
    console.error('Error creating playthrough:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/playthroughs/:ptId', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const { platform, status, label } = req.body;
  const userId = req.user.id;
  if (status && !['playing', 'completed', 'pend', 'dropped'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    const existing = await query('SELECT * FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });

    const pt = existing.rows[0];
    const result = await query(
      'UPDATE playthroughs SET platform=$1, status=$2, label=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [platform ?? pt.platform, status ?? pt.status, label !== undefined ? label : pt.label, ptId]
    );
    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [pt.game_id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/playthroughs/:ptId', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      'DELETE FROM playthroughs WHERE id=$1 AND user_id=$2 RETURNING id, game_id',
      [ptId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [result.rows[0].game_id]);
    res.json({ message: 'Playthrough deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PLAYTHROUGH SESSIONS ──────────────────────────────────────────────────────
app.get('/api/playthroughs/:ptId/sessions', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const userId = req.user.id;
  try {
    const ptCheck = await query('SELECT id FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const result = await query(
      'SELECT * FROM playthrough_sessions WHERE playthrough_id=$1 ORDER BY start_date, created_at',
      [ptId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/playthroughs/:ptId/sessions', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const { start_date, end_date, status } = req.body;
  const userId = req.user.id;
  if (!start_date) return res.status(400).json({ message: 'start_date is required.' });
  const sessionStatus = status || 'playing';
  if (!['playing', 'completed', 'pend', 'dropped'].includes(sessionStatus)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    const ptCheck = await query(
      'SELECT p.id, p.game_id FROM playthroughs p WHERE p.id=$1 AND p.user_id=$2',
      [ptId, userId]
    );
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const { game_id } = ptCheck.rows[0];

    const result = await query(
      'INSERT INTO playthrough_sessions (playthrough_id, user_id, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [ptId, userId, start_date, end_date || null, sessionStatus]
    );
    await query('UPDATE playthroughs SET status=$1, updated_at=NOW() WHERE id=$2', [sessionStatus, ptId]);
    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [game_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/playthroughs/:ptId/sessions/:sessionId', isAuthenticated, async (req, res) => {
  const { ptId, sessionId } = req.params;
  const { start_date, end_date, status } = req.body;
  const userId = req.user.id;
  if (status && !['playing', 'completed', 'pend', 'dropped'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    const ptCheck = await query(
      'SELECT p.id, p.game_id FROM playthroughs p WHERE p.id=$1 AND p.user_id=$2',
      [ptId, userId]
    );
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const { game_id } = ptCheck.rows[0];

    const existing = await query('SELECT * FROM playthrough_sessions WHERE id=$1 AND playthrough_id=$2', [sessionId, ptId]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Session not found.' });
    const cur = existing.rows[0];

    const result = await query(
      'UPDATE playthrough_sessions SET start_date=$1, end_date=$2, status=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [start_date ?? cur.start_date, end_date !== undefined ? end_date : cur.end_date, status ?? cur.status, sessionId]
    );

    const latestSession = await query(
      'SELECT status FROM playthrough_sessions WHERE playthrough_id=$1 ORDER BY start_date DESC, created_at DESC LIMIT 1',
      [ptId]
    );
    if (latestSession.rows.length > 0) {
      await query('UPDATE playthroughs SET status=$1, updated_at=NOW() WHERE id=$2', [latestSession.rows[0].status, ptId]);
    }
    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [game_id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/playthroughs/:ptId/sessions/:sessionId', isAuthenticated, async (req, res) => {
  const { ptId, sessionId } = req.params;
  const userId = req.user.id;
  try {
    const ptCheck = await query(
      'SELECT p.id, p.game_id FROM playthroughs p WHERE p.id=$1 AND p.user_id=$2',
      [ptId, userId]
    );
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const { game_id } = ptCheck.rows[0];

    const result = await query(
      'DELETE FROM playthrough_sessions WHERE id=$1 AND playthrough_id=$2 RETURNING id',
      [sessionId, ptId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Session not found.' });

    // Re-sync playthrough status after deletion
    const latestSession = await query(
      'SELECT status FROM playthrough_sessions WHERE playthrough_id=$1 ORDER BY start_date DESC, created_at DESC LIMIT 1',
      [ptId]
    );
    if (latestSession.rows.length > 0) {
      await query('UPDATE playthroughs SET status=$1, updated_at=NOW() WHERE id=$2', [latestSession.rows[0].status, ptId]);
    } else {
      await query('UPDATE playthroughs SET status=$1, updated_at=NOW() WHERE id=$2', ['pend', ptId]);
    }
    await query('UPDATE games SET updated_at=NOW() WHERE id=$1', [game_id]);

    res.json({ message: 'Session deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── CALENDAR ──────────────────────────────────────────────────────────────────
app.get('/api/calendar/sessions', isAuthenticated, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await query(
      `SELECT s.id, s.playthrough_id, s.start_date, s.end_date, s.status,
              p.platform, p.game_id,
              g.title AS game_title, g.cover_url, g.releases AS game_releases
       FROM playthrough_sessions s
       JOIN playthroughs p ON p.id = s.playthrough_id
       JOIN games g ON g.id = p.game_id
       WHERE s.user_id = $1
       ORDER BY s.start_date`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── NOTES (scoped to playthrough) ────────────────────────────────────────────
app.get('/api/playthroughs/:ptId/notes', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const userId = req.user.id;
  try {
    const ptCheck = await query('SELECT id FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });

    const result = await query(
      'SELECT content, updated_at FROM game_notes WHERE playthrough_id=$1 AND user_id=$2',
      [ptId, userId]
    );
    res.json(result.rows[0] || { content: '', updated_at: null });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/playthroughs/:ptId/notes', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  try {
    const ptCheck = await query(
      'SELECT p.id, p.game_id FROM playthroughs p WHERE p.id=$1 AND p.user_id=$2',
      [ptId, userId]
    );
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const { game_id } = ptCheck.rows[0];

    const result = await query(
      `INSERT INTO game_notes (game_id, playthrough_id, user_id, content, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (playthrough_id, user_id) DO UPDATE SET content=$4, updated_at=NOW()
       RETURNING content, updated_at`,
      [game_id, ptId, userId, content || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving notes:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── NOTE FILES (multi-file notes per playthrough) ────────────────────────────

// List note files for a playthrough (metadata only, no content)
app.get('/api/playthroughs/:ptId/note-files', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const userId = req.user.id;
  try {
    const ptCheck = await query('SELECT id FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });

    const result = await query(
      'SELECT id, title, updated_at, created_at FROM note_files WHERE playthrough_id=$1 AND user_id=$2 ORDER BY created_at',
      [ptId, userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing note files:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create a new note file
app.post('/api/playthroughs/:ptId/note-files', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const { title } = req.body;
  const userId = req.user.id;
  try {
    const ptCheck = await query('SELECT id FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });

    const result = await query(
      `INSERT INTO note_files (playthrough_id, user_id, title, content)
       VALUES ($1, $2, $3, '') RETURNING id, title, updated_at, created_at`,
      [ptId, userId, title || 'Untitled']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating note file:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get a single note file (with content)
app.get('/api/note-files/:fileId', isAuthenticated, async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      'SELECT id, title, content, updated_at, created_at FROM note_files WHERE id=$1 AND user_id=$2',
      [fileId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Note file not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Update a note file (title and/or content)
app.put('/api/note-files/:fileId', isAuthenticated, async (req, res) => {
  const { fileId } = req.params;
  const { title, content } = req.body;
  const userId = req.user.id;
  try {
    const existing = await query(
      'SELECT id, title, content FROM note_files WHERE id=$1 AND user_id=$2',
      [fileId, userId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Note file not found.' });
    const cur = existing.rows[0];

    const result = await query(
      `UPDATE note_files SET title=$1, content=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4
       RETURNING id, title, content, updated_at`,
      [
        title !== undefined ? title : cur.title,
        content !== undefined ? content : cur.content,
        fileId,
        userId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating note file:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete a note file — also eagerly cleans up referenced notes-set attachments
app.delete('/api/note-files/:fileId', isAuthenticated, async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      'DELETE FROM note_files WHERE id=$1 AND user_id=$2 RETURNING id, content',
      [fileId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Note file not found.' });

    // Eager cleanup: find /uploads/... URLs referenced in the deleted note's content
    // and delete the matching attachment records + disk files.
    const content = result.rows[0].content || '';
    const urlPattern = /\/uploads\/games\/\d+\/notes\/[^\s)"']+/g;
    const referencedUrls = content.match(urlPattern) || [];
    if (referencedUrls.length > 0) {
      for (const url of referencedUrls) {
        const attResult = await query(
          'DELETE FROM game_attachments WHERE url=$1 AND user_id=$2 RETURNING file_path',
          [url, userId]
        );
        if (attResult.rows.length > 0) {
          const filePath = attResult.rows[0].file_path;
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Failed to delete file ${filePath}:`, err);
          });
        }
      }
    }

    res.json({ message: 'Note file deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── ATTACHMENTS ───────────────────────────────────────────────────────────────

// List all attachments for a game, optionally filtered by set_type
app.get('/api/games/:gameId/attachments', isAuthenticated, async (req, res) => {
  const { gameId } = req.params;
  const { set } = req.query; // optional: 'maps' | 'notes'
  const userId = req.user.id;
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [gameId, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    let q = 'SELECT id, set_type, filename, original_name, mime_type, url, source, created_at FROM game_attachments WHERE game_id=$1 AND user_id=$2';
    const params = [gameId, userId];
    if (set && ['maps', 'notes'].includes(set)) {
      q += ' AND set_type=$3';
      params.push(set);
    }
    q += ' ORDER BY created_at';

    const result = await query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Upload an attachment — multipart file upload
// POST /api/games/:gameId/attachments/:set  (set = 'maps' | 'notes')
app.post('/api/games/:gameId/attachments/:set', isAuthenticated, (req, res, next) => {
  // Validate set before multer runs so we don't write to a bad path
  if (!['maps', 'notes'].includes(req.params.set)) {
    return res.status(400).json({ message: "set must be 'maps' or 'notes'." });
  }
  next();
}, upload.single('file'), async (req, res) => {
  const { gameId, set } = req.params;
  const userId = req.user.id;

  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [gameId, userId]);
    if (gameCheck.rows.length === 0) {
      // Clean up uploaded file if game check fails
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'Game not found.' });
    }

    // ── Case 1: local file upload ──
    if (req.file) {
      const url = `/uploads/games/${gameId}/${set}/${req.file.filename}`;
      const result = await query(
        `INSERT INTO game_attachments (game_id, user_id, set_type, filename, original_name, mime_type, file_path, url, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload') RETURNING id, set_type, filename, original_name, mime_type, url, source, created_at`,
        [gameId, userId, set, req.file.filename, req.file.originalname, req.file.mimetype, req.file.path, url]
      );
      return res.status(201).json(result.rows[0]);
    }

    // ── Case 2: URL fetch ──
    const { url: sourceUrl } = req.body;
    if (!sourceUrl) {
      return res.status(400).json({ message: 'Either a file or a url is required.' });
    }

    const fetchRes = await fetch(sourceUrl);
    if (!fetchRes.ok) {
      return res.status(422).json({ message: `Could not fetch image from URL (${fetchRes.status}).` });
    }
    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(422).json({ message: 'URL does not point to an image.' });
    }

    const extMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
    const ext = extMap[contentType.split(';')[0].trim()] || '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    const dir = path.join(UPLOADS_ROOT, 'games', String(gameId), set);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);

    const buffer = await fetchRes.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const url = `/uploads/games/${gameId}/${set}/${filename}`;
    const originalName = path.basename(new URL(sourceUrl).pathname) || filename;

    const result = await query(
      `INSERT INTO game_attachments (game_id, user_id, set_type, filename, original_name, mime_type, file_path, url, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'url') RETURNING id, set_type, filename, original_name, mime_type, url, source, created_at`,
      [gameId, userId, set, filename, originalName, contentType, filePath, url]
    );
    return res.status(201).json(result.rows[0]);

  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Error creating attachment:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete an attachment
// Notes-set: blocked if any note_file in the same game still references the URL.
// Maps-set:  always allowed (map record deletion handles this via the maps DELETE route).
app.delete('/api/attachments/:attachmentId', isAuthenticated, async (req, res) => {
  const { attachmentId } = req.params;
  const userId = req.user.id;
  try {
    const attResult = await query(
      'SELECT id, game_id, set_type, file_path, url FROM game_attachments WHERE id=$1 AND user_id=$2',
      [attachmentId, userId]
    );
    if (attResult.rows.length === 0) return res.status(404).json({ message: 'Attachment not found.' });
    const att = attResult.rows[0];

    // Reference check for notes set
    if (att.set_type === 'notes') {
      const refs = await query(
        `SELECT id FROM note_files
         WHERE user_id=$1
           AND playthrough_id IN (SELECT id FROM playthroughs WHERE game_id=$2)
           AND content LIKE $3`,
        [userId, att.game_id, `%${att.url}%`]
      );
      if (refs.rows.length > 0) {
        return res.status(409).json({
          message: 'This image is still referenced in one or more notes. Remove it from those notes first.',
        });
      }
    }

    await query('DELETE FROM game_attachments WHERE id=$1', [attachmentId]);
    fs.unlink(att.file_path, (err) => {
      if (err) console.error(`Failed to delete file ${att.file_path}:`, err);
    });

    res.json({ message: 'Attachment deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── MAPS (scoped to playthrough) ──────────────────────────────────────────────

// List maps — joins attachment to return the image URL (no more base64)
app.get('/api/playthroughs/:ptId/maps', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const userId = req.user.id;
  try {
    const ptCheck = await query('SELECT id FROM playthroughs WHERE id=$1 AND user_id=$2', [ptId, userId]);
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });

    const result = await query(
      `SELECT m.id, m.name, m.created_at, a.url AS image_url, a.mime_type AS image_mime
       FROM game_maps m
       LEFT JOIN game_attachments a ON a.id = m.attachment_id
       WHERE m.playthrough_id=$1 AND m.user_id=$2
       ORDER BY m.created_at`,
      [ptId, userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Create map — expects attachment_id (client uploads file first via /api/games/:gameId/attachments/maps)
app.post('/api/playthroughs/:ptId/maps', isAuthenticated, async (req, res) => {
  const { ptId } = req.params;
  const { name, attachment_id } = req.body;
  const userId = req.user.id;
  if (!name || !attachment_id) {
    return res.status(400).json({ message: 'name and attachment_id are required.' });
  }
  try {
    const ptCheck = await query(
      'SELECT p.id, p.game_id FROM playthroughs p WHERE p.id=$1 AND p.user_id=$2',
      [ptId, userId]
    );
    if (ptCheck.rows.length === 0) return res.status(404).json({ message: 'Playthrough not found.' });
    const { game_id } = ptCheck.rows[0];

    // Verify attachment belongs to this game and is maps-set
    const attCheck = await query(
      "SELECT id, url, mime_type FROM game_attachments WHERE id=$1 AND game_id=$2 AND user_id=$3 AND set_type='maps'",
      [attachment_id, game_id, userId]
    );
    if (attCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Attachment not found or does not belong to this game.' });
    }

    const result = await query(
      `INSERT INTO game_maps (game_id, playthrough_id, user_id, attachment_id, name)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, created_at`,
      [game_id, ptId, userId, attachment_id, name]
    );

    res.status(201).json({
      ...result.rows[0],
      image_url: attCheck.rows[0].url,
      image_mime: attCheck.rows[0].mime_type,
    });
  } catch (err) {
    console.error('Error creating map:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get a single map — returns image_url instead of base64 blob
app.get('/api/maps/:mapId', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      `SELECT m.id, m.name, m.game_id, m.playthrough_id, m.created_at,
              a.url AS image_url, a.mime_type AS image_mime
       FROM game_maps m
       LEFT JOIN game_attachments a ON a.id = m.attachment_id
       WHERE m.id=$1 AND m.user_id=$2`,
      [mapId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete map — eagerly deletes the attachment record + disk file
app.delete('/api/maps/:mapId', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    // Fetch map + attachment info before deleting
    const mapResult = await query(
      'SELECT m.id, a.id AS att_id, a.file_path FROM game_maps m LEFT JOIN game_attachments a ON a.id = m.attachment_id WHERE m.id=$1 AND m.user_id=$2',
      [mapId, userId]
    );
    if (mapResult.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    const { att_id, file_path } = mapResult.rows[0];

    // Delete map (cascades to map_pins)
    await query('DELETE FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);

    // Eagerly clean up the attachment
    if (att_id) {
      await query('DELETE FROM game_attachments WHERE id=$1', [att_id]);
      if (file_path) {
        fs.unlink(file_path, (err) => {
          if (err) console.error(`Failed to delete map file ${file_path}:`, err);
        });
      }
    }

    res.json({ message: 'Map deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PINS ──────────────────────────────────────────────────────────────────────
app.get('/api/maps/:mapId/pins', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    const result = await query('SELECT * FROM map_pins WHERE map_id=$1 ORDER BY created_at', [mapId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/maps/:mapId/pins', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const { x_percent, y_percent, label, description, color } = req.body;
  const userId = req.user.id;
  if (x_percent == null || y_percent == null || !label) {
    return res.status(400).json({ message: 'x_percent, y_percent, and label are required.' });
  }
  try {
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    const result = await query(
      'INSERT INTO map_pins (map_id, x_percent, y_percent, label, description, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [mapId, x_percent, y_percent, label, description || null, color || 'blue']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/maps/:mapId/pins/:pinId', isAuthenticated, async (req, res) => {
  const { mapId, pinId } = req.params;
  const { label, description, color, x_percent, y_percent } = req.body;
  const userId = req.user.id;
  try {
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });

    // Build SET clause dynamically so partial updates work
    const fields = ['label=$1', 'description=$2', 'color=$3'];
    const values = [label, description || null, color || 'blue'];

    if (x_percent != null) { fields.push(`x_percent=$${values.length + 1}`); values.push(x_percent); }
    if (y_percent != null) { fields.push(`y_percent=$${values.length + 1}`); values.push(y_percent); }

    values.push(pinId, mapId);
    const result = await query(
      `UPDATE map_pins SET ${fields.join(', ')} WHERE id=$${values.length - 1} AND map_id=$${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Pin not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/maps/:mapId/pins/:pinId', isAuthenticated, async (req, res) => {
  const { mapId, pinId } = req.params;
  const userId = req.user.id;
  try {
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    const result = await query('DELETE FROM map_pins WHERE id=$1 AND map_id=$2 RETURNING id', [pinId, mapId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Pin not found.' });
    res.json({ message: 'Pin deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── USER SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/settings/:key', isAuthenticated, async (req, res) => {
  const { key } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      'SELECT value FROM user_settings WHERE user_id=$1 AND key=$2',
      [userId, key]
    );
    res.json(result.rows[0]?.value ?? null);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/settings/:key', isAuthenticated, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const userId = req.user.id;
  if (value === undefined) return res.status(400).json({ message: 'value is required.' });
  try {
    const result = await query(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value=$3, updated_at=NOW()
       RETURNING value`,
      [userId, key, JSON.stringify(value)]
    );
    res.json(result.rows[0].value);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── BULLETIN POSTS ────────────────────────────────────────────────────────────
// GET  /api/bulletin         — public, list all posts (newest first)
// POST /api/bulletin         — authenticated, publish a note file
// DELETE /api/bulletin/:id   — admin OR post owner

app.get('/api/bulletin', async (req, res) => {
  try {
    const result = await query(
      `SELECT bp.id, bp.title, bp.cover_url, bp.created_at,

              bp.note_file_id, bp.game_id, bp.user_id,
              u.name AS author_name,
              g.title AS game_title
       FROM bulletin_posts bp
       JOIN users u ON u.id = bp.user_id
       JOIN games g ON g.id = bp.game_id
       ORDER BY bp.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing bulletin posts:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/bulletin', isAuthenticated, async (req, res) => {
  const { note_file_id } = req.body;
  const userId = req.user.id;
  if (!note_file_id) return res.status(400).json({ message: 'note_file_id is required.' });
  try {
    const fileResult = await query(
      `SELECT nf.id, nf.title, nf.playthrough_id,
              p.game_id,
              g.cover_url
       FROM note_files nf
       JOIN playthroughs p ON p.id = nf.playthrough_id
       JOIN games g ON g.id = p.game_id
       WHERE nf.id = $1 AND nf.user_id = $2`,
      [note_file_id, userId]
    );
    if (fileResult.rows.length === 0) return res.status(404).json({ message: 'Note file not found.' });
    const nf = fileResult.rows[0];

    const existing = await query(
      'SELECT id FROM bulletin_posts WHERE note_file_id=$1',
      [note_file_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'This note is already published to the bulletin.' });
    }

    const result = await query(
      `INSERT INTO bulletin_posts (note_file_id, user_id, game_id, title, cover_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, cover_url, created_at, note_file_id, game_id, user_id`,
      [note_file_id, userId, nf.game_id, nf.title, nf.cover_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error publishing bulletin post:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// Admin OR the post owner can delete
app.delete('/api/bulletin/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'Admin';
  try {
    const check = await query('SELECT user_id FROM bulletin_posts WHERE id=$1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ message: 'Post not found.' });

    if (!isAdmin && check.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    await query('DELETE FROM bulletin_posts WHERE id=$1', [id]);
    res.json({ message: 'Post deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Public — anyone can read a published post's content
app.get('/api/bulletin/:id/content', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT nf.content, nf.title, p.platform
       FROM bulletin_posts bp
       JOIN note_files nf ON nf.id = bp.note_file_id
       JOIN playthroughs p ON p.id = nf.playthrough_id
       WHERE bp.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Post not found.' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.listen(PORT, () => console.log(`Grimoire backend running on port ${PORT}`));
