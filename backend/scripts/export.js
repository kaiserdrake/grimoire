/**
 * Export script — outputs all users' games and playthroughs as JSON to stdout.
 *
 * Usage:
 *   docker compose exec grimoire-backend npm run export
 *
 * Optionally filter by username:
 *   docker compose exec grimoire-backend npm run export -- --user alice
 *
 * Redirect to a file on the host:
 *   docker compose exec grimoire-backend npm run export > games-export.json
 */

import { query } from '../src/db.js';
import dotenv from 'dotenv';
dotenv.config();

const args     = process.argv.slice(2);
const userFlag = args.indexOf('--user');
const username = userFlag !== -1 ? args[userFlag + 1] : null;

const main = async () => {
  try {
    // Resolve optional --user filter
    let userIds = null;
    if (username) {
      const result = await query('SELECT id, name FROM users WHERE name = $1', [username]);
      if (result.rows.length === 0) {
        console.error(`EXPORT: User '${username}' not found.`);
        process.exit(1);
      }
      userIds = result.rows.map((r) => r.id);
    }

    // Fetch all users (for embedding user context in output)
    const usersResult = await query(
      `SELECT id, name, email FROM users${userIds ? ` WHERE id = ANY($1)` : ''}`,
      userIds ? [userIds] : []
    );

    const output = [];

    for (const user of usersResult.rows) {
      const gamesResult = await query(
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
        WHERE g.user_id = $1
        GROUP BY g.id
        ORDER BY g.updated_at DESC`,
        [user.id]
      );

      output.push({
        user: { id: user.id, name: user.name, email: user.email },
        games: gamesResult.rows,
      });
    }

    // Write JSON to stdout so it can be piped / redirected on the host
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    process.exit(0);
  } catch (err) {
    console.error('EXPORT ERROR:', err);
    process.exit(1);
  }
};

main();
