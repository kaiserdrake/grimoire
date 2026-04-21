'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, HStack, VStack, Text, Spinner, Button, useToast, Tooltip, Input } from '@chakra-ui/react';
import { ArrowBackIcon, ArrowForwardIcon, ChevronDownIcon, ChevronUpIcon, AddIcon } from '@chakra-ui/icons';
import Navbar from '@/components/Navbar';
import GameDetailModal from '@/components/GameDetailModal';
import RecentDrawer from '@/components/RecentDrawer';
import { useAuth } from '@/context/AuthContext';
import { useTabState } from '@/context/TabStateContext';
import { api } from '@/utils/api';

// ── Color by playthrough status ──────────────────────────────────────────────
const STATUS_COLORS = {
  playing:   { bg: '#B5D4F4', text: '#0C447C', border: '#6aaae8' },
  completed: { bg: '#9FE1CB', text: '#085041', border: '#5bbfa3' },
  pend:      { bg: '#FAC775', text: '#633806', border: '#e8a030' },
  dropped:   { bg: '#D4D4D4', text: '#444444', border: '#9e9e9e' },
};

function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS['pend'];
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}

function fmtMonthYear(date) {
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function fmtDay(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ── Build Gantt rows grouped by game ─────────────────────────────────────────
function buildGanttRows(sessions, rangeStart, rangeEnd, sortKey = 'date', sortDir = 'asc') {
  const totalDays = diffDays(rangeStart, rangeEnd) + 1;

  const byGame = new Map();
  for (const s of sessions) {
    const start = parseDate(s.start_date);
    const today = new Date();
    const end   = s.end_date ? parseDate(s.end_date) : today;

    if (end < rangeStart || start > rangeEnd) continue;

    if (!byGame.has(s.game_id)) {
      byGame.set(s.game_id, {
        game_id:    s.game_id,
        game_title: s.game_title,
        cover_url:  s.cover_url,
        releases:   s.game_releases,
        bars:       [],
      });
    }

    const clampedStart = start < rangeStart ? rangeStart : start;
    const clampedEnd   = end   > rangeEnd   ? rangeEnd   : end;

    const leftDays  = diffDays(rangeStart, clampedStart);
    const widthDays = diffDays(clampedStart, clampedEnd) + 1;

    byGame.get(s.game_id).bars.push({
      left:      (leftDays  / totalDays) * 100,
      width:     (widthDays / totalDays) * 100,
      startDate: start,
      endDate:   s.end_date ? parseDate(s.end_date) : new Date(),
      rawSession: s,
    });
  }

  const rows = [...byGame.values()];
  rows.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') {
      const aDate = a.releases?.find(r => r.date)?.date ?? '';
      const bDate = b.releases?.find(r => r.date)?.date ?? '';
      cmp = aDate.localeCompare(bDate);
    } else if (sortKey === 'playthrough') {
      const aMin = Math.min(...a.bars.map(bar => bar.startDate.getTime()));
      const bMin = Math.min(...b.bars.map(bar => bar.startDate.getTime()));
      cmp = aMin - bMin;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return rows;
}

// ── Build header ticks ────────────────────────────────────────────────────────
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildTicks(rangeStart, rangeEnd) {
  const totalDays  = diffDays(rangeStart, rangeEnd) + 1;
  const spanMonths = Math.round(totalDays / 30);
  const monthStep  = spanMonths > 36 ? 6 : spanMonths > 13 ? 3 : 1;
  const multiYear  = rangeEnd.getFullYear() > rangeStart.getFullYear();

  const monthTicks = [];
  const yearTicks  = [];

  let cursor = startOfMonth(rangeStart);
  while (cursor <= rangeEnd) {
    if (cursor.getMonth() % monthStep === 0) {
      const leftDays = diffDays(rangeStart, cursor < rangeStart ? rangeStart : cursor);
      monthTicks.push({ label: MONTH_SHORT[cursor.getMonth()], left: (leftDays / totalDays) * 100 });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  if (multiYear) {
    let yr = rangeStart.getFullYear() + 1;
    const endYr = rangeEnd.getFullYear();
    while (yr <= endYr) {
      const yearStart    = new Date(yr, 0, 1);
      const leftDays     = diffDays(rangeStart, yearStart);
      yearTicks.push({ label: String(yr), left: (leftDays / totalDays) * 100 });
      yr++;
    }
  }

  return { monthTicks, yearTicks, multiYear };
}

function todayPosition(rangeStart, rangeEnd) {
  const today = new Date();
  if (today < rangeStart || today > rangeEnd) return null;
  const totalDays = diffDays(rangeStart, rangeEnd) + 1;
  return (diffDays(rangeStart, today) / totalDays) * 100;
}

// ── Gantt Chart ───────────────────────────────────────────────────────────────
const ROW_HEIGHT  = 40;
const LABEL_WIDTH = 160;
const MIN_BAR_W   = 6;

// Hides the horizontal scrollbar on the gantt body (Firefox uses scrollbarWidth:'none' inline)
const GANTT_BODY_STYLE = (
  <style>{`.gantt-body::-webkit-scrollbar { display: none; }`}</style>
);

function GanttChart({ sessions, rangeStart, rangeEnd, onBarClick, onGameClick, sortKey, sortDir }) {
  const today = new Date();
  const rows  = buildGanttRows(sessions, rangeStart, rangeEnd, sortKey, sortDir);
  const { monthTicks, yearTicks, multiYear } = buildTicks(rangeStart, rangeEnd);
  const todayPct  = todayPosition(rangeStart, rangeEnd);

  // Shared horizontal scroll sync between header and body
  const headerRef = useRef(null);
  const bodyRef   = useRef(null);

  const onHeaderScroll = () => {
    if (bodyRef.current) bodyRef.current.scrollLeft = headerRef.current.scrollLeft;
  };
  const onBodyScroll = () => {
    if (headerRef.current) headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
  };

  if (rows.length === 0) {
    return (
      <Box textAlign="center" py={16}>
        <Text fontSize="2xl" mb={3}>🎮</Text>
        <Text color="var(--color-text-muted)">No sessions in this period.</Text>
      </Box>
    );
  }

  const headerHeight = multiYear ? 36 : 18;

  return (
    <Box border="1px solid var(--color-border-subtle)" borderRadius="6px" overflow="hidden">
      {GANTT_BODY_STYLE}

      {/* ── Sticky header: game label column + tick area, scrolls horizontally ── */}
      <div
        ref={headerRef}
        onScroll={onHeaderScroll}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          // Show scrollbar here (between header and body)
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-subtle)',
        }}
      >
        <div style={{ display: 'flex', minWidth: '600px', padding: '6px 0 4px' }}>
          {/* Frozen left label column spacer */}
          <div style={{ width: `${LABEL_WIDTH}px`, flexShrink: 0 }} />
          {/* Tick area */}
          <div style={{ flex: 1, position: 'relative', height: `${headerHeight}px` }}>
            {multiYear && yearTicks.map((t, i) => (
              <span key={i} style={{
                position: 'absolute', left: `${t.left}%`,
                top: '0', fontSize: '0.65rem', fontWeight: 700,
                color: 'var(--color-text-muted)', whiteSpace: 'nowrap', userSelect: 'none',
              }}>{t.label}</span>
            ))}
            {monthTicks.map((t, i) => (
              <span key={i} style={{
                position: 'absolute', left: `${t.left}%`,
                top: multiYear ? '16px' : '0',
                fontSize: '0.65rem', color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap', userSelect: 'none',
              }}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body: vertical scroll here, horizontal synced with header ── */}
      <div
        ref={bodyRef}
        onScroll={onBodyScroll}
        className="gantt-body"
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '480px',
          // Hide horizontal scrollbar here — header scrollbar is the one shown
          scrollbarWidth: 'none',
        }}
      >
        <div style={{ minWidth: '600px' }}>
          {rows.map((row) => (
            <div key={row.game_id} style={{
              display: 'flex', alignItems: 'center',
              height: `${ROW_HEIGHT}px`,
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              {/* Frozen game label */}
              <div
                style={{
                  width: `${LABEL_WIDTH}px`, flexShrink: 0, paddingRight: '12px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)',
                  cursor: 'pointer', transition: 'opacity 0.12s',
                  position: 'sticky', left: 0,
                  background: 'var(--color-bg-surface)',
                  zIndex: 1,
                }}
                onClick={() => onGameClick(row)}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {row.game_title}
              </div>

              {/* Bar track */}
              <div style={{
                flex: 1, position: 'relative',
                height: `${ROW_HEIGHT - 12}px`,
                background: 'var(--color-bg-subtle)',
                borderRadius: '4px',
              }}>
                {todayPct !== null && (
                  <div style={{
                    position: 'absolute', left: `${todayPct}%`,
                    top: '-4px', bottom: '-4px', width: '2px',
                    background: 'var(--color-accent)', opacity: 0.7,
                    zIndex: 10, pointerEvents: 'none',
                  }} />
                )}

                {row.bars.map((bar, bi) => {
                  const col       = statusColor(bar.rawSession.status);
                  const isOngoing = !bar.rawSession.end_date;
                  const label     = isOngoing
                    ? `${fmtDay(bar.startDate)} → ongoing`
                    : `${fmtDay(bar.startDate)} → ${fmtDay(bar.endDate)}`;

                  return (
                    <Tooltip key={bi} label={label} hasArrow placement="top" openDelay={200}>
                      <div
                        onClick={() => onBarClick(bar.rawSession)}
                        style={{
                          position: 'absolute',
                          left: `${bar.left}%`,
                          width: `max(${bar.width}%, ${MIN_BAR_W}px)`,
                          top: '4px', bottom: '4px',
                          background: col.bg,
                          border: `1px solid ${col.border}`,
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'opacity 0.12s',
                          boxSizing: 'border-box',
                          ...(isOngoing ? {
                            backgroundImage: `repeating-linear-gradient(
                              -45deg, transparent, transparent 4px,
                              rgba(255,255,255,0.25) 4px, rgba(255,255,255,0.25) 8px
                            )`,
                          } : {}),
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Box>
  );
}

// ── Stats Panel helpers ───────────────────────────────────────────────────────

const PIE_COLORS = [
  '#6aaae8', '#5bbfa3', '#e8a030', '#9e9e9e', '#b088e8',
  '#e8806a', '#88c05a', '#e8c46a', '#6ac4e8', '#c46ae8',
  '#e86aaa', '#6ae8b0', '#aae86a', '#e8e86a', '#6a8ae8',
];

function buildPieSlices(data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];
  let cumAngle = -Math.PI / 2;
  return data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const start = cumAngle;
    const end   = cumAngle + angle;
    cumAngle    = end;
    const r = 80, cx = 100, cy = 100;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = angle >= 2 * Math.PI - 0.001
      ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 -${2 * r} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return {
      path, color: PIE_COLORS[i % PIE_COLORS.length],
      label: d.label, value: d.value,
      pct: Math.round((d.value / total) * 100),
    };
  });
}

function PieChart({ data, title }) {
  const [hovered, setHovered] = useState(null);
  const slices = buildPieSlices(data);

  if (data.length === 0) {
    return (
      <Box>
        <Text fontSize="xs" fontWeight="700" color="var(--color-text-secondary)" mb={1}>{title}</Text>
        <Text fontSize="xs" color="var(--color-text-muted)" fontStyle="italic">No data</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" color="var(--color-text-secondary)" mb={1}>{title}</Text>
      {/* Pie + legend stacked vertically so each chart is self-contained in its grid cell */}
      <Box>
        <svg width="140" height="140" viewBox="0 0 200 200" style={{ display: 'block', marginBottom: '6px' }}>
          {slices.map((s, i) => (
            <path
              key={i} d={s.path} fill={s.color}
              opacity={hovered === null || hovered === i ? 1 : 0.4}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '2px',
          maxHeight: `${7 * 18}px`, overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
        }}>
          {slices.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                opacity: hovered === null || hovered === i ? 1 : 0.4,
                transition: 'opacity 0.15s', cursor: 'default',
                lineHeight: '1.2',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: '7px', height: '7px', borderRadius: '1px',
                background: s.color, flexShrink: 0, marginTop: '1px',
              }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.label}{' '}
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{s.pct}%</span>
                <span style={{ fontSize: '0.65rem' }}> ({s.value})</span>
              </span>
            </div>
          ))}
        </div>
      </Box>
    </Box>
  );
}

// ── Top 20 List ───────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'top20_games';

function Top20List({ games, onOpenGame }) {
  const [entries,     setEntries]     = useState(null); // null = loading
  const [editingId,   setEditingId]   = useState(null);
  const [draft,       setDraft]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch,  setShowSearch]  = useState(false);
  const searchRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    api.settings.get(SETTINGS_KEY)
      .then(val => setEntries(Array.isArray(val) ? val : []))
      .catch(() => setEntries([]));
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    if (!showSearch) return;
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSearch]);

  const persist = async (next) => {
    setSaving(true);
    try {
      await api.settings.set(SETTINGS_KEY, next);
      setEntries(next);
    } catch {
      toast({ title: 'Failed to save', status: 'error', duration: 2000 });
    } finally {
      setSaving(false);
    }
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...entries];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    persist(next);
  };

  const moveDown = (i) => {
    if (i === entries.length - 1) return;
    const next = [...entries];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    persist(next);
  };

  const remove = (i) => persist(entries.filter((_, idx) => idx !== i));

  const commitEdit = (i) => {
    if (!draft.trim()) { setEditingId(null); return; }
    const next = [...entries];
    next[i] = draft.trim();
    setEditingId(null);
    persist(next);
  };

  const addFromSearch = (title) => {
    if (entries.length >= 20) return;
    setShowSearch(false);
    setSearchQuery('');
    persist([...entries, title]);
  };

  // Suggestions: user's library filtered by query, excluding already-listed titles
  const suggestions = searchQuery.trim().length > 0
    ? (games || [])
        .filter(g =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !entries.includes(g.title)
        )
        .slice(0, 8)
    : [];

  if (entries === null) {
    return <Spinner size="xs" color="var(--color-accent)" />;
  }

  return (
    <Box>
      <HStack mb={1.5} justify="space-between">
        <Text fontSize="xs" fontWeight="700" color="var(--color-text-secondary)">
          🏆 Top 20 Games of All Time
        </Text>
        {entries.length < 20 && (
          <Button
            size="xs" variant="ghost" p={0} h="16px" minW="auto"
            fontSize="xs"
            color="var(--color-text-muted)"
            _hover={{ color: 'var(--color-accent)' }}
            isDisabled={saving}
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => document.getElementById('top20-search')?.focus(), 50);
            }}
          >
            + Add
          </Button>
        )}
      </HStack>

      {/* Search input + dropdown */}
      {showSearch && (
        <Box ref={searchRef} position="relative" mb={2}>
          <Input
            id="top20-search"
            autoFocus
            size="xs"
            placeholder="Search your games…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); }
            }}
            style={{
              fontSize: '0.75rem',
              background: 'var(--color-bg-page)',
              border: '1px solid var(--color-accent)',
              borderRadius: '4px',
              color: 'var(--color-text-primary)',
            }}
          />
          {(suggestions.length > 0 || searchQuery.trim().length > 0) && (
            <Box
              position="absolute" top="100%" left={0} right={0} zIndex={50}
              bg="var(--color-bg-surface)"
              border="1px solid var(--color-border)"
              borderRadius="4px"
              boxShadow="0 4px 12px rgba(0,0,0,0.15)"
              mt="2px" maxH="200px" overflowY="auto"
            >
              {suggestions.length > 0 ? suggestions.map((g) => (
                <Box
                  key={g.id}
                  px={2} py={1.5}
                  cursor="pointer"
                  _hover={{ bg: 'var(--color-bg-hover)' }}
                  onMouseDown={() => addFromSearch(g.title)}
                >
                  <HStack spacing={2}>
                    {g.cover_url && (
                      <img
                        src={g.cover_url.replace('t_cover_big', 't_thumb')}
                        alt=""
                        style={{ width: '18px', height: '24px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                      />
                    )}
                    <Text fontSize="xs" color="var(--color-text-primary)" noOfLines={1}>{g.title}</Text>
                  </HStack>
                </Box>
              )) : (
                <Box px={2} py={1.5}>
                  <Text fontSize="xs" color="var(--color-text-muted)" fontStyle="italic">No matches in your library</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {entries.length === 0 && !showSearch && (
        <Text fontSize="xs" color="var(--color-text-muted)" fontStyle="italic">
          No entries yet. Click + Add to build your list.
        </Text>
      )}

      <VStack spacing={0} align="stretch">
        {entries.map((entry, i) => (
          <HStack
            key={i} spacing={1.5} py="2px"
            borderBottom="1px solid var(--color-border-subtle)"
            _hover={{ bg: 'var(--color-bg-hover)' }}
            px={1} borderRadius="sm"
          >
            <Text
              fontSize="xs" fontWeight="700"
              color={i < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
              w="20px" textAlign="right" flexShrink={0}
            >
              {i + 1}.
            </Text>

            {editingId === i ? (
              <Input
                autoFocus size="xs" value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => commitEdit(i)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(i);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                style={{
                  flex: 1, fontSize: '0.72rem', padding: '1px 4px',
                  background: 'var(--color-bg-page)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: '3px',
                  color: 'var(--color-text-primary)',
                }}
              />
            ) : (
              <Text
                fontSize="xs" flex={1}
                color={entry ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}
                fontStyle={entry ? 'normal' : 'italic'}
                cursor={entry ? 'pointer' : 'default'} noOfLines={1}
                onClick={() => {
                  if (!entry) return;
                  const match = games?.find(g => g.title === entry);
                  if (match && onOpenGame) onOpenGame(match.id);
                }}
                onDoubleClick={() => { setEditingId(i); setDraft(entry); }}
                _hover={{ color: entry ? 'var(--color-accent)' : undefined }}
                title={entry ? 'Click to open · Double-click to rename' : undefined}
              >
                {entry || 'Click to set title…'}
              </Text>
            )}

            <HStack spacing={0} flexShrink={0}>
              <Button
                size="xs" variant="ghost" p={0} h="16px" minW="16px" fontSize="9px"
                color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
                isDisabled={i === 0 || saving}
                onClick={() => moveUp(i)}
              >▲</Button>
              <Button
                size="xs" variant="ghost" p={0} h="16px" minW="16px" fontSize="9px"
                color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
                isDisabled={i === entries.length - 1 || saving}
                onClick={() => moveDown(i)}
              >▼</Button>
              <Button
                size="xs" variant="ghost" p={0} h="16px" minW="16px" fontSize="9px"
                color="var(--color-text-muted)" _hover={{ color: '#e53e3e' }}
                isDisabled={saving}
                onClick={() => remove(i)}
              >✕</Button>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ sessions, games, onOpenGame }) {
  const [open, setOpen] = useState(false);

  const genreData = (() => {
    const counts = {};
    for (const g of games) {
      for (const genre of (g.genres || [])) {
        counts[genre] = (counts[genre] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  const playedGameIds = new Set(sessions.map(s => s.game_id));

  const playedGenreData = (() => {
    const counts = {};
    for (const g of games) {
      if (!playedGameIds.has(g.id)) continue;
      const genres = g.genres || [];
      if (genres.length === 0) counts['Unknown'] = (counts['Unknown'] || 0) + 1;
      for (const genre of genres) counts[genre] = (counts[genre] || 0) + 1;
    }
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  const platformData = (() => {
    const counts = {};
    for (const s of sessions) {
      const p = s.platform || 'Unknown';
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  // Count distinct games that had at least one session starting in each calendar year
  const gamesPerYearData = (() => {
    // Map year → Set of game_ids
    const byYear = {};
    for (const s of sessions) {
      const year = s.start_date?.slice(0, 4);
      if (!year) continue;
      if (!byYear[year]) byYear[year] = new Set();
      byYear[year].add(s.game_id);
    }
    return Object.entries(byYear)
      .map(([label, ids]) => ({ label, value: ids.size }))
      .sort((a, b) => b.label.localeCompare(a.label)); // latest year first
  })();

  const totalGames        = games.length;
  const totalPlayed       = playedGameIds.size;
  const totalPlaythroughs = games.reduce((s, g) => s + (g.playthroughs?.length || 0), 0);

  return (
    <Box mb={4} border="1px solid var(--color-border)" borderRadius="8px" overflow="hidden">

      {/* ── Compact header toggle ── */}
      <HStack
        px={3} py={1.5}
        justify="space-between"
        cursor="pointer"
        bg="var(--color-bg-subtle)"
        _hover={{ bg: 'var(--color-bg-hover)' }}
        onClick={() => setOpen(v => !v)}
        userSelect="none"
      >
        <HStack spacing={3}>
          <Text fontSize="xs" fontWeight="700" color="var(--color-text-primary)">📊 Statistics</Text>
          <HStack spacing={1.5}>
            <Text fontSize="xs" color="var(--color-text-muted)">{totalGames} games</Text>
            <Text fontSize="xs" color="var(--color-text-muted)">·</Text>
            <Text fontSize="xs" color="var(--color-text-muted)">{totalPlayed} played</Text>
            <Text fontSize="xs" color="var(--color-text-muted)">·</Text>
            <Text fontSize="xs" color="var(--color-text-muted)">{totalPlaythroughs} playthroughs</Text>
          </HStack>
        </HStack>
        {open
          ? <ChevronUpIcon boxSize={3} color="var(--color-text-muted)" />
          : <ChevronDownIcon boxSize={3} color="var(--color-text-muted)" />
        }
      </HStack>

      {/* ── Collapsible body ── */}
      {open && (
        <Box px={3} py={3} bg="var(--color-bg-surface)">
          {/*
            Two-column layout on md+:
              col 1 (left)  — summary numbers + pie charts
              col 2 (right) — Top 20 list
          */}
          <Box
            display="grid"
            gridTemplateColumns={{ base: '1fr', md: '3fr 2fr' }}
            gap={4}
            alignItems="flex-start"
          >
            {/* ── Left: summary + charts ── */}
            <Box>
              {/* Compact summary row */}
              <HStack spacing={5} mb={3} flexWrap="wrap">
                {[
                  { label: 'Total Games',  value: totalGames },
                  { label: 'Games Played', value: totalPlayed },
                  { label: 'Playthroughs', value: totalPlaythroughs },
                ].map(stat => (
                  <Box key={stat.label}>
                    <Text fontSize="md" fontWeight="800" color="var(--color-accent)" lineHeight="1.1">
                      {stat.value}
                    </Text>
                    <Text fontSize="xs" color="var(--color-text-muted)">{stat.label}</Text>
                  </Box>
                ))}
              </HStack>

              {/* Pie charts — 2 per row */}
              <Box
                display="grid"
                gridTemplateColumns="1fr 1fr"
                gap={3}
              >
                <PieChart data={genreData}       title="🎭 Genres in Library" />
                <PieChart data={playedGenreData} title="🎮 Genres Played" />
                <PieChart data={platformData}    title="🖥️ Sessions per Platform" />
                <PieChart data={gamesPerYearData} title="📅 Games Played per Year" />
              </Box>
            </Box>

            {/* ── Right: Top 20 ── */}
            <Box
              border="1px solid var(--color-border-subtle)"
              borderRadius="6px"
              p={2}
              bg="var(--color-bg-subtle)"
            >
              <Top20List games={games} onOpenGame={onOpenGame} />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Range presets ─────────────────────────────────────────────────────────────
function getRangeForPreset(preset, refDate) {
  const today = refDate || new Date();
  if (preset === '3m') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const end   = endOfMonth(today);
    return { start, end };
  }
  if (preset === '6m') {
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const end   = endOfMonth(today);
    return { start, end };
  }
  if (preset === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    const end   = new Date(today.getFullYear(), 11, 31);
    return { start, end };
  }
  if (preset === 'all') return null;
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const today    = new Date();

  const [sessions,     setSessions]     = useState([]);
  const [games,        setGames]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [loadingGame,  setLoadingGame]  = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  const { calendarState, setCalendarState } = useTabState();
  const preset    = calendarState.preset;
  const setPreset = (val) => setCalendarState((s) => ({ ...s, preset: val }));

  const [ganttSortKey, setGanttSortKey] = useState('date');
  const [ganttSortDir, setGanttSortDir] = useState('desc');

  const toggleGanttSort = (key) => {
    if (ganttSortKey === key) {
      setGanttSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setGanttSortKey(key);
      setGanttSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sessionData, gameData] = await Promise.all([
        api.calendar.sessions(),
        api.games.list(),
      ]);
      setSessions(sessionData);
      setGames(gameData);
    } catch (err) {
      toast({ title: 'Error loading calendar', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const range = (() => {
    if (preset === 'all') {
      if (sessions.length === 0) return getRangeForPreset('6m', today);
      const allStarts = sessions.map(s => parseDate(s.start_date));
      const allEnds   = sessions.map(s => s.end_date ? parseDate(s.end_date) : today);
      const minDate   = new Date(Math.min(...allStarts.map(d => d.getTime())));
      const maxDate   = new Date(Math.max(...allEnds.map(d => d.getTime())));
      return { start: startOfMonth(minDate), end: endOfMonth(maxDate) };
    }
    return getRangeForPreset(preset, today);
  })();

  const openGame = useCallback(async (gameId) => {
    if (loadingGame) return;
    setLoadingGame(true);
    try {
      const game = await api.games.get(gameId);
      setSelectedGame(game);
    } catch (err) {
      toast({ title: 'Could not load game', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setLoadingGame(false);
    }
  }, [loadingGame, toast]);

  const handleBarClick  = useCallback((session) => openGame(session.game_id), [openGame]);
  const handleGameClick = useCallback((row)     => openGame(row.game_id),     [openGame]);

  const PRESETS = [
    { key: '3m',   label: '3 months' },
    { key: '6m',   label: '6 months' },
    { key: 'year', label: 'This year' },
    { key: 'all',  label: 'All time'  },
  ];

  return (
    <>
      <Navbar />
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />
      <div className="page-container">
        <Box maxW="1100px" mx="auto">

          {loading ? (
            <Box display="flex" justifyContent="center" py={16}>
              <Spinner color="var(--color-accent)" />
            </Box>
          ) : (
            <>
              <StatsPanel sessions={sessions} games={games} onOpenGame={openGame} />

              {/* ── Toolbar ── */}
              <HStack mb={4} justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <Text fontSize="lg" fontWeight="700" color="var(--color-text-primary)">
                  Playthroughs
                </Text>
                <HStack spacing={1}>
                  {PRESETS.map((p) => (
                    <Button
                      key={p.key}
                      size="xs"
                      variant={preset === p.key ? 'solid' : 'outline'}
                      bg={preset === p.key ? 'var(--color-accent)' : 'transparent'}
                      color={preset === p.key ? 'white' : 'var(--color-text-secondary)'}
                      borderColor="var(--color-border)"
                      _hover={{
                        bg:          preset === p.key ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                        borderColor: 'var(--color-accent)',
                      }}
                      onClick={() => setPreset(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                  <Box w="1px" h="20px" bg="var(--color-border)" mx={1} flexShrink={0} />
                  <Tooltip label={`Sort by game release date (${ganttSortKey === 'date' ? ganttSortDir : 'asc'})`} hasArrow placement="bottom" openDelay={400}>
                    <Button
                      size="xs" variant="outline"
                      bg={ganttSortKey === 'date' ? 'var(--color-bg-subtle)' : 'transparent'}
                      color={ganttSortKey === 'date' ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                      borderColor={ganttSortKey === 'date' ? 'var(--color-accent)' : 'var(--color-border)'}
                      _hover={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                      onClick={() => toggleGanttSort('date')}
                    >
                      📅 {ganttSortKey === 'date' ? (ganttSortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </Button>
                  </Tooltip>
                  <Tooltip label={`Sort by playthrough count (${ganttSortKey === 'playthrough' ? ganttSortDir : 'asc'})`} hasArrow placement="bottom" openDelay={400}>
                    <Button
                      size="xs" variant="outline"
                      bg={ganttSortKey === 'playthrough' ? 'var(--color-bg-subtle)' : 'transparent'}
                      color={ganttSortKey === 'playthrough' ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                      borderColor={ganttSortKey === 'playthrough' ? 'var(--color-accent)' : 'var(--color-border)'}
                      _hover={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                      onClick={() => toggleGanttSort('playthrough')}
                    >
                      🔁 {ganttSortKey === 'playthrough' ? (ganttSortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </Button>
                  </Tooltip>
                </HStack>
              </HStack>

              {/* ── Status legend ── */}
              <HStack mb={4} spacing={3} flexWrap="wrap">
                {Object.entries(STATUS_COLORS).map(([status, col]) => (
                  <HStack key={status} spacing={1.5}>
                    <Box w="10px" h="10px" borderRadius="2px" bg={col.bg} border={`1px solid ${col.border}`} flexShrink={0} />
                    <Text fontSize="xs" color="var(--color-text-muted)" textTransform="capitalize">
                      {status === 'pend' ? 'Pended' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </HStack>
                ))}
              </HStack>

              <GanttChart
                sessions={sessions}
                rangeStart={range.start}
                rangeEnd={range.end}
                onBarClick={handleBarClick}
                onGameClick={handleGameClick}
                sortKey={ganttSortKey}
                sortDir={ganttSortDir}
              />
            </>
          )}

        </Box>
      </div>

      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          onUpdated={fetchSessions}
          onDeleted={() => { fetchSessions(); setSelectedGame(null); }}
        />
      )}
    </>
  );
}
