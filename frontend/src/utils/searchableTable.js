// ── Searchable tables ─────────────────────────────────────────────────────────
// A table whose first header cell contains the token `:search` becomes a
// filterable table: the rendered <table> is tagged with data-searchable="true"
// (see SearchableTable.js) and the marker is stripped from the header so it never
// shows. Example first row: | Monster :search | Weakness | Notes |

export const SEARCH_TABLE_TOKEN = ':search';

// Strip the token (and any leftover surrounding whitespace) from a text value.
function stripToken(value) {
  return value.replace(SEARCH_TABLE_TOKEN, '').replace(/\s{2,}/g, ' ').trim();
}

// Recursively collect the text nodes under a node, in order.
function collectTextNodes(node, out) {
  if (node.type === 'text') { out.push(node); return; }
  if (node.children) node.children.forEach(child => collectTextNodes(child, out));
}

// Remark plugin: marks tables whose first header cell contains :search and
// removes the marker from that cell.
export function makeRemarkSearchableTablePlugin() {
  return function remarkSearchableTable() {
    return (tree) => {
      const visitNode = (node) => {
        if (node.type === 'table') {
          const headerRow = (node.children || [])[0];
          const firstCell = headerRow && (headerRow.children || [])[0];
          if (firstCell) {
            const texts = [];
            collectTextNodes(firstCell, texts);
            const marked = texts.some(t => t.value.includes(SEARCH_TABLE_TOKEN));
            if (marked) {
              texts.forEach(t => { t.value = stripToken(t.value); });
              node.data = node.data || {};
              node.data.hProperties = { ...(node.data.hProperties || {}), 'data-searchable': 'true' };
            }
          }
          // No need to descend further into a handled table.
          return;
        }
        if (node.children) node.children.forEach(visitNode);
      };
      visitNode(tree);
    };
  };
}
