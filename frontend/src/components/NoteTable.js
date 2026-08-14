'use client';

import { useState, Children, cloneElement, isValidElement } from 'react';
import { FiSearch, FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi';
import { priorityByRank, MAX_PRIORITY_RANK } from '@/utils/noteTables';

// Custom react-markdown `table` renderer for note tables. Rows can be filtered by
// the columns marked `:search`, every column header is click-to-sort (shift-click
// to build a multi-column chain), and cells in `:check` / `:prio` columns render
// interactive controls that write back to the markdown source.
//
// The remark plugin in utils/noteTables.js supplies the per-column config and the
// per-cell sort keys / source offsets this component reads off its children.
//
// `onSourceEdit(start, end, text)` replaces that range of the markdown source.
// Omitting it (the bulletin preview) renders the controls read-only.

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

export default function NoteTable({
  'data-col-kinds':    colKindsAttr   = '',
  'data-search-cols':  searchColsAttr = '',
  'data-sort-spec':    sortSpecAttr   = '',
  'data-row-template': rowTemplate    = '',
  'data-table-end':    tableEndAttr,
  tableIndex, initialSearch, onSourceEdit, children, ...props
}) {
  const [query, setQuery] = useState(initialSearch ?? '');
  // Clicking headers overrides the `:sortN` tokens, but editing those tokens in the
  // markdown re-seeds the chain — otherwise the author's change would do nothing
  // until the table remounted.
  const [sortState, setSortState] = useState(() => ({ spec: sortSpecAttr, chain: parseSortSpec(sortSpecAttr) }));
  if (sortState.spec !== sortSpecAttr) {
    setSortState({ spec: sortSpecAttr, chain: parseSortSpec(sortSpecAttr) });
  }
  const sort = sortState.chain;
  const setSort = (next) => setSortState(s => ({ ...s, chain: typeof next === 'function' ? next(s.chain) : next }));

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
        onClick: (e) => toggleSort(ci, e.shiftKey),
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
  const renderCell = (td) => {
    const kind = td.props['data-cell-kind'];
    if (kind !== 'check' && kind !== 'prio') return td;

    const start = numAttr(td.props['data-src-start']);
    const end   = numAttr(td.props['data-src-end']);
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

  if (query.trim() && searchCols.length) {
    const haystack = (row) => searchCols.map(c => sortText(row.cells[c])).join('   ').toLowerCase();
    rows = rows.filter(row => matchesQuery(haystack(row), query));
  }

  if (sort.length) {
    rows = [...rows].sort((a, b) => {
      for (const { col, dir } of sort) {
        const c = compareCells(a.cells[col], b.cells[col], dir);
        if (c) return c;
      }
      return a.i - b.i; // stable: fall back to document order
    });
  }

  const renderedBody = tbody && cloneElement(
    tbody,
    {},
    rows.map(({ tr, cells }) => cloneElement(tr, { key: tr.key }, cells.map(renderCell))),
  );

  // ── Add row ─────────────────────────────────────────────────────────────────
  const tableEnd = numAttr(tableEndAttr);
  const canAddRow = !!onSourceEdit && tableEnd != null && !!rowTemplate;
  const addRow = () => {
    // An active filter would hide the blank row, making the click look like a
    // no-op — so clear it and show the row that was just added.
    setQuery('');
    onSourceEdit(tableEnd, tableEnd, `\n${rowTemplate}`);
  };

  const table = <table {...props}>{renderedHead}{renderedBody}</table>;

  if (!searchCols.length && !canAddRow) return table;

  return (
    <div className="md-table-wrap">
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
      {table}
      {canAddRow && (
        <button type="button" className="md-table-add-row" onClick={addRow} title="Append an empty row">
          <FiPlus size={11} /> Row
        </button>
      )}
    </div>
  );
}
