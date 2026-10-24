'use client';

import { useState, useEffect, useRef, Children, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { FiSearch, FiChevronUp, FiChevronDown, FiPlus, FiCamera, FiTrash2, FiX, FiCopy, FiClipboard, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { priorityByRank, MAX_PRIORITY_RANK } from '@/utils/noteTables';

// Custom react-markdown `table` renderer for note tables. Rows can be filtered by
// the columns marked `:search`, every column header is click-to-sort (shift-click
// to build a multi-column chain), and cells in `:check` / `:prio` columns render
// interactive controls that write back to the markdown source. Images in `:img`
// columns render as thumbnails that open full screen, plus a camera button.
// Plain text cells can be double-clicked to edit their raw markdown in place.
//
// The remark plugin in utils/noteTables.js supplies the per-column config and the
// per-cell sort keys / source offsets this component reads off its children.
//
// `onSourceEdit(start, end, text, expected)` replaces that range of the markdown source.
// Omitting it (the bulletin preview) renders the controls read-only.
// `locked` (a locked note) keeps search, checkboxes, priority nudges, snapshots and
// text-cell edits but turns off adding rows.
// `onCaptureImage()` resolves to the markdown of a freshly captured image; without
// it `:img` cells only show their thumbnails. `onClearImage(start, end, expected)`,
// when given, removes a cell's image (and deletes its file) instead of a plain edit.

function matchesQuery(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // OR groups split by ||, AND terms split by && within each group
  return q.split('||').some(orPart =>
    orPart.split('&&').every(term => text.includes(term.trim()))
  );
}

const elementsOf = (children) => Children.toArray(children).filter(isValidElement);

const cx = (...parts) => parts.filter(Boolean).join(' ');

const numAttr = (v) => (v == null || v === '' ? null : Number(v));

const sortText = (cell) => (cell?.props?.['data-sort-text'] ?? '');

const NUMERIC_RE = /^-?[\d.,]+%?$/;

// Ascending comparison of one column, with `dir` applied here so blanks can stay
// last in both directions.
function compareCells(a, b, dir) {
  const flip = dir === 'desc' ? -1 : 1;

  const na = numAttr(a?.props?.['data-sort-num']);
  const nb = numAttr(b?.props?.['data-sort-num']);
  if (na != null && nb != null) return (na - nb) * flip;

  const ta = sortText(a);
  const tb = sortText(b);
  if (!ta && !tb) return 0;
  if (!ta) return 1;
  if (!tb) return -1;

  if (NUMERIC_RE.test(ta) && NUMERIC_RE.test(tb)) {
    const fa = parseFloat(ta.replace(/[,%]/g, ''));
    const fb = parseFloat(tb.replace(/[,%]/g, ''));
    if (!Number.isNaN(fa) && !Number.isNaN(fb)) return (fa - fb) * flip;
  }
  return ta.localeCompare(tb, undefined, { numeric: true, sensitivity: 'base' }) * flip;
}

function parseSortSpec(spec) {
  if (!spec) return [];
  return spec.split(',').reduce((acc, part) => {
    const [col, dir] = part.split(':');
    const i = Number(col);
    if (Number.isInteger(i) && i >= 0) acc.push({ col: i, dir: dir === 'desc' ? 'desc' : 'asc' });
    return acc;
  }, []);
}

// Direction hint shown in the header tooltip, phrased per column type.
function sortHint(kind, dir) {
  if (kind === 'check') return dir === 'asc' ? 'unchecked first' : 'checked first';
  if (kind === 'prio')  return dir === 'asc' ? 'highest priority first' : 'lowest priority first';
  return dir === 'asc' ? 'ascending' : 'descending';
}

// Full-screen image viewer. Portaled to <body> so the preview's CSS `zoom` and
// overflow don't clip it.
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="md-lightbox" onClick={onClose} role="dialog" aria-label="Image viewer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <button type="button" className="md-lightbox-close" aria-label="Close" onClick={onClose}>
        <FiX size={20} />
      </button>
    </div>,
    document.body,
  );
}

// Corner button on an image cell that removes the image only after being held,
// so a stray click can't wipe a snapshot. Same timing as the other hold-to-delete
// buttons in the app.
const HOLD_DURATION = 1800;

function HoldToClear({ onClear, disabled }) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef(null);
  const rafRef   = useRef(null);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    setProgress(0);
  };

  const tick = () => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) rafRef.current = requestAnimationFrame(tick);
    else { reset(); onClear(); }
  };

  const start = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (disabled) return;
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
  };
  const stop = (e) => { e.stopPropagation(); reset(); };

  const holding = progress > 0;
  const radius = 7;
  const size = radius * 2 + 3;
  const circumference = 2 * Math.PI * radius;

  return (
    <button type="button" className={cx('md-img-snap retake clear', holding && 'holding')}
      disabled={disabled} title="Hold to remove image"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchEnd={stop} onTouchCancel={stop}>
      {holding ? (
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={2}
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
      ) : (
        <FiTrash2 size={11} />
      )}
    </button>
  );
}

// A literal `|` would end the cell, so escape any the author typed unescaped.
const escapeCellPipes = (text) => text.replace(/\\?\|/g, (m) => (m === '|' ? '\\|' : m));

// Inline editor for one text cell. Enter or blur commits, Escape cancels. Copy and
// Paste buttons sit beside it; they don't take focus, so using them keeps the
// editor open. Paste needs the async clipboard API (HTTPS or localhost only), so
// it's hidden where the browser doesn't offer clipboard reads.
const canReadClipboard = () => typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

function CellEditor({ initial, onCommit, onCancel }) {
  const [val, setVal] = useState(initial);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const done = useRef(false);
  const finish = (commit) => {
    if (done.current) return;
    done.current = true;
    if (commit && val !== initial) onCommit(val); else onCancel();
  };

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  // Copies the selection, or the whole cell when nothing is selected.
  const copy = async () => {
    const el = inputRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const text = a !== b ? el.value.slice(a, b) : el.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No async clipboard (plain-HTTP origin): copy through the input itself.
      if (a === b) el.select();
      document.execCommand('copy');
      el.setSelectionRange(a, b);
    }
    setCopied(true);
  };

  // Inserts clipboard text at the cursor (replacing any selection). Cells are one
  // line, so line breaks become spaces. execCommand keeps it undoable with Ctrl+Z.
  const paste = async () => {
    const el = inputRef.current;
    if (!el) return;
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { return; }
    text = text.replace(/\s*\r?\n\s*/g, ' ');
    if (!text) return;
    el.focus();
    document.execCommand('insertText', false, text);
  };

  const keepFocus = (e) => e.preventDefault();

  return (
    <span className="md-cell-edit-wrap" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="md-cell-edit"
        autoFocus
        value={val}
        size={Math.max(8, val.length + 1)}
        onChange={(e) => setVal(e.target.value)}
        onFocus={(e) => e.target.select()}
        // A blur from the whole window losing focus (another app, or the browser's
        // clipboard permission prompt) doesn't end the edit.
        onBlur={() => { if (document.hasFocus()) finish(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        }}
      />
      <button type="button" className="md-cell-edit-btn" title={copied ? 'Copied' : 'Copy (selection or whole cell)'}
        onMouseDown={keepFocus} onClick={copy}>
        {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
      </button>
      {canReadClipboard() && (
        <button type="button" className="md-cell-edit-btn" title="Paste from clipboard"
          onMouseDown={keepFocus} onClick={paste}>
          <FiClipboard size={11} />
        </button>
      )}
    </span>
  );
}

export default function NoteTable({
  'data-col-kinds':    colKindsAttr   = '',
  'data-search-cols':  searchColsAttr = '',
  'data-sort-spec':    sortSpecAttr   = '',
  'data-row-template': rowTemplate    = '',
  'data-table-end':    tableEndAttr,
  'data-done-col':     doneColAttr    = '-1',
  'data-hide-done':    hideDoneAttr   = '0',
  'data-reverse':      reverseAttr    = '0',
  tableIndex, initialSearch, onSourceEdit: sourceEdit, onCaptureImage, onClearImage, locked, children, ...props
}) {
  const [query, setQuery] = useState(initialSearch ?? '');
  // Hide rows ticked in the "done" `:check` column. Seeded by a `:hidedone` header
  // tag and re-seeded when that tag is edited; the toggle itself never edits the note.
  const [doneView, setDoneView] = useState(() => ({ seed: hideDoneAttr, hide: hideDoneAttr === '1' }));
  if (doneView.seed !== hideDoneAttr) setDoneView({ seed: hideDoneAttr, hide: hideDoneAttr === '1' });
  const [lightbox, setLightbox] = useState(null);           // { src, alt }
  const [capturing, setCapturing] = useState(() => new Set()); // src-start of cells mid-capture
  const [editing, setEditing] = useState(null);             // src-start of the text cell being edited
  // Clicking headers overrides the `:sortN` tokens, but editing those tokens in the
  // markdown re-seeds the chain — otherwise the author's change would do nothing
  // until the table remounted.
  //
  // `pinned` freezes the row order (document indexes, as displayed) once a control
  // in a sorted table edits the source, so ticking a checkbox or nudging a priority
  // doesn't make the row jump. Choosing a sort again releases it.
  //
  // `reverse` shows document order bottom-to-top (and breaks sort ties that way);
  // seeded by a `:reverse` header tag, flipped by the Reverse toggle.
  const [sortState, setSortState] = useState(() => ({
    spec: sortSpecAttr, chain: parseSortSpec(sortSpecAttr), pinned: null,
    revSeed: reverseAttr, reverse: reverseAttr === '1',
  }));
  if (sortState.spec !== sortSpecAttr || sortState.revSeed !== reverseAttr) {
    setSortState(s => ({
      ...s,
      ...(s.spec !== sortSpecAttr && { spec: sortSpecAttr, chain: parseSortSpec(sortSpecAttr) }),
      ...(s.revSeed !== reverseAttr && { revSeed: reverseAttr, reverse: reverseAttr === '1' }),
      pinned: null,
    }));
  }
  const sort = sortState.chain;
  const { reverse } = sortState;
  const toggleReverse = () => setSortState(s => ({ ...s, reverse: !s.reverse, pinned: null }));
  const setSort = (next) => setSortState(s => ({ ...s, pinned: null, chain: typeof next === 'function' ? next(s.chain) : next }));
  const displayOrder = useRef([]);

  const pinOrder = () => {
    if (sort.length) setSortState(s => ({ ...s, pinned: s.pinned ?? displayOrder.current }));
  };
  const onSourceEdit = sourceEdit && ((...args) => { pinOrder(); sourceEdit(...args); });

  const colKinds   = colKindsAttr ? colKindsAttr.split(',') : [];
  const searchCols = searchColsAttr ? searchColsAttr.split(',').map(Number) : [];

  const sections = elementsOf(children);
  const thead = sections.find(c => c.type === 'thead');
  const tbody = sections.find(c => c.type === 'tbody');

  const toggleSort = (col, additive) => {
    setSort((prev) => {
      const idx = prev.findIndex(s => s.col === col);
      if (additive) {
        // Shift-click cycles this column asc → desc → out of the chain, keeping
        // the other columns and their order untouched.
        if (idx === -1) return [...prev, { col, dir: 'asc' }];
        if (prev[idx].dir === 'asc') return prev.map((s, i) => (i === idx ? { ...s, dir: 'desc' } : s));
        return prev.filter((_, i) => i !== idx);
      }
      if (prev.length === 1 && idx === 0) return prev[0].dir === 'asc' ? [{ col, dir: 'desc' }] : [];
      return [{ col, dir: 'asc' }];
    });
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  const renderTh = (th, ci) => {
    const entry = sort.find(s => s.col === ci);
    const rank  = entry && sort.length > 1 ? sort.indexOf(entry) + 1 : null;
    const nextDir = entry?.dir === 'asc' ? 'desc' : 'asc';
    return cloneElement(
      th,
      {
        key: th.key,
        className: cx(th.props.className, 'md-th-sortable', entry && 'md-th-sorted'),
        // The second click of a double-click doesn't count, so double-clicking a
        // header doesn't flip the sort to descending by accident.
        onClick: (e) => { if (e.detail <= 1) toggleSort(ci, e.shiftKey); },
        title: `Sort ${sortHint(colKinds[ci], entry ? nextDir : 'asc')}` +
               ' — shift-click to add to the sort chain',
      },
      <span className="md-th-inner">
        <span>{th.props.children}</span>
        <span className={cx('md-sort-ind', entry && 'active')}>
          {entry?.dir === 'desc' ? <FiChevronDown size={11} /> : <FiChevronUp size={11} />}
          {rank && <span className="md-sort-rank">{rank}</span>}
        </span>
      </span>,
    );
  };

  const renderedHead = thead && cloneElement(
    thead,
    {},
    elementsOf(thead.props.children).map(tr =>
      cloneElement(tr, { key: tr.key }, elementsOf(tr.props.children).map(renderTh))),
  );

  // ── Cells ───────────────────────────────────────────────────────────────────
  const openImage = (e) => {
    if (e.target.tagName !== 'IMG') return;
    e.preventDefault();
    e.stopPropagation(); // present mode treats a preview click as "exit"
    setLightbox({ src: e.target.currentSrc || e.target.src, alt: e.target.alt });
  };

  const renderImageCell = (td, start, end) => {
    const canCapture = !!onSourceEdit && !!onCaptureImage && start != null && end != null;
    const busy = capturing.has(start);
    const hasImg = td.props['data-has-img'] === '1';
    const canClear = !!onSourceEdit && hasImg && start != null && end != null;

    const clear = () => {
      if (busy) return;
      const expected = td.props['data-src-text'] ?? '';
      if (onClearImage) { pinOrder(); onClearImage(start, end, expected); }
      else onSourceEdit(start, end, '', expected);
    };

    const capture = async (e) => {
      e.stopPropagation();
      if (busy) return;
      setCapturing(s => new Set(s).add(start));
      try {
        const md = await onCaptureImage();
        if (md) onSourceEdit(start, end, start === end ? `${md} ` : md, td.props['data-src-text'] ?? '');
      } finally {
        setCapturing(s => { const n = new Set(s); n.delete(start); return n; });
      }
    };

    return cloneElement(
      td,
      { key: td.key, className: cx(td.props.className, 'md-td-img'), onClick: openImage },
      <>
        {td.props.children}
        {canCapture && (
          <button type="button" className={cx('md-img-snap', hasImg && 'retake', busy && 'busy')}
            onClick={capture} disabled={busy}
            title={hasImg ? 'Retake snapshot from camera' : 'Snapshot from camera'}>
            <FiCamera size={hasImg ? 11 : 14} />
          </button>
        )}
        {canClear && <HoldToClear onClear={clear} disabled={busy} />}
      </>,
    );
  };

  const renderTextCell = (td, start, end) => {
    if (!onSourceEdit || start == null || end == null) return td;
    const original = td.props['data-src-text'] ?? '';
    const blank = td.props['data-cell-empty'] === '1';
    if (editing === start) {
      const commit = (text) => {
        setEditing(null);
        const next = escapeCellPipes(text.trim());
        // A blank cell's range spans its whole interior, pipes excluded — pad it.
        onSourceEdit(start, end, blank ? ` ${next} ` : next, original);
      };
      return cloneElement(
        td,
        { key: td.key, className: cx(td.props.className, 'md-td-editing') },
        <CellEditor initial={blank ? '' : original} onCommit={commit} onCancel={() => setEditing(null)} />,
      );
    }
    return cloneElement(td, {
      key: td.key,
      className: cx(td.props.className, 'md-td-editable'),
      title: 'Double-click to edit',
      onDoubleClick: (e) => {
        if (e.target.closest?.('a, button, input')) return;
        e.preventDefault();
        window.getSelection?.()?.removeAllRanges();
        setEditing(start);
      },
    });
  };

  const renderCell = (td) => {
    const kind = td.props['data-cell-kind'];
    const start = numAttr(td.props['data-src-start']);
    const end   = numAttr(td.props['data-src-end']);
    if (kind === 'img') return renderImageCell(td, start, end);
    if (kind === 'text') return renderTextCell(td, start, end);
    if (kind !== 'check' && kind !== 'prio') return td;

    const editable = !!onSourceEdit && start != null && end != null;
    // An empty range means the cell has no token yet, so we insert one.
    const write = (text) => onSourceEdit(start, end, start === end ? `${text} ` : text);

    let control;
    if (kind === 'check') {
      const checked = td.props['data-checked'] === '1';
      control = (
        <input
          type="checkbox"
          className="md-cell-check"
          checked={checked}
          disabled={!editable}
          onChange={() => write(checked ? '[ ]' : '[x]')}
          aria-label={checked ? 'Done' : 'Not done'}
        />
      );
    } else {
      const rank  = numAttr(td.props['data-prio-rank']) ?? 0;
      const level = priorityByRank(rank);
      const nudge = (delta) => write(priorityByRank(rank + delta).write);
      control = (
        <span className="md-prio" data-level={level.key}>
          <span className="md-prio-label">{level.label}</span>
          {editable && (
            <span className="md-prio-ctl">
              <button type="button" title="Raise priority"
                disabled={rank >= MAX_PRIORITY_RANK} onClick={() => nudge(1)}>
                <FiChevronUp size={9} />
              </button>
              <button type="button" title="Lower priority"
                disabled={rank <= 0} onClick={() => nudge(-1)}>
                <FiChevronDown size={9} />
              </button>
            </span>
          )}
        </span>
      );
    }

    return cloneElement(
      td,
      { key: td.key, className: cx(td.props.className, `md-td-${kind}`) },
      <>{control}{td.props.children}</>,
    );
  };

  // ── Body ────────────────────────────────────────────────────────────────────
  let rows = tbody
    ? elementsOf(tbody.props.children).map((tr, i) => ({ tr, i, cells: elementsOf(tr.props.children) }))
    : [];

  const { pinned } = sortState;
  if (pinned) {
    // Frozen order; rows that weren't there when it froze (just added) go last.
    const pos = new Map(pinned.map((i, k) => [i, k]));
    rows = [...rows].sort((a, b) => (pos.get(a.i) ?? Infinity) - (pos.get(b.i) ?? Infinity) || a.i - b.i);
  } else if (sort.length) {
    rows = [...rows].sort((a, b) => {
      for (const { col, dir } of sort) {
        const c = compareCells(a.cells[col], b.cells[col], dir);
        if (c) return c;
      }
      return reverse ? b.i - a.i : a.i - b.i; // stable: fall back to document order
    });
  } else if (reverse) {
    rows = [...rows].reverse();
  }
  displayOrder.current = rows.map(r => r.i);

  const doneCol = Number(doneColAttr);
  const isDone = (row) => row.cells[doneCol]?.props?.['data-checked'] === '1';
  const doneCount = doneCol >= 0 ? rows.filter(isDone).length : 0;
  if (doneCol >= 0 && doneView.hide) rows = rows.filter(row => !isDone(row));

  if (query.trim() && searchCols.length) {
    const haystack = (row) => searchCols.map(c => sortText(row.cells[c])).join('   ').toLowerCase();
    rows = rows.filter(row => matchesQuery(haystack(row), query));
  }

  const renderedBody = tbody && cloneElement(
    tbody,
    {},
    rows.map(({ tr, cells }) => cloneElement(tr, { key: tr.key }, cells.map(renderCell))),
  );

  // ── Add row ─────────────────────────────────────────────────────────────────
  const tableEnd = numAttr(tableEndAttr);
  const canAddRow = !!onSourceEdit && !locked && tableEnd != null && !!rowTemplate;
  const addRow = () => {
    // An active filter would hide the blank row, making the click look like a
    // no-op — so clear it and show the row that was just added.
    setQuery('');
    onSourceEdit(tableEnd, tableEnd, `\n${rowTemplate}`);
  };

  const table = (
    <>
      <table {...props}>{renderedHead}{renderedBody}</table>
      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} />}
    </>
  );

  const showDoneToggle = doneCol >= 0;
  // Reverse is offered on the notes page (not read-only previews) once there's an
  // order to flip.
  const showReverse = !!sourceEdit && (displayOrder.current.length > 1 || reverse);
  if (!searchCols.length && !canAddRow && !showDoneToggle && !showReverse) return table;

  return (
    <div className="md-table-wrap">
      {(searchCols.length > 0 || showDoneToggle) && (
        <div className="md-table-controls">
          {searchCols.length > 0 && (
            <div className="md-table-search-wrap">
              <FiSearch size={13} className="md-table-search-icon" />
              <input
                className="md-table-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter rows…"
              />
            </div>
          )}
          {showDoneToggle && (
            <button type="button" className={cx('md-table-done-toggle', doneView.hide && 'active')}
              onClick={() => setDoneView(v => ({ ...v, hide: !v.hide }))}
              title={doneView.hide ? 'Show rows that are ticked done' : 'Hide rows that are ticked done'}>
              {doneView.hide ? <FiEye size={11} /> : <FiEyeOff size={11} />}
              {doneView.hide ? `Show done (${doneCount})` : `Hide done (${doneCount})`}
            </button>
          )}
        </div>
      )}
      {table}
      {(canAddRow || showReverse) && (
        <div className="md-table-footer">
          {canAddRow && (
            <button type="button" className="md-table-add-row" onClick={addRow} title="Append an empty row">
              <FiPlus size={11} /> Row
            </button>
          )}
          {showReverse && (
            <button type="button" className={cx('md-table-add-row', reverse && 'active')} onClick={toggleReverse}
              title={reverse ? 'Showing bottom-to-top — click for document order' : 'Show rows bottom-to-top (newest first)'}>
              <span aria-hidden="true">⇅</span> {reverse ? 'Reversed' : 'Reverse'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
