'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HStack, Text, Button, SimpleGrid, Box, VStack, Spinner,
  useDisclosure, useToast, Input, InputGroup, InputLeftElement, Select,
} from '@chakra-ui/react';
import { AddIcon, SearchIcon } from '@chakra-ui/icons';
import Navbar from '@/components/Navbar';
import AddGameModal from '@/components/AddGameModal';
import GameDetailModal from '@/components/GameDetailModal';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'playing',   label: '▶ Playing' },
  { key: 'backlog',   label: '📋 Backlog' },
  { key: 'completed', label: '✅ Completed' },
  { key: 'dropped',   label: '✖ Dropped' },
];

const STATUS_CSS = { backlog: 'backlog', playing: 'playing', completed: 'completed', dropped: 'dropped' };

export default function HomePage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();

  const [games, setGames]         = useState([]);
  const [fetching, setFetching]   = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('updated');
  const [selectedGame, setSelectedGame] = useState(null);

  const fetchGames = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const data = await api.games.list(activeTab === 'all' ? undefined : activeTab);
      setGames(data);
    } catch {
      toast({ title: 'Error loading games', status: 'error', duration: 3000 });
    } finally {
      setFetching(false);
    }
  }, [user, activeTab]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const filtered = games
    .filter((g) => !search || g.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'title')   return a.title.localeCompare(b.title);
      if (sortBy === 'rating')  return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'release') return (b.release_date || '').localeCompare(a.release_date || '');
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

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

  return (
    <>
      <Navbar />
      <div className="page-container">

        <HStack justify="space-between" mb={6}>
          <VStack align="start" spacing={0}>
            <Text fontSize="2xl" fontWeight="800" color="var(--color-text-primary)" letterSpacing="-0.02em">
              My Library
            </Text>
            <Text fontSize="sm" color="var(--color-text-muted)">
              {games.length} game{games.length !== 1 ? 's' : ''} tracked
            </Text>
          </VStack>
          {user && (
            <Button size="sm" leftIcon={<AddIcon />}
              bg="var(--color-accent)" color="white"
              _hover={{ bg: 'var(--color-accent-hover)' }}
              onClick={onAddOpen}
            >
              Add Game
            </Button>
          )}
        </HStack>

        {!user && (
          <Box textAlign="center" py={16}>
            <Text fontSize="4xl" mb={4}>📖</Text>
            <Text fontWeight="600" fontSize="lg" color="var(--color-text-primary)" mb={2}>
              Welcome to Grimoire
            </Text>
            <Text color="var(--color-text-muted)">
              Sign in to start tracking your video game backlog.
            </Text>
          </Box>
        )}

        {user && (
          <>
            <VStack spacing={3} mb={6} align="stretch">
              <div className="tab-bar">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <HStack>
                <InputGroup size="sm" flex={1}>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="var(--color-text-muted)" />
                  </InputLeftElement>
                  <Input
                    placeholder="Search games…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    bg="var(--color-bg-surface)"
                    borderColor="var(--color-border)"
                    color="var(--color-text-primary)"
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    _placeholder={{ color: 'var(--color-text-muted)' }}
                    pl={8}
                  />
                </InputGroup>
                <Select size="sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  w="170px" flexShrink={0}
                  bg="var(--color-bg-surface)" borderColor="var(--color-border)"
                  color="var(--color-text-primary)"
                >
                  <option value="updated">Recently updated</option>
                  <option value="title">Title A–Z</option>
                  <option value="rating">Rating</option>
                  <option value="release">Release year</option>
                </Select>
              </HStack>
            </VStack>

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
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} spacing={4}>
                {filtered.map((game) => (
                  <div key={game.id} className="game-card" onClick={() => setSelectedGame(game)}>
                    {game.cover_url ? (
                      <img src={game.cover_url} alt={game.title} className="game-card-cover" />
                    ) : (
                      <div className="game-card-cover-placeholder">🎮</div>
                    )}
                    <div className="game-card-body">
                      <p className="game-card-title">{game.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={`status-badge ${STATUS_CSS[game.status]}`}>
                          {game.status}
                        </span>
                        {game.rating > 0 && (
                          <span className="game-card-meta">⭐ {game.rating}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </SimpleGrid>
            )}
          </>
        )}
      </div>

      <AddGameModal isOpen={isAddOpen} onClose={onAddClose} onAdded={fetchGames} />
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
