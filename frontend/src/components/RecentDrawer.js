'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiFileText, FiMap, FiBook, FiTrash2, FiLink } from 'react-icons/fi';
import { useLastVisited } from '@/context/LastVisitedContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { detectGamepad, makeRemarkGamepadPlugin } from '@/utils/gamepad';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// ── RecentDrawer ───────────────────────────────────────────────────────────────
// Pull-tab drawer anchored to the bottom-right of the viewport.
// Used on all pages except Notes (which uses NotesDrawer for the extra CONTENTS tab).
// Now has two tabs: RECENT and BULLETIN.
//
// Props:
//   isOpen   – boolean
//   onToggle – () => void

export default function RecentDrawer({ isOpen, onToggle }) {
  const router = useRouter();
  const { recentGames } = useLastVisited();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('recent');
  const [bulletinPosts, setBulletinPosts] = useState([]);
  const [readPost, setReadPost] = useState(null); // { title, content, id }
  const [readLoading, setReadLoading] = useState(false);

  // Non-authenticated users only see bulletin
  const effectiveTab = !user ? 'bulletin' : activeTab;

  const navigate = (href) => { onToggle(); router.push(href); };

  const loadBulletin = useCallback(async () => {
    try {
      const posts = await api.bulletin.list();
      setBulletinPosts(posts);
      return posts;
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen && effectiveTab === 'bulletin') loadBulletin();
  }, [isOpen, effectiveTab, loadBulletin]);

  const openPostById = useCallback(async (postId) => {
    setReadLoading(true);
    try {
      const data = await api.bulletin.getContent(postId);
      setReadPost({ id: postId, title: data.title, content: data.content, platform: data.platform });
    } catch {
      setReadPost(null);
    } finally {
      setReadLoading(false);
    }
  }, []);

  // On mount, check for #bulletin-{id} hash and auto-open that post
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#bulletin-(\d+)$/);
    if (match) openPostById(Number(match[1]));
  }, [openPostById]);

  const handleRead = async (post) => {
    history.replaceState(null, '', `/#bulletin-${post.id}`);
    openPostById(post.id);
  };

  const handleCloseRead = () => {
    setReadPost(null);
    // Clear the hash without triggering a navigation
    history.replaceState(null, '', window.location.pathname + window.location.search);
  };


  const handleDelete = async (postId) => {
    try {
      await api.bulletin.delete(postId);

      setBulletinPosts(prev => prev.filter(p => p.id !== postId));
    } catch {}
  };

  const pullLabel = effectiveTab === 'bulletin' ? 'BULLETIN' : 'RECENT';


  return (
    <>
      <div className={`recent-drawer${isOpen ? ' recent-drawer--open' : ''}`}>
        <button className="recent-drawer-pull" onClick={onToggle}>
          <span>{pullLabel}</span>
        </button>

        <div className="recent-drawer-inner">
          {/* Tab bar — only show when logged in (both tabs available) */}
          {user && (
            <div className="recent-drawer-tabs">
              <button
                className={`recent-drawer-tab${effectiveTab === 'recent' ? ' active' : ''}`}
                onClick={() => setActiveTab('recent')}
              >
                RECENT
              </button>
              <button

                className={`recent-drawer-tab${effectiveTab === 'bulletin' ? ' active' : ''}`}
                onClick={() => { setActiveTab('bulletin'); loadBulletin(); }}

              >
                BULLETIN
              </button>
            </div>
          )}

          {/* Body */}
          <div className="recent-drawer-body">
            {effectiveTab === 'recent' ? (

              recentGames.length === 0 ? (
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
              )
            ) : (
              bulletinPosts.length === 0 ? (
                <span className="recent-drawer-empty">No bulletin posts yet.</span>
              ) : (
                bulletinPosts.map(post => (
                  <BulletinRow
                    key={post.id}
                    post={post}
                    canDelete={user?.role === 'Admin' || user?.id === post.user_id}
                    onRead={() => handleRead(post)}
                    onDelete={() => handleDelete(post.id)}
                  />
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Read modal */}
      {(readPost || readLoading) && (
        <BulletinReadModal
          post={readPost}
          loading={readLoading}
          onClose={handleCloseRead}
        />
      )}
    </>
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

// ── BulletinRow ───────────────────────────────────────────────────────────────
const BULLETIN_HOLD_DURATION = 1800;

function BulletinHoldToDelete({ onDelete, hasCover }) {
  const [progress, setProgress] = useState(0);
  const [holding,  setHolding]  = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / BULLETIN_HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
    else if (!firedRef.current) { firedRef.current = true; onDelete(); reset(); }
  }, [onDelete]);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    firedRef.current = false;
    setProgress(0);
    setHolding(false);
  };

  const start = (e) => { e.preventDefault(); e.stopPropagation(); startRef.current = Date.now(); firedRef.current = false; setHolding(true); rafRef.current = requestAnimationFrame(tick); };
  const stop  = (e) => { e.stopPropagation(); if (!firedRef.current) reset(); };


  const radius = 7;
  const svgSize = radius * 2 + 4;
  const circumference = 2 * Math.PI * radius;


  const bg     = hasCover ? 'rgba(220,38,38,0.55)' : 'transparent';
  const border = hasCover ? '1px solid rgba(220,38,38,0.6)' : '1px solid rgba(220,38,38,0.5)';
  const color  = hasCover ? '#fca5a5' : '#ef4444';
  const hoverBg = hasCover ? 'rgba(220,38,38,0.80)' : 'rgba(220,38,38,0.12)';

  return (
    <button
      className="recent-drawer-action-btn"
      style={{ background: holding ? hoverBg : bg, border, color, padding: '3px 5px' }}
      onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchEnd={stop}
      title="Hold to delete"
    >
      {holding ? (
        <svg width={svgSize} height={svgSize} style={{ display: 'block' }}>
          <circle cx={svgSize/2} cy={svgSize/2} r={radius} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={1.5} />
          <circle cx={svgSize/2} cy={svgSize/2} r={radius} fill="none" stroke={color} strokeWidth={1.5}
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round" transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`} />
        </svg>
      ) : (
        <FiTrash2 size={9} />
      )}
    </button>
  );
}

function BulletinRow({ post, canDelete, onRead, onDelete }) {
  const hasCover = !!post.cover_url;

  const readBg     = hasCover ? 'rgba(255,255,255,0.15)' : 'transparent';
  const readBorder = hasCover ? '1px solid rgba(255,255,255,0.35)' : '1px solid var(--color-border)';
  const readColor  = hasCover ? '#fff' : 'var(--color-text-secondary)';
  const readHover  = hasCover ? 'rgba(255,255,255,0.28)' : 'var(--color-bg-hover)';

  return (
    <div
      className="recent-drawer-game-row"
      style={{
        backgroundImage:    hasCover ? `url(${post.cover_url})` : 'none',
        backgroundSize:     'cover',
        backgroundPosition: 'center 40%',
        backgroundColor:    'var(--color-bg-subtle)',
        height: '56px',
      }}

    >
      {hasCover && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.75) 100%)',
        }} />
      )}
      <div className="recent-drawer-game-content">
        {/* Left: title + game name */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span className="recent-drawer-game-title" style={{ color: hasCover ? '#fff' : 'var(--color-text-primary)', fontSize: '11px' }}>
            {post.title || 'Untitled'}
          </span>
          {post.game_title && (
            <span style={{
              fontSize: '9px', fontWeight: 400,
              color: hasCover ? 'rgba(255,255,255,0.65)' : 'var(--color-text-muted)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {post.game_title}
            </span>
          )}
        </div>
        {/* Right: action buttons */}
        <div className="recent-drawer-game-actions">
          <button
            onClick={onRead}
            className="recent-drawer-action-btn"
            style={{ background: readBg, border: readBorder, color: readColor }}
            onMouseEnter={e => { e.currentTarget.style.background = readHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = readBg; }}
          >
            <FiBook size={9} /><span>READ</span>
          </button>
          {canDelete && (
            <BulletinHoldToDelete onDelete={onDelete} hasCover={hasCover} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── BulletinReadModal ─────────────────────────────────────────────────────────
function BulletinReadModal({ post, loading, onClose }) {
  const [copied, setCopied] = useState(false);
  const gamepad = detectGamepad(post?.platform);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#bulletin-${post.id}`;
    navigator.clipboard.writeText(url).then(() => {

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',

      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          width: 'min(720px, 95vw)',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
          gap: '8px',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loading ? 'Loading…' : (post?.title || 'Note')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {post && (
              <button
                onClick={handleCopyLink}
                title={copied ? 'Copied!' : 'Copy shareable link'}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', borderRadius: '4px',
                  color: copied ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  padding: '2px 4px', display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}

              >
                <FiLink size={13} />
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: 1,
                padding: '2px 6px', borderRadius: '4px',
              }}
            >✕</button>
          </div>
        </div>
        {/* Content */}
        <div
          className="notes-preview-content"
          style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}
        >
          {loading ? (
            <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>Loading…</div>

          ) : post?.content?.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, makeRemarkGamepadPlugin(gamepad)]}
              rehypePlugins={[rehypeRaw]}
              components={{
                img: ({ node, ...props }) => (
                  <div className="img-resizer"><img {...props} /></div>
                ),
              }}
            >{post.content}</ReactMarkdown>
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>
              Nothing to display.
            </div>
          )}
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
