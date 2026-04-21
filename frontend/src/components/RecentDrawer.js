'use client';

import { useRouter } from 'next/navigation';
import { FiFileText, FiMap } from 'react-icons/fi';
import { useLastVisited } from '@/context/LastVisitedContext';

// ── RecentDrawer ───────────────────────────────────────────────────────────────
// Pull-tab drawer anchored to the bottom-right of the viewport.
// Used on all pages except Notes (which uses NotesDrawer for the extra CONTENTS tab).
//
// Props:
//   isOpen   – boolean
//   onToggle – () => void

export default function RecentDrawer({ isOpen, onToggle }) {
  const router = useRouter();
  const { recentGames } = useLastVisited();

  const navigate = (href) => { onToggle(); router.push(href); };

  return (
    <div className={`recent-drawer${isOpen ? ' recent-drawer--open' : ''}`}>
      <button className="recent-drawer-pull" onClick={onToggle}>
        <span>RECENT</span>
      </button>
      <div className="recent-drawer-inner">
        <div className="recent-drawer-body">
          {recentGames.length === 0 ? (
            <span className="recent-drawer-empty">
              Open a game's Notes or Map to see it here.
            </span>
          ) : (
            recentGames.map((entry, idx) => (
              <RecentGameRow
                key={entry.gameId}
                entry={entry}
                isCurrent={idx === 0}
                onNotes={() => navigate(`/game/${entry.gameId}/${entry.ptId}/notes`)}
                onMap={()   => navigate(`/game/${entry.gameId}/${entry.ptId}/map`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── RecentGameRow — shared by RecentDrawer and NotesDrawer ────────────────────
export function RecentGameRow({ entry, isCurrent, onNotes, onMap }) {
  const hasCover = !!entry.coverUrl;

  return (
    <div
      className="recent-drawer-game-row"
      style={{
        backgroundImage:    hasCover ? `url(${entry.coverUrl})` : 'none',
        backgroundSize:     'cover',
        backgroundPosition: 'center 40%',
        backgroundColor:    'var(--color-bg-subtle)',
      }}
    >
      {hasCover && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.7) 100%)',
        }} />
      )}
      <div className="recent-drawer-game-content">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span className="recent-drawer-game-title" style={{ color: hasCover ? '#fff' : 'var(--color-text-primary)' }}>
            {entry.gameTitle || 'Untitled'}
          </span>
          {isCurrent && (
            <span style={{
              flexShrink: 0, fontSize: '8px', fontWeight: 700,
              padding: '1px 4px', borderRadius: '3px',
              background: hasCover ? 'rgba(108,71,255,0.85)' : 'var(--color-accent-subtle)',
              color: hasCover ? '#fff' : 'var(--color-accent)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>current</span>
          )}
        </div>
        <div className="recent-drawer-game-actions">
          <GameActionBtn onClick={onNotes} hasCover={hasCover} isCurrent={isCurrent}>
            <FiFileText size={10} /><span>Notes</span>
          </GameActionBtn>
          <GameActionBtn onClick={onMap} hasCover={hasCover} isCurrent={isCurrent}>
            <FiMap size={10} /><span>Map</span>
          </GameActionBtn>
        </div>
      </div>
    </div>
  );
}

function GameActionBtn({ onClick, hasCover, isCurrent, children }) {
  const bg     = isCurrent ? 'rgba(108,71,255,0.75)' : hasCover ? 'rgba(255,255,255,0.15)' : 'transparent';
  const border = isCurrent ? '1px solid rgba(108,71,255,0.7)' : hasCover ? '1px solid rgba(255,255,255,0.35)' : '1px solid var(--color-border)';
  const color  = hasCover  ? '#fff' : 'var(--color-text-secondary)';
  const hoverBg = isCurrent ? 'rgba(108,71,255,0.92)' : hasCover ? 'rgba(255,255,255,0.28)' : 'var(--color-bg-hover)';

  return (
    <button
      onClick={onClick}
      className="recent-drawer-action-btn"
      style={{ background: bg, border, color }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = bg; }}
    >
      {children}
    </button>
  );
}
