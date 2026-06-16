'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Flex, HStack, VStack, Box, Text, Heading, Button, IconButton, Spinner,
  Input, Select, Tooltip, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
} from '@chakra-ui/react';
import { FiPlus, FiTrash2, FiSettings, FiMap, FiTag, FiLink, FiX, FiCheck } from 'react-icons/fi';
import Navbar from '@/components/Navbar';
import GameTabBar from '@/components/GameTabBar';
import GameDetailModal from '@/components/GameDetailModal';
import RecentDrawer from '@/components/RecentDrawer';
import { useAuth } from '@/context/AuthContext';
import { api, getApiBase } from '@/utils/api';
import { PIN_COLORS, PIN_TYPES, PinIcon } from '@/constants/pins';
import { slugifyGroup, iconToken } from '@/utils/noteIcons';

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, children }) {
  return (
    <Box
      mb={3}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '0.85rem 1rem',
      }}
    >
      <HStack spacing={2} mb={0.5}>
        <Icon size={13} style={{ color: 'var(--color-accent)' }} />
        <Heading size="xs" style={{ color: 'var(--color-text-primary)' }}>{title}</Heading>
      </HStack>
      {description && (
        <Text fontSize="11px" mb={3} style={{ color: 'var(--color-text-muted)' }}>{description}</Text>
      )}
      {children}
    </Box>
  );
}

// ── Color swatch picker ─────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <HStack spacing={1}>
      {PIN_COLORS.map(c => (
        <Box
          key={c}
          as="button"
          w="16px" h="16px" borderRadius="full"
          background={`var(--color-pin-${c})`}
          onClick={() => onChange(c)}
          style={{
            outline: value === c ? '2px solid var(--color-accent)' : '2px solid transparent',
            outlineOffset: '1px',
            cursor: 'pointer',
          }}
        />
      ))}
    </HStack>
  );
}

export default function GameSettingsPage({ params }) {
  const { id, ptId } = params;
  const toast = useToast();
  const { user } = useAuth();

  const [game, setGame]                 = useState(null);
  const [playthroughs, setPlaythroughs] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [recentOpen, setRecentOpen]     = useState(false);
  const [apiBase, setApiBase]           = useState('');

  // ── Auto-save status: 'idle' | 'saving' | 'saved' ───────────────────────────
  const [saveState, setSaveState] = useState('idle');
  const skipNextSave = useRef(true); // skip the state change caused by initial load

  // ── Map defaults: [{ icon, color, label }] ──────────────────────────────────
  const [mapDefaults, setMapDefaults] = useState([]);
  // ── Note icon groups: [{ name, icons: [url] }] ──────────────────────────────
  const [iconGroups, setIconGroups]   = useState([]);

  // ── URL-based icon add ──────────────────────────────────────────────────────
  const [urlModalIdx, setUrlModalIdx] = useState(null); // group index awaiting a URL
  const [urlInput,    setUrlInput]    = useState('');
  const [addingUrl,   setAddingUrl]   = useState(false);

  useEffect(() => {
    getApiBase().then(setApiBase).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [g, pts, mapDef, iconDef] = await Promise.all([
          api.games.get(id),
          api.playthroughs.list(id),
          api.settings.get(`map_defaults_${id}`).catch(() => null),
          api.settings.get(`note_icons_${id}`).catch(() => null),
        ]);
        setGame(g);
        setPlaythroughs(pts);
        setMapDefaults(Array.isArray(mapDef) ? mapDef : []);
        setIconGroups(Array.isArray(iconDef) ? iconDef : []);
      } catch (err) {
        toast({ title: 'Failed to load settings', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  // ── Debounced auto-save whenever settings change ────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        const cleanedDefaults = mapDefaults
          .map(d => ({ icon: d.icon, color: d.color, label: (d.label || '').trim() }))
          .filter(d => d.label);
        const cleanedGroups = iconGroups
          .map(g => ({ name: slugifyGroup(g.name), icons: g.icons || [] }))
          .filter(g => g.name);
        await Promise.all([
          api.settings.set(`map_defaults_${id}`, cleanedDefaults),
          api.settings.set(`note_icons_${id}`, cleanedGroups),
        ]);
        setSaveState('saved');
      } catch (err) {
        setSaveState('idle');
        toast({ title: 'Auto-save failed', description: err.message, status: 'error', duration: 4000 });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [mapDefaults, iconGroups, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map defaults ────────────────────────────────────────────────────────────
  const addDefault = () =>
    setMapDefaults(prev => [...prev, { icon: PIN_TYPES[0].id, color: PIN_COLORS[0], label: '' }]);
  const updateDefault = (idx, patch) =>
    setMapDefaults(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const removeDefault = (idx) =>
    setMapDefaults(prev => prev.filter((_, i) => i !== idx));

  // ── Icon groups ───────────────────────────────────────────────────────────
  const addGroup = () =>
    setIconGroups(prev => [...prev, { name: `group_${prev.length + 1}`, icons: [] }]);
  const updateGroupName = (idx, name) =>
    setIconGroups(prev => prev.map((g, i) => (i === idx ? { ...g, name } : g)));
  const removeGroup = (idx) =>
    setIconGroups(prev => prev.filter((_, i) => i !== idx));
  const removeIcon = (gIdx, iIdx) =>
    setIconGroups(prev => prev.map((g, i) =>
      i === gIdx ? { ...g, icons: g.icons.filter((_, j) => j !== iIdx) } : g));

  const openUrlModal = (idx) => { setUrlModalIdx(idx); setUrlInput(''); };

  const handleAddUrl = async () => {
    const url = urlInput.trim();
    if (!url || urlModalIdx == null) return;
    const idx = urlModalIdx;
    setAddingUrl(true);
    try {
      const att = await api.attachments.fromUrl(id, 'icons', url);
      setIconGroups(prev => prev.map((g, i) =>
        i === idx ? { ...g, icons: [...(g.icons || []), att.url] } : g));
      setUrlModalIdx(null);
      setUrlInput('');
    } catch (err) {
      toast({ title: 'Failed to fetch image', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setAddingUrl(false);
    }
  };

  if (!user) return (
    <>
      <Navbar />
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in to view settings.</Text>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <GameTabBar gameId={id} ptId={ptId} hasPlaythroughs={loading || playthroughs.length > 0} />
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />

      {loading ? (
        <Flex justify="center" align="center" style={{ height: '60vh' }}>
          <Spinner style={{ color: 'var(--color-accent)' }} />
        </Flex>
      ) : (
        <Box style={{ maxWidth: '760px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>
          <Flex align="center" justify="space-between" mb={4} gap={3} wrap="wrap">
            <HStack spacing={2} minW={0}>
              <FiSettings size={15} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              <Heading size="sm" style={{ color: 'var(--color-text-primary)' }}>Settings</Heading>
              <Text fontSize="xs" noOfLines={1} style={{ color: 'var(--color-text-muted)' }}>
                · {game?.title}
              </Text>
            </HStack>
            {/* Auto-save status */}
            <HStack spacing={1.5} flexShrink={0} style={{ color: 'var(--color-text-muted)' }}>
              {saveState === 'saving' && (
                <><Spinner size="xs" style={{ color: 'var(--color-accent)' }} /><Text fontSize="xs">Saving…</Text></>
              )}
              {saveState === 'saved' && (
                <><FiCheck size={13} style={{ color: 'var(--color-success, #48bb78)' }} /><Text fontSize="xs">Saved</Text></>
              )}
            </HStack>
          </Flex>

          {/* ── Note Icons ── */}
          <Section
            icon={FiTag}
            title="Note Icons"
            description="Create icon groups and add icons by URL. Reference them in notes with the toolbar tag button or by typing :icon[group_01]."
          >
            {iconGroups.length === 0 ? (
              <Text fontSize="xs" mb={2} style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                No icon groups yet.
              </Text>
            ) : (
              <VStack spacing={2} align="stretch" mb={2}>
                {iconGroups.map((g, gIdx) => {
                  const slug = slugifyGroup(g.name) || 'group';
                  return (
                    <Box key={gIdx} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                      <HStack spacing={2} mb={2}>
                        <Input
                          size="xs"
                          value={g.name}
                          onChange={e => updateGroupName(gIdx, e.target.value)}
                          placeholder="group name"
                          style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', maxWidth: '180px' }}
                        />
                        <Text fontSize="10px" style={{ color: 'var(--color-text-muted)' }}>
                          → :icon[{slug}_01]
                        </Text>
                        <Box flex={1} />
                        <Tooltip label="Remove group" hasArrow placement="top" openDelay={300}>
                          <IconButton
                            icon={<FiTrash2 size={12} />}
                            size="xs"
                            variant="ghost"
                            aria-label="Remove group"
                            onClick={() => removeGroup(gIdx)}
                            style={{ color: 'var(--color-text-muted)', minWidth: '24px' }}
                          />
                        </Tooltip>
                      </HStack>

                      <Flex wrap="wrap" gap={2} align="flex-start">
                        {(g.icons || []).map((url, iIdx) => (
                          <Box key={iIdx} style={{ width: '64px', textAlign: 'center', position: 'relative' }}>
                            <Box
                              style={{
                                position: 'relative',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                height: '48px',
                                background: 'var(--color-bg-page)',
                                border: '1px solid var(--color-border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <Box style={{
                                position: 'absolute', top: '-6px', left: '-6px',
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: 'var(--color-accent)', color: 'white',
                                fontSize: '9px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {iIdx + 1}
                              </Box>
                              <img
                                src={url.startsWith('http') ? url : `${apiBase}${url}`}
                                alt={iconToken(g.name, iIdx + 1)}
                                style={{ maxHeight: '38px', maxWidth: '54px', objectFit: 'contain' }}
                              />
                              <Box
                                as="button"
                                onClick={() => removeIcon(gIdx, iIdx)}
                                title="Remove icon"
                                style={{
                                  position: 'absolute', top: '-6px', right: '-6px',
                                  width: '16px', height: '16px', borderRadius: '50%',
                                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                                  color: 'var(--color-text-muted)', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <FiX size={9} />
                              </Box>
                            </Box>
                            <Text fontSize="9px" mt={0.5} noOfLines={1} style={{ color: 'var(--color-text-muted)' }}>
                              {slug}_{String(iIdx + 1).padStart(2, '0')}
                            </Text>
                          </Box>
                        ))}

                        {/* Add icon from URL */}
                        <Box
                          as="button"
                          onClick={() => openUrlModal(gIdx)}
                          style={{
                            width: '64px', height: '48px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '2px',
                            background: 'var(--color-bg-subtle)',
                            border: '1px dashed var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <FiLink size={13} /><Text fontSize="9px">Add URL</Text>
                        </Box>
                      </Flex>
                    </Box>
                  );
                })}
              </VStack>
            )}

            <Button
              size="xs"
              leftIcon={<FiPlus size={12} />}
              onClick={addGroup}
              variant="ghost"
              style={{ color: 'var(--color-accent)', border: '1px dashed var(--color-border)' }}
            >
              Add group
            </Button>
          </Section>

          {/* ── Map Defaults ── */}
          <Section
            icon={FiMap}
            title="Map Defaults"
            description="Map a pin type + color to a default label. In the map editor these appear as one-click markers."
          >
            {mapDefaults.length === 0 ? (
              <Text fontSize="xs" mb={2} style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                No defaults yet.
              </Text>
            ) : (
              <VStack spacing={1.5} align="stretch" mb={2}>
                {/* Header row */}
                <HStack spacing={2.5} px={1} style={{ color: 'var(--color-text-muted)' }}>
                  <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.06em" style={{ width: '140px' }}>Type</Text>
                  <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.06em" style={{ width: '120px' }}>Color</Text>
                  <Text fontSize="10px" textTransform="uppercase" letterSpacing="0.06em" flex={1}>Label</Text>
                  <Box style={{ width: '24px' }} />
                </HStack>

                {mapDefaults.map((d, idx) => (
                  <HStack key={idx} spacing={2.5} align="center">
                    {/* Type */}
                    <HStack spacing={1} style={{ width: '140px' }}>
                      <PinIcon color={d.color} icon={d.icon} size={18} />
                      <Select
                        size="xs"
                        value={d.icon}
                        onChange={e => updateDefault(idx, { icon: e.target.value })}
                        style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                      >
                        {PIN_TYPES.map(t => (
                          <option key={t.id} value={t.id} style={{ background: 'var(--color-bg-surface)' }}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                    {/* Color */}
                    <Box style={{ width: '120px' }}>
                      <ColorPicker value={d.color} onChange={c => updateDefault(idx, { color: c })} />
                    </Box>
                    {/* Label */}
                    <Input
                      size="xs"
                      flex={1}
                      value={d.label}
                      onChange={e => updateDefault(idx, { label: e.target.value })}
                      placeholder="e.g. Rare Item A"
                      style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                    {/* Delete */}
                    <Tooltip label="Remove" hasArrow placement="top" openDelay={300}>
                      <IconButton
                        icon={<FiTrash2 size={12} />}
                        size="xs"
                        variant="ghost"
                        aria-label="Remove default"
                        onClick={() => removeDefault(idx)}
                        style={{ color: 'var(--color-text-muted)', minWidth: '24px' }}
                      />
                    </Tooltip>
                  </HStack>
                ))}
              </VStack>
            )}

            <Button
              size="xs"
              leftIcon={<FiPlus size={12} />}
              onClick={addDefault}
              variant="ghost"
              style={{ color: 'var(--color-accent)', border: '1px dashed var(--color-border)' }}
            >
              Add default
            </Button>
          </Section>
        </Box>
      )}

      {/* ── Add-icon-by-URL modal ── */}
      <Modal isOpen={urlModalIdx != null} onClose={() => setUrlModalIdx(null)} size="sm" isCentered>
        <ModalOverlay />
        <ModalContent style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <ModalHeader fontSize="sm">Add icon from URL</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              size="sm"
              autoFocus
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(); }}
              placeholder="https://example.com/icon.png"
              style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <Text fontSize="xs" mt={2} style={{ color: 'var(--color-text-muted)' }}>
              The image is downloaded and hosted locally.
            </Text>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button size="sm" variant="ghost" onClick={() => setUrlModalIdx(null)}
              style={{ color: 'var(--color-text-secondary)' }}>
              Cancel
            </Button>
            <Button size="sm" isLoading={addingUrl} loadingText="Adding…" isDisabled={!urlInput.trim()}
              onClick={handleAddUrl}
              style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}>
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {game && (
        <GameDetailModal
          game={game}
          isOpen={gameModalOpen}
          onClose={() => setGameModalOpen(false)}
          onUpdated={() => api.games.get(id).then(setGame).catch(() => {})}
          onDeleted={() => setGameModalOpen(false)}
        />
      )}
    </>
  );
}
