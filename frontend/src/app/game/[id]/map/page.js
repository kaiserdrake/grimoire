'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Flex, HStack, VStack, Text, Button, Spinner, useToast, IconButton,
  Box, Input, Select, Popover, PopoverTrigger, PopoverContent,
  PopoverBody, PopoverArrow, FormControl, FormLabel, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter,
} from '@chakra-ui/react';
import { ArrowBackIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { FiMap, FiUpload, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';

const PIN_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

const PinIcon = ({ color }) => (
  <svg viewBox="0 0 24 24" fill={`var(--color-pin-${color})`} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

export default function MapPage({ params }) {
  const { id } = params;
  const router  = useRouter();
  const toast   = useToast();
  const { user } = useAuth();
  const imgRef  = useRef(null);

  const [game, setGame]         = useState(null);
  const [maps, setMaps]         = useState([]);
  const [activeMap, setActiveMap] = useState(null);
  const [imageData, setImageData] = useState(null);  // base64 of active map
  const [pins, setPins]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [placingPin, setPlacingPin] = useState(false);

  // New map modal
  const [isNewMapOpen, setIsNewMapOpen] = useState(false);
  const [newMapName, setNewMapName]     = useState('');
  const [newMapFile, setNewMapFile]     = useState(null);
  const [uploading, setUploading]       = useState(false);

  // New pin form (shows after clicking map)
  const [pendingPin, setPendingPin]   = useState(null);  // { x_percent, y_percent }
  const [pinLabel, setPinLabel]       = useState('');
  const [pinDesc, setPinDesc]         = useState('');
  const [pinColor, setPinColor]       = useState('blue');
  const [savingPin, setSavingPin]     = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [g, mapsData] = await Promise.all([
          api.games.get(id),
          api.maps.list(id),
        ]);
        setGame(g);
        setMaps(mapsData);
        if (mapsData.length > 0) await selectMap(mapsData[0]);
      } catch (err) {
        toast({ title: 'Failed to load', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  const selectMap = async (map) => {
    setActiveMap(map);
    setImageData(null);
    setPins([]);
    try {
      const [fullMap, pinsData] = await Promise.all([
        api.maps.get(map.id),
        api.pins.list(map.id),
      ]);
      setImageData(`data:${fullMap.image_mime};base64,${fullMap.image_data}`);
      setPins(pinsData);
    } catch (err) {
      toast({ title: 'Failed to load map', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── File → base64 ────────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  // ── Create new map ────────────────────────────────────────────────────────
  const handleCreateMap = async () => {
    if (!newMapName.trim() || !newMapFile) {
      toast({ title: 'Name and image are required', status: 'warning', duration: 3000 });
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(newMapFile);
      const created = await api.maps.create(id, {
        name: newMapName.trim(),
        image_data: base64,
        image_mime: newMapFile.type,
      });
      const newMaps = [...maps, created];
      setMaps(newMaps);
      await selectMap(created);
      setIsNewMapOpen(false);
      setNewMapName('');
      setNewMapFile(null);
    } catch (err) {
      toast({ title: 'Failed to create map', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setUploading(false);
    }
  };

  // ── Delete map ────────────────────────────────────────────────────────────
  const handleDeleteMap = async (mapId) => {
    if (!confirm('Delete this map and all its pins?')) return;
    try {
      await api.maps.delete(mapId);
      const remaining = maps.filter((m) => m.id !== mapId);
      setMaps(remaining);
      if (remaining.length > 0) {
        await selectMap(remaining[0]);
      } else {
        setActiveMap(null);
        setImageData(null);
        setPins([]);
      }
    } catch (err) {
      toast({ title: 'Failed to delete map', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Click on map image to place pin ──────────────────────────────────────
  const handleMapClick = (e) => {
    if (!placingPin || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setPendingPin({ x_percent: x, y_percent: y });
    setPinLabel('');
    setPinDesc('');
    setPinColor('blue');
  };

  // ── Save new pin ──────────────────────────────────────────────────────────
  const handleSavePin = async () => {
    if (!pinLabel.trim()) {
      toast({ title: 'Label is required', status: 'warning', duration: 2000 });
      return;
    }
    setSavingPin(true);
    try {
      const pin = await api.pins.create(activeMap.id, {
        ...pendingPin,
        label: pinLabel.trim(),
        description: pinDesc.trim() || null,
        color: pinColor,
      });
      setPins((prev) => [...prev, pin]);
      setPendingPin(null);
      setPlacingPin(false);
    } catch (err) {
      toast({ title: 'Failed to save pin', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSavingPin(false);
    }
  };

  // ── Delete pin ────────────────────────────────────────────────────────────
  const handleDeletePin = async (pinId) => {
    try {
      await api.pins.delete(activeMap.id, pinId);
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch (err) {
      toast({ title: 'Failed to delete pin', description: err.message, status: 'error', duration: 3000 });
    }
  };

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in to view maps.</Text>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">

        {/* ── Header ── */}
        <Flex align="center" justify="space-between" mb={4}>
          <HStack spacing={3}>
            <IconButton
              icon={<ArrowBackIcon />}
              size="sm"
              variant="ghost"
              aria-label="Back"
              onClick={() => router.push('/')}
              style={{ color: 'var(--color-text-secondary)' }}
            />
            <Box>
              <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
                {game?.title ?? '…'}
              </Text>
              <Text fontSize="lg" fontWeight={700} style={{ color: 'var(--color-text-primary)' }}>
                Maps
              </Text>
            </Box>
          </HStack>

          <HStack spacing={2}>
            {activeMap && (
              <Button
                size="sm"
                leftIcon={placingPin ? <FiX /> : <AddIcon />}
                onClick={() => { setPlacingPin((p) => !p); setPendingPin(null); }}
                style={{
                  background: placingPin ? 'var(--color-warning)' : 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                }}
              >
                {placingPin ? 'Cancel Pin' : 'Add Pin'}
              </Button>
            )}
            <Button
              size="sm"
              leftIcon={<FiUpload />}
              variant="outline"
              onClick={() => setIsNewMapOpen(true)}
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              New Map
            </Button>
          </HStack>
        </Flex>

        {loading ? (
          <Flex justify="center" py={16}><Spinner style={{ color: 'var(--color-accent)' }} /></Flex>
        ) : (
          <Flex gap={4} align="start">

            {/* ── Sidebar: map list ── */}
            <Box
              w="200px"
              flexShrink={0}
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
              }}
            >
              <Text
                fontSize="0.7rem"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing="0.06em"
                mb={2}
                style={{ color: 'var(--color-text-muted)' }}
              >
                Maps
              </Text>
              {maps.length === 0 ? (
                <Text fontSize="sm" style={{ color: 'var(--color-text-muted)' }}>No maps yet.</Text>
              ) : (
                <VStack spacing={1} align="stretch">
                  {maps.map((m) => (
                    <Flex
                      key={m.id}
                      align="center"
                      justify="space-between"
                      px={2}
                      py={1.5}
                      borderRadius="md"
                      cursor="pointer"
                      onClick={() => selectMap(m)}
                      style={{
                        background: activeMap?.id === m.id ? 'var(--color-accent-subtle)' : 'transparent',
                        color: activeMap?.id === m.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      }}
                      _hover={{ background: 'var(--color-bg-hover)' }}
                    >
                      <Text fontSize="sm" fontWeight={activeMap?.id === m.id ? 600 : 400} noOfLines={1}>
                        {m.name}
                      </Text>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        icon={<DeleteIcon />}
                        aria-label="Delete map"
                        onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}
                        style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
                      />
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>

            {/* ── Map canvas ── */}
            <Box flex={1} minW={0}>
              {!activeMap || !imageData ? (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  py={16}
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <FiMap size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <Text fontSize="sm">No map selected.</Text>
                  <Text fontSize="xs" mt={1}>Upload a map image to get started.</Text>
                </Flex>
              ) : (
                <Box>
                  {placingPin && (
                    <Box
                      mb={2}
                      px={3}
                      py={2}
                      borderRadius="md"
                      style={{
                        background: 'var(--color-accent-subtle)',
                        border: '1px solid var(--color-accent)',
                        color: 'var(--color-accent)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      Click anywhere on the map to place a pin
                    </Box>
                  )}

                  {/* Map with pins overlay */}
                  <div
                    className="map-container"
                    onClick={handleMapClick}
                    style={{ cursor: placingPin ? 'crosshair' : 'default', width: '100%' }}
                  >
                    <img
                      ref={imgRef}
                      src={imageData}
                      alt={activeMap.name}
                      className="map-image"
                      style={{ width: '100%' }}
                      draggable={false}
                    />

                    {/* Placed pins */}
                    {pins.map((pin) => (
                      <Popover key={pin.id} isLazy placement="top">
                        <PopoverTrigger>
                          <div
                            className="map-pin"
                            style={{ left: `${pin.x_percent}%`, top: `${pin.y_percent}%` }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PinIcon color={pin.color} />
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          style={{
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-md)',
                            color: 'var(--color-text-primary)',
                            maxWidth: '220px',
                          }}
                        >
                          <PopoverArrow style={{ background: 'var(--color-bg-surface)' }} />
                          <PopoverBody>
                            <Flex justify="space-between" align="start">
                              <Box>
                                <Text fontWeight={700} fontSize="sm">{pin.label}</Text>
                                {pin.description && (
                                  <Text fontSize="xs" mt={0.5} style={{ color: 'var(--color-text-secondary)' }}>
                                    {pin.description}
                                  </Text>
                                )}
                              </Box>
                              <IconButton
                                size="xs"
                                variant="ghost"
                                icon={<DeleteIcon />}
                                aria-label="Delete pin"
                                onClick={() => handleDeletePin(pin.id)}
                                style={{ color: 'var(--color-danger)', flexShrink: 0, marginLeft: '0.5rem' }}
                              />
                            </Flex>
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                    ))}

                    {/* Pending pin (not yet saved) */}
                    {pendingPin && (
                      <div
                        className="map-pin"
                        style={{
                          left: `${pendingPin.x_percent}%`,
                          top: `${pendingPin.y_percent}%`,
                          opacity: 0.6,
                          animation: 'pulse 1s infinite',
                        }}
                      >
                        <PinIcon color={pinColor} />
                      </div>
                    )}
                  </div>

                  {/* Pin placement form */}
                  {pendingPin && (
                    <Box
                      mt={3}
                      p={4}
                      style={{
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <Text fontSize="sm" fontWeight={700} mb={3} style={{ color: 'var(--color-text-primary)' }}>
                        New Pin
                      </Text>
                      <VStack spacing={3}>
                        <FormControl>
                          <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>
                            Label *
                          </FormLabel>
                          <Input
                            size="sm"
                            value={pinLabel}
                            onChange={(e) => setPinLabel(e.target.value)}
                            placeholder="e.g. Boss arena, Secret chest…"
                            style={{
                              background: 'var(--color-bg-subtle)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>
                            Description
                          </FormLabel>
                          <Textarea
                            size="sm"
                            rows={2}
                            value={pinDesc}
                            onChange={(e) => setPinDesc(e.target.value)}
                            placeholder="Optional details…"
                            resize="none"
                            style={{
                              background: 'var(--color-bg-subtle)',
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>
                            Color
                          </FormLabel>
                          <HStack spacing={2}>
                            {PIN_COLORS.map((c) => (
                              <button
                                key={c}
                                title={c}
                                onClick={() => setPinColor(c)}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: `var(--color-pin-${c})`,
                                  border: pinColor === c
                                    ? '3px solid var(--color-text-primary)'
                                    : '2px solid transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              />
                            ))}
                          </HStack>
                        </FormControl>
                        <HStack justify="flex-end" w="full">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingPin(null)}
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            isLoading={savingPin}
                            onClick={handleSavePin}
                            style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
                          >
                            Place Pin
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Flex>
        )}
      </div>

      {/* ── New Map Modal ── */}
      <Modal isOpen={isNewMapOpen} onClose={() => setIsNewMapOpen(false)} isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <ModalHeader style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            Upload Map
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={5}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel fontSize="sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Map name *
                </FormLabel>
                <Input
                  value={newMapName}
                  onChange={(e) => setNewMapName(e.target.value)}
                  placeholder="e.g. World Map, Dungeon Floor 1…"
                  style={{
                    background: 'var(--color-bg-subtle)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Map image *
                </FormLabel>
                <Box
                  as="label"
                  htmlFor="map-upload"
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  py={6}
                  cursor="pointer"
                  style={{
                    background: 'var(--color-bg-subtle)',
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-muted)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <FiUpload size={24} style={{ marginBottom: '0.5rem' }} />
                  <Text fontSize="sm">
                    {newMapFile ? newMapFile.name : 'Click to select an image'}
                  </Text>
                  <Text fontSize="xs" mt={0.5} style={{ color: 'var(--color-text-muted)' }}>
                    PNG, JPG, WebP
                  </Text>
                  <input
                    id="map-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => setNewMapFile(e.target.files[0] || null)}
                  />
                </Box>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <HStack spacing={2}>
              <Button size="sm" variant="ghost" onClick={() => setIsNewMapOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={uploading}
                onClick={handleCreateMap}
                style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
              >
                Upload
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
