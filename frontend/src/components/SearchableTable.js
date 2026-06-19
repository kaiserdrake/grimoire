'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';

function matchesQuery(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // OR groups split by ||, AND terms split by && within each group
  return q.split('||').some(orPart =>
    orPart.split('&&').every(term => text.includes(term.trim()))
  );
}

// Custom react-markdown `table` renderer. Plain tables render unchanged. Tables
// tagged by the searchable-table remark plugin (data-searchable="true") get a
// search box that filters rows by the first column.
// Supports && (AND) and || (OR) operators in the search query.
// tableIndex (1-based) and initialSearch are used for URL-param pre-fill.
export default function SearchableTable({ 'data-searchable': searchable, tableIndex, initialSearch, children, ...props }) {
  const tableRef = useRef(null);
  const [query, setQuery] = useState(initialSearch ?? '');

  useEffect(() => {
    if (!searchable || !tableRef.current) return;
    const q = query.toLowerCase();
    const rows = tableRef.current.querySelectorAll('tbody tr');
    rows.forEach((tr) => {
      const cell = tr.querySelector('td');
      const text = (cell?.textContent || '').toLowerCase();
      tr.style.display = matchesQuery(text, q) ? '' : 'none';
    });
  }, [query, searchable, children]);

  if (!searchable) {
    return <table {...props}>{children}</table>;
  }

  return (
    <div className="md-table-wrap">
      <div className="md-table-search-wrap">
        <FiSearch size={13} className="md-table-search-icon" />
        <input
          className="md-table-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows…"
        />
      </div>
      <table ref={tableRef} {...props}>{children}</table>
    </div>
  );
}
