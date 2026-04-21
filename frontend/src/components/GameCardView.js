'use client';

import { Box } from '@chakra-ui/react';
import { TAG_CONFIG } from '@/constants/tags';

export default function GameCardView({ game, onClick }) {
  const tagCfg = game.tag ? TAG_CONFIG[game.tag] : null;

  return (
    <Box
      className="game-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
      {/* Cover image */}
      <div
        className="game-card-cover"
        style={tagCfg ? { boxShadow: `0 0 0 1.5px ${tagCfg.color}40, 0 2px 8px ${tagCfg.color}30` } : undefined}
      >
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            background: 'var(--color-bg-subtle)',
          }}>
            🎮
          </div>
        )}

        {/* Title — visible on hover only */}
        <div className="game-card-hover-title">
          {game.title}
        </div>
      </div>
    </Box>
  );
}
