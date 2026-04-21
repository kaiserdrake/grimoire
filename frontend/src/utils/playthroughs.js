/**
 * Returns the display label for a playthrough.
 * Used in GameList and GameDetailModal.
 */
export function ptDisplayLabel(pt, allPlaythroughs) {
  const base = (pt.label && pt.label.trim()) ? pt.label.trim() : 'Playthrough';
  const duplicates = allPlaythroughs.filter(
    (p) => ((p.label && p.label.trim()) || 'Playthrough') === base
  );
  if (duplicates.length <= 1) return base;
  const instance = duplicates.findIndex((p) => p.id === pt.id) + 1;
  return `${base} (${instance})`;
}

/**
 * Returns the sidebar label for a playthrough.
 * Shows just the label; appends (id) only when two PTs share the same label.
 * Platform is shown via tooltip, not inline.
 */
export function ptSidebarLabel(pt, allPlaythroughs) {
  const base = (pt.label && pt.label.trim()) ? pt.label.trim() : 'PT';
  const duplicates = allPlaythroughs.filter(
    (p) => ((p.label && p.label.trim()) || 'PT') === base
  );
  if (duplicates.length <= 1) return base;
  const instance = duplicates.findIndex((p) => p.id === pt.id) + 1;
  return `${base} (${instance})`;
}
