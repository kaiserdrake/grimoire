'use client';

import { Box } from '@chakra-ui/react';
import { PT_STATUS_LABELS, PT_STATUS_STYLE } from '@/constants/playthroughs';
import { TAG_STYLE } from '@/constants/tags';
import { ptDisplayLabel } from '@/utils/playthroughs';
import { coverSrc, fallbackToGenericCover } from '@/utils/cover';

const s = {
  muted: { margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--color-text-muted)' },
};

function PlaythroughRow({ pt, allPlaythroughs }) {
  const style = PT_STATUS_STYLE[pt.status] || PT_STATUS_STYLE.pend;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={s.muted}>{ptDisplayLabel(pt, allPlaythroughs)}</span>
      <span style={s.muted}>·</span>
      <span style={{
        fontSize: '0.65rem', fontWeight: 600, lineHeight: '1.4',
        padding: '1px 6px', borderRadius: '4px',
        color: style.color, background: style.background,
      }}>
        {PT_STATUS_LABELS[pt.status] || pt.status}
      </span>
    </div>
  );
}

const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

export default function GameListRow({ game, onClick }) {
  const releaseYear = (() => {
    const d = game.releases?.[0]?.date;
    return d ? new Date(d).getFullYear() : null;
  })();

  const genre     = game.genres?.[0] ?? null;
  const company   = game.publisher ?? game.developer ?? null;
  const ttb       = game.time_to_beat != null ? `${game.time_to_beat}h` : null;
  const tagStyle  = game.tag ? TAG_STYLE[game.tag] : null;
  const playthroughs = [...(game.playthroughs ?? [])];

  const yearLine  = [releaseYear, ttb ? `⏱ ${ttb}` : null].filter(Boolean).join(' · ');
  const infoLine  = [company, genre].filter(Boolean).join(' | ');

  return (
    <Box
      className="game-list-row"

      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
      {/* Cover */}
      <div className="game-list-row-cover">
        <img
          src={coverSrc(game.cover_url)}
          alt={game.title}
          onError={fallbackToGenericCover}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '3px' }}>

        {/* Title */}
        <span style={{
          fontWeight: 700, fontSize: '0.875rem', lineHeight: '1.3',
          color: 'var(--color-text-primary)', ...oneLine,
        }}>
          {game.title}
        </span>

        {/* Year + tag (left) | playthroughs (right) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {yearLine && <span style={{ ...s.muted, ...oneLine }}>{yearLine}</span>}
            {tagStyle && game.tag && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, lineHeight: '1',
                padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: tagStyle.color, background: tagStyle.background,
              }}>
                {game.tag}
              </span>
            )}
          </div>

          {playthroughs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '3px' }}>
              {playthroughs.map((pt) => (
                <PlaythroughRow key={pt.id} pt={pt} allPlaythroughs={playthroughs} />
              ))}
            </div>
          )}
        </div>

        {/* Publisher | Genre */}
        {infoLine && <span style={{ ...s.muted, ...oneLine }}>{infoLine}</span>}

        {/* Brief description */}
        {game.summary && (
          <span className="game-list-row-summary">{game.summary}</span>
        )}
      </div>
    </Box>
  );
}
