'use client';

// ── GamepadSprites ────────────────────────────────────────────────────────────
// Mount once in the layout (Navbar). All button icons reference these via
// <use href="#gp-..."/>. Every symbol uses viewBox="0 0 24 24" except
// shoulders (48x28), triggers (48x28), touchpad (52x32), dpad (24x24).

export default function GamepadSprites() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }} aria-hidden="true">

      {/* ── PlayStation face buttons ── */}

      <symbol id="gp-ps-cross" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#1a3a6b" stroke="#4a7fc1" strokeWidth="1.5"/>
        <line x1="7.5" y1="7.5" x2="16.5" y2="16.5" stroke="#7ab4f5" strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="16.5" y1="7.5" x2="7.5" y2="16.5" stroke="#7ab4f5" strokeWidth="2.2" strokeLinecap="round"/>
      </symbol>

      <symbol id="gp-ps-circle" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#6b1a1a" stroke="#c14a4a" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="5.5" fill="none" stroke="#f57a7a" strokeWidth="2.2"/>
      </symbol>

      <symbol id="gp-ps-square" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#5a1a5a" stroke="#b44ab4" strokeWidth="1.5"/>
        <rect x="7" y="7" width="10" height="10" fill="none" stroke="#e87ae8" strokeWidth="2.2" strokeLinejoin="round"/>
      </symbol>

      <symbol id="gp-ps-triangle" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#0d4a3a" stroke="#2a9a7a" strokeWidth="1.5"/>
        <polygon points="12,6.5 18,17.5 6,17.5" fill="none" stroke="#4acfaa" strokeWidth="2.2" strokeLinejoin="round"/>
      </symbol>

      {/* ── Xbox face buttons ── */}

      <symbol id="gp-xb-a" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#1a4a1a" stroke="#3a9a3a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#6adf6a">A</text>
      </symbol>

      <symbol id="gp-xb-b" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#6b1a1a" stroke="#c14a4a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#f57a7a">B</text>
      </symbol>

      <symbol id="gp-xb-x" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#1a3a6b" stroke="#4a7fc1" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#7ab4f5">X</text>
      </symbol>

      <symbol id="gp-xb-y" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#5a4a0a" stroke="#b4941a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#f0c830">Y</text>
      </symbol>

      {/* ── Switch face buttons ── */}


      <symbol id="gp-sw-a" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#6b1a1a" stroke="#c14a4a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#f57a7a">A</text>
      </symbol>

      <symbol id="gp-sw-b" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#5a3a0a" stroke="#c47a1a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#f0a840">B</text>
      </symbol>

      <symbol id="gp-sw-x" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#1a3a6b" stroke="#4a7fc1" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#7ab4f5">X</text>
      </symbol>

      <symbol id="gp-sw-y" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#1a4a1a" stroke="#3a9a3a" strokeWidth="1.5"/>
        <text x="12" y="16.5" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#6adf6a">Y</text>
      </symbol>


      {/* ── Shoulders (L1/R1/LB/RB/L/R) — bumper shape ── */}

      <symbol id="gp-shoulder-l1" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">L1</text>
      </symbol>


      <symbol id="gp-shoulder-r1" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">R1</text>
      </symbol>

      <symbol id="gp-shoulder-lb" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">LB</text>
      </symbol>

      <symbol id="gp-shoulder-rb" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">RB</text>
      </symbol>

      <symbol id="gp-shoulder-l" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">L</text>
      </symbol>

      <symbol id="gp-shoulder-r" viewBox="0 0 48 28">
        <rect x="1" y="9" width="46" height="18" rx="9" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M4,9 Q6,1 24,1 Q42,1 44,9" fill="#3a3a5a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="22" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">R</text>
      </symbol>

      {/* ── Triggers (L2/R2/LT/RT/ZL/ZR) — curved trigger shape ── */}

      <symbol id="gp-trigger-l2" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">L2</text>
      </symbol>

      <symbol id="gp-trigger-r2" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">R2</text>
      </symbol>

      <symbol id="gp-trigger-lt" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">LT</text>
      </symbol>

      <symbol id="gp-trigger-rt" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">RT</text>
      </symbol>

      <symbol id="gp-trigger-zl" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">ZL</text>
      </symbol>

      <symbol id="gp-trigger-zr" viewBox="0 0 48 28">
        <path d="M4,28 Q4,8 12,2 Q24,0 36,2 Q44,8 44,28 Z" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="24" y="19" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#c0c0e0">ZR</text>
      </symbol>

      {/* ── D-Pad — shared, direction highlighted ── */}

      <symbol id="gp-dpad-neutral" viewBox="0 0 24 24">
        <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="16" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="1" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="16" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="8" width="8" height="8" fill="#2a2a3a"/>
      </symbol>

      <symbol id="gp-dpad-up" viewBox="0 0 24 24">
        <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#4a7fc1"/>
        <rect x="8" y="16" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="1" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="16" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="8" width="8" height="8" fill="#2a2a3a"/>
        <polygon points="12,3 10,6 14,6" fill="white"/>
      </symbol>


      <symbol id="gp-dpad-down" viewBox="0 0 24 24">
        <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="16" width="8" height="7" rx="1.5" fill="#4a7fc1"/>
        <rect x="1" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="16" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="8" width="8" height="8" fill="#2a2a3a"/>
        <polygon points="12,21 10,18 14,18" fill="white"/>
      </symbol>

      <symbol id="gp-dpad-left" viewBox="0 0 24 24">
        <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="16" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="1" y="8" width="7" height="8" rx="1.5" fill="#4a7fc1"/>
        <rect x="16" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="8" width="8" height="8" fill="#2a2a3a"/>
        <polygon points="3,12 6,10 6,14" fill="white"/>
      </symbol>

      <symbol id="gp-dpad-right" viewBox="0 0 24 24">
        <rect x="8" y="1" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="8" y="16" width="8" height="7" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="1" y="8" width="7" height="8" rx="1.5" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="0.8"/>
        <rect x="16" y="8" width="7" height="8" rx="1.5" fill="#4a7fc1"/>
        <rect x="8" y="8" width="8" height="8" fill="#2a2a3a"/>
        <polygon points="21,12 18,10 18,14" fill="white"/>
      </symbol>

      {/* ── Analog sticks — shared ── */}

      <symbol id="gp-stick-neutral" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="5" fill="#3a3a5a" stroke="#7a7aaa" strokeWidth="1"/>
        <circle cx="12" cy="12" r="2" fill="#8a8aba"/>
      </symbol>

      <symbol id="gp-stick-up" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="12" cy="8" r="5" fill="#3a3a5a" stroke="#4a7fc1" strokeWidth="1"/>
        <circle cx="12" cy="8" r="2" fill="#7ab4f5"/>
      </symbol>

      <symbol id="gp-stick-down" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="12" cy="16" r="5" fill="#3a3a5a" stroke="#4a7fc1" strokeWidth="1"/>
        <circle cx="12" cy="16" r="2" fill="#7ab4f5"/>
      </symbol>

      <symbol id="gp-stick-left" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="8" cy="12" r="5" fill="#3a3a5a" stroke="#4a7fc1" strokeWidth="1"/>
        <circle cx="8" cy="12" r="2" fill="#7ab4f5"/>
      </symbol>

      <symbol id="gp-stick-right" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="16" cy="12" r="5" fill="#3a3a5a" stroke="#4a7fc1" strokeWidth="1"/>
        <circle cx="16" cy="12" r="2" fill="#7ab4f5"/>
      </symbol>

      <symbol id="gp-stick-l3" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#4a7fc1" strokeWidth="2"/>
        <text x="12" y="16" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#7ab4f5">L3</text>
      </symbol>

      <symbol id="gp-stick-r3" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#2a2a3a" stroke="#4a7fc1" strokeWidth="2"/>
        <text x="12" y="16" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#7ab4f5">R3</text>
      </symbol>

      {/* ── Touchpad — PS only ── */}

      <symbol id="gp-touchpad" viewBox="0 0 52 32">
        <rect x="1" y="1" width="50" height="30" rx="6" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="26" cy="16" r="4" fill="#5a5a8a"/>
      </symbol>

      <symbol id="gp-touchpad-left" viewBox="0 0 52 32">
        <rect x="1" y="1" width="50" height="30" rx="6" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <line x1="26" y1="31" x2="26" y2="1" stroke="#5a5a8a" strokeWidth="1" strokeDasharray="2,2"/>
        <circle cx="13" cy="16" r="4" fill="#4a7fc1"/>
      </symbol>

      <symbol id="gp-touchpad-right" viewBox="0 0 52 32">
        <rect x="1" y="1" width="50" height="30" rx="6" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <line x1="26" y1="31" x2="26" y2="1" stroke="#5a5a8a" strokeWidth="1" strokeDasharray="2,2"/>
        <circle cx="39" cy="16" r="4" fill="#4a7fc1"/>
      </symbol>

      <symbol id="gp-touchpad-swipe-up" viewBox="0 0 52 32">
        <rect x="1" y="1" width="50" height="30" rx="6" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M20,24 L26,10 L32,24" fill="none" stroke="#4a7fc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

        <polygon points="26,8 23,13 29,13" fill="#4a7fc1"/>
      </symbol>

      <symbol id="gp-touchpad-swipe-down" viewBox="0 0 52 32">
        <rect x="1" y="1" width="50" height="30" rx="6" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <path d="M20,8 L26,22 L32,8" fill="none" stroke="#4a7fc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polygon points="26,25 23,20 29,20" fill="#4a7fc1"/>
      </symbol>

      {/* ── Special buttons ── */}

      <symbol id="gp-options" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <line x1="7" y1="9" x2="17" y2="9" stroke="#c0c0e0" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="7" y1="12" x2="17" y2="12" stroke="#c0c0e0" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="7" y1="15" x2="17" y2="15" stroke="#c0c0e0" strokeWidth="1.5" strokeLinecap="round"/>
      </symbol>

      <symbol id="gp-menu" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <rect x="7" y="9" width="10" height="2" rx="1" fill="#c0c0e0"/>
        <rect x="7" y="13" width="7" height="2" rx="1" fill="#c0c0e0"/>
      </symbol>

      <symbol id="gp-plus" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="12" y="16" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#c0c0e0">+</text>
      </symbol>

      <symbol id="gp-minus" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <text x="12" y="16" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#c0c0e0">−</text>
      </symbol>

      <symbol id="gp-share-ps" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <rect x="7" y="10" width="4" height="5" rx="1" fill="#c0c0e0"/>
        <path d="M11,11 L16,8 L16,17 L11,14 Z" fill="#c0c0e0"/>
        <line x1="17" y1="9.5" x2="19" y2="8" stroke="#c0c0e0" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="17" y1="12.5" x2="19.5" y2="12.5" stroke="#c0c0e0" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="17" y1="15.5" x2="19" y2="17" stroke="#c0c0e0" strokeWidth="1.2" strokeLinecap="round"/>
      </symbol>

      <symbol id="gp-share-xb" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <rect x="8" y="9" width="8" height="7" rx="1" fill="none" stroke="#c0c0e0" strokeWidth="1.2"/>
        <line x1="12" y1="9" x2="12" y2="6" stroke="#c0c0e0" strokeWidth="1.2"/>
        <polygon points="12,4.5 10.5,7 13.5,7" fill="#c0c0e0"/>
      </symbol>

      <symbol id="gp-capture-sw" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#2a2a3a" stroke="#5a5a8a" strokeWidth="1.5"/>
        <circle cx="9" cy="10" r="2" fill="#c0c0e0"/>
        <line x1="11" y1="10" x2="14" y2="8" stroke="#c0c0e0" strokeWidth="1.2"/>
        <line x1="11" y1="10" x2="14" y2="12" stroke="#c0c0e0" strokeWidth="1.2"/>
        <circle cx="15" cy="8" r="1.5" fill="none" stroke="#c0c0e0" strokeWidth="1.2"/>
        <circle cx="15" cy="12" r="1.5" fill="none" stroke="#c0c0e0" strokeWidth="1.2"/>
      </symbol>

    </svg>
  );
}
