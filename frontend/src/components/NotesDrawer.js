'use client';

import { useRouter } from 'next/navigation';
import { useLastVisited } from '@/context/LastVisitedContext';
import { RecentGameRow } from './RecentDrawer';

// ── NotesDrawer ────────────────────────────────────────────────────────────────
// Replaces the existing notes-toc-drawer on the Notes page.
// Two tabs: RECENT (recent games) and CONTENTS (heading TOC).
//
// Props:
//   isOpen         – boolean
//   onToggle       – () => void
//   activeTab      – 'recent' | 'contents'
//   onTabChange    – (tab: string) => void
//   headings       – [{ level: number, text: string }]
//   onHeadingClick – (heading) => void

export default function NotesDrawer({ isOpen, onToggle, activeTab, onTabChange, headings, onHeadingClick }) {
  const router = useRouter();
  const { recentGames } = useLastVisited();

  const navigate = (href) => { onToggle(); router.push(href); };

  return (
    <div className={`recent-drawer${isOpen ? ' recent-drawer--open' : ''}`}>
      {/* Pull tab */}
      <button className="recent-drawer-pull" onClick={onToggle}>
        <span>{activeTab === 'contents' ? 'CONTENTS' : 'RECENT'}</span>
      </button>

      {/* Panel */}
      <div className="recent-drawer-inner">
        {/* Tab bar */}
        <div className="recent-drawer-tabs">
          <button
            className={`recent-drawer-tab${activeTab === 'recent' ? ' active' : ''}`}
            onClick={() => onTabChange('recent')}
          >
            RECENT
          </button>
          <button
            className={`recent-drawer-tab${activeTab === 'contents' ? ' active' : ''}`}
            onClick={() => onTabChange('contents')}
          >
            CONTENTS
          </button>
        </div>

        {/* Body */}
        <div className="recent-drawer-body">
          {activeTab === 'recent' ? (
            recentGames.length === 0 ? (
              <span className="recent-drawer-empty">Open a game's Notes or Map to see it here.</span>
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
            )
          ) : (
            headings.length === 0 ? (
              <span className="recent-drawer-empty">No headings yet.</span>
            ) : (
              headings.map((h, i) => (
                <button
                  key={i}
                  className="recent-drawer-toc-item"
                  style={{ paddingLeft: `${(h.level - 1) * 0.75 + 0.75}rem` }}
                  onClick={() => onHeadingClick(h)}
                >
                  {h.text}
                </button>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
