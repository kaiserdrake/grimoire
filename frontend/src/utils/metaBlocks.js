// ── Metadata directive blocks ─────────────────────────────────────────────────
// Typed `:::name … :::` blocks (parsed by remark-directive) carry metadata that
// should not show up like a normal `---` rule. Hidden block types are dropped from
// the tree entirely so they never reach the rendered output. Any other *block*
// directive is kept renderable (as a tagged <div>) so an unknown `:::foo` never
// silently vanishes. Example:
//
//   :::meta
//   status: in-progress
//   tags: rpg, hard-mode
//   :::
//
// Only block (`:::`) directives are treated as metadata. Inline `:name` / `::name`
// directives are restored to their original source text, because this codebase
// uses colon-prefixed tokens as plain text (e.g. `:search`, see searchableTable.js)
// and remark-directive would otherwise swallow them.
//
// Requires remarkDirective to run earlier in the plugin chain so the `:::` syntax
// is parsed into directive nodes first.

// Directive names whose blocks are removed from the rendered view.
export const HIDDEN_META_TYPES = ['meta'];

// Faithfully reconstruct the original `:name…` source for an inline directive,
// preferring exact source offsets and falling back to `:`/`::` + name.
function directiveToText(node, src) {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (src != null && typeof start === 'number' && typeof end === 'number') {
    return { type: 'text', value: src.slice(start, end), position: node.position };
  }
  const marker = node.type === 'leafDirective' ? '::' : ':';
  return { type: 'text', value: marker + node.name, position: node.position };
}

// Walk a children array: drop hidden block directives, tag other block directives
// so they still render, and restore inline directives to literal text. Returns the
// rewritten children.
function processChildren(children, hidden, src) {
  const out = [];
  for (const child of children) {
    if (child.type === 'textDirective' || child.type === 'leafDirective') {
      out.push(directiveToText(child, src));
      continue;
    }
    if (child.type === 'containerDirective') {
      if (hidden.has(child.name)) continue; // hidden metadata block: drop entirely
      child.data = child.data || {};
      child.data.hName = 'div';
      child.data.hProperties = { ...(child.data.hProperties || {}), 'data-directive': child.name };
    }
    if (child.children) child.children = processChildren(child.children, hidden, src);
    out.push(child);
  }
  return out;
}

// Remark plugin: removes hidden metadata directive blocks (default `:::meta`),
// keeps any other block directive renderable, and restores inline `:name` tokens
// to plain text. Pass `{ hidden: [...] }` to override which block names are hidden.
export function makeRemarkMetaPlugin(options = {}) {
  const hidden = new Set(options.hidden || HIDDEN_META_TYPES);
  return function remarkMeta() {
    return (tree, file) => {
      const src = file ? String(file.value) : null;
      if (tree.children) tree.children = processChildren(tree.children, hidden, src);
    };
  };
}
