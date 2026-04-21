// ── Gamepad utility ───────────────────────────────────────────────────────────
// Shared by notes/page.js, NotesDrawer.js, RecentDrawer.js

export function detectGamepad(platform) {
  const p = (platform || '').toLowerCase();
  if (/xbox|microsoft/.test(p))               return 'xbox';
  if (/switch|nintendo/.test(p))              return 'switch';
  if (/playstation|ps[1-9]|psp|vita/.test(p)) return 'playstation';
  return 'playstation';
}

function use(id, w = 24, h = 24) {
  return `<svg class="gp-icon" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

function pill(label) {
  return `<span class="gp-btn-pill">${label}</span>`;
}

export const GAMEPAD_MAP = {
  playstation: {
    cross:                { html: use('gp-ps-cross') },
    circle:               { html: use('gp-ps-circle') },

    square:               { html: use('gp-ps-square') },
    triangle:             { html: use('gp-ps-triangle') },
    l1:                   { html: use('gp-shoulder-l1', 48, 28) },
    r1:                   { html: use('gp-shoulder-r1', 48, 28) },
    l2:                   { html: use('gp-trigger-l2',  48, 28) },
    r2:                   { html: use('gp-trigger-r2',  48, 28) },
    l3:                   { html: use('gp-stick-l3') },
    r3:                   { html: use('gp-stick-r3') },

    ls:                   { html: use('gp-stick-neutral') },
    'ls-up':              { html: use('gp-stick-up') },
    'ls-down':            { html: use('gp-stick-down') },
    'ls-left':            { html: use('gp-stick-left') },
    'ls-right':           { html: use('gp-stick-right') },
    rs:                   { html: use('gp-stick-neutral') },
    'rs-up':              { html: use('gp-stick-up') },
    'rs-down':            { html: use('gp-stick-down') },
    'rs-left':            { html: use('gp-stick-left') },
    'rs-right':           { html: use('gp-stick-right') },

    up:                   { html: use('gp-dpad-up') },
    down:                 { html: use('gp-dpad-down') },
    left:                 { html: use('gp-dpad-left') },
    right:                { html: use('gp-dpad-right') },
    options:              { html: use('gp-options') },
    share:                { html: use('gp-share-ps') },
    touchpad:             { html: use('gp-touchpad',            52, 32) },
    'touchpad-left':      { html: use('gp-touchpad-left',       52, 32) },
    'touchpad-right':     { html: use('gp-touchpad-right',      52, 32) },
    'touchpad-swipe-up':  { html: use('gp-touchpad-swipe-up',   52, 32) },
    'touchpad-swipe-down':{ html: use('gp-touchpad-swipe-down', 52, 32) },
  },
  xbox: {
    cross:                { html: use('gp-xb-a') },
    circle:               { html: use('gp-xb-b') },
    square:               { html: use('gp-xb-x') },
    triangle:             { html: use('gp-xb-y') },
    l1:                   { html: use('gp-shoulder-lb', 48, 28) },
    r1:                   { html: use('gp-shoulder-rb', 48, 28) },
    l2:                   { html: use('gp-trigger-lt',  48, 28) },
    r2:                   { html: use('gp-trigger-rt',  48, 28) },
    l3:                   { html: use('gp-stick-l3') },
    r3:                   { html: use('gp-stick-r3') },
    ls:                   { html: use('gp-stick-neutral') },
    'ls-up':              { html: use('gp-stick-up') },
    'ls-down':            { html: use('gp-stick-down') },
    'ls-left':            { html: use('gp-stick-left') },
    'ls-right':           { html: use('gp-stick-right') },
    rs:                   { html: use('gp-stick-neutral') },
    'rs-up':              { html: use('gp-stick-up') },
    'rs-down':            { html: use('gp-stick-down') },
    'rs-left':            { html: use('gp-stick-left') },
    'rs-right':           { html: use('gp-stick-right') },
    up:                   { html: use('gp-dpad-up') },
    down:                 { html: use('gp-dpad-down') },
    left:                 { html: use('gp-dpad-left') },
    right:                { html: use('gp-dpad-right') },
    options:              { html: use('gp-menu') },
    share:                { html: use('gp-share-xb') },
    touchpad:             { html: pill('TouchPad') },
    'touchpad-left':      { html: pill('TouchPad') },
    'touchpad-right':     { html: pill('TouchPad') },
    'touchpad-swipe-up':  { html: pill('TouchPad') },
    'touchpad-swipe-down':{ html: pill('TouchPad') },
  },
  switch: {
    cross:                { html: use('gp-sw-a') },
    circle:               { html: use('gp-sw-b') },
    square:               { html: use('gp-sw-x') },
    triangle:             { html: use('gp-sw-y') },

    l1:                   { html: use('gp-shoulder-l', 48, 28) },
    r1:                   { html: use('gp-shoulder-r', 48, 28) },
    l2:                   { html: use('gp-trigger-zl', 48, 28) },
    r2:                   { html: use('gp-trigger-zr', 48, 28) },
    l3:                   { html: use('gp-stick-l3') },
    r3:                   { html: use('gp-stick-r3') },

    ls:                   { html: use('gp-stick-neutral') },
    'ls-up':              { html: use('gp-stick-up') },
    'ls-down':            { html: use('gp-stick-down') },
    'ls-left':            { html: use('gp-stick-left') },
    'ls-right':           { html: use('gp-stick-right') },
    rs:                   { html: use('gp-stick-neutral') },
    'rs-up':              { html: use('gp-stick-up') },
    'rs-down':            { html: use('gp-stick-down') },
    'rs-left':            { html: use('gp-stick-left') },
    'rs-right':           { html: use('gp-stick-right') },
    up:                   { html: use('gp-dpad-up') },
    down:                 { html: use('gp-dpad-down') },
    left:                 { html: use('gp-dpad-left') },
    right:                { html: use('gp-dpad-right') },
    options:              { html: use('gp-plus') },
    share:                { html: use('gp-capture-sw') },
    touchpad:             { html: pill('TouchPad') },
    'touchpad-left':      { html: pill('TouchPad') },
    'touchpad-right':     { html: pill('TouchPad') },
    'touchpad-swipe-up':  { html: pill('TouchPad') },
    'touchpad-swipe-down':{ html: pill('TouchPad') },
  },
};

export const PICKER_SECTIONS = [
  { label: 'Face',         btns: ['cross', 'circle', 'square', 'triangle'] },
  { label: 'Shoulder',     btns: ['l1', 'r1'] },
  { label: 'Trigger',      btns: ['l2', 'r2'] },
  { label: 'D-Pad',        btns: ['up', 'down', 'left', 'right'] },
  { label: 'Left stick',   btns: ['ls', 'ls-up', 'ls-down', 'ls-left', 'ls-right', 'l3'] },
  { label: 'Right stick',  btns: ['rs', 'rs-up', 'rs-down', 'rs-left', 'rs-right', 'r3'] },
  { label: 'Special',      btns: ['options', 'share', 'touchpad', 'touchpad-left', 'touchpad-right', 'touchpad-swipe-up', 'touchpad-swipe-down'] },
];

export function renderBtnHtml(canonical, platform) {
  const map = GAMEPAD_MAP[platform] || GAMEPAD_MAP.playstation;
  const btn = map[canonical];
  if (!btn) return pill(canonical);
  return btn.html;
}

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
