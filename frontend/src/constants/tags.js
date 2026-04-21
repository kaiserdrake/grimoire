export const BacklogIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" />
    <polyline points="3 6 4 7 6 5" /><polyline points="3 12 4 13 6 11" /><polyline points="3 18 4 19 6 17" />
  </svg>
);

export const WishlistIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export const FavoriteIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const DroppedIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

export const PlayingIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export const CompletedIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const PendedIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const OtherIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);

export const GroupIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="19" x2="21" y2="19" />
    <rect x="16" y="9" width="5" height="6" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

export const TAG_CONFIG = {
  playing:  { label: 'Playing',  color: '#4a90d9',             bg: '#B5D4F418',                  border: '#6aaae8',            Icon: PlayingIcon  },
  backlog:  { label: 'Backlog',  color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)', border: 'var(--color-accent)', Icon: BacklogIcon  },
  wishlist: { label: 'Wishlist', color: '#c8a800',             bg: '#f6c90e18',                  border: '#c8a800',            Icon: WishlistIcon },
  favorite: { label: 'Favorite', color: '#e05c5c',             bg: '#e05c5c18',                  border: '#e05c5c',            Icon: FavoriteIcon },
  dropped:  { label: 'Dropped',  color: '#888888',             bg: '#88888818',                  border: '#888888',            Icon: DroppedIcon  },
};

export const TAG_STYLE = {
  playing:   { color: '#4a90d9',             bg: '#B5D4F418',                  background: '#B5D4F418',                  border: '#6aaae8'              },
  backlog:   { color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)', background: 'var(--color-accent-subtle)', border: 'var(--color-accent)'  },
  wishlist:  { color: '#c8a800',             bg: '#f6c90e18',                  background: '#f6c90e18',                  border: '#c8a800'               },
  favorite:  { color: '#e05c5c',             bg: '#e05c5c18',                  background: '#e05c5c18',                  border: '#e05c5c'               },
  completed: { color: '#4caf82',             bg: '#4caf8218',                  background: '#4caf8218',                  border: '#4caf82'               },
  pend:      { color: '#999999',             bg: '#99999918',                  background: '#99999918',                  border: '#999999'               },
  dropped:   { color: '#888888',             bg: '#88888818',                  background: '#88888818',                  border: '#888888'               },
  other:     { color: '#777777',             bg: '#77777718',                  background: '#77777718',                  border: '#777777'               },
};

