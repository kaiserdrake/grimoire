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
import { FiMap, FiUpload, FiX, FiPlus, FiFolder, FiTrash2, FiLink } from 'react-icons/fi';
import { TbMapPin, TbRoute } from 'react-icons/tb';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useLastVisited } from '@/context/LastVisitedContext';
import { useTabState } from '@/context/TabStateContext';
import GameDetailModal from '@/components/GameDetailModal';
import RecentDrawer from '@/components/RecentDrawer';
import { api } from '@/utils/api';
import { ptSidebarLabel } from '@/utils/playthroughs';

const PIN_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

// ── Pin types: game-themed icons ──────────────────────────────────────────────
// Each svg() receives the fill color. All major shapes carry stroke="black"
// strokeWidth="1.5" with paintOrder="stroke fill" so the outline sits outside
// the fill and never obscures interior detail.
const PIN_TYPES = [
  {
    id: 'treasure',
    label: 'Treasure',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Chest lid */}
        <path d="M4 16 Q4 8 16 8 Q28 8 28 16 Z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Chest body */}
        <rect x="4" y="14" width="24" height="14" rx="2"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Lid rim band */}
        <rect x="4" y="14" width="24" height="3"
          fill="rgba(0,0,0,0.18)" stroke="black" strokeWidth="1" />
        {/* Lock plate */}
        <rect x="13" y="17" width="6" height="5" rx="1"
          fill="rgba(0,0,0,0.55)" stroke="black" strokeWidth="1" />
        <circle cx="16" cy="19" r="1.4" fill="rgba(255,255,255,0.55)" />
        {/* Hinges */}
        <rect x="5" y="13" width="3" height="3" rx="0.5"
          fill="rgba(0,0,0,0.5)" stroke="black" strokeWidth="0.8" />
        <rect x="24" y="13" width="3" height="3" rx="0.5"
          fill="rgba(0,0,0,0.5)" stroke="black" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    id: 'quest',
    label: 'Quest',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Scroll body */}
        <rect x="7" y="6" width="18" height="22" rx="2"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Top curl */}
        <ellipse cx="16" cy="6" rx="9" ry="3"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Bottom curl */}
        <ellipse cx="16" cy="28" rx="9" ry="3"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Text lines */}
        <line x1="10" y1="12" x2="22" y2="12" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="20" x2="18" y2="20" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        {/* Wax seal */}
        <circle cx="21" cy="24" r="3" fill="rgba(0,0,0,0.4)" stroke="black" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: 'exclamation',
    label: 'Alert',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Shield */}
        <path d="M16 3 L28 8 L28 20 Q28 28 16 30 Q4 28 4 20 L4 8 Z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ! bar */}
        <rect x="14" y="9" width="4" height="11" rx="2"
          fill="white" stroke="black" strokeWidth="0.8"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ! dot */}
        <circle cx="16" cy="24" r="2.2"
          fill="white" stroke="black" strokeWidth="0.8"
          style={{ paintOrder: 'stroke fill' }} />
      </svg>
    ),
  },
  {
    id: 'question',
    label: 'Unknown',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Circle background */}
        <circle cx="16" cy="16" r="13"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ? mark — stroked text for outline */}
        <text x="16" y="22" textAnchor="middle" fontSize="16" fontWeight="bold" fontFamily="serif"
          fill="white" stroke="black" strokeWidth="1" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }}>?</text>
      </svg>
    ),
  },
  {
    id: 'battle',
    label: 'Battle',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Black outline layer drawn first (behind) */}
        <line x1="6" y1="6" x2="26" y2="26" stroke="black" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="26" y1="6" x2="6" y2="26" stroke="black" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="9" y1="13" x2="19" y2="3" stroke="black" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="23" y1="13" x2="13" y2="3" stroke="black" strokeWidth="3.5" strokeLinecap="round" />
        {/* Colored layer on top */}
        <line x1="6" y1="6" x2="26" y2="26" stroke={fill} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="26" y1="6" x2="6" y2="26" stroke={fill} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="9" y1="13" x2="19" y2="3" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        <line x1="23" y1="13" x2="13" y2="3" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        {/* Center gem */}
        <circle cx="16" cy="16" r="3.5" fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        <circle cx="16" cy="16" r="1.5" fill="rgba(255,255,255,0.5)" />
      </svg>
    ),
  },
  {
    id: 'location',
    label: 'Location',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 3C11.03 3 7 7.03 7 12c0 7.88 9 17 9 17s9-9.12 9-17c0-4.97-4.03-9-9-9z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        <circle cx="16" cy="12" r="3.5" fill="rgba(255,255,255,0.65)" stroke="black" strokeWidth="1"
          style={{ paintOrder: 'stroke fill' }} />
      </svg>
    ),
  },
];

// ── Helper to parse stored "color:icon" or plain "color" ─────────────────────
function parsePinStyle(stored) {
  if (!stored) return { color: 'blue', icon: 'location' };
  const [color, icon] = stored.split(':');
  return { color: color || 'blue', icon: icon || 'location' };
}
function encodePinStyle(color, icon) {
  return `${color}:${icon}`;
}

// ── Pin rendered on the map ───────────────────────────────────────────────────
const PinIcon = ({ color, icon = 'location' }) => {
  const type = PIN_TYPES.find(t => t.id === icon) ?? PIN_TYPES[PIN_TYPES.length - 1];
  const fill = `var(--color-pin-${color})`;
  return (
    <div style={{ width: 32, height: 32 }}>
      {type.svg(fill)}
    </div>
  );
};

// ── Hold-to-delete ────────────────────────────────────────────────────────────
const HOLD_DURATION = 3000;

function HoldToDelete({ onDelete }) {
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
        borderRadius="md" border="none" cursor="pointer" background="none"
        color={holding ? 'var(--color-danger)' : 'var(--color-text-muted)'}
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

// ── Add Pin Modal ─────────────────────────────────────────────────────────────
function AddPinModal({ isOpen, onClose, onAdd }) {
  const [label,   setLabel]   = useState('');
  const [desc,    setDesc]    = useState('');
  const [color,   setColor]   = useState('blue');
  const [icon,    setIcon]    = useState('location');
  const [saving,  setSaving]  = useState(false);
  const labelRef = useRef(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setDesc('');
      setColor('blue');
      setIcon('location');
      setSaving(false);
      setTimeout(() => labelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await onAdd({ label: label.trim(), description: desc.trim() || null, color: encodePinStyle(color, icon) });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered closeOnEsc closeOnOverlayClick={false}>
      <ModalOverlay style={{ background: 'rgba(0,0,0,0.5)' }} />
      <ModalContent style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}>
        <ModalHeader fontSize="sm" pb={2}>Add Pin</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={3} align="stretch">
            <FormControl isRequired>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Label</FormLabel>
              <Input
                ref={labelRef}
                size="sm"
                value={label}
                onChange={e => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pin label"
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
                        border: icon === t.id
                          ? '2px solid var(--color-accent)'
                          : '2px solid transparent',
                        background: icon === t.id ? 'var(--color-accent-subtle)' : 'var(--color-bg-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                      outline: color === c ? '3px solid var(--color-text-primary)' : '2px solid transparent',
                      cursor: 'pointer', padding: 0,
                    }}
                  />
                ))}
              </HStack>
            </FormControl>

            {/* Live preview */}
            <Box display="flex" alignItems="center" gap={2} pt={1}>
              <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>Preview:</Text>
              <div style={{ width: 32, height: 32 }}>
                <PinIcon color={color} icon={icon} />
              </div>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2} pt={3}>
          <Button size="sm" variant="ghost" onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}>
            Cancel
          </Button>
          <Button
            size="sm"
            isLoading={saving}
            isDisabled={!label.trim()}
            onClick={handleAdd}
            style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
          >
            Add
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
  initialPtId, onOpenGame,
}) {
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
function NewMapModal({ isOpen, onClose, onConfirm, uploading, gameId }) {
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

  const canSubmit = name.trim() && (file || urlInput.trim() || selectedAtt);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}>
        <ModalHeader fontSize="sm">Add Map</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel fontSize="xs" style={{ color: 'var(--color-text-secondary)' }}>Map Name</FormLabel>
              <Input size="sm" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. World Map"
                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </FormControl>

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
                              src={`${process.env.NEXT_PUBLIC_API_URL}${att.url}`}
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
            <Button size="sm" isLoading={uploading} isDisabled={!canSubmit}
              onClick={() => onConfirm({
                name: name.trim(),
                attachmentId: selectedAtt?.id,
                file: tab === 1 ? file : null,
                url: tab === 2 ? urlInput.trim() : null,
              })}
              style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
            >
              {tab === 0 ? 'Use Image' : 'Upload'}
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
  const [loading,      setLoading]      = useState(true);

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

  // ── Pin dragging (pin mode only) ────────────────────────────────────────────
  const [draggingPin,  setDraggingPin]  = useState(null); // { pinId, x_percent, y_percent }
  const draggingRef = useRef(null); // mirrors draggingPin for event handlers

  // ── Path drawing ───────────────────────────────────────────────────────────
  // Only one path at a time; stored as array of { x_percent, y_percent, id }
  const [pathWaypoints, setPathWaypoints] = useState([]);

  // ── Upload modal ─────────────────────────────────────────────────────────────
  const [newMapPtId, setNewMapPtId] = useState(null);
  const [uploading,  setUploading]  = useState(false);

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
        const savedMapId = mapStateRef.current.activeMapId;
        const restoredMap = savedMapId != null
          ? allMaps.find((m) => m.id == savedMapId)
          : null;

        if (restoredMap) {
          const restoredPtId = Object.keys(byPt).find((ptId) =>
            byPt[ptId].some((m) => m.id === restoredMap.id)
          );
          setActivePtId(restoredPtId);
          try {
            const pinsData = await api.pins.list(restoredMap.id);
            setPinsByMap(prev => ({ ...prev, [restoredMap.id]: pinsData }));
          } catch (err) {
            toast({ title: 'Failed to load pins', description: err.message, status: 'error', duration: 3000 });
          }
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
    try {
      let attachmentIdToUse = attachmentId;
      if (!attachmentIdToUse) {
        const attachment = file
          ? await api.attachments.upload(id, 'maps', file)
          : await api.attachments.fromUrl(id, 'maps', url);
        attachmentIdToUse = attachment.id;
      }
      const created = await api.maps.create(newMapPtId, {
        name,
        attachment_id: attachmentIdToUse,
      });

      setMapsByPt(prev => ({
        ...prev,
        [newMapPtId]: [...(prev[newMapPtId] || []), created],
      }));
      await selectMap(newMapPtId, created);
      setNewMapPtId(null);
    } catch (err) {
      toast({ title: 'Failed to create map', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setUploading(false);
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
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left)  / rect.width)  * 100;
    const y = ((e.clientY - rect.top)   / rect.height) * 100;

    if (toolMode === 'pin') {
      setPendingPin({ x_percent: x, y_percent: y });
      setShowPinModal(true);
    } else if (toolMode === 'path') {
      const newWp = { x_percent: x, y_percent: y, id: Date.now() };
      setPathWaypoints(prev => [...prev, newWp]);
    }
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

  // ── Pin drag (pin mode only) ────────────────────────────────────────────────
  const handlePinDragStart = (e, pin) => {
    e.stopPropagation();
    e.preventDefault();
    const info = { pinId: pin.id, x_percent: pin.x_percent, y_percent: pin.y_percent };
    draggingRef.current = info;
    setDraggingPin(info);
  };

  const handleContainerMouseMove = (e) => {
    if (!draggingRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width)  * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top)  / rect.height) * 100));
    const updated = { ...draggingRef.current, x_percent: x, y_percent: y };
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
    const { pinId, x_percent, y_percent } = draggingRef.current;
    draggingRef.current = null;
    setDraggingPin(null);
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
      <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />

      <div className="notes-workspace">

        {/* ── Left: Sidebar ── */}
        {loading ? null : (
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
          />
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
                    <Text fontSize="xs" mt={1}>Click + on a playthrough in the sidebar to add a map.</Text>
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
                      onMouseMove={toolMode === 'pin' ? handleContainerMouseMove : undefined}
                      onMouseUp={toolMode === 'pin' ? handleContainerMouseUp : undefined}
                      onMouseLeave={toolMode === 'pin' ? handleContainerMouseUp : undefined}
                      style={{ cursor: draggingPin ? 'grabbing' : toolMode !== 'none' ? 'crosshair' : 'default' }}
                    >
                      {/* Resizable wrapper */}
                      <div className="map-image-resizer">
                        <img
                          ref={imgRef}
                          src={`${process.env.NEXT_PUBLIC_API_URL}${activeMap.image_url}`}
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
                      {disambiguatePinLabels(activePins).map(pin => {
                        const isDragging = draggingPin?.pinId === pin.id;
                        const { color: pinColor, icon: pinIcon } = parsePinStyle(pin.color);
                        const isHovered = openPinId === pin.id;
                        return (
                          <div
                            key={pin.id}
                            className="map-pin"
                            style={{
                              left: `${pin.x_percent}%`,
                              top: `${pin.y_percent}%`,
                              transform: 'translate(-50%, -50%)',
                              cursor: toolMode === 'pin' ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                              opacity: isDragging ? 0.85 : 1,
                              filter: isDragging ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : undefined,
                              zIndex: isDragging ? 50 : isHovered ? 30 : undefined,
                            }}
                            onMouseDown={toolMode === 'pin' ? (e) => handlePinDragStart(e, pin) : undefined}
                            onMouseEnter={() => {
                              if (toolMode !== 'none' || isDragging) return;
                              setOpenPinId(pin.id);
                              setActivePinId(pin.id);
                            }}
                            onMouseLeave={() => {
                              if (toolMode !== 'none') return;
                              setOpenPinId(null);
                              setActivePinId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <PinIcon color={pinColor} icon={pinIcon} />

                            {/* Hover tooltip */}
                            {isHovered && (
                              <div
                                onMouseEnter={() => { setOpenPinId(pin.id); setActivePinId(pin.id); }}
                                onMouseLeave={() => { setOpenPinId(null); setActivePinId(null); }}
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(100% + 6px)',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  background: 'var(--color-bg-surface)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '6px',
                                  padding: '6px 8px',
                                  minWidth: '120px',
                                  maxWidth: '200px',
                                  whiteSpace: 'pre-wrap',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                  zIndex: 100,
                                  pointerEvents: 'auto',
                                  cursor: 'default',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '11px', lineHeight: 1.3, color: 'var(--color-text-primary)' }}>
                                      {pin.displayLabel}
                                    </div>
                                    {pin.description && (
                                      <div style={{ fontSize: '10px', marginTop: '3px', lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>
                                        {pin.description}
                                      </div>
                                    )}
                                  </div>
                                  {toolMode === 'pin' ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeletePin(pin.id); }}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                        color: 'var(--color-danger)', flexShrink: 0, display: 'flex', alignItems: 'center',
                                      }}
                                    >
                                      <FiTrash2 size={11} />
                                    </button>
                                  ) : (
                                    <HoldToDelete onDelete={() => handleDeletePin(pin.id)} />
                                  )}
                                </div>
                                {/* Arrow */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '-5px', left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: '8px', height: '8px',
                                  background: 'var(--color-bg-surface)',
                                  border: '1px solid var(--color-border)',
                                  borderTop: 'none', borderLeft: 'none',
                                  transform: 'translateX(-50%) rotate(45deg)',
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

      {/* ── Add Pin Modal ── */}
      <AddPinModal
        isOpen={showPinModal}
        onClose={handleCancelPinModal}
        onAdd={handleAddPin}
      />

      {/* ── Map Modal ── */}
      <NewMapModal
        isOpen={!!newMapPtId}
        onClose={() => setNewMapPtId(null)}
        onConfirm={handleCreateMap}
        uploading={uploading}
        gameId={id}
      />
    </>
  );
}
