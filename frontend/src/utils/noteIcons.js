// ── Note icon presets ─────────────────────────────────────────────────────────
// Users define icon groups (e.g. "tiers") and upload PNGs into them. Each icon
// gets a 1-based, zero-padded number, so the first icon in group "tiers" is
// referenced in notes as :icon[tiers_01], the second as :icon[tiers_02], etc.

// Sanitize a group name into a token-safe slug (lowercase, a-z0-9_).
export function slugifyGroup(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const pad2 = (n) => String(n).padStart(2, '0');

// The token (without the :icon[] wrapper) for the Nth (1-based) icon of a group.
export function iconToken(groupName, index1) {
  return `${slugifyGroup(groupName)}_${pad2(index1)}`;
}

// Build a lookup of token -> fully-qualified image src from the stored groups.
// groups: [{ name, icons: [relativeUrl, ...] }]
export function buildIconMap(groups, apiBase = '') {
  const map = {};
  (groups || []).forEach(g => {
    (g.icons || []).forEach((url, i) => {
      map[iconToken(g.name, i + 1)] = url.startsWith('http') ? url : `${apiBase}${url}`;
    });
  });
  return map;
}

function iconImg(src, token) {
  return `<img class="note-icon" src="${src}" alt="${token}" draggable="false"/>`;
}

// Renders unknown tokens as a neutral pill so the author can see what's missing.
function missingPill(token) {
  return `<span class="note-icon-missing">${token}?</span>`;
}

// Remark plugin: replaces :icon[token] occurrences in text with the mapped image.
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
            const src = iconMap[token];
            parts.push({ type: 'html', value: src ? iconImg(src, token) : missingPill(token) });
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
        if (node.children) node.children.forEach(child => visitNode(child, node));
      };
      visitNode(tree, null);
    };
  };
}
