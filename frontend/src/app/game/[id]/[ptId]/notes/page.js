'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Flex, HStack, Text, Button, Spinner, useToast, IconButton, Box, Tooltip,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody,
  Tabs, TabList, Tab, TabPanels, TabPanel, Input, FormControl, FormLabel,
  ModalFooter, VStack,
} from '@chakra-ui/react';
import { ChevronRightIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FiSave, FiPlus, FiTrash2, FiFileText, FiFolder, FiHelpCircle, FiBold, FiItalic, FiCode, FiList, FiMinus, FiImage, FiUpload, FiLink, FiGrid, FiEye, FiEdit3, FiMap, FiTag, FiSearch, FiLayers, FiLock, FiUnlock, FiCamera, FiCopy } from 'react-icons/fi';
import { BsController } from 'react-icons/bs';
import { TbPin } from 'react-icons/tb';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Navbar from '@/components/Navbar';
import GameDetailModal from '@/components/GameDetailModal';
import NotesDrawer from '@/components/NotesDrawer';
import RecentDrawer from '@/components/RecentDrawer';
import GameTabBar from '@/components/GameTabBar';
import CameraCapture from '@/components/CameraCapture';
import { useAuth } from '@/context/AuthContext';
import { api, getApiBase } from '@/utils/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLastVisited } from '@/context/LastVisitedContext';
import { useTabState } from '@/context/TabStateContext';
import { ptSidebarLabel } from '@/utils/playthroughs';
import { detectGamepad, makeRemarkGamepadPlugin, GAMEPAD_MAP, PICKER_SECTIONS } from '@/utils/gamepad';
import { makeRemarkNoteIconPlugin, buildIconMap, iconTokenFor, normalizeIcon } from '@/utils/noteIcons';
import { makeRemarkSearchableTablePlugin } from '@/utils/searchableTable';
import SearchableTable from '@/components/SearchableTable';
import { slugify, rehypeHeadingIds, withHeadingSlugs } from '@/utils/headings';
import TierList from '@/components/TierList';

// ── Markdown editor helpers ───────────────────────────────────────────────────
function insertAtCursor(textarea, before, after = '', placeholder = '') {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const inserted = before + selected + after;
  textarea.focus();
  document.execCommand('insertText', false, inserted);
  const newStart = start + before.length;
  const newEnd   = newStart + selected.length;
  textarea.setSelectionRange(newStart, newEnd);
}

// Inline React component to render a single button (used in picker)
function GpBtn({ canonical, platform }) {
  const map = GAMEPAD_MAP[platform] || GAMEPAD_MAP.playstation;
  const btn = map[canonical] || { glyph: canonical, cls: 'gp-btn-pill' };
  return <span className={btn.cls}>{btn.glyph}</span>;
}

// Toolbar picker popover
function GamepadPicker({ platform, onInsert, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onMouseDown={onClose}
    >
      <div
        className="gp-picker"
        style={{ position: 'static', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {PICKER_SECTIONS.map(sec => (
          <div key={sec.label}>
            <div className="gp-picker-section">{sec.label}</div>
            <div className="gp-picker-row">
              {sec.btns.map(canonical => {
                const map = GAMEPAD_MAP[platform] || GAMEPAD_MAP.playstation;
                const btn = map[canonical] || { html: `<span class="gp-btn-pill">${canonical}</span>` };
                return (
                  <button key={canonical} className="gp-picker-btn"
                    onMouseDown={(e) => { e.preventDefault(); onInsert(canonical); }}>
                    <span dangerouslySetInnerHTML={{ __html: btn.html }} />
                    <span className="gp-picker-label">{canonical}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Note icon preset picker ─────────────────────────────────────────────────
function NoteIconPicker({ iconGroups, apiBase, onInsert, onClose }) {
  const groups = (iconGroups || []).filter(g => (g.icons || []).length > 0);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onMouseDown={onClose}
    >
      <div
        className="gp-picker"
        style={{ position: 'static', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {groups.length === 0 ? (
          <div style={{ padding: '0.5rem 0.25rem', maxWidth: '240px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              No icon presets yet.
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Add icon groups in the Settings tab.
            </div>
          </div>
        ) : groups.map(g => (
          <div key={g.name}>
            <div className="gp-picker-section">{g.name}</div>
            <div className="gp-picker-row">
              {g.icons.map((icon, i) => {
                const { url, name, code } = normalizeIcon(icon, i);
                const token = iconTokenFor(g.name, code);
                return (
                  <button key={token} className="gp-picker-btn" title={name || token}
                    onMouseDown={(e) => { e.preventDefault(); onInsert(token); }}>
                    <img
                      className="note-icon"
                      src={url.startsWith('http') ? url : `${apiBase}${url}`}
                      alt={name || token}
                      style={{ height: '26px' }}
                      draggable={false}
                    />
                    <span className="gp-picker-label">{name || token}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Image Upload Modal ────────────────────────────────────────────────────────
function ImageUploadModal({ isOpen, onClose, onInsert, gameId }) {
  const toast = useToast();

  const [tabIndex,     setTabIndex]     = useState(0);   // 0=existing, 1=upload, 2=url, 3=camera
  const [file,         setFile]         = useState(null);
  const [url,          setUrl]          = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [existing,     setExisting]     = useState(null);
  const [loadingExist, setLoadingExist] = useState(false);
  const [apiBase,      setApiBase]      = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoadingExist(true);
    api.attachments.list(gameId, 'notes')
      .then(data => setExisting(data))
      .catch(() => setExisting([]))
      .finally(() => setLoadingExist(false));
    getApiBase().then(setApiBase).catch(() => {});
  }, [isOpen, gameId]);

  const reset = () => { setFile(null); setUrl(''); setTabIndex(0); setExisting(null); };
  const handleClose = () => { reset(); onClose(); };

  const handlePickExisting = (att) => {
    const label = att.original_name || att.filename;
    onInsert(`![${label}](${apiBase}${att.url})`)
    handleClose();
  };

  const handleInsert = async () => {
    setUploading(true);
    let inserted = null;
    try {
      const attachment = (tabIndex === 1 || tabIndex === 3)
        ? await api.attachments.upload(gameId, 'notes', file)
        : await api.attachments.fromUrl(gameId, 'notes', url.trim());

      const label = attachment.original_name || 'image';
      inserted = `![${label}](${apiBase}${attachment.url})`;
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setUploading(false);
      if (inserted) { onInsert(inserted); handleClose(); }
    }
  };

  const canInsert = (tabIndex === 1 || tabIndex === 3) ? !!file : tabIndex === 2 ? !!url.trim() : false;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}>
        <ModalHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.95rem' }}>
          Insert Image
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4}>
          <Tabs index={tabIndex} onChange={setTabIndex} size="sm" variant="unstyled">
            <TabList mb={3}>
              <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}>
                <HStack spacing={1}><FiImage size={11} /><span>Existing</span></HStack>
              </Tab>
              <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}>
                <HStack spacing={1}><FiUpload size={11} /><span>Upload</span></HStack>
              </Tab>
              <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}>
                <HStack spacing={1}><FiLink size={11} /><span>From URL</span></HStack>
              </Tab>
              <Tab fontSize="xs" color="var(--color-text-muted)" bg="transparent" borderRadius="md"
                _selected={{ bg: 'var(--color-accent-subtle)', color: 'var(--color-accent)', fontWeight: 600 }}
                _hover={{ color: 'var(--color-text-primary)' }}>
                <HStack spacing={1}><FiCamera size={11} /><span>Camera</span></HStack>
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel p={0}>
                {loadingExist ? (
                  <Box display="flex" justifyContent="center" py={6}>
                    <Spinner size="sm" style={{ color: 'var(--color-accent)' }} />
                  </Box>
                ) : existing && existing.length === 0 ? (
                  <Box py={6} textAlign="center">
                    <Text fontSize="sm" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      No images uploaded yet for this game's notes.
                    </Text>
                    <Text fontSize="xs" mt={1} style={{ color: 'var(--color-text-muted)' }}>
                      Use the Upload or From URL tab to add one.
                    </Text>
                  </Box>
                ) : (
                  <Box maxH="260px" overflowY="auto" display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}
                    sx={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)' } }}>
                    {(existing || []).map(att => (
                      <Box key={att.id} as="button" onClick={() => handlePickExisting(att)}
                        borderRadius="md" overflow="hidden"
                        style={{
                          background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)',
                          cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column',
                          alignItems: 'stretch', transition: 'border-color 0.1s',
                        }}
                        _hover={{ borderColor: 'var(--color-accent)' }}>
                        <Box h="72px" overflow="hidden" style={{ background: 'var(--color-bg-page)' }}>
                          <img src={`${apiBase}${att.url}`}
                            alt={att.original_name || att.filename}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                        <Box px={1} py={0.5}>
                          <Text fontSize="9px" noOfLines={1} style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                            {att.original_name || att.filename}
                          </Text>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </TabPanel>
              <TabPanel p={0}>
                <Box as="label" htmlFor="note-img-upload"
                  display="flex" flexDirection="column" alignItems="center" justifyContent="center"
                  py={6} cursor="pointer"
                  style={{
                    background: 'var(--color-bg-subtle)', border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)',
                  }}>
                  <FiUpload size={22} style={{ marginBottom: '0.4rem' }} />
                  <Text fontSize="sm">{file ? file.name : 'Click to select an image'}</Text>
                  <Text fontSize="xs" mt={0.5}>PNG, JPG, WebP, GIF</Text>
                  <input id="note-img-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
                </Box>
              </TabPanel>
              <TabPanel p={0}>
                <VStack spacing={2} align="stretch">
                  <Input value={url} onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com/image.png" size="sm"
                    style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
                  <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
                    Image will be downloaded and hosted locally.
                  </Text>
                </VStack>
              </TabPanel>
              <TabPanel p={0}>
                <CameraCapture active={isOpen && tabIndex === 3} onCapture={setFile} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
        {tabIndex > 0 && (
          <ModalFooter style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <HStack spacing={2}>
              <Button size="sm" variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button size="sm" isLoading={uploading} loadingText="Uploading…" spinnerPlacement="start"
                isDisabled={!canInsert} onClick={handleInsert}
                style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}>
                Insert
              </Button>
            </HStack>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}

// ── Source-line mapping ───────────────────────────────────────────────────
// Tags each top-level preview block with the markdown line it starts on, so the
// block matching the editor cursor can be highlighted.
function rehypeSourceLine() {
  const tag = (node) => {
    const line = node.type === 'element' && node.position?.start?.line;
    if (line) {
      node.properties = node.properties || {};
      node.properties['data-source-line'] = line;
    }
  };
  return (tree) => {
    // Top-level blocks (paragraphs, headings, lists, tables, …).
    for (const node of tree.children || []) tag(node);
    // Also tag table rows so the cursor highlights a single row, not the whole table.
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'tr') tag(node);
      for (const child of node.children || []) visit(child);
    };
    visit(tree);
  };
}

// ── Table of contents helpers ─────────────────────────────────────────────
function extractHeadings(markdown) {
  const lines = markdown.split('\n');
  return lines.reduce((acc, line) => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) acc.push({ level: m[1].length, text: m[2].trim() });
    return acc;
  }, []);
}

// ── Markdown toolbar ──────────────────────────────────────────────────────────
function MarkdownToolbar({ textareaRef, onChange, onOpenImageModal, platform, iconGroups, apiBase }) {
  const apply = (before, after = '', placeholder = '') => {
    if (!textareaRef.current) return;
    insertAtCursor(textareaRef.current, before, after, placeholder);
    onChange(textareaRef.current.value);
  };
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const insertBtn = (canonical) => {
    if (!textareaRef.current) return;
    insertAtCursor(textareaRef.current, `:btn[${canonical}]`);
    onChange(textareaRef.current.value);
    setPickerOpen(false);
  };

  const insertIcon = (token) => {
    if (!textareaRef.current) return;
    insertAtCursor(textareaRef.current, `:icon[${token}]`);
    onChange(textareaRef.current.value);
    setIconPickerOpen(false);
  };

  const ITEMS = [
    { icon: <FiBold size={12} />,   label: 'Bold',        action: () => apply('**', '**', 'bold text') },
    { icon: <FiItalic size={12} />, label: 'Italic',      action: () => apply('*', '*', 'italic text') },
    { icon: <FiCode size={12} />,   label: 'Inline code', action: () => apply('`', '`', 'code') },
    null,
    { icon: <FiList size={12} />,   label: 'Bullet list', action: () => apply('- ', '', 'list item') },
    { icon: <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>H1</span>, label: 'Heading 1', action: () => apply('# ', '', 'Heading') },
    { icon: <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>H2</span>, label: 'Heading 2', action: () => apply('## ', '', 'Heading') },
    { icon: <FiMinus size={12} />,  label: 'Divider',     action: () => apply('\n---\n') },
    null,
    { icon: <FiImage size={12} />,  label: 'Insert image', action: onOpenImageModal },
    null,
    { icon: <FiGrid size={12} />,   label: 'Insert table', action: () => apply(
      '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| ',
      ' | cell | cell |\n',
      'cell'
    )},
    { icon: <FiSearch size={12} />, label: 'Insert searchable table', action: () => apply(
      '\n| Column 1 :search | Column 2 | Column 3 |\n| --- | --- | --- |\n| ',
      ' | cell | cell |\n',
      'cell'
    )},
    { icon: <FiLayers size={12} />, label: 'Insert tier list', action: () => apply(
      '\n```tier\nS: \nA: \nB: \nC: \nD: \nUnranked: \n```\n'
    )},
    null,
    { icon: <BsController size={12} />, label: 'Insert gamepad button', action: () => setPickerOpen(o => !o) },
    { icon: <FiTag size={12} />, label: 'Insert preset icon', action: () => setIconPickerOpen(o => !o) },
  ];

  return (
    <div className="notes-toolbar" style={{ position: 'relative' }}>
      {ITEMS.map((item, i) =>
        item === null
          ? <div key={i} className="notes-toolbar-sep" />
          : (
            <Tooltip key={i} label={item.label} fontSize="xs" placement="bottom" openDelay={400} hasArrow>
              <button className="notes-toolbar-btn" onClick={item.action} type="button">{item.icon}</button>
            </Tooltip>
          )
      )}
      {pickerOpen && (
        <GamepadPicker
          platform={platform}
          onInsert={insertBtn}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {iconPickerOpen && (
        <NoteIconPicker
          iconGroups={iconGroups}
          apiBase={apiBase}
          onInsert={insertIcon}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Markdown help modal ───────────────────────────────────────────────────────
function MarkdownHelpModal({ isOpen, onClose }) {
  const SECTIONS = [
    { heading: 'Text formatting', rows: [['**bold**','Bold'],['*italic*','Italic'],['~~strikethrough~~','Strikethrough'],['`inline code`','Inline code']] },
    { heading: 'Headings',        rows: [['# H1','Heading 1'],['## H2','Heading 2'],['### H3','Heading 3']] },
    { heading: 'Lists',           rows: [['- item','Bullet list'],['1. item','Numbered list'],['- [ ] task','Task list']] },
    { heading: 'Other',           rows: [['> quote','Blockquote'],['---','Horizontal rule'],['[text](url)','Link'],['![alt](url)','Image'],['| A | B |','Table'],[':btn[cross]', 'Gamepad button (canonical name)'],['```code```','Code block']] },
  ];
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent style={{
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <ModalHeader style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: '0.9rem' }}>
          Markdown Reference
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={3}>
          {SECTIONS.map(sec => (
            <Box key={sec.heading} mb={3}>
              <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.06em"
                mb={1.5} style={{ color: 'var(--color-text-muted)' }}>{sec.heading}</Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {sec.rows.map(([syntax, desc]) => (
                    <tr key={syntax}>
                      <td style={{ padding: '3px 8px 3px 0', width: '50%' }}>
                        <code style={{
                          background: 'var(--color-bg-subtle)',
                          border: '1px solid var(--color-border-subtle)',
                          borderRadius: '3px', padding: '1px 5px', fontSize: '0.78rem',
                          color: 'var(--color-accent)', fontFamily: 'monospace', whiteSpace: 'pre',
                        }}>{syntax}</code>
                      </td>
                      <td style={{ padding: '3px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          ))}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ── Inline rename input ───────────────────────────────────────────────────────
function RenameInput({ value, onConfirm, onCancel }) {
  const [val, setVal] = useState(value);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input ref={ref} value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onConfirm(val.trim() || 'Untitled');
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onConfirm(val.trim() || 'Untitled')}
      style={{
        background: 'var(--color-bg-page)', border: '1px solid var(--color-accent)',
        borderRadius: '3px', color: 'var(--color-text-primary)',
        fontSize: '0.8rem', padding: '1px 4px', width: '100%', outline: 'none',
      }}
    />
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ game, playthroughs, filesByPt, activePtId, activeFileId,
  onSelectFile, onNewFile, onDeleteFile, onRenameFile, onOpenGame, initialPtId, gameId }) {
  const router = useRouter();
  const [expandedPts, setExpandedPts] = useState(() => {
    const init = {};
    if (initialPtId) init[initialPtId] = true;
    return init;
  });
  const [renamingFileId, setRenamingFileId] = useState(null);
  const togglePt = (ptId) => setExpandedPts(p => ({ ...p, [ptId]: !p[ptId] }));

  // Auto-expand the PT that owns the active file when restored from context
  useEffect(() => {
    if (activePtId) setExpandedPts(p => ({ ...p, [activePtId]: true }));
  }, [activePtId]);

  return (
    <div className="notes-sidebar">
      <div className="notes-sidebar-header">
        <button className="notes-sidebar-title-btn" onClick={onOpenGame} title="Open game details">
          <FiFolder size={13} style={{ flexShrink: 0, color: 'var(--color-accent)' }} />
          <span className="notes-sidebar-title-text">{game?.title ?? '…'}</span>
        </button>
      </div>
      <div className="notes-sidebar-tree">
        {playthroughs.map((pt, i) => {
          const files = filesByPt[pt.id] || [];
          const isOpen = !!expandedPts[pt.id];
          const isActivePt = pt.id === activePtId;
          return (
            <div key={pt.id}>
              <div className={`notes-sidebar-folder${isActivePt ? ' active-folder' : ''}`}
                onClick={() => togglePt(pt.id)}>
                {isOpen
                  ? <ChevronDownIcon  boxSize={3} style={{ flexShrink: 0 }} />
                  : <ChevronRightIcon boxSize={3} style={{ flexShrink: 0 }} />}
                <FiFolder size={12} style={{ flexShrink: 0, color: isOpen ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
                <Tooltip label={pt.platform} hasArrow placement="right" openDelay={300}>
                  <Text fontSize="11px" noOfLines={1} flex={1}>{ptSidebarLabel(pt, playthroughs)}</Text>
                </Tooltip>
                <IconButton icon={<FiPlus size={10} />} size="xs" variant="ghost" aria-label="New file"
                  onClick={e => { e.stopPropagation(); onNewFile(pt.id); }}
                  style={{ color: 'var(--color-text-muted)', minWidth: '18px', height: '18px' }} />
              </div>
              {isOpen && (
                <div className="notes-sidebar-files">
                  {files.length === 0 && (
                    <Text fontSize="10px" style={{ color: 'var(--color-text-muted)', paddingLeft: '2rem', fontStyle: 'italic' }}>
                      No files
                    </Text>
                  )}
                  {files.map(file => (
                    <div key={file.id}
                      className={`notes-sidebar-file${file.id === activeFileId ? ' active' : ''}`}
                      onClick={() => onSelectFile(pt.id, file.id)}>
                      <FiFileText size={11} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingFileId === file.id ? (
                          <RenameInput value={file.title}
                            onConfirm={title => { onRenameFile(file.id, title); setRenamingFileId(null); }}
                            onCancel={() => setRenamingFileId(null)} />
                        ) : (
                          <Text fontSize="11px" noOfLines={1}
                            onDoubleClick={e => { e.stopPropagation(); setRenamingFileId(file.id); }}>
                            {file.title}
                          </Text>
                        )}
                      </div>
                      {file.id === activeFileId && (
                        <HoldToDelete onDelete={() => onDeleteFile(pt.id, file.id)} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hold-to-delete ────────────────────────────────────────────────────────────
const HOLD_DURATION = 1800;

function HoldToDelete({ onDelete }) {
  const [progress, setProgress] = useState(0);
  const [holding,  setHolding]  = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const p = Math.min((Date.now() - startRef.current) / HOLD_DURATION, 1);
    setProgress(p);
    if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
    else if (!firedRef.current) { firedRef.current = true; onDelete(); reset(); }
  }, [onDelete]);

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    firedRef.current = false;
    setProgress(0);
    setHolding(false);
  };

  const start = (e) => {
    e.preventDefault(); e.stopPropagation();
    startRef.current = Date.now(); firedRef.current = false;
    setHolding(true); rafRef.current = requestAnimationFrame(tick);
  };
  const stop = (e) => { e.stopPropagation(); if (!firedRef.current) reset(); };

  const radius = 10;
  const svgSize = radius * 2 + 4;
  const circumference = 2 * Math.PI * radius;

  return (
    <Tooltip label="Hold to delete" hasArrow placement="top" openDelay={400}>
      <Box as="button" display="inline-flex" alignItems="center" justifyContent="center"
        borderRadius="md" border="none" cursor="pointer" background="none"
        color={holding ? 'var(--color-danger)' : 'var(--color-text-muted)'}
        onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchEnd={stop}
        style={{ padding: '1px', flexShrink: 0 }}>
        {holding ? (
          <svg width={svgSize} height={svgSize} style={{ display: 'block' }}>
            <circle cx={svgSize/2} cy={svgSize/2} r={radius} fill="none" stroke="var(--color-danger)" strokeOpacity={0.2} strokeWidth={2} />
            <circle cx={svgSize/2} cy={svgSize/2} r={radius} fill="none" stroke="var(--color-danger)" strokeWidth={2}
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round" transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`} />
          </svg>
        ) : (
          <FiTrash2 size={11} />
        )}
      </Box>
    </Tooltip>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotesPage({ params }) {
  const { id, ptId: initialPtId } = params;
  const toast    = useToast();
  const { user } = useAuth();
  const { visitNotes } = useLastVisited();
  const { notesState, setNotesState } = useTabState();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Incremented each render pass to assign 1-based index to each SearchableTable
  const tableCounterRef = useRef(0);

  const [game, setGame]                     = useState(null);
  const [playthroughs, setPlaythroughs]     = useState([]);
  const [filesByPt, setFilesByPt]           = useState({});
  const [apiBase, setApiBase]               = useState('');
  const [iconGroups, setIconGroups]         = useState([]); // [{ name, icons: [url] }]

  const [renamingTopbar, setRenamingTopbar] = useState(false);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [gameModalOpen, setGameModalOpen]   = useState(false);
  const [helpOpen, setHelpOpen]             = useState(false);
  // Locked = render-only (no editor). Persisted per note file across reloads/tab switches.
  const [lockedFiles, setLockedFiles]       = useState(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('grimoire:notesLocked') || '{}') || {}; }
    catch { return {}; }
  });
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [drawerTab,  setDrawerTab]          = useState('recent');
  const [publishing, setPublishing]         = useState(false);
  const [previewZoom, setPreviewZoom]       = useState(100);
  const [recentOpen, setRecentOpen]         = useState(false);

  // ── All persisted via TabStateContext (survives tab switches) ─────────────
  const activePtId   = notesState.activePtId;
  const activeFileId = notesState.activeFileId;
  const content      = notesState.content;
  const saved        = notesState.saved;

  const setActivePtId   = (val) => setNotesState((s) => ({ ...s, activePtId: val }));
  const setActiveFileId = (val) => setNotesState((s) => ({ ...s, activeFileId: val }));
  const setContent      = (val) => setNotesState((s) => ({ ...s, content: val }));
  const setSaved        = (val) => setNotesState((s) => ({ ...s, saved: val }));

  // Lock state is per active note file.
  const isPresentMode = !!(activeFileId != null && lockedFiles[activeFileId]);
  const toggleLocked = () => {
    if (activeFileId == null) return;
    setLockedFiles((prev) => {
      const next = { ...prev };
      if (next[activeFileId]) delete next[activeFileId];
      else next[activeFileId] = true;
      try { localStorage.setItem('grimoire:notesLocked', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const saveTimer   = useRef(null);
  const textareaRef = useRef(null);
  const previewRef  = useRef(null);
  const lastNavSlug = useRef(null); // last heading slug auto-scrolled from the URL

  const [activeLine, setActiveLine] = useState(null);

  const isDirty = content !== saved;

  // Sync the editor cursor's line to the matching preview block.
  const updateCursorLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
    setActiveLine(line);
  }, []);

  // In Present mode there's no editor caret, so let a click on the preview move
  // the row highlight to the clicked block.
  const handlePreviewClick = useCallback((e) => {
    if (!isPresentMode) return;
    const el = e.target.closest?.('[data-source-line]');
    if (!el) return;
    setActiveLine(Number(el.getAttribute('data-source-line')));
  }, [isPresentMode]);

  // Highlight the top-level preview block that contains the cursor line.
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;
    const els = container.querySelectorAll('[data-source-line]');
    let active = null;
    els.forEach((el) => {
      el.classList.remove('notes-preview-line-active');
      const ln = Number(el.getAttribute('data-source-line'));
      if (activeLine != null && ln <= activeLine &&
          (!active || ln > Number(active.getAttribute('data-source-line')))) {
        active = el;
      }
    });
    if (active) active.classList.add('notes-preview-line-active');
  }, [activeLine, content, isPresentMode]);

  useEffect(() => {
    if (game) visitNotes(id, initialPtId, game.title, game.cover_url ?? null);
  }, [game]);

  useEffect(() => { getApiBase().then(setApiBase).catch(() => {}); }, []);

  // ── Load this game's note icon presets ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    api.settings.get(`note_icons_${id}`)
      .then(val => setIconGroups(Array.isArray(val) ? val : []))
      .catch(() => {});
  }, [id, user]);

  const iconMap = useMemo(() => buildIconMap(iconGroups, apiBase), [iconGroups, apiBase]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [g, pts] = await Promise.all([api.games.get(id), api.playthroughs.list(id)]);

        setGame(g);
        setPlaythroughs(pts);
        const fileLists = await Promise.all(pts.map(pt => api.noteFiles.list(pt.id)));
        const byPt = {};
        pts.forEach((pt, i) => { byPt[pt.id] = fileLists[i]; });
        setFilesByPt(byPt);

        // If we already have this file open in context, don't re-fetch — just restore UI
        const urlFileId = searchParams.get('fileId') ? Number(searchParams.get('fileId')) : null;
        const savedFileId = notesState.activeFileId;
        const allFiles = Object.values(byPt).flat();
        const restoredFile = urlFileId
          ? allFiles.find(f => f.id === urlFileId)
          : savedFileId ? allFiles.find(f => f.id === savedFileId) : null;

        if (restoredFile) {
          const restoredPtId = Object.keys(byPt).find(ptId =>
            byPt[ptId].some(f => f.id === restoredFile.id)
          );
          setActivePtId(restoredPtId);
          setActiveFileId(restoredFile.id);
          if (urlFileId) {
            const file = await api.noteFiles.get(restoredFile.id);
            setContent(file.content || '');
            setSaved(file.content || '');
          }
        } else {
          const targetPt = pts.find(p => String(p.id) === String(initialPtId)) ?? pts[0];
          if (targetPt) {
            const files = byPt[targetPt.id] || [];
            if (files.length > 0) await openFile(targetPt.id, files[0].id);
            else setActivePtId(targetPt.id);
          }
        }
      } catch (err) {
        toast({ title: 'Failed to load', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  const openFile = async (ptId, fileId) => {
    clearTimeout(saveTimer.current);
    if (isDirty && activeFileId) { await api.noteFiles.save(activeFileId, { content }); setSaved(content); }
    setActivePtId(ptId);
    setActiveFileId(fileId);
    // Write fileId to the URL so users can copy the address bar to deep-link.
    // Drop any heading anchor — it belonged to the previously open file.
    const params = new URLSearchParams(searchParams.toString());
    params.set('fileId', fileId);
    params.delete('heading');
    lastNavSlug.current = null;
    router.replace(`?${params.toString()}`, { scroll: false });
    try {
      const file = await api.noteFiles.get(fileId);
      setContent(file.content || '');
      setSaved(file.content || '');
    } catch (err) {
      toast({ title: 'Failed to open file', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const save = useCallback(async (text) => {
    if (!activeFileId) return;
    setSaving(true);
    try { await api.noteFiles.save(activeFileId, { content: text }); setSaved(text); }
    catch (err) { toast({ title: 'Auto-save failed', description: err.message, status: 'error', duration: 3000 }); }
    finally { setSaving(false); }
  }, [activeFileId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    updateCursorLine();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 2000);
  };

  const handleManualSave = () => { clearTimeout(saveTimer.current); save(content); };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Replace a ```tier block (by its line range) with regenerated body text, then
  // persist via the normal debounced save. Used by the interactive TierList.
  const persistTierBlock = useCallback((position, body) => {
    if (!position) return;
    const lines = content.split('\n');
    const block = '```tier\n' + body + '\n```';
    const next = [
      ...lines.slice(0, position.start.line - 1),
      block,
      ...lines.slice(position.end.line),
    ].join('\n');
    setContent(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(next), 2000);
  }, [content, save]);

  // Scroll the preview to a heading id and reflect it in the URL so the address
  // bar can be copied as a deep-link to that section. Works in split, locked and
  // present mode since the preview is always rendered. `writeUrl=false` is used by
  // the URL-driven scroll so it doesn't redundantly rewrite the param.
  const navigateSection = useCallback((slug, { writeUrl = true } = {}) => {
    if (!slug) return false;
    const el = previewRef.current?.querySelector('#' + (window.CSS?.escape ? CSS.escape(slug) : slug));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (writeUrl) {
      const params = new URLSearchParams(window.location.search);
      params.set('heading', slug);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    return !!el;
  }, [router]);

  // Deep-link: when the URL carries a ?heading=<slug>, scroll the preview to it
  // once the file's content has rendered. Guarded so typing (which changes
  // `content` but not the slug) doesn't keep yanking the scroll position.
  useEffect(() => {
    const slug = searchParams.get('heading');
    if (!slug) { lastNavSlug.current = null; return; }
    if (!content || lastNavSlug.current === slug) return;
    // The preview may not be painted yet on first load — retry briefly.
    let tries = 0;
    const tryScroll = () => {
      if (navigateSection(slug, { writeUrl: false })) {
        lastNavSlug.current = slug;
      } else if (tries++ < 10) {
        setTimeout(tryScroll, 100);
      }
    };
    const t = setTimeout(tryScroll, 50);
    return () => clearTimeout(t);
  }, [content, searchParams, navigateSection]);

  const handleImageInsert = (markdown) => {
    const ta = textareaRef.current;
    if (ta) {
      insertAtCursor(ta, markdown);
      const newVal = ta.value;
      setContent(newVal);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(newVal), 2000);
    } else {
      const newVal = content + '\n' + markdown;
      setContent(newVal);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(newVal), 2000);
    }
  };

  const handlePublish = async () => {
    if (!activeFileId) return;
    setPublishing(true);
    try {
      await api.bulletin.publish({ note_file_id: activeFileId });
      toast({ title: 'Published to bulletin!', status: 'success', duration: 2500 });
    } catch (err) {

      toast({
        title: 'Publish failed',

        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDragOver = (e) => {
    if (!activeFileId) return;
    const hasImage = Array.from(e.dataTransfer.items).some(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (hasImage) { e.preventDefault(); setIsDraggingOver(true); }
  };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = async (e) => {
    setIsDraggingOver(false);
    if (!activeFileId) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    const base = await getApiBase();
    for (const file of files) {
      try {
        const attachment = await api.attachments.upload(id, 'notes', file);
        handleImageInsert(`![${attachment.original_name || 'image'}](${base}${attachment.url})`);
      } catch (err) {
        toast({ title: `Failed to upload ${file.name}`, description: err.message, status: 'error', duration: 4000 });
      }
    }
  };

  const handleNewFile = async (ptId) => {
    try {
      const file = await api.noteFiles.create(ptId, { title: 'Untitled' });
      setFilesByPt(prev => ({ ...prev, [ptId]: [...(prev[ptId] || []), file] }));
      await openFile(ptId, file.id);
    } catch (err) { toast({ title: 'Failed to create file', description: err.message, status: 'error', duration: 3000 }); }
  };

  const handleDeleteFile = async (ptId, fileId) => {
    try {
      await api.noteFiles.delete(fileId);
      const remaining = (filesByPt[ptId] || []).filter(f => f.id !== fileId);
      setFilesByPt(prev => ({ ...prev, [ptId]: remaining }));
      if (activeFileId === fileId) {
        if (remaining.length > 0) await openFile(ptId, remaining[0].id);
        else { setActiveFileId(null); setContent(''); setSaved(''); }
      }
    } catch (err) { toast({ title: 'Failed to delete file', description: err.message, status: 'error', duration: 3000 }); }
  };

  const handleRenameFile = async (fileId, title) => {
    try {
      await api.noteFiles.save(fileId, { title });
      setFilesByPt(prev => {
        const next = { ...prev };
        for (const ptId of Object.keys(next)) next[ptId] = next[ptId].map(f => f.id === fileId ? { ...f, title } : f);
        return next;
      });
    } catch (err) { toast({ title: 'Rename failed', description: err.message, status: 'error', duration: 3000 }); }
  };

  const activeFile = activeFileId ? Object.values(filesByPt).flat().find(f => f.id === activeFileId) : null;
  const activePt = playthroughs.find(p => String(p.id) === String(activePtId));
  const gamepad  = useMemo(() => detectGamepad(activePt?.platform), [activePt?.platform]);

  // Stable plugin/component identities for the markdown preview. Recreating these
  // inline on every render makes react-markdown remount custom components (e.g.
  // SearchableTable), which would wipe a table's active filter on every cell click.
  // These hooks must run before any early return below to satisfy the Rules of Hooks.
  const remarkPlugins = useMemo(
    () => [remarkGfm, makeRemarkGamepadPlugin(gamepad), makeRemarkNoteIconPlugin(iconMap), makeRemarkSearchableTablePlugin()],
    [gamepad, iconMap],
  );
  const rehypePlugins = useMemo(() => [rehypeRaw, rehypeSourceLine, rehypeHeadingIds], []);
  // Headings render with a hover "#" anchor that copies a deep-link to the section
  // (and scrolls to it). The id is assigned by rehypeHeadingIds. Works in locked /
  // present mode too, since the preview is the visible pane there.
  const makeHeading = (Tag) => ({ node, children, ...props }) => {
    const id = props.id;
    const copyLink = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!id) return;
      navigateSection(id); // scroll + reflect ?heading in the URL
      const params = new URLSearchParams(window.location.search);
      params.set('heading', id);
      const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      navigator.clipboard?.writeText(url)
        .then(() => toast({ title: 'Section link copied', status: 'success', duration: 1500 }))
        .catch(() => {});
    };
    return (
      <Tag {...props} className="notes-heading-anchor">
        {children}
        <button type="button" className="notes-heading-link"
          onClick={copyLink} aria-label="Copy link to this section" title="Copy link to this section">
          #
        </button>
      </Tag>
    );
  };

  const markdownComponents = useMemo(() => ({
    h1: makeHeading('h1'),
    h2: makeHeading('h2'),
    h3: makeHeading('h3'),
    h4: makeHeading('h4'),
    h5: makeHeading('h5'),
    h6: makeHeading('h6'),
    img: ({ node, ...props }) => (
      <div className="img-resizer"><img {...props} /></div>
    ),
    table: ({ node, ...props }) => {
      const idx = ++tableCounterRef.current;
      // Tables are keyed st1, st2, … by their order on the page. Accept a bare
      // `st` as a convenience alias for the first table.
      const fromUrl = searchParams.get(`st${idx}`) ?? (idx === 1 ? searchParams.get('st') : null);
      const init = props['data-searchable'] ? (fromUrl ?? '') : '';
      return <SearchableTable tableIndex={idx} initialSearch={init} {...props} />;
    },
    pre: ({ node, children, ...props }) => {
      const codeEl = node?.children?.[0];
      const cls = codeEl?.properties?.className;
      if (Array.isArray(cls) && cls.includes('language-tier')) {
        const raw = (codeEl.children?.[0]?.value || '').replace(/\n$/, '');
        return (
          <TierList
            raw={raw}
            iconMap={iconMap}
            headings={extractHeadings(content).map(h => ({ ...h, slug: slugify(h.text) }))}
            position={node.position}
            onPersist={persistTierBlock}
            onNavigateSection={navigateSection}
          />
        );
      }
      return <pre {...props}>{children}</pre>;
    },
  }), [iconMap, searchParams, content, persistTierBlock, navigateSection]);

  if (!user) return (
    <>
      <Navbar />
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in to view notes.</Text>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <GameTabBar gameId={id} ptId={activePtId || initialPtId} hasPlaythroughs={loading || playthroughs.length > 0} />
      <div className="notes-workspace">

        {/* ── Left: Sidebar ── */}
        {loading ? null : (
          <Sidebar
            game={game}
            playthroughs={playthroughs}
            filesByPt={filesByPt}
            activePtId={activePtId}
            activeFileId={activeFileId}
            onSelectFile={openFile}
            onNewFile={handleNewFile}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onOpenGame={() => setGameModalOpen(true)}
            initialPtId={initialPtId}
            gameId={id}
          />
        )}

        {/* ── Right: Editor ── */}
        <div className="notes-editor-area">

          {loading ? (
            <Flex justify="center" align="center" height="100%">
              <Spinner style={{ color: 'var(--color-accent)' }} />
            </Flex>
          ) : activeFileId ? (
            <>
              <div className="notes-editor-topbar">
              <HStack spacing={1}>
                <FiFileText size={12} style={{ color: 'var(--color-text-muted)' }} />
                {renamingTopbar ? (
                  <RenameInput
                    value={activeFile?.title ?? 'Untitled'}
                    onConfirm={(title) => {
                      handleRenameFile(activeFileId, title);
                      setRenamingTopbar(false);
                    }}
                    onCancel={() => setRenamingTopbar(false)}
                  />
                ) : (
                  <Text
                    fontSize="xs"
                    style={{ color: 'var(--color-text-muted)', cursor: 'default' }}
                    title="Double-click to rename"
                    onDoubleClick={() => setRenamingTopbar(true)}
                  >
                    {activeFile?.title ?? 'Untitled'}
                  </Text>
                )}
                </HStack>
                <HStack spacing={2}>
                  {previewZoom !== 100 && (
                    <button className="notes-zoom-reset" onClick={() => setPreviewZoom(100)}>Reset</button>
                  )}
                  <input
                    type="range" min={100} max={300} step={10}
                    value={previewZoom}
                    onChange={e => setPreviewZoom(Number(e.target.value))}
                    className="notes-zoom-slider"
                  />
                  <span className="notes-zoom-label">{previewZoom}%</span>
                  {!isPresentMode && saving && (
                    <HStack spacing={1}>
                      <Spinner size="xs" style={{ color: 'var(--color-accent)' }} />
                      <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>Saving…</Text>
                    </HStack>
                  )}
                  {!isPresentMode && !saving && !isDirty && saved && (
                    <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>Saved</Text>
                  )}
                  {!isPresentMode && <IconButton icon={<FiHelpCircle size={14} />} size="xs" variant="ghost"
                    aria-label="Markdown help" onClick={() => setHelpOpen(true)}
                    style={{ color: 'var(--color-text-muted)' }} /> }
                  {!isPresentMode && <Button size="xs" leftIcon={<FiSave size={11} />}
                    onClick={handleManualSave} isLoading={saving} isDisabled={!isDirty}
                    style={{
                      background: isDirty ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                      color: isDirty ? 'white' : 'var(--color-text-muted)', border: 'none',
                    }}>
                    Save
                  </Button> }
                  <Button
                    size="xs"
                    leftIcon={<TbPin size={12} />}
                    onClick={handlePublish}
                    isLoading={publishing}
                    style={{
                      background: 'var(--color-bg-subtle)',
                      color: 'var(--color-text-muted)', border: 'none',
                    }}
                  >
                    Pin
                  </Button>
                  {isPresentMode && activeFileId != null && (
                    <Tooltip label="Copy raw markdown URL">
                      <IconButton
                        icon={<FiCopy size={13} />}
                        size="xs"
                        aria-label="Copy raw markdown URL"
                        variant="ghost"
                        style={{ color: 'var(--color-text-muted)' }}
                        onClick={async () => {
                          const base = await getApiBase();
                          const url = `${base}/api/note-files/${activeFileId}/raw`;
                          try {
                            await navigator.clipboard.writeText(url);
                            toast({ title: 'URL copied', status: 'success', duration: 2000, isClosable: true });
                          } catch {
                            toast({ title: 'Copy failed', status: 'error', duration: 2000, isClosable: true });
                          }
                        }}
                      />
                    </Tooltip>
                  )}
                  <Button size="xs"
                    leftIcon={isPresentMode ? <FiUnlock size={11} /> : <FiLock size={11} />}
                    onClick={toggleLocked}
                    style={{
                      background: 'var(--color-bg-subtle)',
                      color: 'var(--color-text-muted)', border: 'none',
                    }}>
                    {isPresentMode ? 'Unlock' : 'Lock'}
                  </Button>
                </HStack>
              </div>

              {/* ── Split pane: editor left, preview right ── */}
              <div className="notes-split-pane">
                {!isPresentMode && <div className="notes-editor-body">
                  <MarkdownToolbar
                    textareaRef={textareaRef}
                    onChange={(val) => {
                      setContent(val);
                      clearTimeout(saveTimer.current);
                      saveTimer.current = setTimeout(() => save(val), 2000);
                    }}
                    onOpenImageModal={() => setImageModalOpen(true)}
                    platform={gamepad}
                    iconGroups={iconGroups}
                    apiBase={apiBase}
                  />
                  <textarea
                    ref={textareaRef}
                    className="notes-textarea notes-textarea-full"
                    value={content}
                    onChange={handleChange}
                    onSelect={updateCursorLine}
                    onClick={updateCursorLine}
                    onKeyUp={updateCursorLine}
                    placeholder={`# Notes\n\nStart writing…\n\nMarkdown supported:\n- **bold**, *italic*, \`code\`\n- # Headings, > Blockquotes\n- | Tables |\n- ![alt](image-url) for images\n\nDrag & drop images to upload them.`}
                    spellCheck
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={isDraggingOver ? { outline: '2px solid var(--color-accent)', outlineOffset: '-2px' } : undefined}
                  />
                </div>}

                {!isPresentMode && <div className="notes-split-divider" />}

                <div ref={previewRef} className="notes-preview-content notes-preview-split"
                  style={{ zoom: `${previewZoom}%`, cursor: isPresentMode ? 'pointer' : undefined }}
                  onClick={handlePreviewClick}>
                  {content.trim()
                    ? (tableCounterRef.current = 0, <ReactMarkdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={markdownComponents}
                      >{content}</ReactMarkdown>)
                    : <Text style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Nothing to preview yet…</Text>
                  }
                </div>

                {/* TOC drawer + pull tab */}
                <NotesDrawer
                  isOpen={drawerOpen}
                  onToggle={() => setDrawerOpen(o => !o)}
                  activeTab={drawerTab}
                  onTabChange={setDrawerTab}
                  headings={withHeadingSlugs(extractHeadings(content))}
                  onHeadingClick={(h) => {
                    // Scroll the preview and deep-link the section — works whether
                    // locked/present or split.
                    lastNavSlug.current = h.slug;
                    navigateSection(h.slug);
                    // In edit mode, also move the editor caret to the heading.
                    if (!isPresentMode && textareaRef.current) {
                      const idx = content.indexOf(h.text);
                      if (idx >= 0) {
                        textareaRef.current.focus();
                        textareaRef.current.setSelectionRange(idx, idx);
                        textareaRef.current.scrollTop =
                          (idx / content.length) * textareaRef.current.scrollHeight;
                      }
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <Flex justify="center" align="center" height="100%">
              <Text style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {playthroughs.length === 0
                  ? 'No playthroughs yet. Add one from the game page.'
                  : 'Select a file or create a new one.'}
              </Text>
            </Flex>
          )}
        </div>
      </div>

      {game && (
        <GameDetailModal game={game} isOpen={gameModalOpen}
          onClose={() => setGameModalOpen(false)}
          onUpdated={() => api.games.get(id).then(setGame).catch(() => {})}
          onDeleted={() => setGameModalOpen(false)} />
      )}
      <MarkdownHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <ImageUploadModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleImageInsert}
        gameId={id}
      />
      {/* Standalone Recent/Bulletin drawer — only for the no-file empty state.
          When a file is open, NotesDrawer (which also has the CONTENTS/TOC tab)
          is rendered instead; showing both stacks them on the same edge and
          hides the TOC. */}
      {!activeFile && <RecentDrawer isOpen={recentOpen} onToggle={() => setRecentOpen(o => !o)} />}
    </>
  );
}
