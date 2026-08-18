'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalOverlay, ModalContent, Input, Text } from '@chakra-ui/react';
import { FiSearch, FiMap, FiCheck } from 'react-icons/fi';
import { PinIcon, parsePinStyle, pinTypeLabel } from '@/constants/pins';
import { ptSidebarLabel } from '@/utils/playthroughs';

const MAX_RESULTS = 50;

// `is:` / `type:` tokens are pulled out of the query; whatever is left is the
// free text matched against labels and notes.
function parseQuery(raw) {
  const filters = { found: null, type: null };
  const words = [];
  raw.trim().split(/\s+/).filter(Boolean).forEach((w) => {
    const m = /^(is|type):(.+)$/i.exec(w);
    if (!m) { words.push(w.toLowerCase()); return; }
    const [, key, value] = m;
    if (key.toLowerCase() === 'is') {
      if (/^unfound$/i.test(value)) filters.found = false;
      else if (/^found$/i.test(value)) filters.found = true;
      else words.push(w.toLowerCase());
    } else {
      filters.type = value.toLowerCase();
    }
  });
  return { filters, text: words.join(' ') };
}

// Lower is better. A label match beats a note match, a prefix beats a hit
// anywhere, and the map already open wins ties — jumping across maps should be
// deliberate, not the default.
function score(entry, text, activeMapId) {
  const label = (entry.pin.label || '').toLowerCase();
  const note  = (entry.pin.description || '').toLowerCase();
  let s;
  if (!text) s = 40;
  else if (label.startsWith(text)) s = 0;
  else if (label.includes(text)) s = 10;
  else if (entry.typeName.toLowerCase().includes(text)) s = 20;
  else if (note.includes(text)) s = 30;
  else return null;
  return s + (entry.map.id === activeMapId ? 0 : 1);
}

// Find-a-marker palette: searches every pin in the game — not just the open map
// — and hands the chosen one back for the caller to switch to and fly at.
export default function MapSearch({
  isOpen, onClose, playthroughs, mapsByPt, pinsByMap, mapDefaults,
  activeMapId, onSelect,
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  // Every pin in the game, flattened once with the context each row displays.
  // Derived from mapDefaults rather than taking the page's trackable Set, whose
  // identity changes every render and would rebuild this index each time.
  const entries = useMemo(() => {
    const named = new Map();
    const trackable = new Set();
    (mapDefaults || []).forEach((d) => {
      const key = `${d.color}:${d.icon}`;
      named.set(key, d.label);
      if (d.trackable) trackable.add(key);
    });
    const out = [];
    (playthroughs || []).forEach((pt) => {
      (mapsByPt[pt.id] || []).forEach((map) => {
        (pinsByMap[map.id] || []).forEach((pin) => {
          const style = parsePinStyle(pin.color);
          const key = `${style.color}:${style.icon}`;
          out.push({
            pin, map, pt, style, key,
            typeName: named.get(key) || pinTypeLabel(style.icon),
            trackable: trackable.has(key),
          });
        });
      });
    });
    return out;
  }, [playthroughs, mapsByPt, pinsByMap, mapDefaults]);

  const { filters, text } = useMemo(() => parseQuery(query), [query]);

  const results = useMemo(() => {
    const scored = [];
    for (const entry of entries) {
      if (filters.found !== null && !!entry.pin.found !== filters.found) continue;
      if (filters.type && !entry.typeName.toLowerCase().includes(filters.type)) continue;
      const s = score(entry, text, activeMapId);
      if (s === null) continue;
      scored.push({ entry, s });
    }
    scored.sort((a, b) => a.s - b.s || a.entry.pin.id - b.entry.pin.id);
    return scored.slice(0, MAX_RESULTS).map(r => r.entry);
  }, [entries, filters.found, filters.type, text, activeMapId]);

  const total = useMemo(() => {
    if (!filters.type && filters.found === null && !text) return entries.length;
    return entries.filter((entry) => {
      if (filters.found !== null && !!entry.pin.found !== filters.found) return false;
      if (filters.type && !entry.typeName.toLowerCase().includes(filters.type)) return false;
      return score(entry, text, activeMapId) !== null;
    }).length;
  }, [entries, filters.found, filters.type, text, activeMapId]);

  // A fresh query starts at the top; reopening starts clean.
  useEffect(() => { setCursor(0); }, [query]);
  useEffect(() => { if (isOpen) { setQuery(''); setCursor(0); } }, [isOpen]);

  // Keep the highlighted row in view as the cursor walks past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, results]);

  const choose = (entry) => {
    if (!entry) return;
    onClose();
    onSelect(entry.pin, entry.map, entry.pt.id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Home')      { e.preventDefault(); setCursor(0); }
    else if (e.key === 'End')       { e.preventDefault(); setCursor(results.length - 1); }
    else if (e.key === 'Enter')     { e.preventDefault(); choose(results[cursor]); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered scrollBehavior="inside">
      <ModalOverlay style={{ background: 'rgba(0,0,0,0.55)' }} />
      <ModalContent className="map-search" style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        marginTop: '12vh',
        alignSelf: 'flex-start',
      }}>
        <div className="map-search-field">
          <FiSearch size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <Input
            autoFocus
            variant="unstyled"
            placeholder="Search every pin in this game…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}
          />
          <Text fontSize="10px" style={{ color: 'var(--color-text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {results.length === 0 ? 'no matches' : `${Math.min(results.length, total)} of ${total}`}
          </Text>
        </div>

        <div className="map-search-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="map-search-empty">
              <Text fontSize="xs">Nothing matches that.</Text>
              <Text fontSize="10px" mt={1}>
                Try a label, a word from a note, <code>is:unfound</code>, or <code>type:treasure</code>.
              </Text>
            </div>
          ) : results.map((entry, i) => (
            <div
              key={`${entry.map.id}:${entry.pin.id}`}
              data-active={i === cursor}
              className="map-search-row"
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(entry)}
            >
              <div className="map-search-icon">
                <PinIcon color={entry.style.color} icon={entry.style.icon} size={18} />
              </div>
              <div className="map-search-text">
                <div className="map-search-label">
                  {entry.pin.label}
                  {entry.trackable && entry.pin.found && (
                    <span className="map-search-found"><FiCheck size={9} /> found</span>
                  )}
                </div>
                {entry.pin.description && (
                  <div className="map-search-note">{entry.pin.description}</div>
                )}
              </div>
              <div className="map-search-where">
                <FiMap size={10} style={{ flexShrink: 0 }} />
                <span>{entry.map.name}</span>
                <span className="map-search-pt">{ptSidebarLabel(entry.pt, playthroughs)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="map-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> jump</span>
          <span><kbd>esc</kbd> close</span>
          <span className="map-search-hint">is:unfound · type:chest</span>
        </div>
      </ModalContent>
    </Modal>
  );
}
