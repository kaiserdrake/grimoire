'use client';

import { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

// Classic tier palette; rows beyond the list cycle through it.
const TIER_COLORS = ['#ff7f7f', '#ffbf7f', '#ffdf7f', '#ffff7f', '#bfff7f', '#7fdfff', '#bf9fff', '#ff9fdf'];
const TRAY_LABEL = 'Unranked';

// ── Serialization ─────────────────────────────────────────────────────────────
// An item is a tiny inline-markdown snippet: optional `:icon[token]`, then either
// plain text or a section link `[text](#slug)`. Items on a tier line are joined by
// ` | `; the first `:` separates a tier's label from its items.

function parseItem(str) {
  let s = str.trim();
  let icon = null;
  const iconM = s.match(/^:icon\[([a-zA-Z0-9_]+)\]\s*/);
  if (iconM) { icon = iconM[1].toLowerCase(); s = s.slice(iconM[0].length).trim(); }
  const linkM = s.match(/^\[([^\]]*)\]\(#([^)]*)\)$/);
  if (linkM) return { icon, text: linkM[1], slug: linkM[2] };
  return { icon, text: s, slug: null };
}

function serializeItem({ icon, text, slug }) {
  const parts = [];
  if (icon) parts.push(`:icon[${icon}]`);
  parts.push(slug ? `[${text}](#${slug})` : text);
  return parts.join(' ');
}

function parseRows(raw) {
  const rows = [];
  (raw || '').split('\n').forEach((line) => {
    if (!line.trim()) return;
    const m = line.match(/^([^:]+):(.*)$/);
    if (!m) return;
    const label = m[1].trim();
    const items = m[2].split('|').map(s => s.trim()).filter(Boolean).map(parseItem);
    rows.push({ label, items });
  });
  if (!rows.some(r => r.label === TRAY_LABEL)) rows.push({ label: TRAY_LABEL, items: [] });
  return rows;
}

function serializeRows(rows) {
  return rows.map(r => `${r.label}: ${r.items.map(serializeItem).join(' | ')}`).join('\n');
}

function sanitizeText(t) {
  return (t || '').replace(/[|\[\]\n]/g, '').trim();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TierList({ raw, iconMap = {}, headings = [], position, onPersist, onNavigateSection }) {
  const rows = parseRows(raw);
  const trayIndex = rows.findIndex(r => r.label === TRAY_LABEL);

  // editor = { mode: 'new' } | { mode: 'edit', label, idx } | null
  const [editor, setEditor] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const commit = (nextRows) => onPersist?.(position, serializeRows(nextRows));

  const moveItem = (fromLabel, fromIdx, toLabel) => {
    const next = rows.map(r => ({ ...r, items: [...r.items] }));
    const from = next.find(r => r.label === fromLabel);
    const to = next.find(r => r.label === toLabel);
    if (!from || !to) return;
    const [item] = from.items.splice(fromIdx, 1);
    if (!item) return;
    to.items.push(item);
    commit(next);
  };

  const saveCard = (card) => {
    const next = rows.map(r => ({ ...r, items: [...r.items] }));
    const clean = { ...card, text: sanitizeText(card.text) };
    if (editor?.mode === 'edit') {
      const row = next.find(r => r.label === editor.label);
      if (row) row.items[editor.idx] = clean;
    } else {
      const tray = next.find(r => r.label === TRAY_LABEL);
      if (tray) tray.items.push(clean);
    }
    commit(next);
    setEditor(null);
  };

  const deleteCard = () => {
    if (editor?.mode !== 'edit') { setEditor(null); return; }
    const next = rows.map(r => ({ ...r, items: [...r.items] }));
    const row = next.find(r => r.label === editor.label);
    if (row) row.items.splice(editor.idx, 1);
    commit(next);
    setEditor(null);
  };

  const onDrop = (toLabel) => (e) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const { fromLabel, fromIdx } = JSON.parse(e.dataTransfer.getData('text/plain'));
      moveItem(fromLabel, fromIdx, toLabel);
    } catch { /* ignore malformed payloads */ }
  };

  const renderCard = (item, label, idx) => (
    <div
      key={`${label}-${idx}`}
      className="tier-item"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ fromLabel: label, fromIdx: idx }))}
    >
      {item.icon && (iconMap[item.icon]
        ? (iconMap[item.icon].name
            ? <span className="note-icon-tip" data-tip={iconMap[item.icon].name}>
                <img className="note-icon" src={iconMap[item.icon].src} alt={iconMap[item.icon].name} draggable="false" />
              </span>
            : <img className="note-icon" src={iconMap[item.icon].src} alt={item.icon} draggable="false" />)
        : <span className="note-icon-missing">{item.icon}?</span>)}
      {item.text && (item.slug
        ? <a className="tier-item-link" onClick={() => onNavigateSection?.(item.slug)}>{item.text}</a>
        : <span className="tier-item-text">{item.text}</span>)}
      <button className="tier-item-edit" title="Edit" onClick={() => setEditor({ mode: 'edit', label, idx })}>
        <FiEdit2 size={11} />
      </button>
    </div>
  );

  return (
    <div className="tier-list">
      {rows.map((row, i) => {
        if (row.label === TRAY_LABEL) return null;
        const color = TIER_COLORS[i % TIER_COLORS.length];
        return (
          <div className="tier-row" key={row.label + i}>
            <div className="tier-label" style={{ background: color }}>{row.label}</div>
            <div
              className={`tier-body${dragOver === row.label ? ' tier-drop-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(row.label); }}
              onDragLeave={() => setDragOver(d => (d === row.label ? null : d))}
              onDrop={onDrop(row.label)}
            >
              {row.items.map((item, idx) => renderCard(item, row.label, idx))}
            </div>
          </div>
        );
      })}

      <div className="tier-tray-header">
        <span>{TRAY_LABEL}</span>
        <button className="tier-add-btn" onClick={() => setEditor({ mode: 'new' })}>
          <FiPlus size={12} /> Add item
        </button>
      </div>
      <div
        className={`tier-tray${dragOver === TRAY_LABEL ? ' tier-drop-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(TRAY_LABEL); }}
        onDragLeave={() => setDragOver(d => (d === TRAY_LABEL ? null : d))}
        onDrop={onDrop(TRAY_LABEL)}
      >
        {trayIndex >= 0 && rows[trayIndex].items.map((item, idx) => renderCard(item, TRAY_LABEL, idx))}
      </div>

      {editor && (
        <CardEditor
          key={editor.mode === 'edit' ? `${editor.label}-${editor.idx}` : 'new'}
          initial={editor.mode === 'edit' ? rows.find(r => r.label === editor.label)?.items[editor.idx] : null}
          iconMap={iconMap}
          headings={headings}
          onSave={saveCard}
          onDelete={editor.mode === 'edit' ? deleteCard : null}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

// ── Card add/edit form ────────────────────────────────────────────────────────
function CardEditor({ initial, iconMap, headings, onSave, onDelete, onClose }) {
  const [text, setText] = useState(initial?.text || '');
  const [icon, setIcon] = useState(initial?.icon || null);
  const [slug, setSlug] = useState(initial?.slug || '');
  const iconEntries = Object.entries(iconMap);

  return (
    <div className="tier-card-editor">
      <div className="tier-card-editor-row">
        <input
          className="tier-card-input"
          placeholder="Label text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="tier-card-close" title="Cancel" onClick={onClose}><FiX size={13} /></button>
      </div>

      <label className="tier-card-field-label">Link to section</label>
      <select className="tier-card-select" value={slug} onChange={(e) => setSlug(e.target.value)}>
        <option value="">— none —</option>
        {headings.map((h, i) => {
          const value = h.slug;
          return <option key={i} value={value}>{'#'.repeat(h.level)} {h.text}</option>;
        })}
      </select>

      {iconEntries.length > 0 && (
        <>
          <label className="tier-card-field-label">Icon</label>
          <div className="tier-card-icons">
            {iconEntries.map(([token, entry]) => (
              <button
                key={token}
                className={`tier-card-icon${icon === token ? ' selected' : ''}`}
                title={entry.name ? `${entry.name} (${token})` : token}
                onClick={() => setIcon(icon === token ? null : token)}
              >
                <img src={entry.src} alt={entry.name || token} draggable="false" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="tier-card-actions">
        {onDelete && (
          <button className="tier-card-delete" onClick={onDelete}><FiTrash2 size={12} /> Delete</button>
        )}
        <button
          className="tier-card-save"
          onClick={() => onSave({ text: text.trim(), icon, slug: slug || null })}
          disabled={!text.trim() && !icon}
        >
          Save
        </button>
      </div>
    </div>
  );
}
