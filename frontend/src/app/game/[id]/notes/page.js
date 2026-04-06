'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Flex, HStack, Text, Button, Spinner, useToast, IconButton, Box,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { FiSave, FiEye, FiEdit3 } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/utils/api';

export default function NotesPage({ params }) {
  const { id } = params;
  const router  = useRouter();
  const toast   = useToast();
  const { user } = useAuth();

  const [game, setGame]         = useState(null);
  const [content, setContent]   = useState('');
  const [saved, setSaved]       = useState('');   // last saved version for dirty check
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const saveTimer = useRef(null);

  const isDirty = content !== saved;

  // ── Load game + notes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [g, n] = await Promise.all([
          api.games.get(id),
          api.notes.get(id),
        ]);
        setGame(g);
        setContent(n.content || '');
        setSaved(n.content || '');
      } catch (err) {
        toast({ title: 'Failed to load', description: err.message, status: 'error', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  // ── Auto-save after 2s of inactivity ────────────────────────────────────
  const save = useCallback(async (text) => {
    setSaving(true);
    try {
      await api.notes.save(id, text);
      setSaved(text);
    } catch (err) {
      toast({ title: 'Auto-save failed', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setSaving(false);
    }
  }, [id]);

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(val), 2000);
  };

  const handleManualSave = () => {
    clearTimeout(saveTimer.current);
    save(content);
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <Text style={{ color: 'var(--color-text-muted)' }}>Please sign in to view notes.</Text>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-container">

        {/* ── Header ── */}
        <Flex align="center" justify="space-between" mb={4}>
          <HStack spacing={3}>
            <IconButton
              icon={<ArrowBackIcon />}
              size="sm"
              variant="ghost"
              aria-label="Back"
              onClick={() => router.push('/')}
              style={{ color: 'var(--color-text-secondary)' }}
            />
            <Box>
              <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
                {game?.title ?? '…'}
              </Text>
              <Text fontSize="lg" fontWeight={700} style={{ color: 'var(--color-text-primary)' }}>
                Notes
              </Text>
            </Box>
          </HStack>

          <HStack spacing={2}>
            {saving && (
              <HStack spacing={1}>
                <Spinner size="xs" style={{ color: 'var(--color-accent)' }} />
                <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>Saving…</Text>
              </HStack>
            )}
            {!saving && !isDirty && saved && (
              <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>Saved</Text>
            )}
            <Button
              size="sm"
              leftIcon={<FiSave />}
              onClick={handleManualSave}
              isLoading={saving}
              isDisabled={!isDirty}
              style={{
                background: isDirty ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                color: isDirty ? 'white' : 'var(--color-text-muted)',
                border: 'none',
              }}
            >
              Save
            </Button>
          </HStack>
        </Flex>

        {/* ── Editor ── */}
        {loading ? (
          <Flex justify="center" py={16}>
            <Spinner style={{ color: 'var(--color-accent)' }} />
          </Flex>
        ) : (
          <div className="notes-layout">
            {/* Left — Editor */}
            <div className="notes-editor-pane">
              <div className="notes-editor-pane-header">
                <HStack spacing={1}>
                  <FiEdit3 size={11} />
                  <span>Markdown</span>
                </HStack>
              </div>
              <textarea
                className="notes-textarea"
                value={content}
                onChange={handleChange}
                placeholder={`# ${game?.title ?? 'Game'} Notes\n\nStart writing your notes here…\n\nMarkdown is supported:\n- **bold**, *italic*\n- ## Headings\n- > Blockquotes\n- \`code\`\n- | Tables |`}
                spellCheck
              />
            </div>

            {/* Right — Live Preview */}
            <div className="notes-preview-pane">
              <div className="notes-editor-pane-header">
                <HStack spacing={1}>
                  <FiEye size={11} />
                  <span>Preview</span>
                </HStack>
              </div>
              <div className="notes-preview-content">
                {content.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                ) : (
                  <Text style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    Preview will appear here as you type…
                  </Text>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
