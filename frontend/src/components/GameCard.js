'use client';

import { useState } from 'react';
import {
  Box, HStack, VStack, Text, IconButton, Menu, MenuButton, MenuList, MenuItem,
  MenuDivider, useToast,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { FiMoreVertical, FiFileText, FiMap, FiTrash2, FiStar } from 'react-icons/fi';
import { api } from '@/utils/api';

const STATUS_LABELS = {
  backlog: 'Backlog', playing: 'Playing', completed: 'Completed', dropped: 'Dropped',
};

const STATUS_CYCLE = ['backlog', 'playing', 'completed', 'dropped'];

export default function GameCard({ game, onUpdate, onDelete }) {
  const router = useRouter();
  const toast = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setIsUpdating(true);
    try {
      await api.games.updateStatus(game.id, newStatus);
      onUpdate?.();
    } catch (err) {
      toast({ title: 'Failed to update status', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${game.title}"? This cannot be undone.`)) return;
    try {
      await api.games.delete(game.id);
      onDelete?.();
      toast({ title: 'Game removed.', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Failed to delete', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const year = game.release_date ? new Date(game.release_date).getFullYear() : null;

  return (
    <Box className="game-card" role="group">
      {/* Cover */}
      {game.cover_url ? (
        <img
          src={game.cover_url}
          alt={game.title}
          className="game-card-cover"
          onClick={() => router.push(`/game/${game.id}/notes`)}
          loading="lazy"
        />
      ) : (
        <div
          className="game-card-cover-placeholder"
          onClick={() => router.push(`/game/${game.id}/notes`)}
        >
          🎮
        </div>
      )}

      {/* Body */}
      <div className="game-card-body">
        <HStack justify="space-between" align="start" spacing={1}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="game-card-title"
              onClick={() => router.push(`/game/${game.id}/notes`)}
              style={{ cursor: 'pointer' }}>
              {game.title}
            </p>
            <p className="game-card-meta">{year || '—'}</p>
          </div>

          {/* Actions menu */}
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<FiMoreVertical />}
              size="xs"
              variant="ghost"
              aria-label="Game actions"
              style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
            />
            <MenuList fontSize="sm">
              <MenuItem icon={<FiFileText />} onClick={() => router.push(`/game/${game.id}/notes`)}>
                Notes
              </MenuItem>
              <MenuItem icon={<FiMap />} onClick={() => router.push(`/game/${game.id}/map`)}>
                Maps
              </MenuItem>
              <MenuDivider />
              {STATUS_CYCLE.filter((s) => s !== game.status).map((s) => (
                <MenuItem key={s} onClick={() => handleStatusChange(s)}
                  isDisabled={isUpdating}
                  style={{ color: 'var(--color-text-secondary)' }}>
                  Move to {STATUS_LABELS[s]}
                </MenuItem>
              ))}
              <MenuDivider />
              <MenuItem icon={<FiTrash2 />} onClick={handleDelete} style={{ color: 'var(--color-danger)' }}>
                Remove
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>

        {/* Status badge */}
        <div style={{ marginTop: '0.4rem' }}>
          <span className={`status-badge ${game.status}`}>
            {STATUS_LABELS[game.status]}
          </span>
        </div>

        {/* Rating stars (if set) */}
        {game.rating && (
          <HStack spacing={0.5} mt={1}>
            {Array.from({ length: 10 }).map((_, i) => (
              <FiStar
                key={i}
                size={10}
                fill={i < game.rating ? 'var(--color-warning)' : 'none'}
                color={i < game.rating ? 'var(--color-warning)' : 'var(--color-border)'}
              />
            ))}
            <Text fontSize="0.65rem" ml={1} style={{ color: 'var(--color-text-muted)' }}>
              {game.rating}/10
            </Text>
          </HStack>
        )}
      </div>
    </Box>
  );
}
