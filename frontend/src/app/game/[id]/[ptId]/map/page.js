'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flex, HStack, VStack, Text, Button, Spinner, useToast, IconButton,
  Box, Input, Popover, PopoverTrigger, PopoverContent,
  PopoverBody, FormControl, FormLabel, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Tabs, TabList, Tab, TabPanels, TabPanel,
  Tooltip,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { FiMap, FiUpload, FiX, FiPlus, FiFolder, FiTrash2, FiLink, FiEdit2, FiFileText, FiCamera, FiImage, FiCheck, FiList } from 'react-icons/fi';
import { TbMapPin, TbRoute } from 'react-icons/tb';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useLastVisited } from '@/context/LastVisitedContext';
import { useTabState } from '@/context/TabStateContext';
import GameDetailModal from '@/components/GameDetailModal';
import RecentDrawer from '@/components/RecentDrawer';
import GameTabBar from '@/components/GameTabBar';
import CameraCapture from '@/components/CameraCapture';
import { api, getApiBase } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { ptSidebarLabel } from '@/utils/playthroughs';
import {
  PIN_COLORS, PIN_TYPES, parsePinStyle, encodePinStyle, PinIcon,
} from '@/constants/pins';

// ── Hold-to-delete ────────────────────────────────────────────────────────────
const HOLD_DURATION = 1800;

function HoldToDelete({ onDelete, inMap = false }) {
  const [progress, setProgress] = useState(0);
  const [holding,  setHolding]  = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
    else if (!firedRef.current) { firedRef.current = true; onDelete(); reset(); }
  }, [onDelete]);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    firedRef.current = false;
    setProgress(0);
    setHolding(false);
  };

  const start = (e) => {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = Date.now();
    firedRef.current = false;
    setHolding(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = (e) => {
    e.stopPropagation();
    if (!firedRef.current) reset();
  };

  const radius = 10;
  const svgSize = radius * 2 + 4;
  const circumference = 2 * Math.PI * radius;

  return (
    <Tooltip label="Hold to delete" hasArrow placement="top" openDelay={400}>
    <Box as="button"
        display="inline-flex" alignItems="center" justifyContent="center"
        borderRadius={inMap ? '4px' : 'md'}
        border="none"
        cursor="pointer"
        background="transparent"
        style={inMap ? { width: '22px', height: '22px', transition: 'color 0.15s, background 0.15s' } : {}}
        color={holding
          ? (inMap ? 'rgba(255,120,120,0.9)' : 'var(--color-danger)')
          : (inMap ? 'rgba(255,255,255,0.45)' : 'var(--color-text-muted)')}
        onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchEnd={stop}
        style={{ padding: 2, transition: 'color 0.15s' }}
      >
        <svg width={svgSize} height={svgSize} style={{ overflow: 'visible' }}>
          <circle cx={svgSize/2} cy={svgSize/2} r={radius}
            fill="none" stroke="var(--color-border)" strokeWidth="2" />
          {holding && (
            <circle cx={svgSize/2} cy={svgSize/2} r={radius}
              fill="none" stroke="var(--color-danger)" strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`}
            />
          )}
          <FiTrash2
            x={svgSize/2 - 6} y={svgSize/2 - 6}
            width={12} height={12}
          />
        </svg>
      </Box>
    </Tooltip>
  );
}

// ── Load an image's intrinsic size ────────────────────────────────────────────
function loadImageSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

// ── Re-fit pins from an old image to a new one ─────────────────────────────────
// Pins are stored as 0–100 percentages of the displayed image. When the image is
// replaced we keep each pin locked to the same point of the map *content* by
// scaling the old content uniformly (preserving aspect ratio) to fit centered
// inside the new image — a "contain" transform. When the aspect ratios match, the
// scale is uniform and the offsets are zero, so every percentage is unchanged
// (pins retained 100%); when they differ, the content is centered/letterboxed and
// pins move with it instead of stretching.
function refitPins(pins, oldSize, newSize) {
  const { w: ow, h: oh } = oldSize || {};
  const { w: nw, h: nh } = newSize || {};
  if (!ow || !oh || !nw || !nh) return pins.map(p => ({ id: p.id, x_percent: p.x_percent, y_percent: p.y_percent }));
  const s = Math.min(nw / ow, nh / oh);
  const offsetX = (nw - ow * s) / 2;
  const offsetY = (nh - oh * s) / 2;
  return pins.map(p => {
    const px = (p.x_percent / 100) * ow;
    const py = (p.y_percent / 100) * oh;
    const nx = offsetX + px * s;
    const ny = offsetY + py * s;
    return {
      id: p.id,
      x_percent: Math.min(100, Math.max(0, (nx / nw) * 100)),
      y_percent: Math.min(100, Math.max(0, (ny / nh) * 100)),
    };
  });
}

// ── Disambiguate pin labels ───────────────────────────────────────────────────
function disambiguatePinLabels(pins) {
  const counts = {};
  pins.forEach(p => { counts[p.label] = (counts[p.label] || 0) + 1; });
  const seen = {};
  return pins.map(p => {
    if (counts[p.label] <= 1) return { ...p, displayLabel: p.label };
    seen[p.label] = (seen[p.label] || 0) + 1;
    return { ...p, displayLabel: `${p.label} (${seen[p.label]})` };
  });
}

// ── Pin Modal (Add & Edit) ────────────────────────────────────────────────────
function PinModal({ isOpen, onClose, onSave, onDelete, pin, defaultLabel, mapDefaults = [] }) {
  const [label,  setLabel]  = useState('');
  const [desc,   setDesc]   = useState('');
  const [color,  setColor]  = useState('blue');
  const [icon,   setIcon]   = useState('location');
  const [saving, setSaving] = useState(false);
  const labelRef = useRef(null);

  const isEdit = Boolean(pin);

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        const { color: c, icon: ic } = parsePinStyle(pin.color);
        setLabel(pin.label || '');
        setDesc(pin.description || '');
        setColor(c);
        setIcon(ic);
      } else {
        setLabel(defaultLabel || '');
        setDesc('');

        setColor('blue');
        setIcon('location');
      }
      setSaving(false);
      setTimeout(() => labelRef.current?.focus(), 50);
    }
  }, [isOpen, pin]);

  // Clicking a configured default marker fills in its label, type and color.
  // The user can freely tweak any of them afterwards.
  const applyDefault = (d) => {
    setLabel(d.label);
    setColor(d.color);
    setIcon(d.icon);
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {

      await onSave({ label: label.trim(), description: desc.trim() || null, color: encodePinStyle(color, icon) });
    } finally {

      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered closeOnEsc closeOnOverlayClick={false}>
      <ModalOverlay style={{ background: 'rgba(0,0,0,0.5)' }} />
      <ModalContent style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}>
        <ModalHeader fontSize="sm" pb={2}>{isEdit ? 'Edit Pin' : 'Add Pin'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={3} align="stretch">
            {/* Default markers — one click sets label, type and color */}
            {mapDefaults.length > 0 && (
              <FormControl>
                <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Default markers</FormLabel>
                <Box display="flex" flexWrap="wrap" gap={1.5}>
                  {mapDefaults.map((d, i) => {
                    const active = label === d.label && color === d.color && icon === d.icon;
                    return (
                      <Box
                        as="button"
                        key={`${d.color}:${d.icon}:${i}`}
                        type="button"
                        onClick={() => applyDefault(d)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '3px 8px 3px 5px',
                          borderRadius: '999px',
                          border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                          background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-subtle)',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          transition: 'border-color 0.1s, background 0.1s',
                        }}
                      >
                        <PinIcon color={d.color} icon={d.icon} size={16} />
                        <span>{d.label}</span>
                      </Box>
                    );
                  })}
                </Box>
              </FormControl>
            )}

            <FormControl isRequired>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Label</FormLabel>
              <Input
                ref={labelRef}
                size="sm"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />

            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Description</FormLabel>
              <Textarea
                size="sm"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </FormControl>

            {/* Pin type selector */}
            <FormControl>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Type</FormLabel>
              <Box display="grid" gridTemplateColumns="repeat(6, 1fr)" gap={1}>
                {PIN_TYPES.map(t => (
                  <Tooltip key={t.id} label={t.label} hasArrow placement="top" openDelay={200}>
                    <Box
                      as="button"
                      onClick={() => setIcon(t.id)}
                      style={{
                        padding: '4px',
                        borderRadius: '6px',
                        border: icon === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                        background: icon === t.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-subtle)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'border-color 0.1s, background 0.1s',
                      }}
                    >
                      <div style={{ width: 24, height: 24 }}>
                        {t.svg(`var(--color-pin-${color})`)}
                      </div>
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </FormControl>

            {/* Color selector */}
            <FormControl>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Color</FormLabel>
              <HStack spacing={2}>
                {PIN_COLORS.map(c => (
                  <Box
                    key={c}
                    as="button"
                    w="20px" h="20px" borderRadius="full"
                    background={`var(--color-pin-${c})`}
                    onClick={() => setColor(c)}
                    style={{
                      outline: color === c ? '2px solid var(--color-accent)' : '2px solid transparent',
                      outlineOffset: '2px',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </HStack>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2} pt={2}>
          {isEdit && (
            <HoldToDelete onDelete={onDelete} />
          )}
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="ghost" onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}>
            Cancel
          </Button>
          <Button size="sm" isLoading={saving} isDisabled={!label.trim()}
            onClick={handleSave}
            style={{ background: 'var(--color-accent)', color: 'white' }}>
            {isEdit ? 'Save' : 'Add Pin'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  game, playthroughs, mapsByPt, pinsByMap,
  activeMapId, activePinId,
  onSelectMap, onSelectPin, onNewMap, onDeleteMap,
  initialPtId, onOpenGame, gameId,
}) {
  const router = useRouter();
  const [expandedPts,  setExpandedPts]  = useState({});
  const [expandedMaps, setExpandedMaps] = useState({});

  // Auto-expand initial playthrough
  useEffect(() => {
    if (initialPtId) setExpandedPts(prev => ({ ...prev, [initialPtId]: true }));
  }, [initialPtId]);

  const togglePt  = (id) => setExpandedPts(prev  => ({ ...prev, [id]: !prev[id]  }));
  const toggleMap = (id) => setExpandedMaps(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="notes-sidebar">
      {/* Header */}
      <div className="notes-sidebar-header">
        <button className="notes-sidebar-title-btn" onClick={onOpenGame} title={game?.title}>
          <FiFolder size={13} style={{ flexShrink: 0, color: 'var(--color-accent)' }} />
          <span className="notes-sidebar-title-text">{game?.title ?? '…'}</span>
        </button>
      </div>

      {/* Tree */}
      <div className="notes-sidebar-tree">
        {playthroughs.map((pt, i) => {
          const maps   = mapsByPt[pt.id] || [];
          const ptOpen = !!expandedPts[pt.id];

          return (
            <div key={pt.id}>
              {/* Playthrough folder row */}
              <div
                className="notes-sidebar-folder"
                onClick={() => togglePt(pt.id)}
              >
                {ptOpen
                  ? <ChevronDownIcon  boxSize={3} style={{ flexShrink: 0 }} />
                  : <ChevronRightIcon boxSize={3} style={{ flexShrink: 0 }} />}
                <FiFolder size={12} style={{
                  flexShrink: 0,
                  color: ptOpen ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }} />
                <Tooltip label={pt.platform} hasArrow placement="right" openDelay={300}>
                  <Text fontSize="11px" noOfLines={1} flex={1} style={{ color: 'var(--color-text-secondary)' }}>
                    {ptSidebarLabel(pt, playthroughs)}
                  </Text>
                </Tooltip>
                <IconButton
                  icon={<FiPlus size={10} />}
                  size="xs" variant="ghost" aria-label="Add map"
                  onClick={e => { e.stopPropagation(); onNewMap(pt.id); }}
                  style={{ color: 'var(--color-text-muted)', minWidth: '18px', height: '18px' }}
                />
              </div>

              {/* Maps under this playthrough */}
              {ptOpen && (
                <div className="notes-sidebar-files">
                  {maps.length === 0 && (
                    <Text fontSize="10px" style={{
                      color: 'var(--color-text-muted)',
                      paddingLeft: '2rem',
                      fontStyle: 'italic',
                    }}>
                      No maps
                    </Text>
                  )}

                  {maps.map(map => {
                    const mapOpen  = !!expandedMaps[map.id];
                    const isActive = map.id === activeMapId;
                    const rawPins  = pinsByMap[map.id] || [];
                    const pins     = disambiguatePinLabels(rawPins);

                    return (
                      <div key={map.id}>
                        {/* Map row */}
                        <div
                          className={`notes-sidebar-file${isActive ? ' active' : ''}`}
                          style={{ paddingLeft: '1.8rem' }}
                          onClick={() => { onSelectMap(pt.id, map); }}
                        >
                          {/* Expand/collapse pins toggle */}
                          <Box
                            as="span"
                            display="inline-flex"
                            alignItems="center"
                            onClick={e => { e.stopPropagation(); toggleMap(map.id); }}
                            style={{ flexShrink: 0, cursor: 'pointer' }}
                          >
                            {mapOpen
                              ? <ChevronDownIcon  boxSize={3} />
                              : <ChevronRightIcon boxSize={3} />}
                          </Box>
                          <FiMap size={11} style={{ flexShrink: 0 }} />
                          <Text fontSize="11px" noOfLines={1} flex={1}>
                            {map.name}
                          </Text>
                          {isActive && (
                            <HoldToDelete onDelete={() => onDeleteMap(map.id)} />
                          )}
                        </div>

                        {/* Pins under this map */}
                        {mapOpen && pins.map(pin => (
                          <div
                            key={pin.id}
                            className={`notes-sidebar-file${pin.id === activePinId ? ' active' : ''}`}
                            style={{ paddingLeft: '3rem' }}
                            onClick={() => onSelectPin(pin.id)}
                          >
                            <Box
                              w="8px" h="8px" borderRadius="full" flexShrink={0}
                              background={`var(--color-pin-${parsePinStyle(pin.color).color})`}
                            />
                            <Text fontSize="10px" noOfLines={1} flex={1}>
                              {pin.displayLabel}
                            </Text>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Map Modal ─────────────────────────────────────────────────────────────
// mode: 'create' adds a new map (asks for a name); 'update' swaps the image of an
// existing map (keeps its name, pins and other data) and re-fits the pins.
function NewMapModal({ isOpen, onClose, onConfirm, uploading, gameId, apiBase, mode = 'create' }) {
  const isUpdate = mode === 'update';
  const [name,       setName]       = useState('');
  const [tab,        setTab]        = useState(0);
  const [file,       setFile]       = useState(null);
  const [urlInput,   setUrlInput]   = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedAtt, setSelectedAtt] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setName(''); setFile(null); setUrlInput(''); setSelectedAtt(null); setTab(0);
    api.attachments.list(gameId, 'maps').then(setAttachments).catch(() => {});
  }, [isOpen, gameId]);

  const hasImage  = file || urlInput.trim() || selectedAtt;
  const canSubmit = isUpdate ? hasImage : (name.trim() && hasImage);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}>
        <ModalHeader fontSize="sm">{isUpdate ? 'Update Map Image' : 'Add Map'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {isUpdate ? (
              <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
                Pick a new image for this map. Pins and other data are kept; pin positions
                are re-fitted to the new image.
              </Text>
            ) : (
              <FormControl isRequired>
                <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Map Name</FormLabel>
                <Input size="sm" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. World Map"
                  style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </FormControl>
            )}

            <Tabs index={tab} onChange={setTab} size="sm" variant="enclosed">
              <TabList mb={3}>
                <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                  _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                  _hover={{ color: 'var(--color-text-primary)' }}>Existing</Tab>
                <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                  _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                  _hover={{ color: 'var(--color-text-primary)' }}>Upload</Tab>
                <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                  _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                  _hover={{ color: 'var(--color-text-primary)' }}>URL</Tab>
                <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                  _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                  _hover={{ color: 'var(--color-text-primary)' }}>Camera</Tab>
              </TabList>
              <TabPanels>
                {/* Existing attachments tab */}
                <TabPanel p={0} pt={3}>
                  {attachments.length === 0 ? (
                    <Text fontSize="xs" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      No existing map images
                    </Text>
                  ) : (
                    <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
                      {attachments.map(att => (
                        <Box
                          key={att.id}
                          as="button"
                          borderRadius="md"
                          overflow="hidden"
                          onClick={() => setSelectedAtt(att)}
                          style={{
                            border: selectedAtt?.id === att.id
                              ? '2px solid var(--color-accent)'
                              : '1px solid var(--color-border-subtle)',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                            transition: 'border-color 0.1s',
                          }}>
                          <Box h="72px" overflow="hidden" style={{ background: 'var(--color-bg-page)' }}>
                            <img
                              src={`${apiBase}${att.url}`}
                              alt={att.original_name || att.filename}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Box>
                          <Box px={1} py={0.5}>
                            <Text fontSize="9px" noOfLines={1} style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                              {att.original_name || att.filename}
                            </Text>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </TabPanel>

                {/* Upload tab */}
                <TabPanel p={0}>
                  <Box
                    as="label" htmlFor="map-upload"
                    display="flex" flexDirection="column" alignItems="center" justifyContent="center"
                    py={6} cursor="pointer"
                    style={{
                      background: 'var(--color-bg-subtle)',
                      border: '2px dashed var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <FiUpload size={24} style={{ marginBottom: '0.5rem' }} />
                    <Text fontSize="sm">{file ? file.name : 'Click to upload image'}</Text>
                    <input id="map-upload" type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => setFile(e.target.files[0] || null)} />
                  </Box>
                </TabPanel>

                {/* URL tab */}
                <TabPanel p={0} pt={3}>
                  <FormControl>
                    <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Image URL</FormLabel>
                    <Input size="sm" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://..."
                      style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </FormControl>
                </TabPanel>

                {/* Camera tab */}
                <TabPanel p={0} pt={3}>
                  <CameraCapture active={isOpen && tab === 3} onCapture={setFile} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            <Button size="sm" variant="ghost" onClick={onClose}
              style={{ color: 'var(--color-text-secondary)' }}>
              Cancel
            </Button>
            <Button size="sm" isLoading={uploading} loadingText={isUpdate ? 'Updating…' : 'Uploading…'} spinnerPlacement="start"
              isDisabled={!canSubmit}
              onClick={() => onConfirm({
                name: name.trim(),
                attachmentId: tab === 0 ? selectedAtt?.id : undefined,
                file: (tab === 1 || tab === 3) ? file : null,
                url: tab === 2 ? urlInput.trim() : null,
              })}
              style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
            >
              {isUpdate ? 'Update Image' : (tab === 0 ? 'Use Image' : 'Upload')}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MapPage({ params }) {
  const { id, ptId: initialPtId } = params;
  const toast   = useToast();
  const { user } = useAuth();
  const [apiBase, setApiBase] = useState('');
  const { visitMap } = useLastVisited();
  const { mapState, setMapState } = useTabState();
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const imgRef      = useRef(null);
  const mapStateRef = useRef(mapState);
  mapStateRef.current = mapState;

  // ── Data state ──────────────────────────────────────────────────────────────
  const [game,         setGame]         = useState(null);
  const [playthroughs, setPlaythroughs] = useState([]);
  const [mapsByPt,     setMapsByPt]     = useState({});
  const [pinsByMap,    setPinsByMap]    = useState({});
  const [mapDefaults,  setMapDefaults]  = useState([]); // [{ icon, color, label, category, trackable }]
  const [loading,      setLoading]      = useState(true);

  // ── Legend / visibility state ───────────────────────────────────────────────
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set()); // "color:icon" keys hidden on the map
  const [legendScope, setLegendScope] = useState('map');  // 'map' | 'pt' — which counts the legend shows
  const [legendQuery, setLegendQuery] = useState('');     // legend search text
  const [mapsOpen,    setMapsOpen]    = useState(true);   // sidebar "Maps" section expanded
  const [legendOpen,  setLegendOpen]  = useState(true);   // sidebar "Legend" section expanded

  // ── Active selection (persisted via TabStateContext) ────────────────────────
  const [openPinId, setOpenPinId] = useState(null);

  const [recentOpen, setRecentOpen] = useState(false);

  const activeMap   = mapState.activeMap;
  const activePtId  = mapState.activePtId;
  const activePinId = mapState.activePinId;

  const setActiveMap   = (map) => setMapState((s) => ({ ...s, activeMap: map ?? null, activeMapId: map?.id ?? null }));
  const setActivePtId  = (val) => setMapState((s) => ({ ...s, activePtId: val }));
  const setActivePinId = (val) => setMapState((s) => ({ ...s, activePinId: val }));

  // ── Tool mode: 'none' | 'pin' | 'path' ────────────────────────────────────
  const [toolMode, setToolMode] = useState('none');

  // ── Pin placement — modal flow ─────────────────────────────────────────────
  const [pendingPin,      setPendingPin]      = useState(null); // { x_percent, y_percent }
  const [showPinModal,    setShowPinModal]    = useState(false);
  const [editingPin, setEditingPin] = useState(null); // pin object being edited

  // ── Pin dragging (pin mode only) ────────────────────────────────────────────
  const [draggingPin,  setDraggingPin]  = useState(null); // { pinId, x_percent, y_percent }
  const draggingRef = useRef(null); // mirrors draggingPin for event handlers
  const justDraggedRef = useRef(false); // true right after a move, to swallow the trailing click

  // ── Path drawing ───────────────────────────────────────────────────────────
  // Only one path at a time; stored as array of { x_percent, y_percent, id }
  const [pathWaypoints, setPathWaypoints] = useState([]);

  // ── Upload modal ─────────────────────────────────────────────────────────────
  const [newMapPtId, setNewMapPtId] = useState(null);
  const [uploading,  setUploading]  = useState(false);

  // ── Update-image modal ───────────────────────────────────────────────────────
  const [updatingImage, setUpdatingImage] = useState(false); // modal open flag
  const [savingImage,    setSavingImage]   = useState(false); // in-flight flag

  // ── Register last visited ───────────────────────────────────────────────────
  useEffect(() => {
    if (game) visitMap(id, initialPtId, game.title, game.cover_url ?? null);
  }, [game]);

  // ── Load all playthroughs + their maps ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [g, pts] = await Promise.all([
          api.games.get(id),
          api.playthroughs.list(id),
        ]);
        setGame(g);
        setPlaythroughs(pts);

        const mapLists = await Promise.all(pts.map(pt => api.maps.list(pt.id)));
        const byPt = {};
        pts.forEach((pt, i) => { byPt[pt.id] = mapLists[i]; });
        setMapsByPt(byPt);

        const allMaps    = Object.values(byPt).flat();

        // Eager-load pins for every map so the sidebar tree and the per-game
        // pin statistics are accurate without waiting for each map to be opened.
        const pinLists = await Promise.all(allMaps.map(m => api.pins.list(m.id).catch(() => [])));
        const pinsObj = {};
        allMaps.forEach((m, i) => { pinsObj[m.id] = pinLists[i]; });
        setPinsByMap(pinsObj);

        const savedMapId = mapStateRef.current.activeMapId;
        const restoredMap = savedMapId != null
          ? allMaps.find((m) => m.id == savedMapId)
          : null;

        if (restoredMap) {
          const restoredPtId = Object.keys(byPt).find((ptId) =>
            byPt[ptId].some((m) => m.id === restoredMap.id)
          );
          setActivePtId(restoredPtId);
        } else {
          const initialPt = pts.find(p => String(p.id) === String(initialPtId)) ?? pts[0];
          if (initialPt) {
            const firstMap = byPt[initialPt.id]?.[0];
            if (firstMap) await selectMap(initialPt.id, firstMap, byPt);
          }
        }
      } catch (err) {
        toast({ title: 'Failed to load', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  useEffect(() => { getApiBase().then(setApiBase).catch(() => {}); }, []);

  // ── Load the per-game map defaults (type:color:label:category:trackable) ─────
  useEffect(() => {
    if (!user) return;
    api.settings.get(`map_defaults_${id}`)
      .then(val => setMapDefaults(Array.isArray(val) ? val : []))
      .catch(() => {});
  }, [id, user]);

  // ── Load the per-game hidden pin types from settings ────────────────────────
  useEffect(() => {
    if (!user) return;
    api.settings.get(`map_hidden_types_${id}`)
      .then(val => setHiddenTypes(new Set(Array.isArray(val) ? val : [])))
      .catch(() => {});
  }, [id, user]);

  // Persist the hidden-types set (per game) and update local state in one step.
  const applyHiddenTypes = (nextSet) => {
    setHiddenTypes(nextSet);
    api.settings.set(`map_hidden_types_${id}`, [...nextSet]).catch(() => {});
  };

  const toggleTypeHidden = (key) => {
    const next = new Set(hiddenTypes);
    if (next.has(key)) next.delete(key); else next.add(key);
    applyHiddenTypes(next);
  };

  // ── Select a map — loads its pins ──────────────────────────────────────────
  const selectMap = async (ptId, map, currentMapsByPt = mapsByPt) => {
    setActiveMap(map);
    setActivePtId(ptId);
    setActivePinId(null);
    setOpenPinId(null);
    setToolMode('none');
    setPendingPin(null);
    setShowPinModal(false);
    setPathWaypoints([]);

    if (!pinsByMap[map.id]) {
      try {
        const pinsData = await api.pins.list(map.id);
        setPinsByMap(prev => ({ ...prev, [map.id]: pinsData }));
      } catch (err) {
        toast({ title: 'Failed to load pins', description: err.message, status: 'error', duration: 3000 });
      }
    }
  };

  // ── Select a pin from sidebar ───────────────────────────────────────────────
  const handleSelectPin = (pinId) => {
    setActivePinId(pinId);
    setOpenPinId(pinId);
  };

  // ── Create map ──────────────────────────────────────────────────────────────
  const handleCreateMap = async ({ name, attachmentId, file, url }) => {
    if (!newMapPtId) return;
    setUploading(true);
    let created = null;
    try {
      let attachmentIdToUse = attachmentId;
      if (!attachmentIdToUse) {
        const attachment = file
          ? await api.attachments.upload(id, 'maps', file)
          : await api.attachments.fromUrl(id, 'maps', url);
        attachmentIdToUse = attachment.id;
      }
      created = await api.maps.create(newMapPtId, { name, attachment_id: attachmentIdToUse });
    } catch (err) {
      toast({ title: 'Failed to create map', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setUploading(false);
      if (created) {
        setMapsByPt(prev => ({ ...prev, [newMapPtId]: [...(prev[newMapPtId] || []), created] }));
        await selectMap(newMapPtId, created);
        setNewMapPtId(null);  // ← modal closes only after spinner has been visible
      }
    }
  };

  // ── Update map image ──────────────────────────────────────────────────────────
  // Resolves the chosen image to an attachment, re-fits the existing pins to the
  // new image's dimensions, then swaps the image. Pins and other map data are kept.
  const handleUpdateMapImage = async ({ attachmentId, file, url }) => {
    if (!activeMap) return;
    const mapId = activeMap.id;
    setSavingImage(true);
    let done = false;
    try {
      // 1. Resolve the new image to an attachment (same flow as map creation).
      //    Upload/URL return the record directly; an existing pick needs a lookup.
      let attachmentIdToUse = attachmentId;
      let newAttUrl = null;
      if (!attachmentIdToUse) {
        const attachment = file
          ? await api.attachments.upload(id, 'maps', file)
          : await api.attachments.fromUrl(id, 'maps', url);
        attachmentIdToUse = attachment.id;
        newAttUrl = attachment.url;
      } else {
        const existing = (await api.attachments.list(id, 'maps')).find(a => a.id === attachmentIdToUse);
        newAttUrl = existing?.url ?? null;
      }

      // 2. Measure both images so pins can be re-fitted to the new aspect ratio.
      const oldSize = imgRef.current?.naturalWidth
        ? { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight }
        : null;
      let newSize = null;
      if (newAttUrl) {
        try { newSize = await loadImageSize(`${apiBase}${newAttUrl}`); } catch { /* keep percentages */ }
      }

      const currentPins = pinsByMap[mapId] || [];
      const refitted = refitPins(currentPins, oldSize, newSize);

      // 3. Persist the swap + new pin positions in one call.
      const updated = await api.maps.updateImage(mapId, {
        attachment_id: attachmentIdToUse,
        pins: refitted,
      });

      // 4. Reflect the change locally.
      const refitById = new Map(refitted.map(p => [p.id, p]));
      setPinsByMap(prev => ({
        ...prev,
        [mapId]: (prev[mapId] || []).map(p => {
          const r = refitById.get(p.id);
          return r ? { ...p, x_percent: r.x_percent, y_percent: r.y_percent } : p;
        }),
      }));
      const newImageUrl = updated.image_url;
      setMapState(s => ({
        ...s,
        activeMap: s.activeMap?.id === mapId ? { ...s.activeMap, image_url: newImageUrl } : s.activeMap,
      }));
      setMapsByPt(prev => {
        const next = { ...prev };
        for (const ptId of Object.keys(next)) {
          next[ptId] = next[ptId].map(m => m.id === mapId ? { ...m, image_url: newImageUrl } : m);
        }
        return next;
      });
      done = true;
    } catch (err) {
      toast({ title: 'Failed to update image', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setSavingImage(false);
      if (done) setUpdatingImage(false);
    }
  };

  // ── Delete map ──────────────────────────────────────────────────────────────
  const handleDeleteMap = async (mapId) => {
    try {
      await api.maps.delete(mapId);

      const ptId = Object.keys(mapsByPt).find(ptId =>
        mapsByPt[ptId].some(m => m.id === mapId)
      );

      setMapsByPt(prev => {
        const next = { ...prev };
        if (ptId) next[ptId] = prev[ptId].filter(m => m.id !== mapId);
        return next;
      });
      setPinsByMap(prev => { const next = { ...prev }; delete next[mapId]; return next; });

      if (activeMap?.id === mapId) {
        const remaining = (mapsByPt[ptId] || []).filter(m => m.id !== mapId);
        if (remaining.length > 0) {
          await selectMap(ptId, remaining[0]);
        } else {
          setActiveMap(null);
          setActivePtId(null);
        }
      }
    } catch (err) {
      toast({ title: 'Failed to delete map', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Map click ───────────────────────────────────────────────────────────────
  const handleMapClick = (e) => {
    if (!imgRef.current) return;
    // Don't open pin modal if we just finished dragging
    if (draggingRef.current) return;
    setOpenPinId(null);
    setActivePinId(null);
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left)  / rect.width)  * 100;
    const y = ((e.clientY - rect.top)   / rect.height) * 100;

    if (toolMode === 'pin') {
      setPendingPin({ x_percent: x, y_percent: y });
      setShowPinModal(true);
      // defaultLabel is computed inline in the JSX via activePins.length
    } else if (toolMode === 'path') {
      const newWp = { x_percent: x, y_percent: y, id: Date.now() };
      setPathWaypoints(prev => [...prev, newWp]);
    }
  };

  // ── Right-click anywhere on the map to add a pin (no tool mode needed) ───────
  const handleMapContextMenu = (e) => {
    if (!imgRef.current || !activeMap) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    // Only intercept right-clicks that land on the map image itself.
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    e.preventDefault();
    setOpenPinId(null);
    setActivePinId(null);
    setEditingPin(null);
    setPendingPin({ x_percent: x, y_percent: y });
    setShowPinModal(true);
  };

  // ── Save pin from modal ─────────────────────────────────────────────────────
  const handleAddPin = async ({ label, description, color }) => {
    try {
      const pin = await api.pins.create(activeMap.id, {
        ...pendingPin,
        label,
        description,
        color,
      });
      setPinsByMap(prev => ({ ...prev, [activeMap.id]: [...(prev[activeMap.id] || []), pin] }));
      setPendingPin(null);
      setShowPinModal(false);
      // Stay in pin mode so user can keep adding pins
    } catch (err) {
      toast({ title: 'Failed to save pin', description: err.message, status: 'error', duration: 3000 });
      throw err; // let modal know to stop loading
    }
  };

  const handleCancelPinModal = () => {
    setPendingPin(null);
    setShowPinModal(false);
  };

  // ── Edit existing pin ───────────────────────────────────────────────────────
  const handleEditPin = async ({ label, description, color }) => {
    try {
      const updated = await api.pins.update(activeMap.id, editingPin.id, { label, description, color });
      setPinsByMap(prev => ({
        ...prev,
        [activeMap.id]: prev[activeMap.id].map(p => p.id === updated.id ? updated : p),
      }));
      setEditingPin(null);
    } catch (err) {
      toast({ title: 'Failed to update pin', description: err.message, status: 'error', duration: 3000 });
      throw err;
    }
  };

  const openEditPin = (pin) => {
    setEditingPin(pin);
  };

  // ── Save an inline-edited pin note/description (from the bubble) ────────────
  const handleSaveDescription = async (pin, text) => {
    const next = (text || '').trim();
    if (next === (pin.description || '')) return; // unchanged
    setPinsByMap(prev => ({
      ...prev,
      [activeMap.id]: (prev[activeMap.id] || []).map(p => p.id === pin.id ? { ...p, description: next || null } : p),
    }));
    try {
      await api.pins.update(activeMap.id, pin.id, {
        label: pin.label, description: next || null, color: pin.color,
      });
    } catch (err) {
      setPinsByMap(prev => ({
        ...prev,
        [activeMap.id]: (prev[activeMap.id] || []).map(p => p.id === pin.id ? { ...p, description: pin.description } : p),
      }));
      toast({ title: 'Failed to save note', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Toggle a pin's "found" progress flag (trackable types only) ─────────────
  const handleToggleFound = async (pin) => {
    const next = !pin.found;
    // Optimistic local update
    setPinsByMap(prev => ({
      ...prev,
      [activeMap.id]: (prev[activeMap.id] || []).map(p => p.id === pin.id ? { ...p, found: next } : p),
    }));
    try {
      await api.pins.update(activeMap.id, pin.id, {
        label: pin.label, description: pin.description, color: pin.color, found: next,
      });
    } catch (err) {
      // Revert on failure
      setPinsByMap(prev => ({
        ...prev,
        [activeMap.id]: (prev[activeMap.id] || []).map(p => p.id === pin.id ? { ...p, found: pin.found } : p),
      }));
      toast({ title: 'Failed to update progress', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Delete pin ──────────────────────────────────────────────────────────────
  const handleDeletePin = async (pinId) => {
    try {
      await api.pins.delete(activeMap.id, pinId);
      setPinsByMap(prev => ({
        ...prev,
        [activeMap.id]: prev[activeMap.id].filter(p => p.id !== pinId),
      }));
      if (activePinId === pinId) setActivePinId(null);
      if (openPinId   === pinId) setOpenPinId(null);
    } catch (err) {
      toast({ title: 'Failed to delete pin', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Pin drag ────────────────────────────────────────────────────────────────
  // Works in "pin" tool mode and for the currently-selected pin in normal mode.
  // Movement is tracked so a plain click (no drag) neither saves nor is mistaken
  // for a drag by the click handler.
  const handlePinDragStart = (e, pin) => {
    e.stopPropagation();
    e.preventDefault();
    const info = { pinId: pin.id, x_percent: pin.x_percent, y_percent: pin.y_percent, moved: false };
    draggingRef.current = info;
    setDraggingPin(info);
  };

  const handleContainerMouseMove = (e) => {
    if (!draggingRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100));
    const updated = { ...draggingRef.current, x_percent: x, y_percent: y, moved: true };
    draggingRef.current = updated;
    setDraggingPin({ ...updated });
    setPinsByMap(prev => ({
      ...prev,
      [activeMap.id]: (prev[activeMap.id] || []).map(p =>
        p.id === updated.pinId ? { ...p, x_percent: x, y_percent: y } : p
      ),
    }));
  };

  const handleContainerMouseUp = async () => {
    if (!draggingRef.current) return;
    const { pinId, x_percent, y_percent, moved } = draggingRef.current;
    draggingRef.current = null;
    setDraggingPin(null);
    // A click without movement isn't a move — don't persist, and let the click
    // handler run normally.
    if (!moved) return;
    justDraggedRef.current = true; // suppress the click that follows the drag
    try {
      const pin = (pinsByMap[activeMap.id] || []).find(p => p.id === pinId);
      if (!pin) return;
      await api.pins.update(activeMap.id, pinId, {
        label: pin.label,
        description: pin.description,
        color: pin.color,
        x_percent,
        y_percent,
      });
    } catch (err) {
      toast({ title: 'Failed to move pin', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Delete waypoint ─────────────────────────────────────────────────────────
  const handleDeleteWaypoint = (wpId) => {
    setPathWaypoints(prev => prev.filter(wp => wp.id !== wpId));
  };

  // ── Toggle tool mode ────────────────────────────────────────────────────────
  const toggleTool = (mode) => {
    setToolMode(prev => {
      if (prev === mode) {
        // Deactivate
        draggingRef.current = null;
        setDraggingPin(null);
        setPendingPin(null);
        setShowPinModal(false);
        return 'none';
      }
      // Switch mode — clear path if switching away from path
      if (mode !== 'path') setPathWaypoints([]);
      setPendingPin(null);
      setShowPinModal(false);
      return mode;
    });
  };

  if (!user) return (
    <>
      <Navbar />
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in to view maps.</Text>
      </div>
    </>
  );

  const activePins = activeMap ? (pinsByMap[activeMap.id] || []) : [];
  const currentPtPins = (mapsByPt[activePtId] || []).flatMap(m => pinsByMap[m.id] || []);

  const typeKey = (color, icon) => `${color}:${icon}`;

  // Pin types configured as progress-trackable (Settings → "Track").
  const trackableKeys = new Set(
    mapDefaults.filter(d => d.trackable).map(d => typeKey(d.color, d.icon))
  );

  // ── Legend data ───────────────────────────────────────────────────────────
  // One entry per pin *type* (color:icon): every configured default (even when
  // count is 0) plus any non-default type actually present, tallied for the given
  // pin set. Each entry carries count and "found" (for trackable types).
  const OTHER_CAT = 'OTHER';
  const buildLegend = (pins) => {
    const defaultKeys = new Set(mapDefaults.map(d => typeKey(d.color, d.icon)));
    const tally = new Map(); // key -> { count, found, labels:Map, color, icon }
    pins.forEach(p => {
      const s = parsePinStyle(p.color);
      const key = typeKey(s.color, s.icon);
      if (!tally.has(key)) tally.set(key, { count: 0, found: 0, labels: new Map(), color: s.color, icon: s.icon });
      const t = tally.get(key);
      t.count++;
      if (p.found) t.found++;
      t.labels.set(p.label, (t.labels.get(p.label) || 0) + 1);
    });

    const entries = [];
    mapDefaults.forEach(d => {
      const key = typeKey(d.color, d.icon);
      const t = tally.get(key);
      entries.push({
        key, color: d.color, icon: d.icon,
        name: d.label,
        category: (d.category || '').trim() || OTHER_CAT,
        trackable: !!d.trackable,
        count: t ? t.count : 0,
        found: t ? t.found : 0,
      });
    });
    tally.forEach((t, key) => {
      if (defaultKeys.has(key)) return;
      let name = ''; let max = -1;
      t.labels.forEach((n, lbl) => { if (n > max) { max = n; name = lbl; } });
      entries.push({
        key, color: t.color, icon: t.icon, name,
        category: OTHER_CAT, trackable: false,
        count: t.count, found: 0,
      });
    });
    return entries;
  };

  const legendPins    = legendScope === 'pt' ? currentPtPins : activePins;
  const legendEntries = buildLegend(legendPins);
  const allTypeKeys   = legendEntries.map(e => e.key);

  // Category order = first appearance in mapDefaults, OTHER always last.
  const catOrder = [];
  mapDefaults.forEach(d => {
    const c = (d.category || '').trim() || OTHER_CAT;
    if (c !== OTHER_CAT && !catOrder.includes(c)) catOrder.push(c);
  });
  catOrder.push(OTHER_CAT);

  const q = legendQuery.trim().toLowerCase();
  const legendGroups = catOrder
    .map(cat => ({
      category: cat,
      rows: legendEntries.filter(e =>
        e.category === cat &&
        (!q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      ),
    }))
    .filter(g => g.rows.length > 0);

  const showAllTypes = () => applyHiddenTypes(new Set());
  const hideAllTypes = () => applyHiddenTypes(new Set(allTypeKeys));

  // Pins visible on the canvas after applying the per-type visibility filter.
  const visibleActivePins = activePins.filter(p => {
    const s = parsePinStyle(p.color);
    return !hiddenTypes.has(typeKey(s.color, s.icon));
  });

  // Build SVG polyline points string from waypoints
  const buildPolylinePoints = (waypoints, containerRect) => {
    if (!containerRect || waypoints.length < 2) return '';
    return waypoints
      .map(wp => `${wp.x_percent}% ${wp.y_percent}%`)
      .join(', ');
  };

  return (
    <>
      <style>{`
        @keyframes pin-ghost-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.5; }
          50%       { transform: translate(-50%, -50%) scale(1.6); opacity: 0.15; }
        }
      `}</style>
      <Navbar />
      <GameTabBar gameId={id} ptId={activePtId || initialPtId} hasPlaythroughs={loading || playthroughs.length > 0} />
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />

      <div className="notes-workspace map-workspace">

        {/* ── Left: collapsible Maps + Legend sidebar ── */}
        {loading ? null : (
          <div className="map-sidebar">

            {/* MAPS section — playthrough → map tree */}
            <div className={`map-sidebar-section${mapsOpen ? ' open' : ''}`}>
              <button className="map-sidebar-section-header" onClick={() => setMapsOpen(o => !o)}>
                {mapsOpen ? <ChevronDownIcon boxSize={3} /> : <ChevronRightIcon boxSize={3} />}
                <FiFolder size={12} />
                <span>Maps</span>
              </button>
              {mapsOpen && (
                <div className="map-sidebar-section-body map-sidebar-maps">
                  <Sidebar
                    game={game}
                    playthroughs={playthroughs}
                    mapsByPt={mapsByPt}
                    pinsByMap={pinsByMap}
                    activeMapId={activeMap?.id}
                    activePinId={activePinId}
                    onSelectMap={selectMap}
                    onSelectPin={handleSelectPin}
                    onNewMap={(ptId) => setNewMapPtId(ptId)}
                    onDeleteMap={handleDeleteMap}
                    initialPtId={initialPtId}
                    onOpenGame={() => setGameModalOpen(true)}
                    gameId={id}
                  />
                </div>
              )}
            </div>

            {/* LEGEND section — pin types, visibility, progress */}
            <div className={`map-sidebar-section${legendOpen ? ' open' : ''}`}>
              <button className="map-sidebar-section-header" onClick={() => setLegendOpen(o => !o)}>
                {legendOpen ? <ChevronDownIcon boxSize={3} /> : <ChevronRightIcon boxSize={3} />}
                <FiList size={12} />
                <span>Legend</span>
              </button>
              {legendOpen && (
                <div className="map-sidebar-section-body">
                  <div className="map-legend-header">
                    <div className="map-legend-actions">
                      <button className="map-legend-action" onClick={showAllTypes}>SHOW ALL</button>
                      <button className="map-legend-action" onClick={hideAllTypes}>HIDE ALL</button>
                    </div>
                    <input
                      className="map-legend-search"
                      placeholder="Search…"
                      value={legendQuery}
                      onChange={e => setLegendQuery(e.target.value)}
                    />
                    <div className="map-legend-scope">
                      <button className={legendScope === 'map' ? 'active' : ''} onClick={() => setLegendScope('map')}>Map</button>
                      <button className={legendScope === 'pt'  ? 'active' : ''} onClick={() => setLegendScope('pt')}>Playthrough</button>
                    </div>
                    <div className="map-legend-tip">Tip: right-click the map to add a pin.</div>
                  </div>

                  <div className="map-legend-body">
                    {legendGroups.length === 0 ? (
                      <div className="map-legend-empty">
                        No pin types yet. Configure default markers in Settings, or place pins on the map.
                      </div>
                    ) : legendGroups.map(group => (
                      <div key={group.category} className="map-legend-group">
                        <div className="map-legend-cat">{group.category}</div>
                        {group.rows.map(row => {
                          const hidden = hiddenTypes.has(row.key);
                          return (
                            <button
                              key={row.key}
                              className={`map-legend-row${hidden ? ' map-legend-row--hidden' : ''}`}
                              onClick={() => toggleTypeHidden(row.key)}
                              title={hidden ? 'Hidden — click to show' : 'Click to hide'}
                            >
                              <span className="map-legend-row-icon">
                                <PinIcon color={row.color} icon={row.icon} size={16} />
                              </span>
                              <span className="map-legend-row-name">{row.name || '(unnamed)'}</span>
                              <span className="map-legend-row-count">
                                {row.trackable ? `${row.found}/${row.count}` : row.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Right: Canvas area ── */}
        <div className="notes-editor-area">
          {loading ? (
            <Flex justify="center" align="center" height="100%">
              <Spinner style={{ color: 'var(--color-accent)' }} />
            </Flex>
          ) : (
            <>
              {/* Topbar */}
              <div className="notes-editor-topbar">
                <HStack spacing={2}>
                  <FiMap size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
                    {activeMap?.name ?? 'No map selected'}
                  </Text>

                  {/* Quick access toolbar — inline after filename */}
                  {activeMap && (
                    <HStack spacing={1} ml={1}>
                      <Tooltip label={toolMode === 'pin' ? 'Cancel Pin' : 'Add Pin'} hasArrow placement="bottom" openDelay={300}>
                        <IconButton
                          icon={<TbMapPin size={15} />}
                          size="xs"
                          aria-label="Add Pin"
                          onClick={() => toggleTool('pin')}
                          style={{
                            background: toolMode === 'pin' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                            color: toolMode === 'pin' ? 'white' : 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                          }}
                        />
                      </Tooltip>
                      <Tooltip label={toolMode === 'path' ? 'Finish Path' : 'Create Path'} hasArrow placement="bottom" openDelay={300}>
                        <IconButton
                          icon={<TbRoute size={15} />}
                          size="xs"
                          aria-label="Create Path"
                          onClick={() => toggleTool('path')}
                          style={{
                            background: toolMode === 'path' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                            color: toolMode === 'path' ? 'white' : 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                          }}
                        />
                      </Tooltip>

                      {/* Update map image — keeps pins & data */}
                      <Tooltip label="Update image" hasArrow placement="bottom" openDelay={300}>
                        <IconButton
                          icon={<FiImage size={14} />}
                          size="xs"
                          aria-label="Update image"
                          onClick={() => setUpdatingImage(true)}
                          style={{
                            background: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border)',
                          }}
                        />
                      </Tooltip>

                    </HStack>
                  )}
                </HStack>
              </div>

              {/* Canvas */}
              <Box flex={1} overflow="auto" p={4}>
                {!activeMap ? (
                  <Flex
                    direction="column" align="center" justify="center"
                    height="100%"
                    style={{
                      color: 'var(--color-text-muted)',
                      border: '2px dashed var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <FiMap size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                    <Text fontSize="sm">No map selected.</Text>
                    <Text fontSize="xs" mt={1}>In the <strong>Maps</strong> section on the left, click + on a playthrough to add a map.</Text>
                  </Flex>

                ) : (
                  <Box>
                    {/* Mode hint banner */}
                    {toolMode !== 'none' && (
                      <Box mb={2} px={3} py={2} borderRadius="md" style={{
                        background: 'var(--color-accent-subtle)',
                        border: '1px solid var(--color-accent)',
                        color: 'var(--color-accent)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span>
                          {toolMode === 'pin'
                            ? 'Click anywhere on the map to place a pin'
                            : pathWaypoints.length === 0
                              ? 'Click to set the start of the path'
                              : `${pathWaypoints.length} waypoint${pathWaypoints.length > 1 ? 's' : ''} — keep clicking to add more`}
                        </span>
                        <Box
                          as="button"
                          onClick={() => toggleTool(toolMode)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-accent)', display: 'flex', alignItems: 'center',
                          }}
                        >
                          <FiX size={14} />
                        </Box>
                      </Box>
                    )}

                    <div
                      className="map-container"
                      onClick={handleMapClick}
                      onContextMenu={handleMapContextMenu}
                      onMouseMove={handleContainerMouseMove}
                      onMouseUp={handleContainerMouseUp}
                      onMouseLeave={handleContainerMouseUp}
                      style={{ cursor: draggingPin ? 'grabbing' : toolMode !== 'none' ? 'crosshair' : 'default' }}
                    >
                      {/* Resizable wrapper */}
                      <div className="map-image-resizer">
                        <img
                          ref={imgRef}
                          src={`${apiBase}${activeMap.image_url}`}
                          alt={activeMap.name}
                          className="map-image"
                          draggable={false}
                        />
                      </div>

                      {/* Path polyline (SVG overlay using normalized 0-100 viewBox) */}
                      {pathWaypoints.length >= 2 && (
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          style={{
                            position: 'absolute',
                            top: 0, left: 0,
                            width: '100%', height: '100%',
                            pointerEvents: 'none',
                            zIndex: 5,
                          }}
                        >
                          <polyline
                            points={pathWaypoints.map(wp => `${wp.x_percent},${wp.y_percent}`).join(' ')}
                            fill="none"
                            stroke="var(--color-accent)"
                            strokeWidth="0.6"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      )}

                      {/* Path waypoints */}
                      {pathWaypoints.map((wp, idx) => (
                        <Popover
                          key={wp.id}
                          placement="top"
                          closeOnBlur
                          offset={[0, 4]}
                        >
                          <PopoverTrigger>
                            <div
                              style={{
                                position: 'absolute',
                                left: `${wp.x_percent}%`,
                                top:  `${wp.y_percent}%`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 15,
                                cursor: 'pointer',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: idx === 0 ? 'var(--color-success, #48bb78)' : 'var(--color-accent)',
                                border: '2px solid white',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Text fontSize="8px" style={{ color: 'white', fontWeight: 700, lineHeight: 1, userSelect: 'none' }}>
                                {idx + 1}
                              </Text>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="map-pin-popover"
                            style={{ color: 'var(--color-text-primary)', maxWidth: '160px' }}
                          >
                            <PopoverBody>
                              <Flex align="center" justify="space-between" gap={2}>
                                <Text fontSize="xs">
                                  {idx === 0 ? 'Start' : idx === pathWaypoints.length - 1 ? 'End' : `Waypoint ${idx + 1}`}
                                </Text>
                                <IconButton
                                  icon={<FiTrash2 size={11} />}
                                  size="xs"
                                  variant="ghost"
                                  aria-label="Delete waypoint"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteWaypoint(wp.id); }}
                                  style={{ color: 'var(--color-danger)', minWidth: '22px', height: '22px' }}
                                />
                              </Flex>
                            </PopoverBody>
                          </PopoverContent>
                        </Popover>
                      ))}

                      {/* Ghost dot — shows where pin will land while modal is open */}
                      {pendingPin && (
                        <div style={{
                          position: 'absolute',
                          left: `${pendingPin.x_percent}%`,
                          top:  `${pendingPin.y_percent}%`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 20,
                          pointerEvents: 'none',
                        }}>
                          {/* Outer pulse ring */}
                          <div style={{
                            position: 'absolute',
                            width: '24px', height: '24px',
                            borderRadius: '50%',
                            top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            border: '2px solid var(--color-accent)',
                            opacity: 0.5,
                            animation: 'pin-ghost-pulse 1.2s ease-in-out infinite',
                          }} />
                          {/* Inner dot */}
                          <div style={{
                            width: '10px', height: '10px',
                            borderRadius: '50%',
                            background: 'var(--color-accent)',
                            border: '2px solid white',
                            boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
                          }} />
                        </div>
                      )}

                      {/* Placed pins */}
                      {disambiguatePinLabels(visibleActivePins).map(pin => {
                        const isDragging = draggingPin?.pinId === pin.id;
                        const { color: pinColor, icon: pinIcon } = parsePinStyle(pin.color);
                        const isHovered = openPinId === pin.id;
                        const isTrackable = trackableKeys.has(typeKey(pinColor, pinIcon));
                        const isFound = !!pin.found;
                        // Draggable in pin tool mode, or when this pin is the selected one.
                        const isDraggable = toolMode === 'pin' || isHovered;
                        return (
                          <div
                            key={pin.id}
                            className={`map-pin${isFound ? ' map-pin--found' : ''}`}
                            style={{
                              left: `${pin.x_percent}%`,
                              top: `${pin.y_percent}%`,
                              transform: 'translate(-50%, -50%)',
                              cursor: isDragging ? 'grabbing' : (isDraggable ? 'grab' : 'pointer'),
                              opacity: isDragging ? 0.85 : (isFound ? 0.45 : 1),
                              filter: isDragging ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : undefined,
                              zIndex: isDragging ? 50 : isHovered ? 30 : undefined,
                            }}
                            onMouseDown={isDraggable ? (e) => {
                              handlePinDragStart(e, pin);
                              if (toolMode === 'pin') setOpenPinId(null);
                            } : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (justDraggedRef.current) { justDraggedRef.current = false; return; }
                              if (toolMode === 'pin') { openEditPin(pin); return; }
                              setOpenPinId(prev => prev === pin.id ? null : pin.id);
                              setActivePinId(pin.id);
                            }}
                          >
                            <PinIcon color={pinColor} icon={pinIcon} />
                            {/* Found check badge */}
                            {isFound && (
                              <span className="map-pin-found-badge"><FiCheck size={9} /></span>
                            )}
                            {/* Pin tooltip */}
                            {isHovered && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(100% + 8px)',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  zIndex: 100,
                                  pointerEvents: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',

                                }}
                              >
                                {/* Callout */}
                                <div style={{
                                  background: 'rgba(10, 10, 14, 0.88)',
                                  backdropFilter: 'blur(10px)',
                                  WebkitBackdropFilter: 'blur(10px)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: '7px',
                                  minWidth: '120px',
                                  maxWidth: '200px',
                                  cursor: 'default',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                  overflow: 'hidden',
                                }}>
                                  {/* Header row: label + action buttons */}

                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '6px',
                                    padding: '4px 4px 4px 8px',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                  }}>
                                    <div style={{ fontWeight: 600, fontSize: '10px', lineHeight: 1.3, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                      {pin.displayLabel}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                      {isTrackable && (
                                        <Tooltip label={isFound ? 'Found — click to unmark' : 'Mark as found'} hasArrow placement="top" openDelay={400}>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleFound(pin); }}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                              width: '22px', height: '22px', borderRadius: '4px',
                                              background: isFound ? 'var(--color-accent)' : 'transparent',
                                              border: 'none',
                                              color: isFound ? 'white' : 'rgba(255,255,255,0.45)',
                                              cursor: 'pointer',
                                              transition: 'color 0.15s, background 0.15s',
                                            }}
                                            onMouseEnter={e => { if (!isFound) { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; } }}
                                            onMouseLeave={e => { if (!isFound) { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; } }}
                                          >
                                            <FiCheck size={11} />
                                          </button>
                                        </Tooltip>
                                      )}
                                      <Tooltip label="Edit" hasArrow placement="top" openDelay={400}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openEditPin(pin); }}
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            width: '22px', height: '22px', borderRadius: '4px',
                                            background: 'transparent', border: 'none',
                                            color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                                            transition: 'color 0.15s, background 0.15s',
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent'; }}
                                        >
                                          <FiEdit2 size={10} />
                                        </button>
                                      </Tooltip>
                                      <HoldToDelete onDelete={() => handleDeletePin(pin.id)} inMap />
                                    </div>
                                  </div>
                                  {/* Editable description / note */}
                                  <textarea
                                    key={pin.id}
                                    className="map-pin-note"
                                    defaultValue={pin.description || ''}
                                    placeholder="Add a note…"
                                    rows={2}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={(e) => handleSaveDescription(pin, e.target.value)}
                                  />
                                </div>
                                {/* Arrow */}
                                <div style={{
                                  width: '7px', height: '7px',
                                  background: 'rgba(10, 10, 14, 0.88)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  borderTop: 'none', borderLeft: 'none',
                                  transform: 'rotate(45deg)',
                                  marginTop: '-4px',
                                  flexShrink: 0,
                                }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Box>
                )}
              </Box>
            </>
          )}
        </div>
      </div>

      {game && (
        <GameDetailModal
          game={game}
          isOpen={gameModalOpen}
          onClose={() => setGameModalOpen(false)}
          onUpdated={() => api.games.get(id).then(setGame).catch(() => {})}
          onDeleted={() => setGameModalOpen(false)}
        />
      )}

      {/* ── Pin Modal ── */}
      <PinModal
        isOpen={showPinModal || editingPin !== null}
        onClose={() => {
          if (editingPin) { setEditingPin(null); }
          else { handleCancelPinModal(); }
        }}
        onSave={editingPin ? handleEditPin : handleAddPin}
        pin={editingPin ?? undefined}
        defaultLabel={`Pin ${activePins.length + 1}`}
        mapDefaults={mapDefaults}
      />

      {/* ── Map Modal ── */}
      <NewMapModal
        isOpen={!!newMapPtId}
        onClose={() => setNewMapPtId(null)}
        onConfirm={handleCreateMap}
        uploading={uploading}
        apiBase={apiBase}
        gameId={id}
      />

      {/* ── Update Map Image Modal ── */}
      <NewMapModal
        mode="update"
        isOpen={updatingImage}
        onClose={() => setUpdatingImage(false)}
        onConfirm={handleUpdateMapImage}
        uploading={savingImage}
        apiBase={apiBase}
        gameId={id}
      />
    </>
  );
}
