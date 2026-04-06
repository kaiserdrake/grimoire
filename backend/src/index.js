import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { query } from './db.js';
import { isAuthenticated, isAdmin } from './auth.js';

dotenv.config();

const app = express();
const PORT = 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:8089',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://grimoire-frontend:3000',
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

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ── IGDB TOKEN CACHE ──────────────────────────────────────────────────────────
let igdbToken = null;
let igdbTokenExpiry = 0;

const getIgdbToken = async () => {
  if (igdbToken && Date.now() < igdbTokenExpiry) return igdbToken;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to obtain IGDB token');
  const data = await res.json();
  igdbToken = data.access_token;
  igdbTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return igdbToken;
};

// ── IGDB SEARCH PROXY ─────────────────────────────────────────────────────────
app.get('/api/igdb/search', isAuthenticated, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: 'Query must be at least 2 characters.' });
  }
  try {
    const token = await getIgdbToken();
    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: `
        search "${q.trim().replace(/"/g, '')}";
        fields id, name, summary, cover.url, genres.name, platforms.name, first_release_date;
        limit 10;
        where version_parent = null;
      `,
    });
    if (!igdbRes.ok) throw new Error('IGDB API error');
    const games = await igdbRes.json();

    const formatted = games.map((g) => ({
      igdb_id: g.id,
      title: g.name,
      summary: g.summary || null,
      cover_url: g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null,
      genres: g.genres?.map((x) => x.name) || [],
      platforms: g.platforms?.map((x) => x.name) || [],
      release_date: g.first_release_date
        ? new Date(g.first_release_date * 1000).toISOString().split('T')[0]
        : null,
    }));
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

app.get('/api/users/me', isAuthenticated, async (req, res) => {
  try {
    const result = await query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── USER MANAGEMENT (Admin) ───────────────────────────────────────────────────
app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/users', isAuthenticated, isAdmin, async (req, res) => {
  const { email, name, role } = req.body;
  if (!email || !name || !role) return res.status(400).json({ message: 'Email, name, and role are required.' });
  try {
    const generatedPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(generatedPassword, salt);
    const result = await query(
      'INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
      [email, name, role, passwordHash]
    );
    res.status(201).json({ user: result.rows[0], generatedPassword });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'User with this email or name already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/users/:id/password', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ message: 'New password is required.' });
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    res.json({ message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account.' });
  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/users/change-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords are required.' });
  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GAMES (Backlog) ───────────────────────────────────────────────────────────
app.get('/api/games', isAuthenticated, async (req, res) => {
  const { status } = req.query;
  const userId = req.user.id;
  try {
    let sql = `
      SELECT id, igdb_id, title, cover_url, summary, genres, platforms, release_date,
             status, rating, personal_notes, created_at, updated_at
      FROM games WHERE user_id = $1
    `;
    const params = [userId];
    if (status && ['backlog', 'playing', 'completed', 'dropped'].includes(status)) {
      sql += ` AND status = $2`;
      params.push(status);
    }
    sql += ` ORDER BY updated_at DESC`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/games', isAuthenticated, async (req, res) => {
  const { igdb_id, title, cover_url, summary, genres, platforms, release_date, status } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required.' });
  const userId = req.user.id;
  try {
    const result = await query(
      `INSERT INTO games (user_id, igdb_id, title, cover_url, summary, genres, platforms, release_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, igdb_id || null, title, cover_url || null, summary || null,
       genres || [], platforms || [], release_date || null, status || 'backlog']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/games/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = await query('SELECT * FROM games WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/games/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, cover_url, summary, genres, platforms, release_date, status, rating, personal_notes } = req.body;
  try {
    const result = await query(
      `UPDATE games SET title=$1, cover_url=$2, summary=$3, genres=$4, platforms=$5,
       release_date=$6, status=$7, rating=$8, personal_notes=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [title, cover_url, summary, genres, platforms, release_date, status, rating || null, personal_notes || null, id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/games/:id/status', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  if (!['backlog', 'playing', 'completed', 'dropped'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    const result = await query(
      'UPDATE games SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id, status',
      [status, id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.patch('/api/games/:id/rating', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  const userId = req.user.id;
  if (rating !== null && (rating < 1 || rating > 10)) {
    return res.status(400).json({ message: 'Rating must be between 1 and 10.' });
  }
  try {
    const result = await query(
      'UPDATE games SET rating=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id, rating',
      [rating || null, id, userId]
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

// ── NOTES ─────────────────────────────────────────────────────────────────────
app.get('/api/games/:id/notes', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    // Verify game ownership
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const result = await query(
      'SELECT content, updated_at FROM game_notes WHERE game_id=$1 AND user_id=$2',
      [id, userId]
    );
    res.json(result.rows[0] || { content: '', updated_at: null });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/games/:id/notes', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const result = await query(
      `INSERT INTO game_notes (game_id, user_id, content, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (game_id, user_id) DO UPDATE SET content=$3, updated_at=NOW()
       RETURNING content, updated_at`,
      [id, userId, content || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving notes:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── MAPS ──────────────────────────────────────────────────────────────────────
app.get('/api/games/:id/maps', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const result = await query(
      'SELECT id, name, image_mime, created_at FROM game_maps WHERE game_id=$1 AND user_id=$2 ORDER BY created_at',
      [id, userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/games/:id/maps', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { name, image_data, image_mime } = req.body;
  const userId = req.user.id;
  if (!name || !image_data || !image_mime) {
    return res.status(400).json({ message: 'Name, image data, and mime type are required.' });
  }
  try {
    const gameCheck = await query('SELECT id FROM games WHERE id=$1 AND user_id=$2', [id, userId]);
    if (gameCheck.rows.length === 0) return res.status(404).json({ message: 'Game not found.' });

    const result = await query(
      'INSERT INTO game_maps (game_id, user_id, name, image_data, image_mime) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, image_mime, created_at',
      [id, userId, name, image_data, image_mime]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating map:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.get('/api/maps/:mapId', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query(
      'SELECT id, name, image_data, image_mime, game_id, created_at FROM game_maps WHERE id=$1 AND user_id=$2',
      [mapId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.delete('/api/maps/:mapId', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    const result = await query('DELETE FROM game_maps WHERE id=$1 AND user_id=$2 RETURNING id', [mapId, userId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });
    res.json({ message: 'Map deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── MAP PINS ──────────────────────────────────────────────────────────────────
app.get('/api/maps/:mapId/pins', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const userId = req.user.id;
  try {
    // Verify map ownership via join
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });

    const result = await query(
      'SELECT id, x_percent, y_percent, label, description, color, created_at FROM map_pins WHERE map_id=$1 ORDER BY created_at',
      [mapId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.post('/api/maps/:mapId/pins', isAuthenticated, async (req, res) => {
  const { mapId } = req.params;
  const { x_percent, y_percent, label, description, color } = req.body;
  const userId = req.user.id;
  if (x_percent === undefined || y_percent === undefined || !label) {
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
  const { label, description, color } = req.body;
  const userId = req.user.id;
  try {
    const mapCheck = await query('SELECT id FROM game_maps WHERE id=$1 AND user_id=$2', [mapId, userId]);
    if (mapCheck.rows.length === 0) return res.status(404).json({ message: 'Map not found.' });

    const result = await query(
      'UPDATE map_pins SET label=$1, description=$2, color=$3 WHERE id=$4 AND map_id=$5 RETURNING *',
      [label, description || null, color || 'blue', pinId, mapId]
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

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Grimoire backend running on port ${PORT}`);
});
