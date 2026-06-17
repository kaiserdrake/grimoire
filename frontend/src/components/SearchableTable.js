'use client';

import { useState, useRef, useEffect } from 'react';
import { FiSearch } from 'react-icons/fi';

// Custom react-markdown `table` renderer. Plain tables render unchanged. Tables
// tagged by the searchable-table remark plugin (data-searchable="true") get a
// search box that filters rows by the first column (case-insensitive substring;
// empty box shows every row).
export default function SearchableTable({ 'data-searchable': searchable, children, ...props }) {
  const tableRef = useRef(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!searchable || !tableRef.current) return;
    const q = query.trim().toLowerCase();
    const rows = tableRef.current.querySelectorAll('tbody tr');
    rows.forEach((tr) => {
      const cell = tr.querySelector('td');
      const text = (cell?.textContent || '').toLowerCase();
      tr.style.display = (!q || text.includes(q)) ? '' : 'none';
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
