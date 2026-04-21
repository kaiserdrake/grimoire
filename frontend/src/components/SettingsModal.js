'use client';

import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, VStack, HStack, Text, Avatar,
  FormControl, FormLabel, Input, InputGroup, InputRightElement,
  IconButton, useToast, Badge, Box,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/utils/api';

import { DEFAULT_PLATFORMS } from '@/constants/platforms';

export default function SettingsModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { theme, setLight, setDark } = useTheme();
  const toast = useToast();


  // ── Password state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [pwLoading,       setPwLoading]       = useState(false);

  const passwordsMatch   = newPassword === confirmPassword;
  const newPasswordValid = newPassword.length >= 8;
  const canSubmit = currentPassword && newPassword && confirmPassword && passwordsMatch && newPasswordValid;

  // ── Platform list state ───────────────────────────────────────────────────
  const [platforms,    setPlatforms]    = useState(DEFAULT_PLATFORMS);
  const [newPlatform,  setNewPlatform]  = useState('');

  // ── IGDB state ────────────────────────────────────────────────────────────
  const [igdbClientId,     setIgdbClientId]     = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [igdbClientIdSet,  setIgdbClientIdSet]  = useState(false); // true = value exists on server
  const [igdbSecretSet,    setIgdbSecretSet]     = useState(false);
  const [igdbSaved,        setIgdbSaved]        = useState(false);
  const [igdbLoading,      setIgdbLoading]      = useState(false);
  const [showClientId,     setShowClientId]     = useState(false);
  const [showSecret,       setShowSecret]       = useState(false);

  // Load saved platforms on open
  useEffect(() => {
    if (!isOpen) return;
    api.settings.get('platforms').then((val) => {
      if (Array.isArray(val) && val.length > 0) setPlatforms(val);
    }).catch(() => {});
    api.igdb.getCredentials().then((creds) => {
      setIgdbClientIdSet(!!creds.igdb_client_id);
      setIgdbSecretSet(!!creds.igdb_client_secret);
      setIgdbClientId('');
      setIgdbClientSecret('');
    }).catch(() => {});
  }, [isOpen]);

  const handleAddPlatform = async () => {
    const trimmed = newPlatform.trim();
    if (!trimmed) return;
    if (platforms.includes(trimmed)) {
      toast({ title: 'Platform already exists', status: 'warning', duration: 2000 });
      return;
    }
    const updated = [...platforms, trimmed];
    setPlatforms(updated);
    setNewPlatform('');
    try {
      await api.settings.set('platforms', updated);
    } catch (err) {
      toast({ title: 'Error saving platforms', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleRemovePlatform = async (name) => {
    const updated = platforms.filter((p) => p !== name);
    setPlatforms(updated);
    try {
      await api.settings.set('platforms', updated);
    } catch (err) {
      toast({ title: 'Error saving platforms', description: err.message, status: 'error', duration: 3000 });
    }
  };

  const handleResetPlatforms = async () => {
    setPlatforms(DEFAULT_PLATFORMS);
    try {
      await api.settings.set('platforms', DEFAULT_PLATFORMS);
    } catch (err) {
      toast({ title: 'Error saving platforms', description: err.message, status: 'error', duration: 3000 });
    }
  };

  // ── Password submit ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!canSubmit) return;
    setPwLoading(true);
    try {
      await api.users.changePassword(user.id, { currentPassword, newPassword });
      toast({ title: 'Password updated', status: 'success', duration: 3000 });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSaveIgdbCredentials = async () => {
    setIgdbLoading(true);
    try {
      const payload = {};
      if (igdbClientId.trim())     payload.igdb_client_id     = igdbClientId.trim();
      if (igdbClientSecret.trim()) payload.igdb_client_secret = igdbClientSecret.trim();
      await api.igdb.setCredentials(payload);
      setIgdbClientIdSet(igdbClientId.trim()     ? true : igdbClientIdSet);
      setIgdbSecretSet(igdbClientSecret.trim()   ? true : igdbSecretSet);
      setIgdbClientId('');
      setIgdbClientSecret('');
      setIgdbSaved(true);
      setTimeout(() => setIgdbSaved(false), 2500);
      toast({ title: 'IGDB credentials saved', status: 'success', duration: 2500 });
    } catch (err) {
      toast({ title: 'Error saving credentials', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setIgdbLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setIgdbClientId('');
    setIgdbClientSecret('');
    setIgdbClientIdSet(false);
    setIgdbSecretSet(false);
    setIgdbSaved(false);
    setShowClientId(false);
    setShowSecret(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
        maxH="90vh"
      >
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
          Settings
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={5} overflowY="auto">
          <VStack spacing={5} align="stretch">

            {/* ── Account ── */}
            <div className="settings-section">
              <p className="settings-label">Account</p>
              <HStack spacing={3}>
                <Avatar size="md" name={user?.name} bg="var(--color-accent)" color="white" />
                <VStack align="start" spacing={0.5} flex={1}>
                  <HStack>
                    <Text fontWeight="600" fontSize="sm" color="var(--color-text-primary)">{user?.name}</Text>

                    <Badge fontSize="0.65rem" style={{
                      background: user?.role === 'Admin' ? 'var(--color-accent-subtle)' : 'var(--color-bg-hover)',
                      color: user?.role === 'Admin' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>
                      {user?.role}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="var(--color-text-muted)">{user?.email}</Text>
                  <Text fontSize="xs" color="var(--color-text-muted)">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </Text>
                </VStack>
              </HStack>
            </div>

            {/* ── Appearance ── */}
            <div className="settings-section">
              <p className="settings-label">Appearance</p>
              <div className="theme-toggle-row">
                <Text fontSize="sm" color="var(--color-text-secondary)">Color theme</Text>
                <div className="theme-options">
                  <button className={`theme-option-btn ${theme === 'light' ? 'active' : ''}`} onClick={setLight}>
                    <FiSun size={13} /> Light
                  </button>
                  <button className={`theme-option-btn ${theme === 'dark' ? 'active' : ''}`} onClick={setDark}>
                    <FiMoon size={13} /> Dark
                  </button>
                </div>
              </div>
            </div>

            {/* ── IGDB Integration ── */}
            <div className="settings-section">
              <p className="settings-label">IGDB Integration</p>
              {(!igdbClientIdSet || !igdbSecretSet) && (
                <Box mb={3} px={3} py={2} borderRadius="md"
                  bg="rgba(234,179,8,0.1)" borderWidth="1px" borderColor="#ca8a04"
                >
                  <Text fontSize="xs" color="#ca8a04" fontWeight="500">
                    ⚠ IGDB credentials not set — game search will not work until both are provided.
                  </Text>
                </Box>
              )}
              <Text fontSize="xs" color="var(--color-text-muted)" mb={3}>
                Required for searching games when adding to your library.{' '}
                <a href="https://dev.twitch.tv/console" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                  Get your credentials from the Twitch Developer Console.
                </a>
              </Text>
              <VStack spacing={2} align="stretch">
                <InputGroup size="sm">
                  <Input
                    type={showClientId ? 'text' : 'password'}
                    placeholder={igdbClientIdSet ? '••••••••••••••••' : 'Client ID'}
                    value={igdbClientId}
                    onChange={(e) => setIgdbClientId(e.target.value)}
                    bg="var(--color-bg-page)" borderColor="var(--color-border)"
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    fontFamily="mono"
                  />
                  {igdbClientId && (
                  <InputRightElement>
                    <IconButton size="xs" variant="ghost" aria-label="toggle client id visibility"
                      icon={showClientId ? <ViewOffIcon /> : <ViewIcon />}
                      onClick={() => setShowClientId(!showClientId)} />
                  </InputRightElement>
                  )}
                </InputGroup>
                <InputGroup size="sm">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={igdbSecretSet ? '••••••••••••••••' : 'Client Secret'}
                    value={igdbClientSecret}
                    onChange={(e) => setIgdbClientSecret(e.target.value)}
                    bg="var(--color-bg-page)" borderColor="var(--color-border)"
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    fontFamily="mono"
                  />
                  {igdbClientSecret && (
                  <InputRightElement>
                    <IconButton size="xs" variant="ghost" aria-label="toggle secret visibility"
                      icon={showSecret ? <ViewOffIcon /> : <ViewIcon />}
                      onClick={() => setShowSecret(!showSecret)} />
                  </InputRightElement>
                  )}
                </InputGroup>
                <Button size="sm" isLoading={igdbLoading}
                  onClick={handleSaveIgdbCredentials}
                  bg="var(--color-accent)" color="white"
                  _hover={{ opacity: 0.85 }} alignSelf="flex-start"
                >
                  {igdbSaved ? '✓ Saved' : 'Save Credentials'}
                </Button>
              </VStack>
            </div>

            {/* ── Platform List ── */}
            <div className="settings-section">
              <p className="settings-label">Platform List</p>
              <Text fontSize="xs" color="var(--color-text-muted)" mb={3}>
                Platforms shown when adding a playthrough.
              </Text>

              {/* Existing platforms */}
              <VStack spacing={0.5} align="stretch" mb={3}>
                {platforms.map((p) => (
                  <HStack key={p} justify="space-between"
                    px={2} py={0.5} borderRadius="md"
                    bg="var(--color-bg-page)" borderWidth="1px" borderColor="var(--color-border-subtle)"
                  >
                    <Text fontSize="xs" color="var(--color-text-primary)">{p}</Text>
                    <IconButton
                      size="xs" variant="ghost" aria-label={`Remove ${p}`} icon={<DeleteIcon />}
                      color="var(--color-text-muted)" _hover={{ color: 'var(--color-danger)' }}
                      onClick={() => handleRemovePlatform(p)}
                    />
                  </HStack>
                ))}
              </VStack>

              {/* Add new platform */}
              <HStack mb={3}>
                <Input
                  size="sm" placeholder="Add platform…"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlatform(); }}
                  bg="var(--color-bg-page)" borderColor="var(--color-border)"
                  _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                />
                <IconButton
                  size="sm" aria-label="Add platform" icon={<AddIcon />}
                  bg="var(--color-accent)" color="white" _hover={{ opacity: 0.85 }}
                  onClick={handleAddPlatform}
                />
              </HStack>

              {/* Save / Reset */}
              <HStack justify="flex-start">
                <Button size="xs" variant="ghost" color="var(--color-text-muted)"
                  bg="transparent" border="none" boxShadow="none"
                  _hover={{ bg: 'transparent', opacity: 0.75 }}
                  onClick={handleResetPlatforms}>
                  Reset to defaults
                </Button>
              </HStack>
            </div>

            {/* ── Change Password ── */}
            <div className="settings-section">
              <p className="settings-label">Change Password</p>
              <VStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="xs" color="var(--color-text-secondary)" mb={1}>Current password</FormLabel>
                  <InputGroup size="sm">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      bg="var(--color-bg-page)" borderColor="var(--color-border)"
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                    <InputRightElement>
                      <IconButton size="xs" variant="ghost" aria-label="show"
                        icon={showCurrent ? <ViewOffIcon /> : <ViewIcon />}
                        onClick={() => setShowCurrent(!showCurrent)} />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="xs" color="var(--color-text-secondary)" mb={1}>
                    New password <Text as="span" color="var(--color-text-muted)">(min. 8 characters)</Text>
                  </FormLabel>
                  <InputGroup size="sm">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      bg="var(--color-bg-page)"
                      borderColor={newPassword && !newPasswordValid ? 'var(--color-danger)' : 'var(--color-border)'}
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                    <InputRightElement>
                      <IconButton size="xs" variant="ghost" aria-label="show"
                        icon={showNew ? <ViewOffIcon /> : <ViewIcon />}
                        onClick={() => setShowNew(!showNew)} />

                    </InputRightElement>

                  </InputGroup>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="xs" color="var(--color-text-secondary)" mb={1}>Confirm new password</FormLabel>

                  <Input
                    size="sm" type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    bg="var(--color-bg-page)"
                    borderColor={confirmPassword && !passwordsMatch ? 'var(--color-danger)' : 'var(--color-border)'}
                    _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                  />
                  {confirmPassword && !passwordsMatch && (
                    <Text fontSize="xs" color="var(--color-danger)" mt={1}>Passwords do not match</Text>
                  )}
                </FormControl>

                <Button size="sm" width="full" bg="var(--color-accent)" color="white"
                  _hover={{ bg: 'var(--color-accent-hover)' }}
                  onClick={handleChangePassword} isLoading={pwLoading} isDisabled={!canSubmit}>

                  Update Password
                </Button>
              </VStack>
            </div>

          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <Button size="sm" variant="ghost" bg="transparent" border="none" boxShadow="none"
            _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={handleClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
