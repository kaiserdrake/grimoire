'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, Button, Input, HStack, VStack, Text, Image, Box,
  Spinner, useToast, Tabs, TabList, Tab, TabPanels, TabPanel,
  Badge,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { api } from '@/utils/api';

import { TAG_CONFIG, BacklogIcon, WishlistIcon, FavoriteIcon, DroppedIcon } from '@/constants/tags';

function TagToggle({ value, onChange }) {
  return (
    <HStack spacing={1} flexWrap="wrap">
      {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
        <Box
          key={key}
          as="button"
          onClick={() => onChange(value === key ? null : key)}
          title={value === key ? `${cfg.label} (click to remove)` : `Mark as ${cfg.label}`}
          px={2} py={1} borderRadius="md" borderWidth="1px"
          display="flex" alignItems="center" gap="5px"
          fontSize="xs" fontWeight="600"
          transition="all 0.15s"
          style={{
            background:  value === key ? cfg.bg     : 'transparent',
            borderColor: value === key ? cfg.border : 'var(--color-border)',
            color:       value === key ? cfg.color  : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          <cfg.Icon />
          <span>{cfg.label}</span>
        </Box>
      ))}
    </HStack>
  );
}

export default function AddGameModal({ isOpen, onClose, onAdded }) {
  const toast = useToast();

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);

  const [searching, setSearching] = useState(false);
  const [manual,    setManual]    = useState({ title: '', tag: null, cover_url: '' });
  const [adding,    setAdding]    = useState(false);

  const [hasIgdbCredentials, setHasIgdbCredentials] = useState(true);

  useEffect(() => {
  if (!isOpen) return;
  api.igdb.getCredentials().then((creds) => {
    setHasIgdbCredentials(!!creds.igdb_client_id && !!creds.igdb_client_secret);
  }).catch(() => setHasIgdbCredentials(false));
}, [isOpen]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const data = await api.igdb.search(query);
      setResults(data);
      if (data.length === 0) toast({ title: 'No results found', status: 'info', duration: 2500 });
    } catch (err) {
      toast({ title: 'Search failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSearching(false);
    }
  };

  const handleAddFromIGDB = async (game, tag) => {
    setAdding(true);
    try {
      const created = await api.games.create({ ...game, tag });
      toast({ title: `"${game.title}" added!`, status: 'success', duration: 2500 });
      onAdded?.(created);
      handleClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setAdding(false);
    }
  };

  const handleAddManual = async () => {
    if (!manual.title.trim()) {
      toast({ title: 'Title is required', status: 'warning', duration: 3000 });
      return;
    }
    setAdding(true);
    try {
      const created = await api.games.create(manual);
      toast({ title: `"${manual.title}" added!`, status: 'success', duration: 2500 });
      onAdded?.(created);
      handleClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setManual({ title: '', tag: null, cover_url: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
        maxH="85vh"
      >
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
          Add Game
        </ModalHeader>

        <ModalCloseButton />
        <ModalBody py={4}>
          <Tabs variant="unstyled" size="sm">
            <TabList mb={4}>
              <Tab
                color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}
              >
              Search IGDB
              </Tab>
              <Tab
                color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}
              >
              Add Manually
              </Tab>
            </TabList>
            <TabPanels>

            {/* ── IGDB Tab ── */}
            <TabPanel p={0}>
              <VStack spacing={4} align="stretch">
                {!hasIgdbCredentials ? (
                  <Box
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg="rgba(234,179,8,0.1)"
                    borderWidth="1px"
                    borderColor="#ca8a04"
                  >
                    <Text fontSize="xs" color="#ca8a04" fontWeight="500">
                      ⚠ IGDB credentials not set — game search is unavailable.
                      Go to <strong>Settings → IGDB Integration</strong> to configure them.
                    </Text>
                  </Box>
                ) : (
                  <>
                    <HStack>
                      <Input
                        placeholder="Search games on IGDB… or type id:XXXXX"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        bg="var(--color-bg-subtle)"
                        borderColor="var(--color-border)"
                        _focus={{
                           borderColor: 'var(--color-accent)',
                           boxShadow: '0 0 0 1px var(--color-accent)',
                         }}
                       />
                      <Button
                        onClick={handleSearch}
                        isLoading={searching}
                        leftIcon={<SearchIcon />}
                        bg="var(--color-accent)"
                        color="white"
                        _hover={{ bg: 'var(--color-accent-hover)' }}
                        flexShrink={0}
                      >
                         Search
                       </Button>
                     </HStack>

                     {searching && (
                       <HStack justify="center" py={6}>
                         <Spinner color="var(--color-accent)" />
                         <Text color="var(--color-text-muted)" fontSize="sm">
                           Searching IGDB…
                         </Text>
                       </HStack>
                     )}

                     {results.map((game) => (
                       <IGDBResultCard
                         key={game.igdb_id}
                         game={game}
                         onAdd={handleAddFromIGDB}
                         adding={adding}
                       />
                     ))}
                   </>
                 )}
               </VStack>
              </TabPanel>

              {/* ── Manual Tab ── */}
              <TabPanel p={0}>
                <VStack spacing={3} align="stretch">
                  <Input

                    placeholder="Title *"
                    value={manual.title}
                    onChange={(e) => setManual({ ...manual, title: e.target.value })}
                    bg="var(--color-bg-subtle)"
                    borderColor="var(--color-border)"
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                  />
                  <Input
                    placeholder="Cover URL (optional)"
                    value={manual.cover_url}
                    onChange={(e) => setManual({ ...manual, cover_url: e.target.value })}
                    bg="var(--color-bg-subtle)"
                    borderColor="var(--color-border)"
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                  />
                  <TagToggle value={manual.tag} onChange={(t) => setManual({ ...manual, tag: t })} />
                  <Button

                    onClick={handleAddManual}
                    isLoading={adding}
                    bg="var(--color-accent)" color="white"
                    _hover={{ bg: 'var(--color-accent-hover)' }}
                  >
                    Add Game
                  </Button>
                </VStack>
              </TabPanel>

            </TabPanels>

          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ── IGDB Result Card ──────────────────────────────────────────────────────────
// Uses plain div/span instead of Chakra Text (<p>) to avoid browser default margins

function IGDBResultCard({ game, onAdd, adding }) {
  const [tag, setTag] = useState(null);

  const firstRelease = game.releases?.find((r) => r.date)?.date;
  const year         = firstRelease ? new Date(firstRelease).getFullYear() : null;
  const devPub       = [game.developer, game.publisher].filter(Boolean).join(' · ');
  const metaLine     = [year, devPub, game.time_to_beat ? `~${game.time_to_beat}h` : null].filter(Boolean).join(' · ');

  return (
    <Box
      p={3} borderRadius="md"
      borderWidth="1px" borderColor="var(--color-border-subtle)"
      bg="var(--color-bg-subtle)"
      _hover={{ borderColor: 'var(--color-border)', bg: 'var(--color-bg-hover)' }}
      transition="all 0.15s"
    >
      <HStack spacing={3} align="start">
        {game.cover_url ? (
          <Image src={game.cover_url} alt={game.title}
            w="52px" h="70px" objectFit="cover" borderRadius="sm" flexShrink={0}
          />
        ) : (
          <Box w="52px" h="70px" bg="var(--color-bg-hover)" borderRadius="sm"
            display="flex" alignItems="center" justifyContent="center" flexShrink={0}
          >
            <Text fontSize="xl">🎮</Text>
          </Box>
        )}

        {/* Info — plain divs/spans, no <p> default margins */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '4px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: '1.3', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {game.title}
          </span>


          {metaLine && (
            <span style={{ fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--color-text-muted)' }}>
              {metaLine}
            </span>
          )}

          {game.genres?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {game.genres.slice(0, 3).map((g) => (
                <Badge key={g} fontSize="0.6rem" variant="subtle"
                  style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                >{g}</Badge>
              ))}
            </div>
          )}

          {game.releases?.length > 0 && (
            <span style={{ fontSize: '0.72rem', lineHeight: '1.4', color: 'var(--color-text-muted)' }}>
              {[...new Set(game.releases.map(r => r.platform).filter(Boolean))].join(' · ')}
            </span>
          )}

          {game.summary && (
            <span style={{ fontSize: '0.75rem', lineHeight: '1.5', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {game.summary}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <TagToggle value={tag} onChange={setTag} />
            <Button size="xs"
              bg="var(--color-accent)" color="white"
              _hover={{ bg: 'var(--color-accent-hover)' }}
              isLoading={adding}
              onClick={() => onAdd(game, tag)}
            >
              Add
            </Button>
          </div>
        </div>
      </HStack>
    </Box>
  );
}
