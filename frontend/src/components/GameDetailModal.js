'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, HStack, VStack, Text, Image,
  Box, Divider, useToast, IconButton, Tooltip, Spinner,
} from '@chakra-ui/react';
import { DeleteIcon, AddIcon, ChevronRightIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FiFileText, FiMap, FiTrash2, FiEdit2, FiRefreshCw, FiPaperclip } from 'react-icons/fi';

import { useRouter } from 'next/navigation';
import { api } from '@/utils/api';

import { DEFAULT_PLATFORMS } from '@/constants/platforms';
import { PT_STATUS_LABELS, PT_STATUS_COLORS } from '@/constants/playthroughs';
import { TAG_CONFIG, BacklogIcon, WishlistIcon, FavoriteIcon } from '@/constants/tags';
import { ptDisplayLabel } from '@/utils/playthroughs';

const info = (color = 'var(--color-text-muted)') => ({
  margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color,
});

const inputStyle = {
  fontSize: '0.75rem', padding: '2px 6px',
  background: 'var(--color-bg-page)', border: '1px solid var(--color-border)',
  borderRadius: '4px', color: 'var(--color-text-primary)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr) {
  if (!dateStr) return '—';

  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function sessionDays(session) {
  const start = new Date(session.start_date);
  const end   = session.end_date ? new Date(session.end_date) : new Date();
  return Math.max(0, Math.round((end - start) / 86400000));
}

function ptTotalDays(pt) {
  return (pt.sessions || []).reduce((sum, s) => sum + sessionDays(s), 0);
}

function ptSummaryLine(pt) {
  const sessions = pt.sessions || [];
  const total    = ptTotalDays(pt);
  const ongoing  = sessions.some((s) => !s.end_date);
  const count    = sessions.length;
  const parts    = [];
  if (count > 0) parts.push(`${count} session${count !== 1 ? 's' : ''}`);
  if (total > 0) parts.push(`${total}d${ongoing ? ' + ongoing' : ''}`);
  else if (ongoing) parts.push('ongoing');
  return parts.join(' · ');
}

// Mirror the backend's rule: playthrough status = status of latest session by start_date desc
function derivePlaythroughStatus(sessions, fallback) {
  if (!sessions || sessions.length === 0) return fallback;
  const sorted = [...sessions].sort((a, b) => {
    const d = new Date(b.start_date) - new Date(a.start_date);
    return d !== 0 ? d : new Date(b.created_at) - new Date(a.created_at);
  });
  return sorted[0].status ?? fallback;
}

// ── Hold-to-delete button ─────────────────────────────────────────────────────

const HOLD_DURATION = 3000;

function HoldToDelete({ onDelete, label = '', size = 'sm', icon = <DeleteIcon /> }) {
  const [progress, setProgress]   = useState(0);   // 0–1
  const [holding,  setHolding]    = useState(false);
  const startRef   = useRef(null);
  const rafRef     = useRef(null);
  const firedRef   = useRef(false);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const p = Math.min(elapsed / HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else if (!firedRef.current) {
      firedRef.current = true;
      onDelete();
      reset();
    }
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
    startRef.current = Date.now();
    firedRef.current = false;
    setHolding(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (!firedRef.current) reset();
  };

  const dangerColor = 'var(--color-danger)';
  const radius = size === 'xs' ? 10 : 12;
  const svgSize = radius * 2 + 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <Tooltip label="Hold to delete" hasArrow placement="top" openDelay={400}>
      <Box
        as="button"
        display="inline-flex" alignItems="center" gap="6px"
        px={size === 'xs' ? 1.5 : 2} py={size === 'xs' ? 0.5 : 1}
        borderRadius="md" border="none" cursor="pointer"
        background="none"
        color={holding ? dangerColor : 'var(--color-text-muted)'}
        _hover={{ color: dangerColor }}
        transition="color 0.15s"
        onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchEnd={stop}
        aria-label={label}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <Box position="relative" display="inline-flex" alignItems="center" justifyContent="center"
          w={`${svgSize}px`} h={`${svgSize}px`} flexShrink={0}>
          <svg width={svgSize} height={svgSize} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            <circle cx={svgSize / 2} cy={svgSize / 2} r={radius}
              fill="none" stroke={dangerColor} strokeWidth="2" opacity="0.2" />
            <circle cx={svgSize / 2} cy={svgSize / 2} r={radius}
              fill="none" stroke={dangerColor} strokeWidth="2"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'none' }} />
          </svg>
          <Box fontSize={size === 'xs' ? '11px' : '13px'}>{icon}</Box>
        </Box>
        {label && <span style={{ fontSize: size === 'xs' ? '0.75rem' : '0.875rem', fontWeight: 500 }}>{label}</span>}
      </Box>
    </Tooltip>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <Box
      px={1.5} py={0.5} borderRadius="sm" fontSize="0.65rem" fontWeight="600" display="inline-block"
      style={{ background: `${PT_STATUS_COLORS[status]}20`, color: PT_STATUS_COLORS[status] }}
    >
      {PT_STATUS_LABELS[status]}
    </Box>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({ session, index, ptId, onUpdated, onDeleted }) {
  const toast = useToast();
  const [editing,   setEditing]   = useState(false);
  const [startDate, setStartDate] = useState(session.start_date?.slice(0, 10) || '');
  const [endDate,   setEndDate]   = useState(session.end_date?.slice(0, 10) || '');
  const [status,    setStatus]    = useState(session.status);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!editing) {
      setStartDate(session.start_date?.slice(0, 10) || '');
      setEndDate(session.end_date?.slice(0, 10) || '');
      setStatus(session.status);
    }
  }, [session.start_date, session.end_date, session.status, editing]);

  const days    = sessionDays(session);

  const ongoing = !session.end_date;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.sessions.update(ptId, session.id, {
        start_date: startDate,
        end_date:   endDate || null,
        status,
      });

      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      toast({ title: 'Error saving session', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.sessions.delete(ptId, session.id);
      onDeleted(session.id);
    } catch (err) {
      toast({ title: 'Error deleting session', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleAddToday = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      const updated = await api.sessions.update(ptId, session.id, { end_date: today });
      onUpdated(updated);
    } catch (err) {
      toast({ title: 'Error updating session', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <>
        <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <td style={{ ...info(), padding: '6px 8px', width: '28px' }}>{index + 1}</td>
          <td style={{ padding: '6px 8px' }}>
            <input type="date" style={{ ...inputStyle, width: '130px' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </td>
          <td style={{ padding: '6px 8px' }}>
            <input type="date" style={{ ...inputStyle, width: '130px' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </td>
          <td style={{ padding: '6px 8px' }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '110px' }}>
              <option value="playing">▶ Playing</option>
              <option value="pend">⏸ Pended</option>
              <option value="completed">✓ Completed</option>
              <option value="dropped">✖ Dropped</option>
            </select>
          </td>
          <td style={{ ...info(), padding: '6px 8px', textAlign: 'right' }}>—</td>
          <td style={{ padding: '6px 8px' }} />
        </tr>
        {/* Buttons on their own row — Delete left, Cancel/Save right */}
        <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <td colSpan={6} style={{ padding: '4px 8px 8px' }}>
            <HStack justify="space-between">
              <HoldToDelete onDelete={handleDelete} size="xs" icon={<FiTrash2 size={11} />} />
              <HStack spacing={2}>
                <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
                  _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }} isLoading={saving} onClick={handleSave}>Save</Button>
              </HStack>
            </HStack>
          </td>
        </tr>
      </>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ ...info(), padding: '6px 8px', width: '28px' }}>{index + 1}</td>
      <td style={{ padding: '6px 8px' }}>
        <span style={info()}>{fmtDate(session.start_date)}</span>
      </td>
      <td style={{ padding: '6px 8px' }}>
        {ongoing
          ? <HStack spacing={1}><Box w="6px" h="6px" borderRadius="full" bg="var(--color-accent)" /><span style={info('var(--color-accent)')}>ongoing</span></HStack>
          : <span style={info()}>{fmtDate(session.end_date)}</span>
        }
      </td>
      <td style={{ padding: '6px 8px' }}><StatusBadge status={session.status} /></td>
      <td style={{ ...info(), padding: '6px 8px', textAlign: 'right', color: ongoing ? 'var(--color-accent)' : undefined }}>
        {ongoing ? `+${days}` : days}
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
        <HStack spacing={1} justify="flex-end">
          <Tooltip label="Edit" hasArrow placement="top" openDelay={400}>
            <IconButton size="xs" variant="ghost" aria-label="Edit" icon={<span style={{ fontSize: '11px' }}>✎</span>}
              color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
              onClick={() => setEditing(true)} />
          </Tooltip>
          {session.status === 'playing' && (
          <Tooltip label="Set end to today" hasArrow placement="top" openDelay={400}>
            <IconButton size="xs" variant="ghost" aria-label="Add today" icon={<span style={{ fontSize: '11px' }}>⊕</span>}
              color="var(--color-text-muted)" _hover={{ color: 'var(--color-accent)' }}
              isLoading={saving} onClick={handleAddToday} />
          </Tooltip>
          )}
    </HStack>
    </td>
    </tr>
  );
}

// ── Add session row ───────────────────────────────────────────────────────────

function AddSessionRow({ ptId, onAdded }) {
  const toast = useToast();
  const [open,      setOpen]      = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [status,    setStatus]    = useState('playing');
  const [saving,    setSaving]    = useState(false);

  const handleAdd = async () => {
    if (!startDate) {
      toast({ title: 'Start date is required', status: 'warning', duration: 2500 });
      return;
    }
    setSaving(true);
    try {
      const session = await api.sessions.create(ptId, {
        start_date: startDate,
        end_date:   endDate || null,
        status,

      });
      onAdded(session);
      setOpen(false);
      setStartDate(''); setEndDate(''); setStatus('playing');
    } catch (err) {
      toast({ title: 'Error adding session', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: '6px 8px' }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              fontSize: '0.7rem', color: 'var(--color-accent)', background: 'none',
              border: '1px dashed var(--color-accent)', borderRadius: '4px',
              padding: '3px 10px', cursor: 'pointer',
            }}
          >
            + Add session
          </button>
        </td>
      </tr>
    );
  }

  // Open state: inputs on first row, buttons on second row
  return (
    <>
      <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>

        <td style={{ ...info(), padding: '6px 8px', width: '28px' }}>—</td>
        <td style={{ padding: '6px 8px' }}>
          <input type="date" style={{ ...inputStyle, width: '130px' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </td>
        <td style={{ padding: '6px 8px' }}>
          <input type="date" style={{ ...inputStyle, width: '130px' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </td>
        <td style={{ padding: '6px 8px' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '110px' }}>
            <option value="playing">▶ Playing</option>
            <option value="pend">⏸ Pended</option>
            <option value="completed">✓ Completed</option>
            <option value="dropped">✖ Dropped</option>
          </select>
        </td>
        <td /><td />
      </tr>
      <tr style={{ background: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <td colSpan={6} style={{ padding: '4px 8px 8px' }}>
          <HStack spacing={2}>
            <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
              _hover={{ bg: 'transparent', opacity: 0.75 }}
              onClick={() => { setOpen(false); setStartDate(''); setEndDate(''); setStatus('playing'); }}>Cancel</Button>
            <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }} isLoading={saving} onClick={handleAdd}>Add</Button>
          </HStack>
        </td>
      </tr>
    </>
  );
}

// ── Playthrough row (collapsible) ─────────────────────────────────────────────
function PlaythroughRow({ pt, allPlaythroughs, gameId, onUpdated, onDeleted }) {
  const toast  = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(pt.status === 'playing' || pt.status === 'pend');
  const [sessions, setSessions] = useState(pt.sessions || []);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft]     = useState(pt.label || '');
  const [savingLabel, setSavingLabel]   = useState(false);

  const handleDeletePT = async () => {
    try {
      await api.playthroughs.delete(pt.id);
      onDeleted(pt.id);
    } catch (err) {
      toast({ title: 'Error deleting playthrough', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleSessionUpdated = (updated) => {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    onUpdated();
  };

  const handleSessionDeleted = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    onUpdated();
  };

  const handleSessionAdded = (session) => {
    setSessions((prev) => [...prev, session]);
    onUpdated();
  };

  const handleLabelSave = async () => {
    const trimmed = labelDraft.trim().slice(0, 24);
    setSavingLabel(true);
    try {
      await api.playthroughs.update(pt.id, { label: trimmed || null });
      pt.label = trimmed || null; // optimistic update in-place
      onUpdated();
    } catch (err) {
      toast({ title: 'Error saving label', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSavingLabel(false);
      setEditingLabel(false);
    }
  };

  const currentStatus  = derivePlaythroughStatus(sessions, pt.status);
  const ptWithSessions = { ...pt, sessions, status: currentStatus };
  const summary        = ptSummaryLine(ptWithSessions);

  return (
    <Box borderWidth="1px" borderColor="var(--color-border-subtle)" borderRadius="md" overflow="hidden" mb={2}>
      {/* Header */}
      <HStack
        px={3} py={1} justify="space-between" align="flex-start" cursor="pointer"
        bg="var(--color-bg-subtle)" _hover={{ bg: 'var(--color-bg-hover)' }}
        onClick={() => setOpen((v) => !v)}
      >
        <HStack spacing={2} flex={1} minW={0}>
          <Box color="var(--color-text-muted)" flexShrink={0}>
            {open ? <ChevronDownIcon boxSize={3} /> : <ChevronRightIcon boxSize={3} />}
          </Box>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0px' }} onClick={(e) => editingLabel && e.stopPropagation()}>
            {editingLabel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  autoFocus
                  value={labelDraft}
                  maxLength={24}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLabelSave();
                    if (e.key === 'Escape') { setEditingLabel(false); setLabelDraft(pt.label || ''); }
                  }}
                  style={{
                    fontSize: '0.875rem', fontWeight: 600, background: 'var(--color-bg-page)',
                    border: '1px solid var(--color-accent)', borderRadius: '4px',
                    padding: '1px 6px', color: 'var(--color-text-primary)', width: '140px', outline: 'none',
                  }}
                />
                <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }}
                  isLoading={savingLabel} onClick={handleLabelSave}>Save</Button>
                <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
                  _hover={{ bg: 'transparent', opacity: 0.75 }}
                  onClick={(e) => { e.stopPropagation(); setEditingLabel(false); setLabelDraft(pt.label || ''); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--color-text-primary)' }}>
                  {ptDisplayLabel(pt, allPlaythroughs)}
                </span>
                <Tooltip label="Edit label" hasArrow placement="top" openDelay={400}>
                  <IconButton size="xs" variant="ghost" aria-label="Edit label"
                    icon={<FiEdit2 size={10} />}
                    color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
                    minWidth="16px" height="16px"
                    onClick={(e) => { e.stopPropagation(); setEditingLabel(true); }}
                  />
                </Tooltip>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {pt.platform && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{pt.platform}</span>}
              {summary && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{pt.platform ? `· ${summary}` : summary}</span>}
            </div>
          </div>
        </HStack>

        <HStack spacing={1} flexShrink={0} onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={currentStatus} />
          <Tooltip label="Notes" hasArrow placement="top" openDelay={400}>
            <IconButton size="xs" variant="ghost" aria-label="Notes" icon={<FiFileText size={11} />}
              color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
              onClick={() => router.push(`/game/${gameId}/${pt.id}/notes`)} />
          </Tooltip>
          <Tooltip label="Maps" hasArrow placement="top" openDelay={400}>
            <IconButton size="xs" variant="ghost" aria-label="Maps" icon={<FiMap size={11} />}
              color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}

              onClick={() => router.push(`/game/${gameId}/${pt.id}/map`)} />
          </Tooltip>
          <HoldToDelete onDelete={handleDeletePT} label="" size="xs" icon={<FiTrash2 size={11} />} />
        </HStack>
      </HStack>

      {/* Sessions table */}
      {open && (
        <Box borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-page)' }}>
                <th style={{ ...info(), padding: '5px 8px', textAlign: 'left', fontWeight: 600, width: '28px' }}>#</th>
                <th style={{ ...info(), padding: '5px 8px', textAlign: 'left' }}>Start</th>

                <th style={{ ...info(), padding: '5px 8px', textAlign: 'left' }}>End</th>
                <th style={{ ...info(), padding: '5px 8px', textAlign: 'left' }}>Status</th>
                <th style={{ ...info(), padding: '5px 8px', textAlign: 'right' }}>Days</th>
                <th style={{ width: '72px' }} />
              </tr>

            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <SessionRow
                  key={s.id} session={s} index={i} ptId={pt.id}
                  onUpdated={handleSessionUpdated}
                  onDeleted={handleSessionDeleted}
                />
              ))}
              <AddSessionRow ptId={pt.id} onAdded={handleSessionAdded} />
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
}

// ── Inline Sync Panel ─────────────────────────────────────────────────────────

function SyncPanel({ game, onSynced, onCancel }) {
  const toast      = useToast();
  const [candidates, setCandidates] = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [searching,  setSearching]  = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    api.igdb.search(game.title).then((results) => {
      setCandidates(results);
      if (results.length === 1) setSelected(results[0]);
    }).catch(() => {
      toast({ title: 'IGDB search failed', status: 'error', duration: 3000 });
      setCandidates([]);
    }).finally(() => setSearching(false));
  }, [game.title]);

  const handleSync = async () => {
    if (!selected) return;
    setSyncing(true);
    try {
      await api.games.update(game.id, {
        title:        selected.title,
        cover_url:    selected.cover_url,
        summary:      selected.summary,
        genres:       selected.genres,
        series:       selected.series,
        developer:    selected.developer,
        publisher:    selected.publisher,
        time_to_beat: selected.time_to_beat,
        releases:     selected.releases,
        tag:          game.tag,
        igdb_id:      selected.igdb_id,
      });
      toast({
        title: 'Sync complete',
        description: `"${selected.title}" has been updated with the latest information from IGDB.`,
        status: 'success',
        duration: 3500,
      });
      onSynced?.();
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: err.message || 'Could not update game information. Please try again.',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setSyncing(false);
    }
  };

  const noneFound = candidates !== null && candidates.length === 0;

  return (
    <Box ref={panelRef} borderWidth="1px" borderColor="var(--color-accent)" borderRadius="md"
      bg="var(--color-bg-subtle)" overflow="hidden">

      {/* Panel header */}
      <HStack px={3} py={2} justify="space-between"
        borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
        <HStack spacing={2}>
          <FiRefreshCw size={12} color="var(--color-accent)" />
          <Text fontSize="xs" fontWeight="600" color="var(--color-accent)">
            Sync from IGDB
          </Text>
        </HStack>
        <IconButton size="xs" variant="ghost" aria-label="Cancel sync"
          icon={<span style={{ fontSize: '11px' }}>✕</span>}
          color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
          onClick={onCancel} />
      </HStack>

      {/* Panel body */}
      <Box px={3} py={2}>
        {searching && (
          <HStack spacing={2} py={2}>
            <Spinner size="xs" color="var(--color-accent)" />
            <Text fontSize="xs" color="var(--color-text-muted)" m={0}>
              Searching IGDB for "{game.title}"…
            </Text>
          </HStack>
        )}

        {noneFound && (
          <Text fontSize="xs" color="var(--color-text-muted)" py={2} m={0}>
            No matching game found on IGDB.
          </Text>
        )}

        {candidates !== null && candidates.length === 1 && (
          <VStack spacing={2} align="stretch">
            <Text fontSize="xs" color="var(--color-text-muted)" m={0}>
              Found one match — confirm to sync:
            </Text>
            <SyncCandidate candidate={candidates[0]} selected onClick={null} />
          </VStack>
        )}

        {candidates !== null && candidates.length > 1 && (
          <VStack spacing={2} align="stretch">
            <Text fontSize="xs" color="var(--color-text-muted)" m={0}>
              Multiple matches found — select one:
            </Text>
            {candidates.map((c) => (
              <SyncCandidate key={c.igdb_id} candidate={c}
                selected={selected?.igdb_id === c.igdb_id}
                onClick={() => setSelected(c)} />
            ))}
          </VStack>
        )}

        {!searching && !noneFound && (
          <HStack justify="flex-end" mt={2} spacing={2}>
            <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
              _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={onCancel}>Cancel</Button>
            <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }}
              isDisabled={!selected} isLoading={syncing} onClick={handleSync}>
              Sync
            </Button>
          </HStack>
        )}
      </Box>
    </Box>
  );
}

function SyncCandidate({ candidate, selected, onClick }) {
  const year   = candidate.releases?.find((r) => r.date)
    ? new Date(candidate.releases.find((r) => r.date).date).getFullYear()
    : null;
  const devPub = [candidate.developer, candidate.publisher].filter(Boolean).join(' | ');
  return (
    <Box p={2} borderRadius="md" borderWidth="1px"
      cursor={onClick ? 'pointer' : 'default'}
      borderColor={selected ? 'var(--color-accent)' : 'var(--color-border-subtle)'}
      bg={selected ? 'var(--color-accent-subtle)' : 'var(--color-bg-page)'}
      onClick={onClick}
      _hover={onClick ? { borderColor: 'var(--color-accent)' } : {}}
      transition="all 0.15s"
    >
      <HStack spacing={2} align="start">
        {candidate.cover_url ? (
          <Image src={candidate.cover_url} alt={candidate.title}
            w="32px" h="42px" objectFit="cover" borderRadius="sm" flexShrink={0} />
        ) : (
          <Box w="32px" h="42px" bg="var(--color-bg-hover)" borderRadius="sm"
            display="flex" alignItems="center" justifyContent="center" flexShrink={0} fontSize="md">
            🎮
          </Box>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
            {candidate.title}
          </span>
          {(year || devPub) && (
            <span style={{ fontSize: '0.75rem', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
              {[year, devPub].filter(Boolean).join(' · ')}
            </span>
          )}
          {candidate.releases?.length > 0 && (
            <span style={{ fontSize: '0.7rem', lineHeight: '1.4', color: 'var(--color-text-muted)' }}>
              {[...new Set(candidate.releases.map(r => r.platform).filter(Boolean))].join(' · ')}
           </span>
          )}
        </div>
      </HStack>
    </Box>
  );
}

function AttachmentRow({ att, onDeleted }) {
  const toast = useToast();

  const handleDelete = async () => {
    try {
      await api.attachments.delete(att.id);
      onDeleted(att.id);
    } catch (err) {
      toast({ title: 'Cannot delete', description: err.message, status: 'error', duration: 4000 });
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '3px 6px',
      borderRadius: '4px',
      background: 'var(--color-bg-subtle)',
      border: '1px solid var(--color-border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0,
          overflow: 'hidden', background: 'var(--color-bg-page)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <img
            src={`${process.env.NEXT_PUBLIC_API_URL}${att.url}`}
            alt={att.original_name || att.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <span style={{
          fontSize: '0.72rem', color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {att.original_name || att.filename}
        </span>
      </div>

      <HoldToDelete
        onDelete={handleDelete}
        size="xs"
        icon={<FiTrash2 size={10} />}
      />
    </div>
  );
}

// ── Add playthrough form ──────────────────────────────────────────────────────

function AddPlaythroughForm({ gameId, platforms, onAdded, onCancel }) {
  const toast = useToast();
  const [platform,       setPlatform]       = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  const [saving,         setSaving]         = useState(false);

  const handleAdd = async () => {
    const plat = platform === '__custom__' ? customPlatform.trim() : platform;
    if (!plat) {
      toast({ title: 'Platform is required', status: 'warning', duration: 2500 });
      return;
    }
    setSaving(true);
    try {
      const pt = await api.playthroughs.create(gameId, { platform: plat });
      onAdded(pt);

    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    fontSize: '0.875rem', padding: '0.375rem 0.75rem',
    background: 'var(--color-bg-page)', border: '1px solid var(--color-border)',
    borderRadius: '6px', color: 'var(--color-text-primary)', width: '100%',
  };

  return (
    <Box p={3} borderWidth="1px" borderColor="var(--color-border-subtle)" borderRadius="md" bg="var(--color-bg-subtle)">
      <VStack spacing={2} align="stretch">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={selectStyle}>
          <option value="">Select platform…</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Other…</option>
        </select>

        {platform === '__custom__' && (
          <input
            placeholder="Enter platform name"
            value={customPlatform}
            onChange={(e) => setCustomPlatform(e.target.value)}
            style={selectStyle}
          />
        )}

        <HStack justify="flex-end">
          <Button size="xs" variant="ghost" bg="transparent" border="none" boxShadow="none"
            _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={onCancel}>Cancel</Button>
          <Button size="xs" bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }}
            isLoading={saving} onClick={handleAdd}>
            Save
          </Button>
        </HStack>
      </VStack>
    </Box>

  );

}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function GameDetailModal({ game, isOpen, onClose, onUpdated, onDeleted }) {
  const toast  = useToast();
  const router = useRouter();


  const [listStatus,      setListStatus]      = useState(game?.tag ?? null);
  const [playthroughs,    setPlaythroughs]    = useState(game?.playthroughs || []);
  const [deleting,        setDeleting]        = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [releasesExpanded, setReleasesExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [attachments,         setAttachments]         = useState(null); // null = not yet fetched
  const [showAddPT,       setShowAddPT]       = useState(false);
  const [showSync,        setShowSync]        = useState(false);
  const [editingTitle,    setEditingTitle]    = useState(false);
  const [titleDraft,      setTitleDraft]      = useState('');
  const [savingTitle,     setSavingTitle]     = useState(false);
  const [localTitle,      setLocalTitle]      = useState(game?.title || '');
  const [platforms,       setPlatforms]       = useState(DEFAULT_PLATFORMS);
  const [hasIgdbCredentials, setHasIgdbCredentials] = useState(false);

  useEffect(() => {
    if (game) {
      setListStatus(game.tag ?? null);
      setPlaythroughs(game.playthroughs || []);
      setSummaryExpanded(false);
      setReleasesExpanded(false);
      setAttachmentsExpanded(false);
      setAttachments(null);
      setShowAddPT(false);
      setShowSync(false);
      setEditingTitle(false);
      setTitleDraft('');
      setLocalTitle(game.title || '');
    }
  }, [game]);

  useEffect(() => {
    if (!isOpen) return;
      api.igdb.getCredentials().then((creds) => {
        setHasIgdbCredentials(!!creds.igdb_client_id && !!creds.igdb_client_secret);
      }).catch(() => setHasIgdbCredentials(false));
  }, [isOpen]);

  // Load user's configured platform list
  useEffect(() => {
    api.settings.get('platforms').then((val) => {
      if (Array.isArray(val) && val.length > 0) setPlatforms(val);
    }).catch(() => {});
  }, []);

  if (!game) return null;

  const handleTagChange = async (val) => {
    const newTag = listStatus === val ? null : val;
    setListStatus(newTag);
    try {
      await api.games.updateTag(game.id, newTag);
      onUpdated?.();
    } catch {
      toast({ title: 'Error updating tag', status: 'error', duration: 3000 });
      setListStatus(game.tag ?? null);
    }
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

  const handleTitleSave = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === game.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await api.games.update(game.id, {
        title:        trimmed,
        cover_url:    game.cover_url,
        summary:      game.summary,
        genres:       game.genres,
        series:       game.series,
        developer:    game.developer,
        publisher:    game.publisher,
        time_to_beat: game.time_to_beat,
        releases:     game.releases,
        tag:          game.tag,
      });
      setLocalTitle(trimmed);
      toast({ title: 'Title updated', status: 'success', duration: 2000 });
      onUpdated?.();
      setEditingTitle(false);
    } catch (err) {
      toast({ title: 'Failed to update title', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSavingTitle(false);
    }
  };

  const releases         = game.releases || [];
  const firstReleaseYear = releases.find((r) => r.date)?.date
    ? new Date(releases.find((r) => r.date).date).getFullYear()
    : null;
  const devPub = [game.developer, game.publisher].filter(Boolean).join(' | ');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
        maxH="90vh"
      >
        {/* Header */}
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)" pr={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {editingTitle ? (
            <HStack flex={1} minW={0} spacing={1}>
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                style={{
                  flex: 1, minWidth: 0,
                  fontSize: 'inherit', fontWeight: 'inherit',
                  background: 'var(--color-bg-page)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              <Button size="xs" variant="ghost" color="var(--color-text-muted)"
                bg="transparent" border="none" boxShadow="none"
                _hover={{ color: 'var(--color-text-primary)', bg: 'transparent' }}
                isLoading={savingTitle} onClick={handleTitleSave} flexShrink={0}>
                Save
              </Button>
              <Button size="xs" variant="ghost" flexShrink={0}
                bg="transparent" border="none" boxShadow="none"
                _hover={{ bg: 'transparent', opacity: 0.75 }}
                onClick={() => setEditingTitle(false)}>
                Cancel
              </Button>
            </HStack>
          ) : (
            <HStack flex={1} minW={0} spacing={1}>
            <Text noOfLines={1} flex={1} minW={0}>{localTitle}</Text>
            <Tooltip label="Edit title" hasArrow placement="top" openDelay={400}>
              <IconButton
                size="xs" variant="ghost" aria-label="Edit title"
                icon={<span style={{ fontSize: '11px' }}>✎</span>}
                color="var(--color-text-muted)" _hover={{ color: 'var(--color-text-primary)' }}
                flexShrink={0}
                onClick={() => { setTitleDraft(localTitle); setEditingTitle(true); }}
              />
            </Tooltip>
            </HStack>
          )}
          {!editingTitle && (
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
                <Tooltip key={key} label={listStatus === key ? `Remove ${cfg.label}` : cfg.label} hasArrow placement="bottom" openDelay={300}>
                  <button
                    onClick={() => handleTagChange(key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '6px',
                      border: `1px solid ${listStatus === key ? cfg.border : 'var(--color-border)'}`,
                      background: listStatus === key ? cfg.bg : 'transparent',
                      color: listStatus === key ? cfg.color : 'var(--color-text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <cfg.Icon />
                  </button>
                </Tooltip>
              ))}
            </div>
          )}
          </div>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody py={4} overflowY="auto">
          <VStack spacing={4} align="stretch">
            {/* Cover + core info + synopsis */}
            <HStack spacing={4} align="stretch">
              {game.cover_url ? (
                <Image src={game.cover_url} alt={game.title} borderRadius="md"
                  w="180px" h="240px" objectFit="cover" flexShrink={0} />
              ) : (
                <Box w="180px" h="240px" borderRadius="md" bg="var(--color-bg-subtle)"
                  display="flex" alignItems="center" justifyContent="center" fontSize="2xl" flexShrink={0}>
                  🎮
                </Box>
              )}
              <VStack align="start" spacing={1} flex={1} minW={0} h="240px">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  {firstReleaseYear && <span style={info()}>{firstReleaseYear}</span>}
                  {game.time_to_beat && (
                    <span style={info()}>⏱ Estimated Completion: ~{game.time_to_beat}h</span>
                  )}
                </div>
                {devPub           && <span style={info()}>{devPub}</span>}
                {game.genres?.length > 0 && <span style={info()}>{game.genres.join(', ')}</span>}
                {game.series      && <span style={info()}>Series: {game.series}</span>}

                {/* Synopsis — fills remaining height */}
                {game.summary && (
                  <Box flex={1} overflowY="auto" mt={1} pr={1} w="100%" minH={0}
                    sx={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)' } }}>
                    <Text fontSize="xs" color="var(--color-text-secondary)" lineHeight="1.6" m={0}>
                      {game.summary}
                    </Text>
                  </Box>
                )}
              </VStack>
            </HStack>
            {/* Releases */}
            {releases.length > 0 && (
            <Box>
              <button
                onClick={() => setReleasesExpanded((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  marginBottom: releasesExpanded ? '6px' : 0,
                }}
                >
                {releasesExpanded ? <ChevronDownIcon boxSize={3} /> : <ChevronRightIcon boxSize={3} />}
                Releases
              </button>
              {releasesExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {releases.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={info()}>{r.platform || '—'}</span>
                      <span style={info()}>{r.human || r.date || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Box>
            )}

            {showSync && (
            <SyncPanel
              game={{ ...game, title: localTitle }}
                onSynced={() => { setShowSync(false); onUpdated?.(); }}
                onCancel={() => setShowSync(false)}
              />
            )}

            <Divider borderColor="var(--color-border-subtle)" />

            {/* Playthroughs */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="600" color="var(--color-text-secondary)">Playthroughs</Text>
                <Button size="xs" leftIcon={<AddIcon />} variant="ghost" color="var(--color-text-muted)"
                  bg="transparent" border="none" boxShadow="none"
                  _hover={{ color: 'var(--color-text-primary)', bg: 'transparent' }}
                  onClick={() => setShowAddPT((v) => !v)}>
                  Add
                </Button>
              </HStack>

              {showAddPT && (
                <Box mb={2}>
                  <AddPlaythroughForm
                    gameId={game.id}
                    platforms={platforms}
                    onAdded={(pt) => { setPlaythroughs((prev) => [...prev, pt]); setShowAddPT(false); onUpdated?.(); }}
                    onCancel={() => setShowAddPT(false)}
                  />
                </Box>
              )}

              {playthroughs.length === 0 && !showAddPT && (
                <Text fontSize="xs" color="var(--color-text-muted)" fontStyle="italic">
                  No playthroughs yet. Add one to start tracking sessions.
                </Text>
              )}

              {playthroughs.map((pt, i) => (
                <PlaythroughRow
                  key={pt.id} pt={pt} allPlaythroughs={playthroughs} gameId={game.id}
                  onUpdated={() => onUpdated?.()}
                  onDeleted={(ptId) => { setPlaythroughs((prev) => prev.filter((p) => p.id !== ptId)); onUpdated?.(); }}
                />
              ))}
            </Box>

            {/* ── Attachments ───────────────────────────────────────────── */}
            <Divider borderColor="var(--color-border-subtle)" />
            <Box>
              {/* Collapsible header — same style as Releases */}
              <button
                onClick={async () => {
                  const next = !attachmentsExpanded;
                  setAttachmentsExpanded(next);
                  // Lazy-load on first expand
                  if (next && attachments === null) {
                    try {
                      const data = await api.attachments.list(game.id);
                      setAttachments(data);
                    } catch (err) {
                      toast({ title: 'Failed to load attachments', description: err.message, status: 'error', duration: 3000 });
                      setAttachments([]);
                    }
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--color-text-secondary)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  marginBottom: attachmentsExpanded ? '8px' : 0,
                  width: '100%', textAlign: 'left',
                }}
              >
                {attachmentsExpanded
                  ? <ChevronDownIcon  boxSize={3} />
                  : <ChevronRightIcon boxSize={3} />}
                <FiPaperclip size={11} style={{ marginLeft: '2px' }} />
                <span style={{ marginLeft: '4px' }}>Attachments</span>
                {attachments !== null && (
                  <span style={{
                    fontWeight: 400, textTransform: 'none',
                    marginLeft: '4px', color: 'var(--color-text-muted)',
                  }}>
                    ({attachments.length})
                  </span>
                )}
              </button>

              {attachmentsExpanded && (
                <Box>
                  {/* Loading */}
                  {attachments === null && (
                    <Box display="flex" justifyContent="center" py={4}>
                      <Spinner size="sm" style={{ color: 'var(--color-accent)' }} />
                    </Box>
                  )}

                  {/* Empty */}
                  {attachments !== null && attachments.length === 0 && (
                    <Text fontSize="xs" color="var(--color-text-muted)" fontStyle="italic">
                      No attachments yet. Upload images in Notes or Maps to see them here.
                    </Text>
                  )}

                  {/* Lists */}
                  {attachments !== null && attachments.length > 0 && (
                    <VStack spacing={3} align="stretch">
                      {/* Notes Images */}
                      {attachments.filter(a => a.set_type === 'notes').length > 0 && (
                        <Box>
                          <Text fontSize="xs" fontWeight={600} textTransform="uppercase"
                            letterSpacing="0.05em" mb={1.5}
                            style={{ color: 'var(--color-text-muted)' }}>
                            Notes Images
                          </Text>
                          <VStack spacing={1} align="stretch">
                            {attachments
                              .filter(a => a.set_type === 'notes')
                              .map(att => (
                                <AttachmentRow
                                  key={att.id}
                                  att={att}
                                  onDeleted={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
                                />
                              ))}
                          </VStack>
                        </Box>
                      )}

                      {/* Map Images */}
                      {attachments.filter(a => a.set_type === 'maps').length > 0 && (
                        <Box>
                          <Text fontSize="xs" fontWeight={600} textTransform="uppercase"
                            letterSpacing="0.05em" mb={1.5}
                            style={{ color: 'var(--color-text-muted)' }}>
                            Map Images
                          </Text>
                          <VStack spacing={1} align="stretch">
                            {attachments
                              .filter(a => a.set_type === 'maps')
                              .map(att => (
                                <AttachmentRow
                                  key={att.id}
                                  att={att}
                                  onDeleted={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
                                />
                              ))}
                          </VStack>
                        </Box>
                      )}
                    </VStack>
                  )}
                </Box>
              )}
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <HStack justify="space-between" w="full">
            <HStack spacing={2}>
              <HoldToDelete onDelete={handleDelete} />
              {!showSync && (
                <Tooltip
                  label="Set IGDB credentials in Settings to use Sync"
                  isDisabled={hasIgdbCredentials}
                  hasArrow
                  placement="top"
                  openDelay={300}
                >
                <Button size="sm" variant="ghost" leftIcon={<FiRefreshCw size={13} />}
                  color="var(--color-text-muted)" bg="transparent" border="none" boxShadow="none"
                  _hover={{ color: hasIgdbCredentials ? 'var(--color-text-primary)' : 'var(--color-text-muted)', bg: 'transparent' }}
                  isDisabled={!hasIgdbCredentials}
                  onClick={() => setShowSync(true)}>
                  Sync
                </Button>
                </Tooltip>
              )}
            </HStack>
              <Button size="sm" variant="ghost" color="var(--color-text-muted)"
                bg="transparent" border="none" boxShadow="none"
                _hover={{ color: 'var(--color-text-primary)', bg: 'transparent' }}
                onClick={onClose}>
                Close
              </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
