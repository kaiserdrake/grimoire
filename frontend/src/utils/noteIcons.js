// ── Note icon presets ─────────────────────────────────────────────────────────
// Users define icon groups (e.g. "tiers") and add icons to them. Each icon has a
// Name (shown as a hover tooltip) and a Code (the suffix appended to the group
// prefix). An icon in group "tiers" with code "boss" is referenced in notes as
// :icon[tiers_boss]. Legacy icons stored as bare URL strings fall back to a
// numeric code (01, 02, …) so existing :icon[group_01] references keep working.

// Sanitize a group name into a token-safe slug (lowercase, a-z0-9_).
export function slugifyGroup(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Sanitize an icon code suffix into token-safe chars (lowercase, a-z0-9_).
export function slugifyCode(code) {
  return (code || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const pad2 = (n) => String(n).padStart(2, '0');

// Normalize a stored icon (legacy bare URL string, or { url, name, code }) into a
// full { url, name, code } object. `index` provides the legacy/default code.
export function normalizeIcon(icon, index = 0) {
  if (typeof icon === 'string') return { url: icon, name: '', code: pad2(index + 1) };
  return {
    url: icon?.url || '',
    name: icon?.name || '',
    code: (icon?.code && String(icon.code)) || pad2(index + 1),
  };
}

// The full token for a group + code, e.g. ("tiers", "boss") -> "tiers_boss".
export function iconTokenFor(groupName, code) {
  return `${slugifyGroup(groupName)}_${slugifyCode(code)}`;
}

// Resolve the codes for a group's icons, guaranteeing uniqueness: the first icon
// keeps its (slugified) code; later duplicates are auto-suffixed _2, _3, … A blank
// code falls back to the padded row number. Returns an array aligned to `icons`.
export function resolveGroupCodes(icons) {
  const used = new Set();
  return (icons || []).map((icon, i) => {
    const { code } = normalizeIcon(icon, i);
    const base = slugifyCode(code) || pad2(i + 1);
    let resolved = base;
    let k = 2;
    while (used.has(resolved)) { resolved = `${base}_${k}`; k += 1; }
    used.add(resolved);
    return resolved;
  });
}

// Build a lookup of token -> { src, name } from the stored groups.
// groups: [{ name, icons: [string | { url, name, code }] }]
export function buildIconMap(groups, apiBase = '') {
  const map = {};
  (groups || []).forEach(g => {
    const codes = resolveGroupCodes(g.icons);
    (g.icons || []).forEach((icon, i) => {
      const { url, name } = normalizeIcon(icon, i);
      if (!url) return;
      const src = url.startsWith('http') ? url : `${apiBase}${url}`;
      map[iconTokenFor(g.name, codes[i])] = { src, name };
    });
  });
  return map;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function iconImg(src, token, name) {
  const alt = escapeAttr(name || token);
  const img = `<img class="note-icon" src="${escapeAttr(src)}" alt="${alt}" draggable="false"/>`;
  // Wrap in a custom CSS tooltip (see .note-icon-tip) when a Name is set.
  if (!name) return img;
  return `<span class="note-icon-tip" data-tip="${escapeAttr(name)}">${img}</span>`;
}

// Renders unknown tokens as a neutral pill so the author can see what's missing.
function missingPill(token) {
  return `<span class="note-icon-missing">${escapeAttr(token)}?</span>`;
}

// Remark plugin: replaces :icon[token] occurrences in text with the mapped image.
// iconMap is token -> { src, name }.
export function makeRemarkNoteIconPlugin(iconMap = {}) {
  return function remarkNoteIcons() {
    return (tree) => {
      const visitNode = (node, parent) => {
        if (node.type === 'text') {
          const regex = /:icon\[([a-zA-Z0-9_]+)\]/g;
          if (!regex.test(node.value)) return;
          regex.lastIndex = 0;
          const parts = [];
          let last = 0, match;
          while ((match = regex.exec(node.value)) !== null) {
            if (match.index > last)
              parts.push({ type: 'text', value: node.value.slice(last, match.index) });
            const token = match[1].toLowerCase();
            const entry = iconMap[token];
            parts.push({ type: 'html', value: entry ? iconImg(entry.src, token, entry.name) : missingPill(token) });
            last = match.index + match[0].length;
          }
          if (last < node.value.length)
            parts.push({ type: 'text', value: node.value.slice(last) });
          if (parent) {
            const idx = parent.children.indexOf(node);
            if (idx !== -1) parent.children.splice(idx, 1, ...parts);
          }
          return;
        }
        // Iterate over a snapshot: visiting a text child may splice replacement
        // nodes into node.children, growing it. A live forEach would skip later
        // children (e.g. a second :icon[] after a <br> in the same table cell).
        if (node.children) [...node.children].forEach(child => visitNode(child, node));
      };
      visitNode(tree, null);
    };
  };
}
