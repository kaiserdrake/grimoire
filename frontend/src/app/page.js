'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HStack, Text, Box, Spinner, VStack,
  useDisclosure, useToast, Input, Tooltip, Menu, MenuButton,
  MenuList, MenuItem, Button,
} from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import Navbar from '@/components/Navbar';
import AddGameModal from '@/components/AddGameModal';
import GameDetailModal from '@/components/GameDetailModal';
import GameListRow from '@/components/GameListRow';
import GameCardView from '@/components/GameCardView';
import RecentDrawer from '@/components/RecentDrawer';
import { useTabState } from '@/context/TabStateContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';
import { TAG_STYLE, TAG_CONFIG, BacklogIcon, WishlistIcon, FavoriteIcon, DroppedIcon, PlayingIcon, GroupIcon, CompletedIcon, PendedIcon, OtherIcon } from '@/constants/tags';

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const AllGamesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const SearchIconSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SortIconSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="9" y1="18" x2="15" y2="18" />
  </svg>
);

const ListViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const GridViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="9" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

// ── Filter icon ───────────────────────────────────────────────────────────────
const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// All filterable categories in display order
const ALL_FILTERS = [
  { key: 'playing',   label: 'Playing',   Icon: PlayingIcon   },
  { key: 'backlog',   label: 'Backlog',   Icon: BacklogIcon   },
  { key: 'wishlist',  label: 'Wishlist',  Icon: WishlistIcon  },
  { key: 'favorite',  label: 'Favorites', Icon: FavoriteIcon  },
  { key: 'completed', label: 'Completed', Icon: CompletedIcon },
  { key: 'pend',      label: 'Pended',    Icon: PendedIcon    },
  { key: 'dropped',   label: 'Dropped',   Icon: DroppedIcon   },
  { key: 'other',     label: 'Other',     Icon: OtherIcon     },
];

// ── Filter button ─────────────────────────────────────────────────────────────

function FilterBtn({ active, onClick, title, tag, children }) {
  const style = tag ? TAG_STYLE[tag] : TAG_STYLE.backlog;
  return (
    <Tooltip label={title} hasArrow placement="bottom" openDelay={400}>
      <Box
        as="button"
        onClick={onClick}
        w="34px" h="34px"
        borderRadius="md"
        borderWidth="1px"
        display="flex" alignItems="center" justifyContent="center"
        transition="all 0.15s"
        style={{
          background:   active ? style.bg  : 'var(--color-bg-surface)',
          borderColor:  active ? style.border : 'var(--color-border)',
          color:        active ? style.color  : 'var(--color-text-muted)',
          cursor: 'pointer',
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
}

// "All" button has its own neutral active style
function AllFilterBtn({ active, onClick }) {
  return (
    <Tooltip label="All games" hasArrow placement="bottom" openDelay={400}>
      <Box
        as="button"
        onClick={onClick}
        w="34px" h="34px"
        borderRadius="md"
        borderWidth="1px"
        display="flex" alignItems="center" justifyContent="center"
        transition="all 0.15s"
        style={{
          background:  active ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
          borderColor: active ? 'var(--color-border)'   : 'var(--color-border)',
          color:       active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          cursor: 'pointer',
        }}
      >
        <AllGamesIcon />
      </Box>
    </Tooltip>
  );
}

const SORT_OPTIONS = [
  { value: 'default',      label: 'Default' },
  { value: 'playing_first', label: 'Playing first' },
  { value: 'release',       label: 'Release date' },
  { value: 'wishlist',      label: 'Wishlist first' },
  { value: 'pt_status',     label: 'Playthrough status' },
  { value: 'pt_recent',     label: 'Recent playthrough' },
];

const PT_STATUS_ORDER = { playing: 0, pend: 1, completed: 2, dropped: 3 };
// (no-playthrough games return 99 from bestPtStatusRank, so they sink to bottom naturally)

function bestPtStatusRank(game) {
  const pts = game.playthroughs ?? [];
  if (pts.length === 0) return 99;
  return Math.min(...pts.map((p) => PT_STATUS_ORDER[p.status] ?? 99));
}

function hasPlayingPt(game) {
  return (game.playthroughs ?? []).some((p) => p.status === 'playing');
}

function latestPtTime(game) {
  const pts = game.playthroughs ?? [];
  if (pts.length === 0) return 0;
  return Math.max(...pts.map((p) => new Date(p.updated_at).getTime()));
}

function releaseDate(game) {
  return game.releases?.[0]?.date || '';
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();

  const [games, setGames]               = useState([]);
  const [fetching, setFetching]         = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const searchRef = useRef(null);

  const { listState, setListState } = useTabState();

  const activeFilters = listState.activeFilters ?? ['playing', 'backlog', 'wishlist', 'favorite', 'completed', 'pend', 'other'];
  const grouped      = listState.grouped ?? false;
  const search       = listState.search;
  const showSearch   = listState.showSearch;
  const sortBy       = listState.sortBy;

  const setActiveFilters = (val) =>
    setListState((s) => ({ ...s, activeFilters: typeof val === 'function' ? val(s.activeFilters) : val }));
  const setGrouped    = (val) => setListState((s) => ({ ...s, grouped: val }));
  const setSearch     = (val) => setListState((s) => ({ ...s, search: val }));
  const setShowSearch = (val) => setListState((s) => ({ ...s, showSearch: val }));
  const setSortBy     = (val) => setListState((s) => ({ ...s, sortBy: val }));

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      if (prev.includes(key)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== key);
      }
      return [...prev, key];
    });
  };

  const viewMode    = listState.viewMode;
  const setViewMode = (val) => {
    setListState((s) => ({ ...s, viewMode: val }));
    try { localStorage.setItem('grimoire:listViewMode', val); } catch {}
  };

  const fetchGames = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const data = await api.games.list(); // always fetch all; filtering is client-side
      setGames(data);
      setSelectedGame((prev) => {
        if (!prev) return null;
        return data.find((g) => g.id === prev.id) ?? prev;
      });
    } catch {
      toast({ title: 'Error loading games', status: 'error', duration: 3000 });
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  const filtered = games
    .filter((g) => {
      if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;

      const pts = g.playthroughs ?? [];
      const statuses = new Set(pts.map((p) => p.status));

      if (activeFilters.includes('playing')   && statuses.has('playing'))   return true;
      if (activeFilters.includes('completed') && statuses.has('completed'))  return true;
      if (activeFilters.includes('pend')      && statuses.has('pend'))       return true;
      if (activeFilters.includes('dropped')   && statuses.has('dropped'))    return true;
      if (activeFilters.includes(g.tag))                                     return true;

      // "Other": no tag, no playthroughs at all
      const hasAnyPt = pts.length > 0;
      if (activeFilters.includes('other') && !g.tag && !hasAnyPt)           return true;

      return false;
  })
  .sort((a, b) => {
    if (sortBy === 'default') {
      // Tier 1: has a "playing" playthrough
      const aPlaying = (a.playthroughs ?? []).some((p) => p.status === 'playing') ? 0 : 1;
      const bPlaying = (b.playthroughs ?? []).some((p) => p.status === 'playing') ? 0 : 1;
      if (aPlaying !== bPlaying) return aPlaying - bPlaying;

      // Tier 2: has "backlog" tag
      const aBacklog = a.tag === 'backlog' ? 0 : 1;
      const bBacklog = b.tag === 'backlog' ? 0 : 1;
      if (aBacklog !== bBacklog) return aBacklog - bBacklog;

      // Tier 3: release date descending (newest first)
      return releaseDate(b).localeCompare(releaseDate(a));
    }
    if (sortBy === 'playing_first') {
      // Primary: sort by best PT status rank (playing > backlog/pend > completed > dropped > none)
      const rankDiff = bestPtStatusRank(a) - bestPtStatusRank(b);
      if (rankDiff !== 0) return rankDiff;
      // Secondary: release date descending
      return releaseDate(b).localeCompare(releaseDate(a));
    }
    if (sortBy === 'release') {
      return releaseDate(b).localeCompare(releaseDate(a));
    }
    if (sortBy === 'wishlist') {
      const aW = a.tag === 'wishlist' ? 0 : 1;
      const bW = b.tag === 'wishlist' ? 0 : 1;
      return aW - bW;
    }
    if (sortBy === 'pt_status') {
      return bestPtStatusRank(a) - bestPtStatusRank(b);
    }
    if (sortBy === 'pt_recent') {
      return latestPtTime(b) - latestPtTime(a);
    }
    return 0;
  });

  // ── Group filtered games by category ─────────────────────────────────────────
  const GROUP_ORDER = [
    { key: 'playing',  label: 'PLAYING',  test: (g) => (g.playthroughs ?? []).some((p) => p.status === 'playing') },
    { key: 'backlog',  label: 'BACKLOG',  test: (g) => g.tag === 'backlog'  && !(g.playthroughs ?? []).some((p) => p.status === 'playing') },
    { key: 'wishlist', label: 'WISHLIST', test: (g) => g.tag === 'wishlist' && !(g.playthroughs ?? []).some((p) => p.status === 'playing') },
    { key: 'favorite', label: 'FAVORITES', test: (g) => g.tag === 'favorite' && !(g.playthroughs ?? []).some((p) => p.status === 'playing') },
    { key: 'dropped',  label: 'DROPPED',  test: (g) => g.tag === 'dropped'  && !(g.playthroughs ?? []).some((p) => p.status === 'playing') },
    { key: 'other',    label: 'OTHER',    test: () => true },
  ];

  const groupedGames = grouped
    ? GROUP_ORDER.reduce((acc, grp) => {
        const games = filtered.filter((g) => !acc.assigned.has(g.id) && grp.test(g));
        games.forEach((g) => acc.assigned.add(g.id));
        if (games.length > 0) acc.groups.push({ ...grp, games });
        return acc;
      }, { groups: [], assigned: new Set() }).groups
    : null;

  if (loading) {
    return (
      <>
        <Navbar />
        <Box display="flex" justifyContent="center" alignItems="center" minH="60vh">
          <Spinner size="lg" color="var(--color-accent)" />
        </Box>
      </>
    );
  }

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Default';

  return (
    <>
      <Navbar />
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />
      <div className="page-container">

      {!user && (
        <Box textAlign="center" py={16}>
          <Text fontWeight="600" fontSize="lg" color="var(--color-text-primary)" mb={2}>
            Welcome to Grimoire
          </Text>
          <Text color="var(--color-text-muted)">
            Sign in to start tracking your video game backlog.
          </Text>
          <Box
            display="inline-flex"
            alignItems="center"
            gap={2}
            mt={6}
            px={4}
            py={3}
            borderRadius="md"
            bg="var(--color-bg-subtle)"
            borderWidth="1px"
            borderColor="var(--color-border-subtle)"
          >
            <Box flexShrink={0} color="var(--color-text-muted)">
              <svg width="15" height="15" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
              </svg>
            </Box>
            <Text fontSize="xs" color="var(--color-text-muted)">
              Self-hosted app —{' '}
              <Box
                as="a"
                href="https://github.com/kaiserdrake/grimoire"
                target="_blank"
                rel="noopener noreferrer"
                color="var(--color-accent)"
                _hover={{ textDecoration: 'underline' }}
              >
                view source on GitHub
              </Box>
              {' '}to deploy your own instance.
            </Text>
          </Box>
        </Box>
      )}

        {user && (
          <>
          {/* ── Filter bar ── */}
          <VStack spacing={2} mb={6} align="stretch">
            <HStack spacing={2} align="center">

              {/* Group toggle */}
              <Tooltip label={grouped ? 'Ungroup' : 'Group by category'} hasArrow placement="bottom" openDelay={400}>
                <Box
                  as="button"
                  onClick={() => setGrouped(!grouped)}
                  w="34px" h="34px"
                  borderRadius="md"
                  borderWidth="1px"
                  display="flex" alignItems="center" justifyContent="center"
                  transition="all 0.15s"
                  style={{
                    background:  grouped ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
                    borderColor: grouped ? 'var(--color-border)'   : 'var(--color-border)',
                    color:       grouped ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <GroupIcon />
                </Box>
              </Tooltip>
              {/* Filter menu */}
              <Menu closeOnSelect={false}>
                <Tooltip label="Filter" hasArrow placement="bottom" openDelay={400}>
                <MenuButton
                  as={Box}
                  w="34px" h="34px"
                  borderRadius="md"
                  borderWidth="1px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  transition="all 0.15s"
                  style={{
                    background:  activeFilters.length < ALL_FILTERS.length ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
                    borderColor: activeFilters.length < ALL_FILTERS.length ? 'var(--color-border)'   : 'var(--color-border)',
                    color:       activeFilters.length < ALL_FILTERS.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="center" w="100%" h="100%">
                    <FilterIcon />
                  </Box>
                </MenuButton>
                </Tooltip>
                <MenuList fontSize="sm" minW="160px" py={1}>
                  {ALL_FILTERS.map(({ key, label, tag, Icon }) => {
                    const active = activeFilters.includes(key);
                    const style  = TAG_STYLE[key] ?? {};
                    return (
                      <MenuItem
                        key={key}
                        onClick={() => toggleFilter(key)}
                        display="flex" alignItems="center" gap="8px"
                        color={active ? style.color : 'var(--color-text-muted)'}
                        fontWeight={active ? 600 : 400}
                        _hover={{ bg: 'var(--color-bg-hover)' }}
                        bg="transparent"
                      >
                        <Box
                          w="14px" h="14px" borderRadius="2px" borderWidth="1.5px" flexShrink={0}
                          display="flex" alignItems="center" justifyContent="center"
                          style={{
                            borderColor:  active ? style.color  : 'var(--color-border)',
                            background:   active ? style.bg     : 'transparent',
                          }}
                        >
                          {active && <Box w="7px" h="7px" borderRadius="1px" style={{ background: style.color }} />}
                        </Box>
                        <Box as="span" display="flex" alignItems="center" gap="6px">
                          <Icon size={13} />
                          {label}
                        </Box>
                      </MenuItem>
                    );
                  })}
                  <Box h="1px" bg="var(--color-border)" my={1} mx={2} />
                  <MenuItem
                    onClick={() =>
                      setActiveFilters(
                        activeFilters.length === ALL_FILTERS.length
                          ? [ALL_FILTERS[0].key]          // keep at least one active
                          : ALL_FILTERS.map((f) => f.key)
                      )
                    }
                    fontSize="xs"
                    color="var(--color-text-muted)"
                    _hover={{ bg: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                    bg="transparent"
                  >
                  {activeFilters.length === ALL_FILTERS.length ? 'Unselect all' : 'Select all'}
                </MenuItem>
                </MenuList>
              </Menu>

              {/* Separator */}
              <Box w="1px" h="20px" bg="var(--color-border)" mx={0.5} flexShrink={0} />

              {/* Search toggle */}
              <FilterBtn
                active={showSearch || !!search}
                onClick={() => { const next = !showSearch; setShowSearch(next); if (!next) setSearch(''); }}
                title="Search"
                tag="backlog"
              >
                <SearchIconSvg />
              </FilterBtn>
              {/* Sort dropdown */}
              <Menu>
                <Tooltip label={`Sort: ${currentSortLabel}`} hasArrow placement="bottom" openDelay={400}>
                  <MenuButton
                    as={Box}
                    w="34px" h="34px"
                    borderRadius="md"
                    borderWidth="1px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                    transition="all 0.15s"
                    style={{
                      background: 'var(--color-bg-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="center" w="100%" h="100%">
                    <SortIconSvg />
                  </Box>
                </MenuButton>
                </Tooltip>
                <MenuList fontSize="sm" minW="170px">
                  {SORT_OPTIONS.map((o) => (
                    <MenuItem
                      key={o.value}
                      onClick={() => setSortBy(o.value)}
                      fontWeight={sortBy === o.value ? '700' : 'normal'}
                      color={sortBy === o.value ? 'var(--color-accent)' : undefined}
                    >
                      {o.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>

              {/* Separator */}
              <Box w="1px" h="20px" bg="var(--color-border)" mx={0.5} flexShrink={0} />

              {/* View toggle */}
              <Tooltip label={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'} hasArrow placement="bottom" openDelay={400}>
                <Box
                  as="button"
                  onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                  w="34px" h="34px"
                  borderRadius="md"
                  borderWidth="1px"
                  display="flex" alignItems="center" justifyContent="center"
                  transition="all 0.15s"
                  style={{
                    background: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                {viewMode === 'list' ? <GridViewIcon /> : <ListViewIcon />}
                </Box>
              </Tooltip>

              {/* Spacer */}
              <Box flex={1} />

              {/* Add Game — right-aligned */}
              <Button
                size="sm"
                leftIcon={<AddIcon />}
                bg="var(--color-accent)"
                color="white"
                _hover={{ bg: 'var(--color-accent-hover)' }}
                onClick={onAddOpen}
                flexShrink={0}
              >
                Add Game
              </Button>
              </HStack>

              {/* Collapsible search */}
              {(showSearch || search) && (
                <Input
                  ref={searchRef}
                  size="sm"
                  placeholder="Search games…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  bg="var(--color-bg-surface)"
                  borderColor="var(--color-border)"
                  color="var(--color-text-primary)"
                  _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                  _placeholder={{ color: 'var(--color-text-muted)' }}
                />
              )}
            </VStack>

            {/* ── Game grid ── */}
            {fetching ? (
              <Box display="flex" justifyContent="center" py={12}>
                <Spinner color="var(--color-accent)" />
              </Box>
            ) : filtered.length === 0 ? (
              <Box textAlign="center" py={16}>
                <Text fontSize="3xl" mb={3}>🎮</Text>
                <Text color="var(--color-text-muted)">
                  {search ? 'No games match your search.' : 'No games here yet. Add one!'}
                </Text>
              </Box>
            ) : (
              grouped && groupedGames ? (
                groupedGames.map(({ key, label, games }) => (
                  <Box key={key} mb={6}>
                    {/* Group label */}
                    <HStack spacing={2} mb={2} align="center">
                      <Box h="1px" w="12px" bg="var(--color-border)" flexShrink={0} />
                      <Text
                        fontSize="0.65rem"
                        fontWeight={700}
                        letterSpacing="0.1em"
                        color="var(--color-text-muted)"
                        textTransform="uppercase"
                        flexShrink={0}
                      >
                        {label} · {games.length}
                      </Text>
                      <Box h="1px" flex={1} bg="var(--color-border)" />
                    </HStack>

                    {viewMode === 'grid' ? (
                      <div className="game-grid">
                        {games.map((game) => (
                          <GameCardView key={game.id} game={game} onClick={() => setSelectedGame(game)} />
                        ))}
                      </div>
                    ) : (
                      <div className="game-list">
                        {games.map((game) => (
                          <GameListRow key={game.id} game={game} onClick={() => setSelectedGame(game)} />
                        ))}
                      </div>
                    )}
                  </Box>
                ))
              ) : viewMode === 'grid' ? (
                <div className="game-grid">
                  {filtered.map((game) => (
                    <GameCardView key={game.id} game={game} onClick={() => setSelectedGame(game)} />
                  ))}
                </div>
              ) : (
                <div className="game-list">
                  {filtered.map((game) => (
                    <GameListRow key={game.id} game={game} onClick={() => setSelectedGame(game)} />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      <AddGameModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onAdded={async (game) => { await fetchGames(); setSelectedGame(game); }}
      />
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          onUpdated={fetchGames}
          onDeleted={() => { fetchGames(); setSelectedGame(null); }}
        />
      )}
    </>
  );
}
