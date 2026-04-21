// ── Gamepad utility ───────────────────────────────────────────────────────────
// Shared by notes/page.js, NotesDrawer.js, RecentDrawer.js

// Detect platform profile from a free-text platform string
export function detectGamepad(platform) {
  const p = (platform || '').toLowerCase();
  if (/xbox|microsoft/.test(p))                return 'xbox';
  if (/switch|nintendo/.test(p))               return 'switch';
  if (/playstation|ps[1-9]|psp|vita/.test(p))  return 'playstation';
  return 'playstation'; // fallback
}

// canonical name → { glyph, cls } per platform

export const GAMEPAD_MAP = {
  playstation: {

    cross:    { glyph: '✕',        cls: 'gp-btn gp-ps-cross' },
    circle:   { glyph: '○',        cls: 'gp-btn gp-ps-circle' },
    square:   { glyph: '□',        cls: 'gp-btn gp-ps-square' },
    triangle: { glyph: '△',        cls: 'gp-btn gp-ps-triangle' },
    l1:       { glyph: 'L1',       cls: 'gp-btn-pill' },
    l2:       { glyph: 'L2',       cls: 'gp-btn-pill' },
    r1:       { glyph: 'R1',       cls: 'gp-btn-pill' },
    r2:       { glyph: 'R2',       cls: 'gp-btn-pill' },
    l3:       { glyph: 'L3',       cls: 'gp-btn-pill' },
    r3:       { glyph: 'R3',       cls: 'gp-btn-pill' },
    up:       { glyph: '↑',        cls: 'gp-btn-pill' },
    down:     { glyph: '↓',        cls: 'gp-btn-pill' },
    left:     { glyph: '←',        cls: 'gp-btn-pill' },
    right:    { glyph: '→',        cls: 'gp-btn-pill' },
    options:  { glyph: 'Options',  cls: 'gp-btn-pill' },
    share:    { glyph: 'Share',    cls: 'gp-btn-pill' },
    touchpad: { glyph: 'TouchPad', cls: 'gp-btn-pill' },
  },
  xbox: {
    cross:    { glyph: 'A',        cls: 'gp-btn gp-xb-a' },
    circle:   { glyph: 'B',        cls: 'gp-btn gp-xb-b' },
    square:   { glyph: 'X',        cls: 'gp-btn gp-xb-x' },
    triangle: { glyph: 'Y',        cls: 'gp-btn gp-xb-y' },
    l1:       { glyph: 'LB',       cls: 'gp-btn-pill' },

    l2:       { glyph: 'LT',       cls: 'gp-btn-pill' },
    r1:       { glyph: 'RB',       cls: 'gp-btn-pill' },
    r2:       { glyph: 'RT',       cls: 'gp-btn-pill' },
    l3:       { glyph: 'LS',       cls: 'gp-btn-pill' },
    r3:       { glyph: 'RS',       cls: 'gp-btn-pill' },
    up:       { glyph: '↑',        cls: 'gp-btn-pill' },
    down:     { glyph: '↓',        cls: 'gp-btn-pill' },
    left:     { glyph: '←',        cls: 'gp-btn-pill' },
    right:    { glyph: '→',        cls: 'gp-btn-pill' },
    options:  { glyph: 'Menu',     cls: 'gp-btn-pill' },
    share:    { glyph: 'Share',    cls: 'gp-btn-pill' },
    touchpad: { glyph: 'View',     cls: 'gp-btn-pill' },
  },
  switch: {
    cross:    { glyph: 'A',        cls: 'gp-btn gp-sw-a' },
    circle:   { glyph: 'B',        cls: 'gp-btn gp-sw-b' },
    square:   { glyph: 'X',        cls: 'gp-btn gp-sw-x' },
    triangle: { glyph: 'Y',        cls: 'gp-btn gp-sw-y' },
    l1:       { glyph: 'L',        cls: 'gp-btn-pill' },
    l2:       { glyph: 'ZL',       cls: 'gp-btn-pill' },
    r1:       { glyph: 'R',        cls: 'gp-btn-pill' },
    r2:       { glyph: 'ZR',       cls: 'gp-btn-pill' },
    l3:       { glyph: 'LS',       cls: 'gp-btn-pill' },
    r3:       { glyph: 'RS',       cls: 'gp-btn-pill' },
    up:       { glyph: '↑',        cls: 'gp-btn-pill' },
    down:     { glyph: '↓',        cls: 'gp-btn-pill' },
    left:     { glyph: '←',        cls: 'gp-btn-pill' },
    right:    { glyph: '→',        cls: 'gp-btn-pill' },
    options:  { glyph: '+',        cls: 'gp-btn-pill' },
    share:    { glyph: 'Capture',  cls: 'gp-btn-pill' },
    touchpad: { glyph: 'TouchPad', cls: 'gp-btn-pill' }, // neutral fallback
  },
};

// Sections used by the toolbar picker
export const PICKER_SECTIONS = [
  { label: 'Face',     btns: ['cross', 'circle', 'square', 'triangle'] },
  { label: 'Shoulder', btns: ['l1', 'l2', 'r1', 'r2'] },
  { label: 'Stick',    btns: ['l3', 'r3'] },
  { label: 'D-Pad',    btns: ['up', 'down', 'left', 'right'] },
  { label: 'Special',  btns: ['options', 'share', 'touchpad'] },
];

// Returns the HTML string for a single button (used by the remark plugin)
export function renderBtnHtml(canonical, platform) {
  const map = GAMEPAD_MAP[platform] || GAMEPAD_MAP.playstation;
  const btn = map[canonical];
  if (!btn) return `<span class="gp-btn-pill">${canonical}</span>`;
  return `<span class="${btn.cls}">${btn.glyph}</span>`;
}

// Remark plugin factory — call with a platform string, returns a remark plugin
export function makeRemarkGamepadPlugin(platform) {
  return function remarkGamepadButtons() {
    return (tree) => {
      const visitNode = (node, parent) => {
        if (node.type === 'text') {
          const regex = /:btn\[([^\]]+)\]/g;
          if (!regex.test(node.value)) return;
          regex.lastIndex = 0;
          const parts = [];

          let last = 0, match;
          while ((match = regex.exec(node.value)) !== null) {
            if (match.index > last)
              parts.push({ type: 'text', value: node.value.slice(last, match.index) });
            parts.push({ type: 'html', value: renderBtnHtml(match[1].toLowerCase(), platform) });
            last = match.index + match[0].length;
          }
          if (last < node.value.length)
            parts.push({ type: 'text', value: node.value.slice(last) });
          if (parts.length > 1 && parent) {
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
