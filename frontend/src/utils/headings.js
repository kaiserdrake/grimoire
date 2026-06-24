// ── Heading slugs ─────────────────────────────────────────────────────────────
// Shared slug logic so a tier-card's stored section link always matches the id
// assigned to the heading it points at. GitHub-style, dependency-free.

export function slugify(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Attach a `slug` to each extracted heading using the same dedup scheme as
// rehypeHeadingIds, so a TOC entry / URL anchor always matches the id the
// preview assigns to that heading.
export function withHeadingSlugs(headings) {
  const seen = new Map();
  return (headings || []).map((h) => {
    let slug = slugify(h.text);
    if (slug) {
      const n = seen.get(slug) || 0;
      seen.set(slug, n + 1);
      if (n > 0) slug = `${slug}-${n + 1}`;
    }
    return { ...h, slug };
  });
}

// Rehype plugin: give every heading (h1–h6) an id derived from its text, deduping
// collisions with a -2, -3, … suffix (same scheme github-slugger uses).
export function rehypeHeadingIds() {
  return (tree) => {
    const seen = new Map();
    const textOf = (node) => {
      if (node.type === 'text') return node.value || '';
      if (node.children) return node.children.map(textOf).join('');
      return '';
    };
    const visit = (node) => {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
        let slug = slugify(textOf(node));
        if (slug) {
          const n = seen.get(slug) || 0;
          seen.set(slug, n + 1);
          if (n > 0) slug = `${slug}-${n + 1}`;
          node.properties = node.properties || {};
          node.properties.id = slug;
        }
      }
      for (const child of node.children || []) visit(child);
    };
    visit(tree);
  };
}
