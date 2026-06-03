'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Flex, HStack, VStack, Text, Spinner, SimpleGrid,
  Badge, Tooltip, Button, useToast,
} from '@chakra-ui/react';
import Navbar from '@/components/Navbar';
import { api } from '@/utils/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ControllerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 12h4M8 10v4"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="18" cy="13" r="1" fill="currentColor"/>
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const DragIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
  </svg>
);

const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtHours = (h) => {
  if (!h) return null;
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
};

const getPlatforms = (game) => {
  const fromPlaythroughs = (game.playthroughs || []).map((p) => p.platform).filter(Boolean);
  if (fromPlaythroughs.length) return [...new Set(fromPlaythroughs)];
  if (game.releases) {
    try {
      const r = typeof game.releases === 'string' ? JSON.parse(game.releases) : game.releases;
      return [...new Set(r.map((x) => x.platform).filter(Boolean))];
    } catch { /**/ }
  }
  return [];
};

// Default suggested order: shortest time-to-beat first, unknowns last
const suggestOrder = (games) =>
  [...games].sort((a, b) => {
    const ta = a.time_to_beat ?? Infinity;
    const tb = b.time_to_beat ?? Infinity;
    return ta - tb;
  });

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent }) => (
  <Box
    bg="var(--color-surface)"
    border="1px solid var(--color-border)"
    borderRadius="10px"
    p={4}
    minW={0}
  >
    <Text fontSize="11px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em" mb={1}>
      {label}
    </Text>
    <Text fontSize="22px" fontWeight="800" color={accent || 'var(--color-text-primary)'} lineHeight="1.1">
      {value}
    </Text>
    {sub && (
      <Text fontSize="11px" color="var(--color-text-muted)" mt={0.5}>{sub}</Text>
    )}
  </Box>
);

// ── Priority Row ──────────────────────────────────────────────────────────────
const PriorityRow = ({ game, rank, isTop, isDragging, onDragStart, onDragEnter, onDragEnd }) => {
  const platforms = getPlatforms(game);
  const hours = fmtHours(game.time_to_beat);
  const genres = (game.genres || []).slice(0, 2);

  return (
    <Flex
      align="center"
      gap={3}
      p={3}
      bg={isDragging ? 'var(--color-accent-subtle)' : isTop ? 'var(--color-accent-subtle)' : 'var(--color-surface)'}
      border={`1px solid ${isTop ? 'var(--color-accent)' : 'var(--color-border)'}`}
      borderRadius="10px"
      cursor="grab"
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      opacity={isDragging ? 0.5 : 1}
      transition="all 0.15s"
      _hover={{ borderColor: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' }}
      userSelect="none"
    >
      {/* Drag handle */}
      <Box color="var(--color-text-muted)" flexShrink={0} cursor="grab">
        <DragIcon />
      </Box>

      {/* Rank */}
      <Box
        w="28px"
        h="28px"
        borderRadius="50%"
        bg={isTop ? 'var(--color-accent)' : 'var(--color-surface-hover)'}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Text fontSize="12px" fontWeight="800" color={isTop ? '#fff' : 'var(--color-text-muted)'}>
          {rank}
        </Text>
      </Box>

      {/* Cover */}
      {game.cover_url ? (
        <Box
          as="img"
          src={game.cover_url}
          alt={game.title}
          w="36px"
          h="48px"
          borderRadius="4px"
          objectFit="cover"
          flexShrink={0}
        />
      ) : (
        <Box w="36px" h="48px" borderRadius="4px" bg="var(--color-surface-hover)" flexShrink={0} />
      )}

      {/* Info */}
      <Box flex={1} minW={0}>
        <HStack spacing={2} mb={0.5}>
          {isTop && (
            <Badge colorScheme="green" fontSize="9px" px={1.5} py={0.5} borderRadius="4px" textTransform="uppercase">
              Play Next
            </Badge>
          )}
          <Text fontSize="14px" fontWeight="700" color="var(--color-text-primary)" noOfLines={1}>
            {game.title}
          </Text>
        </HStack>
        <HStack spacing={3} flexWrap="wrap">
          {hours && (
            <HStack spacing={1}>
              <Box color="var(--color-text-muted)"><ClockIcon /></Box>
              <Text fontSize="12px" color="var(--color-text-muted)">{hours}</Text>
            </HStack>
          )}
          {platforms.slice(0, 2).map((p) => (
            <Text key={p} fontSize="11px" color="var(--color-text-muted)" bg="var(--color-surface-hover)" px={1.5} py={0.5} borderRadius="4px">
              {p}
            </Text>
          ))}
          {genres.map((g) => (
            <Text key={g} fontSize="11px" color="var(--color-text-muted)">{g}</Text>
          ))}
        </HStack>
      </Box>
    </Flex>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BacklogPage() {
  const [games, setGames]       = useState([]);
  const [ordered, setOrdered]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const toast = useToast();

  const dragSrc = useRef(null);

  // Load backlog games + saved priority
  useEffect(() => {
    (async () => {
      try {
        const [backlogGames, savedSetting] = await Promise.allSettled([
          api.games.list('backlog'),
          api.settings.get('backlog_priority'),
        ]);

        const gamesData = backlogGames.status === 'fulfilled' ? backlogGames.value : [];
        const savedIds  = savedSetting.status === 'fulfilled' && Array.isArray(savedSetting.value) ? savedSetting.value : [];

        setGames(gamesData);

        // Merge saved order with current backlog games
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
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((idx) => {
    dragSrc.current = idx;
  }, []);

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

  const handleDragEnd = useCallback(() => {
    dragSrc.current = null;
    setDirty(true);
  }, []);

  // ── Save priority ───────────────────────────────────────────────────────────
  const savePriority = async () => {
    setSaving(true);
    try {
      await api.settings.set('backlog_priority', ordered.map((g) => g.id));
      setDirty(false);
      toast({ title: 'Priority saved', status: 'success', duration: 2000, isClosable: true });
    } catch {
      toast({ title: 'Failed to save', status: 'error', duration: 3000, isClosable: true });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to suggested ──────────────────────────────────────────────────────
  const resetOrder = () => {
    setOrdered(suggestOrder(games));
    setDirty(true);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const gamesWithTTB  = games.filter((g) => g.time_to_beat);
  const totalHours    = gamesWithTTB.reduce((s, g) => s + g.time_to_beat, 0);
  const avgHours      = gamesWithTTB.length ? totalHours / gamesWithTTB.length : 0;
  const shortest      = gamesWithTTB.length ? gamesWithTTB.reduce((a, b) => a.time_to_beat < b.time_to_beat ? a : b) : null;

  const platformCounts = {};
  games.forEach((g) => {
    getPlatforms(g).forEach((p) => {
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });
  });
  const topPlatforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Box minH="100vh" bg="var(--color-bg)">
      <Navbar />

      <Box maxW="900px" mx="auto" px={4} py={6}>
        {/* Header */}
        <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
          <Box>
            <Text fontSize="22px" fontWeight="800" color="var(--color-text-primary)" letterSpacing="-0.02em">
              Examine Backlog
            </Text>
            <Text fontSize="13px" color="var(--color-text-muted)" mt={0.5}>
              {loading ? 'Loading…' : `${games.length} game${games.length !== 1 ? 's' : ''} in your backlog`}
            </Text>
          </Box>
          <HStack spacing={2}>
            <Tooltip label="Reset to suggested order (shortest first)">
              <Button
                size="sm"
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
            <Button
              size="sm"
              onClick={savePriority}
              isLoading={saving}
              isDisabled={!dirty || games.length === 0}
              bg="var(--color-accent)"
              color="#fff"
              _hover={{ opacity: 0.85 }}
              borderRadius="8px"
            >
              Save Priority
            </Button>
          </HStack>
        </HStack>

        {loading ? (
          <Flex justify="center" align="center" h="200px">
            <Spinner color="var(--color-accent)" size="lg" />
          </Flex>
        ) : games.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            h="200px"
            gap={2}
            color="var(--color-text-muted)"
          >
            <Text fontSize="32px">📋</Text>
            <Text fontSize="14px">No games in your backlog yet.</Text>
          </Flex>
        ) : (
          <VStack spacing={6} align="stretch">
            {/* Stats */}
            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
              <StatCard
                label="Total Games"
                value={games.length}
                sub={`${gamesWithTTB.length} with time estimates`}
              />
              <StatCard
                label="Total Hours"
                value={fmtHours(totalHours) || '—'}
                sub={gamesWithTTB.length < games.length ? 'estimated (partial)' : 'estimated total'}
                accent="var(--color-accent)"
              />
              <StatCard
                label="Avg. Per Game"
                value={avgHours ? fmtHours(avgHours) : '—'}
                sub="average time to beat"
              />
              <StatCard
                label="Quick Win"
                value={shortest ? fmtHours(shortest.time_to_beat) : '—'}
                sub={shortest ? shortest.title : 'no data'}
                accent="#4caf82"
              />
            </SimpleGrid>

            {/* Platform breakdown */}
            {topPlatforms.length > 0 && (
              <Box
                bg="var(--color-surface)"
                border="1px solid var(--color-border)"
                borderRadius="10px"
                p={4}
              >
                <Text fontSize="11px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em" mb={3}>
                  By Platform
                </Text>
                <HStack spacing={2} flexWrap="wrap">
                  {topPlatforms.map(([platform, count]) => (
                    <HStack
                      key={platform}
                      spacing={1.5}
                      bg="var(--color-surface-hover)"
                      border="1px solid var(--color-border)"
                      px={2.5}
                      py={1}
                      borderRadius="6px"
                    >
                      <Box color="var(--color-text-muted)"><ControllerIcon /></Box>
                      <Text fontSize="12px" color="var(--color-text-primary)" fontWeight="600">{platform}</Text>
                      <Text fontSize="12px" color="var(--color-text-muted)">×{count}</Text>
                    </HStack>
                  ))}
                </HStack>
              </Box>
            )}

            {/* Suggestion callout */}
            {ordered.length > 0 && (
              <Flex
                align="center"
                gap={3}
                p={3}
                bg="var(--color-accent-subtle)"
                border="1px solid var(--color-accent)"
                borderRadius="10px"
              >
                <Box color="var(--color-accent)" flexShrink={0}><StarIcon /></Box>
                <Box>
                  <Text fontSize="13px" fontWeight="700" color="var(--color-accent)">
                    Suggested: {ordered[0].title}
                  </Text>
                  <Text fontSize="12px" color="var(--color-text-muted)">
                    {ordered[0].time_to_beat
                      ? `~${fmtHours(ordered[0].time_to_beat)} to beat · `
                      : ''}
                    Drag rows below to set your own priority, then save.
                  </Text>
                </Box>
              </Flex>
            )}

            {/* Priority list */}
            <VStack spacing={2} align="stretch">
              <Text fontSize="11px" color="var(--color-text-muted)" fontWeight="600" textTransform="uppercase" letterSpacing="0.08em">
                Priority Order
              </Text>
              {ordered.map((game, idx) => (
                <PriorityRow
                  key={game.id}
                  game={game}
                  rank={idx + 1}
                  isTop={idx === 0}
                  isDragging={dragSrc.current === idx}
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </VStack>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
