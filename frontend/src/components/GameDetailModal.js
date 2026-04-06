'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, HStack, VStack, Text, Image,
  Select, Box, Badge, Divider, useToast, IconButton, Textarea,
  Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip,
} from '@chakra-ui/react';
import { DeleteIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { FiFileText, FiMap, FiStar } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';


export default function GameDetailModal({ game, isOpen, onClose, onUpdated, onDeleted }) {
  const toast = useToast();
  const router = useRouter();
  const [status, setStatus]   = useState(game?.status || 'backlog');
  const [rating, setRating]   = useState(game?.rating || 0);
  const [notes, setNotes]     = useState(game?.personal_notes || '');
  const [showRating, setShowRating] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (game) {
      setStatus(game.status);
      setRating(game.rating || 0);
      setNotes(game.personal_notes || '');
    }
  }, [game]);

  if (!game) return null;

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await api.games.updateStatus(game.id, newStatus);
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Error updating status', status: 'error', duration: 3000 });
      setStatus(game.status);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await api.games.update(game.id, {
        title: game.title, cover_url: game.cover_url, summary: game.summary,
        genres: game.genres, platforms: game.platforms, release_date: game.release_date,
        status, rating: rating || null, personal_notes: notes,
      });
      toast({ title: 'Saved', status: 'success', duration: 2000 });
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Error saving', status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleRatingChange = async (val) => {
    setRating(val);
    try {
      await api.games.updateRating(game.id, val);
      onUpdated?.();
    } catch {}
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.games.delete(game.id);
      toast({ title: `"${game.title}" deleted`, status: 'success', duration: 2500 });
      onDeleted?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setDeleting(false);
    }
  };

  const year = game.release_date ? new Date(game.release_date).getFullYear() : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
        maxH="85vh"
      >
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)" pr={12}>
          <Text noOfLines={1}>{game.title}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4} overflowY="auto">
          <VStack spacing={4} align="stretch">
            {/* Cover + info */}
            <HStack spacing={4} align="start">
              {game.cover_url ? (
                <Image src={game.cover_url} alt={game.title}
                  w="90px" h="120px" objectFit="cover" borderRadius="md" flexShrink={0}
                  border="1px solid var(--color-border-subtle)"
                />
              ) : (
                <Box w="90px" h="120px" bg="var(--color-bg-subtle)" borderRadius="md"
                  display="flex" alignItems="center" justifyContent="center" flexShrink={0}
                  border="1px solid var(--color-border-subtle)"
                >
                  <Text fontSize="2xl">🎮</Text>
                </Box>
              )}
              <VStack align="start" spacing={1.5} flex={1}>
                {year && <Text fontSize="sm" color="var(--color-text-muted)">{year}</Text>}
                {game.genres?.length > 0 && (
                  <HStack flexWrap="wrap" spacing={1}>
                    {game.genres.map((g) => (
                      <Badge key={g} fontSize="0.65rem" variant="subtle"
                        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                      >{g}</Badge>
                    ))}
                  </HStack>
                )}
                {game.platforms?.length > 0 && (
                  <Text fontSize="xs" color="var(--color-text-muted)">
                    {game.platforms.slice(0, 3).join(' · ')}
                  </Text>
                )}
                {game.summary && (
                  <Text fontSize="xs" color="var(--color-text-secondary)" noOfLines={4} lineHeight="1.6">
                    {game.summary}
                  </Text>
                )}
              </VStack>
            </HStack>

            <Divider borderColor="var(--color-border-subtle)" />

            {/* Status */}
            <HStack justify="space-between" align="center">
              <Text fontSize="sm" fontWeight="600" color="var(--color-text-secondary)">Status</Text>
              <Select size="sm" value={status} onChange={(e) => handleStatusChange(e.target.value)}
                w="140px" bg="var(--color-bg-subtle)" borderColor="var(--color-border)"
              >
                <option value="backlog">Backlog</option>
                <option value="playing">Playing</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </Select>
            </HStack>

            {/* Rating */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="600" color="var(--color-text-secondary)">
                  Rating {rating > 0 ? `— ${rating}/10` : ''}
                </Text>
                {rating > 0 && (
                  <Button size="xs" variant="ghost" color="var(--color-text-muted)"
                    onClick={() => handleRatingChange(0)}
                  >
                    Clear
                  </Button>
                )}
              </HStack>
              <HStack spacing={1}>
                {[...Array(10)].map((_, i) => (
                  <IconButton key={i} size="xs" variant="ghost" aria-label={`Rate ${i + 1}`}
                    icon={<FiStar />}
                    color={i < rating ? 'var(--color-warning)' : 'var(--color-border)'}
                    _hover={{ color: 'var(--color-warning)' }}
                    onClick={() => handleRatingChange(i + 1)}
                  />
                ))}
              </HStack>
            </Box>

            {/* Personal notes */}
            <Box>
              <Text fontSize="sm" fontWeight="600" color="var(--color-text-secondary)" mb={2}>
                Quick Notes
              </Text>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Short personal notes about this game…"
                size="sm"
                rows={3}
                bg="var(--color-bg-subtle)"
                borderColor="var(--color-border)"
                color="var(--color-text-primary)"
                _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                resize="vertical"
              />
              <Button size="xs" mt={2}
                bg="var(--color-accent)" color="white" _hover={{ bg: 'var(--color-accent-hover)' }}
                onClick={handleSaveNotes} isLoading={saving}
              >
                Save Notes
              </Button>
            </Box>

            <Divider borderColor="var(--color-border-subtle)" />

            {/* Navigation links */}
            <HStack spacing={2}>
              <Button size="sm" variant="outline" leftIcon={<FiFileText />}
                borderColor="var(--color-border)" color="var(--color-text-primary)"
                _hover={{ bg: 'var(--color-bg-hover)' }}
                onClick={() => router.push(`/game/${game.id}/notes`)}
              >
                Notes Editor
              </Button>
              <Button size="sm" variant="outline" leftIcon={<FiMap />}
                borderColor="var(--color-border)" color="var(--color-text-primary)"
                _hover={{ bg: 'var(--color-bg-hover)' }}
                onClick={() => router.push(`/game/${game.id}/map`)}
              >
                Maps
              </Button>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <HStack justify="space-between" w="full">
            <Button size="sm" variant="ghost" leftIcon={<DeleteIcon />}
              style={{ color: 'var(--color-danger)' }}
              onClick={handleDelete} isLoading={deleting}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
