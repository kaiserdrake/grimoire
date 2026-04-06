'use client';

import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, VStack, HStack, Text, Avatar,
  FormControl, FormLabel, Input, InputGroup, InputRightElement,
  IconButton, useToast, Divider, Badge,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/utils/api';

export default function SettingsModal({ isOpen, onClose }) {
  const { user, refreshUser } = useAuth();
  const { theme, setLight, setDark } = useTheme();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [isLoading, setIsLoading]             = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const newPasswordValid = newPassword.length >= 8;
  const canSubmit = currentPassword && newPassword && confirmPassword && passwordsMatch && newPasswordValid;

  const handleChangePassword = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      await api.users.updatePassword({ currentPassword, newPassword });
      toast({ title: 'Password updated', status: 'success', duration: 3000 });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
      >
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
          Settings
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={5}>
          <VStack spacing={5} align="stretch">

            {/* ── User Info ── */}
            <div className="settings-section">
              <p className="settings-label">Account</p>
              <HStack spacing={3}>
                <Avatar
                  size="md"
                  name={user?.name}
                  bg="var(--color-accent)"
                  color="white"
                />
                <VStack align="start" spacing={0.5} flex={1}>
                  <HStack>
                    <Text fontWeight="600" fontSize="sm" color="var(--color-text-primary)">
                      {user?.name}
                    </Text>
                    <Badge
                      fontSize="0.65rem"
                      style={{
                        background: user?.role === 'Admin' ? 'var(--color-accent-subtle)' : 'var(--color-bg-hover)',
                        color: user?.role === 'Admin' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      }}
                    >
                      {user?.role}
                    </Badge>
                  </HStack>
                  <Text fontSize="xs" color="var(--color-text-muted)">
                    {user?.email}
                  </Text>
                  <Text fontSize="xs" color="var(--color-text-muted)">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </Text>
                </VStack>
              </HStack>
            </div>

            {/* ── Theme ── */}
            <div className="settings-section">
              <p className="settings-label">Appearance</p>
              <div className="theme-toggle-row">
                <Text fontSize="sm" color="var(--color-text-secondary)">Color theme</Text>
                <div className="theme-options">
                  <button
                    className={`theme-option-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={setLight}
                  >
                    <FiSun size={13} />
                    Light
                  </button>
                  <button
                    className={`theme-option-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={setDark}
                  >
                    <FiMoon size={13} />
                    Dark
                  </button>
                </div>
              </div>
            </div>

            {/* ── Change Password ── */}
            <div className="settings-section">
              <p className="settings-label">Change Password</p>
              <VStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="xs" color="var(--color-text-secondary)" mb={1}>
                    Current password
                  </FormLabel>
                  <InputGroup size="sm">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      bg="var(--color-bg-page)"
                      borderColor="var(--color-border)"
                      _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                    />
                    <InputRightElement>
                      <IconButton size="xs" variant="ghost" aria-label="show"
                        icon={showCurrent ? <ViewOffIcon /> : <ViewIcon />}
                        onClick={() => setShowCurrent(!showCurrent)}
                      />
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
                        onClick={() => setShowNew(!showNew)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="xs" color="var(--color-text-secondary)" mb={1}>
                    Confirm new password
                  </FormLabel>
                  <Input
                    size="sm"
                    type="password"
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

                <Button
                  size="sm"
                  width="full"
                  bg="var(--color-accent)"
                  color="white"
                  _hover={{ bg: 'var(--color-accent-hover)' }}
                  onClick={handleChangePassword}
                  isLoading={isLoading}
                  isDisabled={!canSubmit}
                >
                  Update Password
                </Button>
              </VStack>
            </div>

          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <Button size="sm" variant="ghost" onClick={handleClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
