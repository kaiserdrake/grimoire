// ── Gamepad utility ───────────────────────────────────────────────────────────
// Shared by notes/page.js, NotesDrawer.js, RecentDrawer.js

export function detectGamepad(platform) {
  const p = (platform || '').toLowerCase();
  if (/xbox|microsoft/.test(p))               return 'xbox';
  if (/switch|nintendo/.test(p))              return 'switch';
  if (/playstation|ps[1-9]|psp|vita/.test(p)) return 'playstation';
  return 'playstation';
}

// PNG image button — hosted in /public/gamepad/ps/
function img(path) {
  return `<img class="gp-img" src="/gamepad/${path}" alt="${path.split('/').pop().replace('.png','').replace(/_/g,' ')}" draggable="false"/>`;
}

// Neutral pill fallback
function pill(label) {
  return `<span class="gp-btn-pill">${label}</span>`;
}

export const GAMEPAD_MAP = {
  playstation: {
    // Face
    cross:    { html: img('ps/ps_cross.png') },
    circle:   { html: img('ps/ps_circle.png') },
    square:   { html: img('ps/ps_square.png') },
    triangle: { html: img('ps/ps_triangle.png') },
    // Shoulders
    l1:       { html: img('ps/ps_l1.png') },
    r1:       { html: img('ps/ps_r1.png') },
    // Triggers
    l2:       { html: img('ps/ps_l2.png') },
    r2:       { html: img('ps/ps_r2.png') },
    // Stick press
    l3:       { html: img('ps/ps_l3.png') },
    r3:       { html: img('ps/ps_r3.png') },
    // Left stick directional
    ls:          { html: img('ps/ps_l_neutral.png') },
    'ls-up':     { html: img('ps/ps_l_up.png') },
    'ls-down':   { html: img('ps/ps_l_down.png') },
    'ls-left':   { html: img('ps/ps_l_left.png') },
    'ls-right':  { html: img('ps/ps_l_right.png') },
    // Right stick directional
    rs:          { html: img('ps/ps_r_neutral.png') },
    'rs-up':     { html: img('ps/ps_r_up.png') },
    'rs-down':   { html: img('ps/ps_r_down.png') },
    'rs-left':   { html: img('ps/ps_r_left.png') },
    'rs-right':  { html: img('ps/ps_r_right.png') },
    // D-Pad
    up:    { html: img('ps/ps_dpad_up.png') },
    down:  { html: img('ps/ps_dpad_down.png') },
    left:  { html: img('ps/ps_dpad_left.png') },
    right: { html: img('ps/ps_dpad_right.png') },
    'dpad':   { html: img('ps/ps_dpad_neutral.png') },
    // Special
    options:  { html: img('ps/ps_option.png') },
    share:    { html: img('ps/ps_share.png') },
    touchpad: { html: img('ps/ps_touch.png') },
  },
  xbox: {
    // Face
    cross:    { html: img('xbox/ms_a.png') },
    circle:   { html: img('xbox/ms_b.png') },
    square:   { html: img('xbox/ms_x.png') },
    triangle: { html: img('xbox/ms_y.png') },
    // Shoulders
    l1:       { html: img('xbox/ms_l_lb.png') },
    r1:       { html: img('xbox/ms_r_rb.png') },
    // Triggers
    l2:       { html: img('xbox/ms_l_lt.png') },
    r2:       { html: img('xbox/ms_r_rt.png') },
    // Stick press — no image, pill fallback
    l3:          { html: pill('L3') },
    r3:          { html: pill('R3') },
    // Left stick
    ls:          { html: img('xbox/ms_l_neutral.png') },
    'ls-up':     { html: img('xbox/ms_l_up.png') },
    'ls-down':   { html: img('xbox/ms_l_down.png') },
    'ls-left':   { html: img('xbox/ms_l_left.png') },
    'ls-right':  { html: img('xbox/ms_l_right.png') },
    // Right stick
    rs:          { html: img('xbox/ms_r_neutral.png') },
    'rs-up':     { html: img('xbox/ms_r_up.png') },
    'rs-down':   { html: img('xbox/ms_r_down.png') },
    'rs-left':   { html: img('xbox/ms_r_left.png') },
    'rs-right':  { html: img('xbox/ms_r_right.png') },
    // D-Pad
    up:    { html: img('xbox/ms_dpad_up.png') },
    down:  { html: img('xbox/ms_dpad_down.png') },
    left:  { html: img('xbox/ms_dpad_left.png') },
    right: { html: img('xbox/ms_dpad_right.png') },
    dpad:  { html: img('xbox/ms_dpad_neutral.png') },
    // Special
    options:  { html: img('xbox/ms_option.png') },
    share:    { html: img('xbox/ms_share.png') },
    touchpad: { html: pill('TouchPad') },
  },

  switch: {
    // Face
    cross:               { html: img('switch/ns_a.png') },
    circle:              { html: img('switch/ns_b.png') },
    square:              { html: img('switch/ns_x.png') },
    triangle:            { html: img('switch/ns_y.png') },
    // Shoulders
    l1:                  { html: img('switch/ns_l_l.png') },
    r1:                  { html: img('switch/ns_r_r.png') },
    // Triggers
    l2:                  { html: img('switch/ns_l_zl.png') },
    r2:                  { html: img('switch/ns_r_zr.png') },
    // Stick press
    l3:                  { html: img('switch/ns_l_l3.png') },
    r3:                  { html: img('switch/ns_r_r3.png') },
    // Left stick
    ls:                  { html: img('switch/ns_l_neutral.png') },
    'ls-up':             { html: img('switch/ns_l_up.png') },
    'ls-down':           { html: img('switch/ns_l_down.png') },
    'ls-left':           { html: img('switch/ns_l_left.png') },
    'ls-right':          { html: img('switch/ns_l_right.png') },
    // Right stick
    rs:                  { html: img('switch/ns_r_neutral.png') },
    'rs-up':             { html: img('switch/ns_r_up.png') },
    'rs-down':           { html: img('switch/ns_r_down.png') },
    'rs-left':           { html: img('switch/ns_r_left.png') },
    'rs-right':          { html: img('switch/ns_r_right.png') },
    // D-Pad
    up:                  { html: img('switch/ns_dpad_up.png') },
    down:                { html: img('switch/ns_dpad_down.png') },
    left:                { html: img('switch/ns_dpad_left.png') },
    right:               { html: img('switch/ns_dpad_right.png') },
    dpad:                { html: img('switch/ns_dpad_neutral.png') },
    // Special
    options:             { html: img('switch/ns_option.png') },
    share:               { html: img('switch/ns_share.png') },
    touchpad:            { html: pill('TouchPad') },
  },
};

export const PICKER_SECTIONS = [
  { label: 'Face',         btns: ['cross', 'circle', 'square', 'triangle'] },
  { label: 'Shoulder',     btns: ['l1', 'r1'] },
  { label: 'Trigger',      btns: ['l2', 'r2'] },
  { label: 'D-Pad',        btns: ['up', 'down', 'left', 'right', 'dpad'] },
  { label: 'Left stick',   btns: ['ls', 'ls-up', 'ls-down', 'ls-left', 'ls-right', 'l3'] },
  { label: 'Right stick',  btns: ['rs', 'rs-up', 'rs-down', 'rs-left', 'rs-right', 'r3'] },
  { label: 'Special',      btns: ['options', 'share', 'touchpad'] },
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
