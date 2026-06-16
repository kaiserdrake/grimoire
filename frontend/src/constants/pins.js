// ── Shared pin constants ──────────────────────────────────────────────────────
// Single source of truth for pin colors, icon types, and the helpers that
// encode/decode the stored "color:icon" pin style string. Used by both the map
// editor and the game settings (map defaults) page.

export const PIN_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];

// ── Pin types: game-themed icons ──────────────────────────────────────────────
// Each svg() receives the fill color. All major shapes carry stroke="black"
// strokeWidth="1.5" with paintOrder="stroke fill" so the outline sits outside
// the fill and never obscures interior detail.
export const PIN_TYPES = [
  {
    id: 'treasure',
    label: 'Treasure',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Chest lid */}
        <path d="M4 16 Q4 8 16 8 Q28 8 28 16 Z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Chest body */}
        <rect x="4" y="14" width="24" height="14" rx="2"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Lid rim band */}
        <rect x="4" y="14" width="24" height="3"
          fill="rgba(0,0,0,0.18)" stroke="black" strokeWidth="1" />
        {/* Lock plate */}
        <rect x="13" y="17" width="6" height="5" rx="1"
          fill="rgba(0,0,0,0.55)" stroke="black" strokeWidth="1" />
        <circle cx="16" cy="19" r="1.4" fill="rgba(255,255,255,0.55)" />
        {/* Hinges */}
        <rect x="5" y="13" width="3" height="3" rx="0.5"
          fill="rgba(0,0,0,0.5)" stroke="black" strokeWidth="0.8" />
        <rect x="24" y="13" width="3" height="3" rx="0.5"
          fill="rgba(0,0,0,0.5)" stroke="black" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    id: 'quest',
    label: 'Quest',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Scroll body */}
        <rect x="7" y="6" width="18" height="22" rx="2"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Top curl */}
        <ellipse cx="16" cy="6" rx="9" ry="3"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Bottom curl */}
        <ellipse cx="16" cy="28" rx="9" ry="3"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* Text lines */}
        <line x1="10" y1="12" x2="22" y2="12" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="22" y2="16" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="20" x2="18" y2="20" stroke="rgba(0,0,0,0.45)" strokeWidth="1.5" strokeLinecap="round" />
        {/* Wax seal */}
        <circle cx="21" cy="24" r="3" fill="rgba(0,0,0,0.4)" stroke="black" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: 'exclamation',
    label: 'Alert',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Shield */}
        <path d="M16 3 L28 8 L28 20 Q28 28 16 30 Q4 28 4 20 L4 8 Z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ! bar */}
        <rect x="14" y="9" width="4" height="11" rx="2"
          fill="white" stroke="black" strokeWidth="0.8"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ! dot */}
        <circle cx="16" cy="24" r="2.2"
          fill="white" stroke="black" strokeWidth="0.8"
          style={{ paintOrder: 'stroke fill' }} />
      </svg>
    ),
  },
  {
    id: 'question',
    label: 'Unknown',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Circle background */}
        <circle cx="16" cy="16" r="13"
          fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        {/* ? mark — stroked text for outline */}
        <text x="16" y="22" textAnchor="middle" fontSize="16" fontWeight="bold" fontFamily="serif"
          fill="white" stroke="black" strokeWidth="1" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }}>?</text>
      </svg>
    ),
  },
  {
    id: 'battle',
    label: 'Battle',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        {/* Black outline layer drawn first (behind) */}
        <line x1="6" y1="6" x2="26" y2="26" stroke="black" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="26" y1="6" x2="6" y2="26" stroke="black" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="9" y1="13" x2="19" y2="3" stroke="black" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="23" y1="13" x2="13" y2="3" stroke="black" strokeWidth="3.5" strokeLinecap="round" />
        {/* Colored layer on top */}
        <line x1="6" y1="6" x2="26" y2="26" stroke={fill} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="26" y1="6" x2="6" y2="26" stroke={fill} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="9" y1="13" x2="19" y2="3" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        <line x1="23" y1="13" x2="13" y2="3" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        {/* Center gem */}
        <circle cx="16" cy="16" r="3.5" fill={fill} stroke="black" strokeWidth="1.5"
          style={{ paintOrder: 'stroke fill' }} />
        <circle cx="16" cy="16" r="1.5" fill="rgba(255,255,255,0.5)" />
      </svg>
    ),
  },
  {
    id: 'location',
    label: 'Location',
    svg: (fill) => (
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 3C11.03 3 7 7.03 7 12c0 7.88 9 17 9 17s9-9.12 9-17c0-4.97-4.03-9-9-9z"
          fill={fill} stroke="black" strokeWidth="1.5" strokeLinejoin="round"
          style={{ paintOrder: 'stroke fill' }} />
        <circle cx="16" cy="12" r="3.5" fill="rgba(255,255,255,0.65)" stroke="black" strokeWidth="1"
          style={{ paintOrder: 'stroke fill' }} />
      </svg>
    ),
  },
];

// ── Helpers to parse/encode the stored "color:icon" pin style string ──────────
export function parsePinStyle(stored) {
  if (!stored) return { color: 'blue', icon: 'location' };
  const [color, icon] = stored.split(':');
  return { color: color || 'blue', icon: icon || 'location' };
}

export function encodePinStyle(color, icon) {
  return `${color}:${icon}`;
}

// ── Pin icon renderer (used on the map and in defaults previews) ──────────────
export const PinIcon = ({ color, icon = 'location', size = 32 }) => {
  const type = PIN_TYPES.find((t) => t.id === icon) ?? PIN_TYPES[PIN_TYPES.length - 1];
  const fill = `var(--color-pin-${color})`;
  return <div style={{ width: size, height: size }}>{type.svg(fill)}</div>;
};

// ── Label for an icon id ──────────────────────────────────────────────────────
export function pinTypeLabel(iconId) {
  return PIN_TYPES.find((t) => t.id === iconId)?.label ?? iconId;
}
