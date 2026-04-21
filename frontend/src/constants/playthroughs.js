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

export const PT_STATUS_STYLE = {
  playing:   { color: 'var(--color-status-playing)',   background: 'var(--color-status-bg-playing)' },
  completed: { color: 'var(--color-status-completed)', background: 'var(--color-status-bg-completed)' },
  pend:      { color: 'var(--color-text-muted)',       background: 'var(--color-bg-subtle)' },
  dropped:   { color: 'var(--color-status-dropped)',   background: 'var(--color-status-bg-dropped)' },
};
