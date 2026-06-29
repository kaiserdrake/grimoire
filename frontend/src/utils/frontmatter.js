// ── Frontmatter properties panel ──────────────────────────────────────────────
// Renders leading YAML frontmatter (captured by remarkFrontmatter as a `yaml`
// node) as a collapsible "Properties" table, à la Obsidian. Values are rendered
// by type: arrays as pills, booleans as badges, dates/scalars as text, nested
// objects as an indented sub-table. Malformed YAML falls back to a raw code block
// so nothing is silently lost.
//
// Requires remarkFrontmatter (configured for 'yaml') earlier in the plugin chain.

import { parse as parseYaml } from 'yaml';

// ── tiny hast builders ────────────────────────────────────────────────────────
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const txt = (value) => ({ type: 'text', value: String(value) });

function formatDate(d) {
  const iso = d.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

// Render one YAML value into an array of hast children.
function renderValue(value) {
  if (value == null) return [el('span', { className: ['note-frontmatter-muted'] }, [txt('—')])];
  if (typeof value === 'boolean') {
    return [el('span', {
      className: ['note-frontmatter-bool'],
      'data-value': String(value),
    }, [txt(String(value))])];
  }
  if (value instanceof Date) return [txt(formatDate(value))];
  if (Array.isArray(value)) {
    if (value.length === 0) return [el('span', { className: ['note-frontmatter-muted'] }, [txt('—')])];
    return [el('span', { className: ['note-frontmatter-pills'] },
      value.map(item => el('span', { className: ['note-frontmatter-pill'] },
        [txt(isPlainObject(item) || Array.isArray(item) ? JSON.stringify(item) : item)])))];
  }
  if (isPlainObject(value)) return [buildTable(value, true)];
  return [txt(value)];
}

// Build the key/value table (or sub-table for nested objects).
function buildTable(obj, nested = false) {
  const rows = Object.entries(obj).map(([key, value]) =>
    el('tr', {}, [
      el('td', { className: ['note-frontmatter-key'] }, [txt(key)]),
      el('td', { className: ['note-frontmatter-value'] }, renderValue(value)),
    ]));
  return el('table', {
    className: nested ? ['note-frontmatter-subtable'] : ['note-frontmatter-table'],
  }, [el('tbody', {}, rows)]);
}

// Convert a `yaml` node in place into a collapsible properties panel. The node
// type is changed away from `yaml` because mdast-util-to-hast (remark-rehype)
// has a built-in handler that drops `yaml` nodes and would ignore our hName.
function renderFrontmatter(node) {
  let data;
  try {
    data = parseYaml(node.value);
  } catch {
    // Parse failure: show the raw block instead of dropping it.
    node.type = 'frontmatterPanel';
    node.data = { hName: 'pre', hChildren: [el('code', {}, [txt(node.value)])] };
    return true;
  }
  if (!isPlainObject(data) || Object.keys(data).length === 0) return false; // nothing to show

  const count = Object.keys(data).length;
  const summary = el('summary', { className: ['note-frontmatter-summary'] }, [
    el('span', { className: ['note-frontmatter-caret'] }, []),
    el('span', { className: ['note-frontmatter-title'] }, [txt('Properties')]),
    el('span', { className: ['note-frontmatter-count'] }, [txt(count)]),
  ]);
  node.type = 'frontmatterPanel';
  node.data = {
    hName: 'details',
    hProperties: { className: ['note-frontmatter'] },
    hChildren: [summary, buildTable(data)],
  };
  return true;
}

// Remark plugin: turns a leading `yaml` frontmatter node into a Properties panel.
// Drops empty frontmatter; leaves a malformed block visible as raw code.
export function makeRemarkFrontmatterPlugin() {
  return function remarkFrontmatterPanel() {
    return (tree) => {
      if (!tree.children) return;
      tree.children = tree.children.filter(child => {
        if (child.type !== 'yaml') return true;
        return renderFrontmatter(child); // false → drop empty frontmatter
      });
    };
  };
}
