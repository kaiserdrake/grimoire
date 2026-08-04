// ── Note tables ───────────────────────────────────────────────────────────────
// Markdown tables in notes gain interactive behaviour from tokens placed in their
// header cells. A token is stripped from the header before it renders, so the
// table still reads as plain markdown everywhere else.
//
//   :search        rows can be filtered by this column (was the only token before)
//   :check         cells hold `[ ]` / `[x]` and render as toggleable checkboxes
//   :prio          cells hold a priority level and render as a pill with ▲ / ▼
//   :sort[n][dir]  initial sort; `n` is the position in the multi-sort chain and
//                  `dir` is asc (default) or desc — e.g. `:sort1` `:sort2desc`
//
//   | Task :search | Done :check :sort1 | Priority :prio :sort2 |
//   | --- | --- | --- |
//   | Beat the boss | [x] | High |
//
// Every column is click-to-sort in the rendered table regardless of tokens (see
// NoteTable.js); the tokens only seed the initial ordering.
//
// Toggling a checkbox or nudging a priority edits the markdown source, so each
// body cell carries the source offsets of its token (`data-src-start` /
// `data-src-end`). Offsets are read straight off the source text rather than off
// mdast text nodes, which other plugins in the chain may already have split.
//
// Requires remarkDirective + makeRemarkMetaPlugin() to run earlier so `:check` and
// friends arrive here as literal text rather than directive nodes.

// ── Priority levels ───────────────────────────────────────────────────────────
// `rank` orders the levels; `write` is what a ▲/▼ nudge puts back in the source.
export const PRIORITY_LEVELS = [
  { key: 'none',     label: '—',        rank: 0, write: '-',        aliases: ['none', '-', 'p4'] },
  { key: 'low',      label: 'Low',      rank: 1, write: 'Low',      aliases: ['low', 'p3'] },
  { key: 'medium',   label: 'Medium',   rank: 2, write: 'Medium',   aliases: ['medium', 'med', 'normal', 'p2'] },
  { key: 'high',     label: 'High',     rank: 3, write: 'High',     aliases: ['high', 'p1'] },
  { key: 'critical', label: 'Critical', rank: 4, write: 'Critical', aliases: ['critical', 'urgent', 'p0'] },
];

export const MAX_PRIORITY_RANK = PRIORITY_LEVELS.length - 1;

export function priorityByRank(rank) {
  const r = Math.max(0, Math.min(MAX_PRIORITY_RANK, Number(rank) || 0));
  return PRIORITY_LEVELS.find(l => l.rank === r) ?? PRIORITY_LEVELS[0];
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest aliases first so `medium` wins over a hypothetical `med` prefix.
const ALIAS_ENTRIES = PRIORITY_LEVELS
  .flatMap(level => level.aliases.map(alias => [alias, level]))
  .sort((a, b) => b[0].length - a[0].length);

// Matches a priority word standing on its own inside a cell. Group 2 is the word;
// group 1 is the (possibly empty) boundary consumed before it.
const PRIORITY_TOKEN_RE = new RegExp(
  `(^|[\\s(])(${ALIAS_ENTRIES.map(([alias]) => escapeRe(alias)).join('|')})(?=$|[\\s).,;:!])`,
  'i',
);

const CHECK_TOKEN_RE = /\[([ xX])\]/;

// Header tokens. The trailing lookahead keeps `:searching` from matching `:search`.
const HEADER_TOKEN_RE =
  /:(search|checkbox|check|priority|prio|sort)(\d*)(?:[-_]?(asc|desc))?(?![a-z0-9])/gi;

// Tokens handled by sibling plugins — excluded from a cell's sort text so a cell
// of icons doesn't sort by its raw `:icon[…]` markup.
const OTHER_TOKENS_RE = /:(?:icon|btn)\[[^\]]*\]/g;

// ── mdast helpers ─────────────────────────────────────────────────────────────
function forEachTextNode(node, fn) {
  if (node.type === 'text') { fn(node); return; }
  (node.children || []).forEach(child => forEachTextNode(child, fn));
}

// Remove the first match of `re` from the cell's text, leaving the surrounding
// text alone. Whitespace is not tidied — HTML collapses it in the rendered cell.
function stripFirst(cell, re) {
  let done = false;
  forEachTextNode(cell, (t) => {
    if (done) return;
    const next = t.value.replace(re, () => { done = true; return ''; });
    if (done) t.value = next;
  });
}

// The cell's plain text, used for filtering and for sorting untyped columns.
function cellText(node) {
  const out = [];
  const walk = (n) => {
    if (n.type === 'text' || n.type === 'inlineCode') { out.push(n.value); return; }
    if (n.type === 'image' && n.alt) { out.push(n.alt); return; }
    (n.children || []).forEach(walk);
  };
  walk(node);
  return out.join('').replace(OTHER_TOKENS_RE, '').replace(/\s+/g, ' ').trim();
}

function setProps(node, props) {
  node.data = node.data || {};
  node.data.hProperties = { ...(node.data.hProperties || {}), ...props };
}

// ── Header parsing ────────────────────────────────────────────────────────────
function readHeaderConfig(cell) {
  const cfg = { search: false, kind: null, sortRank: null, sortDir: 'asc' };
  forEachTextNode(cell, (t) => {
    t.value = t.value.replace(HEADER_TOKEN_RE, (_full, name, digits, dir) => {
      switch (name.toLowerCase()) {
        case 'search':   cfg.search = true; break;
        case 'check':
        case 'checkbox': cfg.kind = 'check'; break;
        case 'prio':
        case 'priority': cfg.kind = 'prio'; break;
        case 'sort':
          cfg.sortRank = digits ? Number(digits) : 1;
          if (dir) cfg.sortDir = dir.toLowerCase();
          break;
      }
      return '';
    });
  });
  return cfg;
}

// ── Body cells ────────────────────────────────────────────────────────────────
// `src` is the full markdown; cell positions index into it.
function annotateCell(cell, kind, src) {
  const start = cell.position?.start?.offset;
  const end   = cell.position?.end?.offset;
  const cellSrc = (start != null && end != null) ? src.slice(start, end) : '';
  const props = {};

  // Where a first token gets inserted when the cell has none. An empty cell has a
  // zero-width position sitting on its opening `|`, so step past the pipe —
  // otherwise the insert would land at the end of the previous cell.
  const insertAt = (start != null && src[start] === '|') ? start + 1 : start;

  if (kind === 'check') {
    const m = CHECK_TOKEN_RE.exec(cellSrc);
    const checked = !!m && m[1].toLowerCase() === 'x';
    props['data-cell-kind'] = 'check';
    props['data-checked']   = checked ? '1' : '0';
    props['data-sort-num']  = checked ? '1' : '0';
    if (start != null) {
      props['data-src-start'] = String(m ? start + m.index : insertAt);
      props['data-src-end']   = String(m ? start + m.index + m[0].length : insertAt);
    }
    if (m) stripFirst(cell, CHECK_TOKEN_RE);
  } else if (kind === 'prio') {
    const m = PRIORITY_TOKEN_RE.exec(cellSrc);
    const level = m
      ? (ALIAS_ENTRIES.find(([alias]) => alias === m[2].toLowerCase())?.[1] ?? PRIORITY_LEVELS[0])
      : PRIORITY_LEVELS[0];
    props['data-cell-kind'] = 'prio';
    props['data-prio']      = level.key;
    props['data-prio-rank'] = String(level.rank);
    // Negated so ascending puts the most urgent rows first.
    props['data-sort-num']  = String(MAX_PRIORITY_RANK - level.rank);
    if (start != null) {
      const tokenStart = m ? start + m.index + m[1].length : insertAt;
      props['data-src-start'] = String(tokenStart);
      props['data-src-end']   = String(m ? tokenStart + m[2].length : insertAt);
    }
    if (m) stripFirst(cell, PRIORITY_TOKEN_RE);
  }

  props['data-sort-text'] = cellText(cell);
  setProps(cell, props);
}

function enhanceTable(node, src) {
  const rows = node.children || [];
  const header = rows[0];
  if (!header) return;

  const cols = (header.children || []).map(readHeaderConfig);

  rows.slice(1).forEach((row) => {
    (row.children || []).forEach((cell, ci) => annotateCell(cell, cols[ci]?.kind ?? null, src));
  });

  const sortSpec = cols
    .map((cfg, i) => ({ ...cfg, i }))
    .filter(cfg => cfg.sortRank != null)
    .sort((a, b) => a.sortRank - b.sortRank || a.i - b.i)
    .map(cfg => `${cfg.i}:${cfg.sortDir}`)
    .join(',');

  setProps(node, {
    'data-note-table': 'true',
    'data-col-kinds': cols.map(c => c.kind || 'text').join(','),
    'data-search-cols': cols.map((c, i) => (c.search ? i : -1)).filter(i => i >= 0).join(','),
    'data-sort-spec': sortSpec,
  });
}

// Remark plugin: reads header tokens, tags the table and its body cells, and
// strips every token it consumed from the rendered text.
export function makeRemarkNoteTablePlugin() {
  return function remarkNoteTable() {
    return (tree, file) => {
      const src = file ? String(file.value) : '';
      const visit = (node) => {
        if (node.type === 'table') { enhanceTable(node, src); return; }
        (node.children || []).forEach(visit);
      };
      visit(tree);
    };
  };
}
