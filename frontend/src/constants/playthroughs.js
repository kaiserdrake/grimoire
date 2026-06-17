export const PT_STATUS_LABELS = {
  playing:   '▶ Playing',
  completed: '✓ Completed',
  pend:      '⏸ Pended',
  dropped:   '✖ Dropped',
};

export const PT_STATUS_COLORS = {
  playing:   'var(--color-accent)',
  completed: 'var(--color-text-secondary)',
  pend:      'var(--color-text-muted)',
  dropped:   'var(--color-danger)',
};

// Personal satisfaction scale (low → high). The stored rating is a continuous
// float in [1, 5]; these are the reference levels used for axis labels/tooltips.
export const SATISFACTION_SCALE = [
  { value: 1, label: 'Not good' },
  { value: 2, label: 'Okay' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very Good' },
  { value: 5, label: 'Epic' },
];

export const PT_STATUS_STYLE = {
  playing:   { color: 'var(--color-status-playing)',   background: 'var(--color-status-bg-playing)' },
  completed: { color: 'var(--color-status-completed)', background: 'var(--color-status-bg-completed)' },
  pend:      { color: 'var(--color-text-muted)',       background: 'var(--color-bg-subtle)' },
  dropped:   { color: 'var(--color-status-dropped)',   background: 'var(--color-status-bg-dropped)' },
};
