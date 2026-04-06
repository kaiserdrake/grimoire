'use client';

import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, VStack, HStack, Text, Input,
  FormControl, FormLabel, Select, Spinner, Box, Image, Badge, Divider,
  useToast, Tabs, TabList, Tab, TabPanels, TabPanel,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { FiPlus } from 'react-icons/fi';
import { api } from '@/utils/api';

const STATUSES = ['backlog', 'playing', 'completed', 'dropped'];

export default function AddGameModal({ isOpen, onClose, onAdded }) {
  const toast = useToast();
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding]       = useState(false);

  // Manual form
  const [manual, setManual] = useState({ title: '', status: 'backlog', cover_url: '' });

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setResults([]);
    try {
      const data = await api.igdb.search(query);
      setResults(data);
    } catch (err) {
      toast({ title: 'Search failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSearching(false);
    }
  };

  const handleAddIgdb = async (game, status = 'backlog') => {
    setAdding(true);
    try {
      await api.games.create({ ...game, status });
      toast({ title: `"${game.title}" added!`, status: 'success', duration: 2500 });
      onAdded?.();
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
      await api.games.create(manual);
      toast({ title: `"${manual.title}" added!`, status: 'success', duration: 2500 });
      onAdded?.();
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
    setManual({ title: '', status: 'backlog', cover_url: '' });
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
          <Tabs variant="soft-rounded" size="sm">
            <TabList mb={4}>
              <Tab _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                Search IGDB
              </Tab>
              <Tab _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                Add Manually
              </Tab>
            </TabList>
            <TabPanels>

              {/* ── IGDB Tab ── */}
              <TabPanel p={0}>
                <VStack spacing={4} align="stretch">
                  <HStack>
                    <Input
                      placeholder="Search games on IGDB…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      bg="var(--color-bg-subtle)"
                      borderColor="var(--color-border)"
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                    <Button onClick={handleSearch} isLoading={searching}
                      leftIcon={<SearchIcon />}
                      bg="var(--color-accent)" color="white"
                      _hover={{ bg: 'var(--color-accent-hover)' }}
                      flexShrink={0}
                    >
                      Search
                    </Button>
                  </HStack>

                  {searching && (
                    <HStack justify="center" py={6}>
                      <Spinner color="var(--color-accent)" />
                      <Text color="var(--color-text-muted)" fontSize="sm">Searching IGDB…</Text>
                    </HStack>
                  )}

                  {results.map((game) => (
                    <Box key={game.igdb_id}
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
                        <VStack align="start" spacing={1} flex={1} minW={0}>
                          <Text fontWeight="600" fontSize="sm" color="var(--color-text-primary)" noOfLines={1}>
                            {game.title}
                          </Text>
                          {game.release_date && (
                            <Text fontSize="xs" color="var(--color-text-muted)">
                              {new Date(game.release_date).getFullYear()}
                            </Text>
                          )}
                          {game.genres?.length > 0 && (
                            <HStack flexWrap="wrap" spacing={1}>
                              {game.genres.slice(0, 3).map((g) => (
                                <Badge key={g} fontSize="0.6rem" variant="subtle"
                                  style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                                >{g}</Badge>
                              ))}
                            </HStack>
                          )}
                          {game.summary && (
                            <Text fontSize="xs" color="var(--color-text-muted)" noOfLines={2}>
                              {game.summary}
                            </Text>
                          )}
                        </VStack>
                        <VStack spacing={1} flexShrink={0}>
                          {STATUSES.map((s) => (
                            <Button key={s} size="xs" variant="outline"
                              borderColor="var(--color-border)"
                              color="var(--color-text-secondary)"
                              _hover={{ bg: 'var(--color-accent-subtle)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                              onClick={() => handleAddIgdb(game, s)}
                              isLoading={adding}
                              w="80px" textTransform="capitalize"
                            >
                              {s}
                            </Button>
                          ))}
                        </VStack>
                      </HStack>
                    </Box>
                  ))}

                  {!searching && results.length === 0 && query && (
                    <Text textAlign="center" color="var(--color-text-muted)" fontSize="sm" py={4}>
                      No results found. Try a different search or add manually.
                    </Text>
                  )}
                </VStack>
              </TabPanel>

              {/* ── Manual Tab ── */}
              <TabPanel p={0}>
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="sm" color="var(--color-text-secondary)">Title *</FormLabel>
                    <Input
                      value={manual.title}
                      onChange={(e) => setManual({ ...manual, title: e.target.value })}
                      placeholder="Game title"
                      bg="var(--color-bg-subtle)"
                      borderColor="var(--color-border)"
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" color="var(--color-text-secondary)">Status</FormLabel>
                    <Select value={manual.status}
                      onChange={(e) => setManual({ ...manual, status: e.target.value })}
                      bg="var(--color-bg-subtle)" borderColor="var(--color-border)"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} style={{ textTransform: 'capitalize' }}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" color="var(--color-text-secondary)">Cover Image URL (optional)</FormLabel>
                    <Input
                      value={manual.cover_url}
                      onChange={(e) => setManual({ ...manual, cover_url: e.target.value })}
                      placeholder="https://…"
                      bg="var(--color-bg-subtle)"
                      borderColor="var(--color-border)"
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                  </FormControl>
                  <Button
                    onClick={handleAddManual}
                    isLoading={adding}
                    leftIcon={<FiPlus />}
                    bg="var(--color-accent)"
                    color="white"
                    _hover={{ bg: 'var(--color-accent-hover)' }}
                  >
                    Add Game
                  </Button>
                </VStack>
              </TabPanel>

            </TabPanels>
          </Tabs>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <Button size="sm" variant="ghost" onClick={handleClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
