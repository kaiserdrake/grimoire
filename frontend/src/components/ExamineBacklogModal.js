'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody,
  Box, Flex, HStack, VStack, Text, Spinner, SimpleGrid,
  Badge, Tooltip, Button, Input, useToast,
} from '@chakra-ui/react';
import { api } from '@/utils/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ControllerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 12h4M8 10v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="13" r="1" fill="currentColor"/>
  </svg>
);

const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const DragIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
  </svg>
);

const ResetIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
  </svg>
);

const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtHours = (h) => {
  if (!h) return null;
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
};

const getPlatforms = (game) => {
  const fromPT = (game.playthroughs || []).map((p) => p.platform).filter(Boolean);
  if (fromPT.length) return [...new Set(fromPT)];
  if (game.releases) {
    try {
      const r = typeof game.releases === 'string' ? JSON.parse(game.releases) : game.releases;
      return [...new Set(r.map((x) => x.platform).filter(Boolean))];
    } catch { /**/ }
  }
  return [];
};

const suggestOrder = (games) =>
  [...games].sort((a, b) => (a.time_to_beat ?? Infinity) - (b.time_to_beat ?? Infinity));

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent }) => (
  <Box bg="var(--color-bg)" border="1px solid var(--color-border)" borderRadius="8px" p={3} minW={0}>
    <Text fontSize="10px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em" mb={1}>{label}</Text>
    <Text fontSize="20px" fontWeight="800" color={accent || 'var(--color-text-primary)'} lineHeight="1.1">{value}</Text>
    {sub && <Text fontSize="10px" color="var(--color-text-muted)" mt={0.5}>{sub}</Text>}
  </Box>
);

// ── Priority Row ──────────────────────────────────────────────────────────────
// Fixed height, cover-as-background (matching RecentDrawer style)
const ROW_HEIGHT = '68px';

const PriorityRow = ({ game, rank, isTop, onDragStart, onDragEnter, onDragEnd, onTimeUpdated }) => {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving]     = useState(false);
  const inputRef = useRef(null);

  const platforms = getPlatforms(game);
  const hours     = fmtHours(game.time_to_beat);
  const hasCover  = !!game.cover_url;

  const startEdit = (e) => {
    e.stopPropagation();
    setInputVal(game.time_to_beat != null ? String(game.time_to_beat) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = (e) => { e?.stopPropagation(); setEditing(false); };

  const commitEdit = async (e) => {
    e?.stopPropagation();
    const parsed = parseInt(inputVal, 10);
    const newVal = isNaN(parsed) || parsed <= 0 ? null : parsed;
    setSaving(true);
    try {
      await api.games.update(game.id, {
        title: game.title, cover_url: game.cover_url, summary: game.summary,
        genres: game.genres, series: game.series, developer: game.developer,
        publisher: game.publisher, time_to_beat: newVal, releases: game.releases,
      });
      onTimeUpdated(game.id, newVal);
      setEditing(false);
    } catch { /**/ } finally { setSaving(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit(e);
    if (e.key === 'Escape') cancelEdit(e);
  };

  // Text colors depend on whether there's a cover (dark overlay means white text)
  const textPrimary = hasCover ? '#fff' : 'var(--color-text-primary)';
  const textMuted   = hasCover ? 'rgba(255,255,255,0.65)' : 'var(--color-text-muted)';
  const chipBg      = hasCover ? 'rgba(255,255,255,0.15)' : 'var(--color-surface-hover)';

  return (
    <Box
      position="relative"
      height={ROW_HEIGHT}
      overflow="hidden"
      borderRadius="8px"
      border={`1px solid ${isTop ? 'var(--color-accent)' : 'var(--color-border)'}`}
      cursor={editing ? 'default' : 'grab'}
      draggable={!editing}
      onDragStart={editing ? undefined : onDragStart}
      onDragEnter={editing ? undefined : onDragEnter}
      onDragEnd={editing ? undefined : onDragEnd}
      // cover-as-background
      backgroundImage={hasCover ? `url(${game.cover_url})` : 'none'}
      backgroundSize="cover"
      backgroundPosition="center 30%"
      backgroundColor={isTop ? 'var(--color-accent-subtle)' : 'var(--color-bg)'}
      _hover={{ borderColor: 'var(--color-accent)' }}
      transition="border-color 0.15s"
      userSelect="none"
    >
      {/* Dark gradient overlay (same as RecentDrawer) */}
      {hasCover && (
        <Box
          position="absolute" inset={0}
          background="linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)"
        />
      )}

      {/* Content layer */}
      <Flex
        position="relative" zIndex={1}
        align="center" h="100%" px={3} gap={2.5}
      >
        {/* Drag handle */}
        <Box color={textMuted} flexShrink={0} opacity={editing ? 0.3 : 1}><DragIcon /></Box>

        {/* Title + platforms (left, grows) */}
        <Box flex={1} minW={0}>
          <HStack spacing={1.5} mb={0.5}>
            <Text fontSize="13px" fontWeight="700" color={textPrimary} noOfLines={1} lineHeight="1.2">
              {game.title}
            </Text>
          </HStack>
          <HStack spacing={1.5}>
            {platforms.slice(0, 2).map((p) => (
              <Text key={p} fontSize="10px" color={textMuted} bg={chipBg} px={1.5} py={0.5} borderRadius="4px" flexShrink={0}>
                {p}
              </Text>
            ))}
          </HStack>
        </Box>

        {/* Time to beat — right-aligned, inline editable */}
        <Box flexShrink={0} onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <HStack spacing={1}>
              <Input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="hours"
                type="text"
                inputMode="numeric"
                w="60px"
                h="22px"
                fontSize="11px"
                bg={hasCover ? 'rgba(0,0,0,0.5)' : 'var(--color-bg-surface)'}
                color={textPrimary}
                borderColor="var(--color-accent)"
                borderRadius="4px"
                px={1.5}
                _focus={{ boxShadow: 'none', borderColor: 'var(--color-accent)' }}
                userSelect="text"
                cursor="text"
              />
              <Text fontSize="10px" color={textMuted}>hrs</Text>
              <Button
                size="xs"
                isLoading={saving}
                onClick={commitEdit}
                style={{ background: 'var(--color-accent)', color: 'white' }}
                borderRadius="4px"
                h="22px"
                px={2}
                fontSize="10px"
              >
                Save
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={cancelEdit}
                style={{ color: hasCover ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}
                h="22px"
                px={1.5}
                fontSize="10px"
              >
                Cancel
              </Button>
            </HStack>
          ) : (
            <Tooltip label={hours ? 'Edit time to beat' : 'Add time to beat'} openDelay={400}>
              <HStack
                spacing={1} cursor="pointer" onClick={startEdit}
                px={1.5} py={1} borderRadius="4px"
                _hover={{ bg: hasCover ? 'rgba(255,255,255,0.1)' : 'var(--color-surface-hover)' }}
              >
                <Box color={hours ? textMuted : 'var(--color-accent)'}><ClockIcon /></Box>
                <Text fontSize="11px" color={hours ? textMuted : 'var(--color-accent)'} whiteSpace="nowrap">
                  {hours || 'Add time'}
                </Text>
                <Box color={textMuted} opacity={0.6}><EditIcon /></Box>
              </HStack>
            </Tooltip>
          )}
        </Box>

        {/* Rank number — rightmost, large, white with black outline */}
        <Box flexShrink={0} w="32px" textAlign="right">
          <Text
            fontSize="26px"
            fontWeight="900"
            lineHeight="1"
            color="#fff"
            style={{
              textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 6px rgba(0,0,0,0.5)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rank}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function ExamineBacklogModal({ isOpen, onClose }) {
  const [games, setGames]     = useState([]);
  const [ordered, setOrdered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const toast = useToast();
  const dragSrc   = useRef(null);
  const orderedRef = useRef([]);   // kept in sync so handleDragEnd can read latest

  // Keep ref in sync with state
  useEffect(() => { orderedRef.current = ordered; }, [ordered]);

  // Load on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const [backlogResult, savedResult] = await Promise.allSettled([
          api.games.list('backlog'),
          api.settings.get('backlog_priority'),
        ]);
        const gamesData = backlogResult.status === 'fulfilled' ? backlogResult.value : [];
        const savedIds  = savedResult.status === 'fulfilled' && Array.isArray(savedResult.value) ? savedResult.value : [];

        setGames(gamesData);
        if (savedIds.length > 0) {
          const byId = Object.fromEntries(gamesData.map((g) => [g.id, g]));
          const savedOrdered = savedIds.map((id) => byId[id]).filter(Boolean);
          const newGames = gamesData.filter((g) => !savedIds.includes(g.id));
          setOrdered([...savedOrdered, ...suggestOrder(newGames)]);
        } else {
          setOrdered(suggestOrder(gamesData));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((idx) => { dragSrc.current = idx; }, []);

  const handleDragEnter = useCallback((idx) => {
    if (dragSrc.current === null || dragSrc.current === idx) return;
    setOrdered((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, item);
      dragSrc.current = idx;
      return next;
    });
  }, []);

  // Auto-save on drop
  const handleDragEnd = useCallback(async () => {
    dragSrc.current = null;
    const current = orderedRef.current;
    setSaving(true);
    try {
      await api.settings.set('backlog_priority', current.map((g) => g.id));
    } catch {
      toast({ title: 'Failed to save priority', status: 'error', duration: 3000, isClosable: true });
    } finally {
      setSaving(false);
    }
  }, [toast]);

  // Reset to suggested order and auto-save
  const resetOrder = async () => {
    const next = suggestOrder(games);
    setOrdered(next);
    setSaving(true);
    try {
      await api.settings.set('backlog_priority', next.map((g) => g.id));
      toast({ title: 'Order reset to suggestion', status: 'success', duration: 2000, isClosable: true });
    } catch {
      toast({ title: 'Failed to save priority', status: 'error', duration: 3000, isClosable: true });
    } finally {
      setSaving(false);
    }
  };

  // Update time_to_beat in local state after inline edit
  const handleTimeUpdated = useCallback((gameId, newTime) => {
    const update = (list) => list.map((g) => g.id === gameId ? { ...g, time_to_beat: newTime } : g);
    setGames((prev) => update(prev));
    setOrdered((prev) => update(prev));
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const gamesWithTTB = games.filter((g) => g.time_to_beat);
  const totalHours   = gamesWithTTB.reduce((s, g) => s + g.time_to_beat, 0);
  const avgHours     = gamesWithTTB.length ? totalHours / gamesWithTTB.length : 0;
  const shortest     = gamesWithTTB.length ? gamesWithTTB.reduce((a, b) => a.time_to_beat < b.time_to_beat ? a : b) : null;

  const platformCounts = {};
  games.forEach((g) => getPlatforms(g).forEach((p) => { platformCounts[p] = (platformCounts[p] || 0) + 1; }));
  const topPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        border="1px solid var(--color-border)"
        borderRadius="14px"
        maxW="680px"
        mx={4}
      >
        <ModalHeader pb={2}>
          <HStack justify="space-between" align="center" pr={8}>
            <Box>
              <Text fontSize="18px" fontWeight="800" color="var(--color-text-primary)" letterSpacing="-0.02em">
                Examine Backlog
              </Text>
              <Text fontSize="12px" color="var(--color-text-muted)" fontWeight="400" mt={0.5}>
                {loading ? 'Loading…' : `${games.length} game${games.length !== 1 ? 's' : ''} in your backlog`}
                {saving && <Text as="span" ml={2} fontSize="11px" color="var(--color-accent)">Saving…</Text>}
              </Text>
            </Box>
            <Tooltip label="Reset to suggested order (shortest first)">
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<ResetIcon />}
                onClick={resetOrder}
                isDisabled={loading || games.length === 0}
                color="var(--color-text-muted)"
                _hover={{ color: 'var(--color-text-primary)' }}
              >
                Suggest
              </Button>
            </Tooltip>
          </HStack>
        </ModalHeader>
        <ModalCloseButton top={4} right={4} />

        <ModalBody pb={6}>
          {loading ? (
            <Flex justify="center" align="center" h="160px">
              <Spinner color="var(--color-accent)" size="lg" />
            </Flex>
          ) : games.length === 0 ? (
            <Flex direction="column" align="center" justify="center" h="160px" gap={2} color="var(--color-text-muted)">
              <Text fontSize="28px">📋</Text>
              <Text fontSize="13px">No games in your backlog yet.</Text>
            </Flex>
          ) : (
            <VStack spacing={5} align="stretch">
              {/* Stats */}
              <SimpleGrid columns={4} spacing={2}>
                <StatCard label="Total Games" value={games.length} sub={`${gamesWithTTB.length} with estimates`} />
                <StatCard label="Total Hours" value={fmtHours(totalHours) || '—'} sub="estimated total" accent="var(--color-accent)" />
                <StatCard label="Avg. Per Game" value={avgHours ? fmtHours(avgHours) : '—'} sub="avg time to beat" />
                <StatCard label="Quick Win" value={shortest ? fmtHours(shortest.time_to_beat) : '—'} sub={shortest?.title || 'no data'} accent="#4caf82" />
              </SimpleGrid>

              {/* Platform breakdown */}
              {topPlatforms.length > 0 && (
                <Box bg="var(--color-bg)" border="1px solid var(--color-border)" borderRadius="8px" p={3}>
                  <Text fontSize="10px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em" mb={2}>
                    By Platform
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    {topPlatforms.map(([platform, count]) => (
                      <HStack key={platform} spacing={1} bg="var(--color-surface)" border="1px solid var(--color-border)" px={2} py={0.5} borderRadius="5px">
                        <Box color="var(--color-text-muted)"><ControllerIcon /></Box>
                        <Text fontSize="11px" color="var(--color-text-primary)" fontWeight="600">{platform}</Text>
                        <Text fontSize="11px" color="var(--color-text-muted)">×{count}</Text>
                      </HStack>
                    ))}
                  </HStack>
                </Box>
              )}

              {/* Play Next callout */}
              {ordered.length > 0 && (() => {
                const top = ordered[0];
                const topPlatforms = getPlatforms(top);
                const topHours = fmtHours(top.time_to_beat);
                return (
                  <Flex
                    gap={4} p={3}
                    bg="var(--color-accent-subtle)"
                    border="1px solid var(--color-accent)"
                    borderRadius="10px"
                    align="flex-start"
                  >
                    {/* Large cover card */}
                    {top.cover_url ? (
                      <Box
                        as="img"
                        src={top.cover_url}
                        alt={top.title}
                        w="90px"
                        h="120px"
                        borderRadius="7px"
                        objectFit="cover"
                        flexShrink={0}
                        boxShadow="0 4px 16px rgba(0,0,0,0.35)"
                      />
                    ) : (
                      <Box
                        w="90px" h="120px" borderRadius="7px" flexShrink={0}
                        bg="var(--color-surface-hover)"
                        display="flex" alignItems="center" justifyContent="center"
                      >
                        <Box color="var(--color-text-muted)"><StarIcon /></Box>
                      </Box>
                    )}

                    {/* Details */}
                    <Box flex={1} minW={0} pt={0.5}>
                      <HStack spacing={2} mb={1}>
                        <Badge
                          fontSize="8px" px={1.5} py={0.5} borderRadius="3px"
                          textTransform="uppercase" colorScheme="green"
                        >
                          Play Next
                        </Badge>
                      </HStack>
                      <Text fontSize="16px" fontWeight="800" color="var(--color-text-primary)" noOfLines={2} lineHeight="1.25" mb={2}>
                        {top.title}
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {topHours && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Box color="var(--color-accent)" display="flex"><ClockIcon /></Box>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>~{topHours} to beat</span>
                          </div>
                        )}
                        {topPlatforms.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            <Box color="var(--color-text-muted)" display="flex"><ControllerIcon /></Box>
                            {topPlatforms.slice(0, 3).map((p) => (
                              <span key={p} style={{
                                fontSize: '11px', color: 'var(--color-text-muted)',
                                background: 'var(--color-surface-hover)',
                                padding: '1px 6px', borderRadius: '4px',
                              }}>{p}</span>
                            ))}
                          </div>
                        )}
                        {top.genres?.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {top.genres.slice(0, 3).join(' · ')}
                          </span>
                        )}
                      </div>
                    </Box>
                  </Flex>
                );
              })()}

              {/* Priority list */}
              <VStack spacing={1.5} align="stretch">
                <Box>
                  <Text fontSize="10px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em">
                    Priority Order
                  </Text>
                  <Text fontSize="10px" color="var(--color-text-muted)">
                    Drag rows to reorder — priority saves automatically.
                  </Text>
                </Box>
                {ordered.map((game, idx) => (
                  <PriorityRow
                    key={game.id}
                    game={game}
                    rank={idx + 1}
                    isTop={idx === 0}
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onTimeUpdated={handleTimeUpdated}
                  />
                ))}
              </VStack>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
