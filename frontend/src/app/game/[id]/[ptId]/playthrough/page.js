'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Flex, HStack, VStack, Text, Button, Spinner, useToast, IconButton, Box, Tooltip,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { FiTrash2, FiEdit2, FiTarget } from 'react-icons/fi';
import Navbar from '@/components/Navbar';
import GameTabBar from '@/components/GameTabBar';
import RecentDrawer from '@/components/RecentDrawer';
import GameDetailModal from '@/components/GameDetailModal';
import { useAuth } from '@/context/AuthContext';
import { useFocus } from '@/context/FocusContext';
import { useLastVisited } from '@/context/LastVisitedContext';
import { api } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { PT_STATUS_LABELS, PT_STATUS_COLORS } from '@/constants/playthroughs';
import { ptDisplayLabel } from '@/utils/playthroughs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function sessionDays(session) {
  const start = new Date(session.start_date);
  const end   = session.end_date ? new Date(session.end_date) : new Date();
  return Math.max(0, Math.round((end - start) / 86400000));
}

function ptTotalDays(sessions) {
  return sessions.reduce((sum, s) => sum + sessionDays(s), 0);
}

function deriveStatus(sessions, fallback) {
  if (!sessions || sessions.length === 0) return fallback;
  const sorted = [...sessions].sort((a, b) =>
    new Date(b.start_date) - new Date(a.start_date) || new Date(b.created_at) - new Date(a.created_at)
  );
  return sorted[0].status ?? fallback;
}

const inputStyle = {
  fontSize: '0.75rem', padding: '3px 7px',
  background: 'var(--color-bg-page)',
  border: '1px solid var(--color-border)',
  borderRadius: '4px', color: 'var(--color-text-primary)', outline: 'none',
};

const HOLD_DURATION = 1800;

// ── Hold-to-delete ────────────────────────────────────────────────────────────
function HoldToDelete({ onDelete }) {
  const [progress, setProgress] = useState(0);
  const [holding,  setHolding]  = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
    else if (!firedRef.current) { firedRef.current = true; onDelete(); reset(); }
  }, [onDelete]);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null; firedRef.current = false;
    setProgress(0); setHolding(false);
  };

  const start = (e) => {
    e.preventDefault(); e.stopPropagation();
    startRef.current = Date.now(); firedRef.current = false;
    setHolding(true); rafRef.current = requestAnimationFrame(tick);
  };
  const stop = (e) => { e.stopPropagation(); if (!firedRef.current) reset(); };

  const r = 9, svgSize = r * 2 + 4, circumference = 2 * Math.PI * r;

  return (
    <Tooltip label="Hold to delete" hasArrow placement="top" openDelay={400}>
      <Box as="button" display="inline-flex" alignItems="center" justifyContent="center"
        borderRadius="md" border="none" cursor="pointer" background="none"
        color={holding ? 'var(--color-danger)' : 'var(--color-text-muted)'}
        onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchEnd={stop}
        style={{ padding: '3px', flexShrink: 0 }}>
        {holding ? (
          <svg width={svgSize} height={svgSize}>
            <circle cx={svgSize/2} cy={svgSize/2} r={r} fill="none" stroke="var(--color-danger)" strokeOpacity={0.2} strokeWidth={2} />
            <circle cx={svgSize/2} cy={svgSize/2} r={r} fill="none" stroke="var(--color-danger)" strokeWidth={2}
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round" transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`} />
          </svg>
        ) : (
          <FiTrash2 size={12} />
        )}
      </Box>
    </Tooltip>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 600,
      padding: '2px 7px', borderRadius: '4px',
      background: `${PT_STATUS_COLORS[status] ?? '#888'}22`,
      color: PT_STATUS_COLORS[status] ?? '#888',
    }}>
      {PT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────
function SessionRow({ session, index, ptId, onUpdated, onDeleted }) {
  const toast = useToast();
  const [editing,   setEditing]   = useState(false);
  const [startDate, setStartDate] = useState(session.start_date?.slice(0, 10) || '');
  const [endDate,   setEndDate]   = useState(session.end_date?.slice(0, 10)   || '');
  const [status,    setStatus]    = useState(session.status);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!editing) {
      setStartDate(session.start_date?.slice(0, 10) || '');
      setEndDate(session.end_date?.slice(0, 10) || '');
      setStatus(session.status);
    }
  }, [session.start_date, session.end_date, session.status, editing]);

  const days    = sessionDays(session);
  const ongoing = !session.end_date;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.sessions.update(ptId, session.id, {
        start_date: startDate, end_date: endDate || null, status,
      });
      onUpdated(updated); setEditing(false);
    } catch (err) {
      toast({ title: 'Error saving session', description: err.message, status: 'error', duration: 3000 });
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.sessions.delete(ptId, session.id);
      onDeleted(session.id);
    } catch (err) {
      toast({ title: 'Error deleting session', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleMarkToday = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      const updated = await api.sessions.update(ptId, session.id, { end_date: today });
      onUpdated(updated);
    } catch (err) {
      toast({ title: 'Error updating session', description: err.message, status: 'error', duration: 3000 });
    } finally { setSaving(false); }
  };

  const row = { borderBottom: '1px solid var(--color-border-subtle)' };
  const cell = { padding: '7px 10px', fontSize: '0.78rem', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
  const muted = { ...cell, color: 'var(--color-text-muted)' };

  if (editing) return (
    <tr style={{ ...row, background: 'var(--color-bg-subtle)' }}>
      <td style={muted}>{index + 1}</td>
      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
        <input type="date" style={{ ...inputStyle, width: '130px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
      </td>
      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
        <input type="date" style={{ ...inputStyle, width: '130px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
      </td>
      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: '120px' }}>
          <option value="playing">▶ Playing</option>
          <option value="pend">⏸ Pended</option>
          <option value="completed">✓ Completed</option>
          <option value="dropped">✖ Dropped</option>
        </select>
      </td>
      <td style={muted}>—</td>
      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
        <HStack spacing={1}>
          <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }}
            isLoading={saving} onClick={handleSave}>Save</Button>
          <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
            _hover={{ bg: 'transparent', opacity: 0.7 }} onClick={() => setEditing(false)}>Cancel</Button>
        </HStack>
      </td>
    </tr>
  );

  return (
    <tr style={row}>
      <td style={muted}>{index + 1}</td>
      <td style={cell}>{fmtDate(session.start_date)}</td>
      <td style={cell}>
        {ongoing ? (
          <HStack spacing={2}>
            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>ongoing</span>
            <button onClick={handleMarkToday} disabled={saving} style={{
              fontSize: '0.7rem', color: 'var(--color-accent)', background: 'none',
              border: '1px solid var(--color-accent)', borderRadius: '4px',
              padding: '1px 6px', cursor: 'pointer',
            }}>Mark today</button>
          </HStack>
        ) : fmtDate(session.end_date)}
      </td>
      <td style={cell}><StatusBadge status={session.status} /></td>
      <td style={{ ...cell, color: 'var(--color-text-muted)', textAlign: 'right' }}>
        {ongoing ? `${days}d+` : `${days}d`}
      </td>
      <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
        <HStack spacing={0} justify="flex-end">
          <Tooltip label="Edit" hasArrow placement="top" openDelay={400}>
            <IconButton size="xs" variant="ghost" aria-label="Edit" icon={<FiEdit2 size={11} />}
              color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
              onClick={() => setEditing(true)} />
          </Tooltip>
          <HoldToDelete onDelete={handleDelete} />
        </HStack>
      </td>
    </tr>
  );
}

// ── Add session row ───────────────────────────────────────────────────────────
function AddSessionRow({ ptId, onAdded }) {
  const toast = useToast();
  const [open,      setOpen]      = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [status,    setStatus]    = useState('playing');
  const [saving,    setSaving]    = useState(false);

  const handleAdd = async () => {
    if (!startDate) { toast({ title: 'Start date is required', status: 'warning', duration: 2500 }); return; }
    setSaving(true);
    try {
      const session = await api.sessions.create(ptId, { start_date: startDate, end_date: endDate || null, status });
      onAdded(session);
      setOpen(false); setStartDate(''); setEndDate(''); setStatus('playing');
    } catch (err) {
      toast({ title: 'Error adding session', description: err.message, status: 'error', duration: 3000 });
    } finally { setSaving(false); }
  };

  const row = { borderBottom: '1px solid var(--color-border-subtle)' };

  if (!open) return (
    <tr style={row}>
      <td colSpan={6} style={{ padding: '8px 10px' }}>
        <button onClick={() => setOpen(true)} style={{
          fontSize: '0.72rem', color: 'var(--color-accent)', background: 'none',
          border: '1px dashed var(--color-accent)', borderRadius: '4px',
          padding: '4px 12px', cursor: 'pointer',
        }}>+ Add session</button>
      </td>
    </tr>
  );

  return (
    <>
      <tr style={{ ...row, background: 'var(--color-bg-subtle)' }}>
        <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</td>
        <td style={{ padding: '6px 10px' }}>
          <input type="date" style={{ ...inputStyle, width: '130px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </td>
        <td style={{ padding: '6px 10px' }}>
          <input type="date" style={{ ...inputStyle, width: '130px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </td>
        <td style={{ padding: '6px 10px' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: '120px' }}>
            <option value="playing">▶ Playing</option>
            <option value="pend">⏸ Pended</option>
            <option value="completed">✓ Completed</option>
            <option value="dropped">✖ Dropped</option>
          </select>
        </td>
        <td /><td />
      </tr>
      <tr style={{ ...row, background: 'var(--color-bg-subtle)' }}>
        <td colSpan={6} style={{ padding: '4px 10px 8px' }}>
          <HStack spacing={2}>
            <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
              _hover={{ bg: 'transparent', opacity: 0.7 }}
              onClick={() => { setOpen(false); setStartDate(''); setEndDate(''); setStatus('playing'); }}>Cancel</Button>
            <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }} isLoading={saving} onClick={handleAdd}>Add</Button>
          </HStack>
        </td>
      </tr>
    </>
  );
}

// ── Playthrough card (collapsible) ────────────────────────────────────────────
function PlaythroughCard({ pt, allPlaythroughs, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [sessions, setSessions] = useState(pt.sessions || []);

  const status  = deriveStatus(sessions, pt.status);
  const total   = ptTotalDays(sessions);
  const ongoing = sessions.some(s => !s.end_date);
  const count   = sessions.length;

  const summary = [
    count > 0 ? `${count} session${count !== 1 ? 's' : ''}` : null,
    total > 0 ? `${total}d${ongoing ? '+' : ''}` : ongoing ? 'ongoing' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Box borderWidth="1px" borderColor="var(--color-border-subtle)" borderRadius="md" overflow="hidden" mb={2}>
      {/* Header */}
      <HStack
        px={3} py={1.5} justify="space-between" align="center" cursor="pointer"
        bg="var(--color-bg-subtle)" _hover={{ bg: 'var(--color-bg-hover)' }}
        onClick={() => setOpen(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, lineHeight: 1 }}>
            {open ? <ChevronDownIcon boxSize={3} /> : <ChevronRightIcon boxSize={3} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.2 }}>
              <span style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {ptDisplayLabel(pt, allPlaythroughs)}
              </span>
              <StatusBadge status={status} />
            </div>
            {(pt.platform || summary) && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.2, marginTop: '2px' }}>
                {[pt.platform, summary].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </HStack>

      {/* Sessions table */}
      {open && (
        <Box borderTopWidth="1px" borderColor="var(--color-border-subtle)" overflowX="auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-page)' }}>
                {['#', 'Start', 'End', 'Status', 'Days', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '5px 10px', textAlign: i === 4 ? 'right' : 'left',
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    width: i === 0 ? '32px' : i === 5 ? '80px' : 'auto',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <SessionRow
                  key={s.id} session={s} index={i} ptId={pt.id}
                  onUpdated={updated => setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDeleted={sessionId => setSessions(prev => prev.filter(x => x.id !== sessionId))}
                />
              ))}
              <AddSessionRow ptId={pt.id} onAdded={s => setSessions(prev => [...prev, s])} />
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
}

// ── Game info card ────────────────────────────────────────────────────────────
function GameInfoCard({ game, onOpenModal, focusGame, isFocused, setFocus, clearFocus, playthroughs }) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  if (!game) return null;
  const summary = game.summary || '';
  const longSummary = summary.length > 280;
  const displaySummary = longSummary && !summaryExpanded ? summary.slice(0, 280) + '…' : summary;

  const metaItems = [
    game.genres?.length    && { label: 'Genres',    value: game.genres.join(', ') },
    game.developer         && { label: 'Developer', value: game.developer },
    game.publisher         && { label: 'Publisher', value: game.publisher },
    game.series?.length    && { label: 'Series',    value: game.series.join(', ') },
    game.time_to_beat      && { label: 'Time to beat', value: `~${game.time_to_beat}h` },
  ].filter(Boolean);

  const focused = isFocused(game.id);
  const hasPts  = playthroughs.length > 0;

  const handleFocusToggle = async () => {
    if (focused) { await clearFocus(); return; }
    if (!hasPts) return;
    const pt = playthroughs.find(p => p.status === 'playing')
      ?? playthroughs.find(p => p.status === 'pend')
      ?? playthroughs[0];
    await setFocus({ gameId: String(game.id), ptId: String(pt.id), gameTitle: game.title, coverUrl: game.cover_url ?? null });
  };

  return (
    <Box mb={5} p={4} borderWidth="1px" borderColor="var(--color-border-subtle)" borderRadius="md"
      bg="var(--color-bg-subtle)">
      <HStack spacing={4} align="flex-start">
        {/* Cover */}
        {game.cover_url && (
          <Box flexShrink={0} borderRadius="md" overflow="hidden" w="80px" h="107px">
            <img src={game.cover_url} alt={game.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </Box>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + focus toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', lineHeight: 1 }}>
            <button onClick={onOpenModal} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                {game.title}
              </span>
            </button>
            <Tooltip label={focused ? 'Remove from Focus' : hasPts ? 'Set In Focus' : 'Add a playthrough first'} hasArrow placement="top" openDelay={200}>
              <button onClick={handleFocusToggle} disabled={!hasPts && !focused} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', borderRadius: '5px', border: 'none',
                background: focused ? 'var(--color-accent-subtle)' : 'transparent',
                color: focused ? 'var(--color-accent)' : 'var(--color-text-muted)',
                cursor: (!hasPts && !focused) ? 'default' : 'pointer',
                opacity: (!hasPts && !focused) ? 0.4 : 1,
                flexShrink: 0, transition: 'all 0.15s',
              }}>
                <FiTarget size={12} />
              </button>
            </Tooltip>
          </div>

          {/* Meta grid */}
          {metaItems.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              {metaItems.map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', lineHeight: 1.5 }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)', minWidth: '72px', flexShrink: 0,
                  }}>{label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {displaySummary}
              </span>
              {longSummary && (
                <button onClick={() => setSummaryExpanded(v => !v)} style={{
                  display: 'block', fontSize: '0.72rem', color: 'var(--color-accent)',
                  background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', marginTop: '2px',
                }}>
                  {summaryExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </HStack>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlaythroughPage({ params }) {
  const { id, ptId } = params;
  const toast    = useToast();
  const router   = useRouter();
  const { user } = useAuth();
  const { isFocused, focusGame, setFocus, clearFocus } = useFocus();
  const { visitNotes } = useLastVisited();

  const [game,          setGame]          = useState(null);
  const [playthroughs,  setPlaythroughs]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [recentOpen,    setRecentOpen]    = useState(false);
  const [gameModalOpen, setGameModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const g = await api.games.get(id);
        setGame(g);
        setPlaythroughs(g.playthroughs || []);
      } catch (err) {
        toast({ title: 'Failed to load', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  if (!user) return (
    <>
      <Navbar />
      <GameTabBar gameId={id} ptId={ptId} hasPlaythroughs={loading || playthroughs.length > 0} />
      <Flex justify="center" align="center" height="calc(100vh - 94px)">
        <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in.</Text>
      </Flex>
    </>
  );

  return (
    <>
      <Navbar />
      <GameTabBar gameId={id} ptId={ptId} hasPlaythroughs={loading || playthroughs.length > 0} />
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />

      <div style={{
        height: 'calc(100vh - 94px)',
        overflowY: 'auto',
        padding: '1.5rem 2rem',
        maxWidth: '860px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {loading ? (
          <Flex justify="center" align="center" height="200px">
            <Spinner style={{ color: 'var(--color-accent)' }} />
          </Flex>
        ) : !game ? (
          <Flex justify="center" align="center" height="200px">
            <Text style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Game not found.
            </Text>
          </Flex>
        ) : (
          <>
            <GameInfoCard
              game={game}
              onOpenModal={() => setGameModalOpen(true)}
              focusGame={focusGame}
              isFocused={isFocused}
              setFocus={setFocus}
              clearFocus={clearFocus}
              playthroughs={playthroughs}
            />

            {/* Section header */}
            <Text fontSize="0.72rem" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em"
              mb={2} style={{ color: 'var(--color-text-muted)' }}>
              Playthroughs
            </Text>

            {playthroughs.length === 0 ? (
              <Box p={4} borderWidth="1px" borderColor="var(--color-border-subtle)" borderRadius="md"
                textAlign="center">
                <Text fontSize="0.85rem" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No playthroughs yet. Open the game detail to add one.
                </Text>
              </Box>
            ) : (
              playthroughs.map(pt => (
                <PlaythroughCard
                  key={pt.id}
                  pt={pt}
                  allPlaythroughs={playthroughs}
                  defaultOpen={String(pt.id) === String(ptId)}
                />
              ))
            )}
          </>
        )}
      </div>

      {game && (
        <GameDetailModal
          game={game}
          isOpen={gameModalOpen}
          onClose={() => setGameModalOpen(false)}
          onUpdated={() => api.games.get(id).then(g => { setGame(g); setPlaythroughs(g.playthroughs || []); }).catch(() => {})}
          onDeleted={() => router.push('/')}
        />
      )}
    </>
  );
}
