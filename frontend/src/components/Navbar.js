'use client';

import {
  Box, Flex, HStack, Text, Button, IconButton, Menu, MenuButton,
  MenuList, MenuItem, MenuDivider, useDisclosure, Avatar,
} from '@chakra-ui/react';
import { HamburgerIcon } from '@chakra-ui/icons';
import { FiBookOpen, FiSettings, FiLogOut, FiUsers, FiMoon, FiSun } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import LoginModal from './LoginModal';
import SettingsModal from './SettingsModal';
import UserManagementModal from './UserManagementModal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { isOpen: isLoginOpen,    onOpen: onLoginOpen,    onClose: onLoginClose    } = useDisclosure();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const { isOpen: isUsersOpen,    onOpen: onUsersOpen,    onClose: onUsersClose    } = useDisclosure();

  return (
    <>
      <Box className="grimoire-navbar" px={6} py={3}>
        <Flex align="center" justify="space-between" maxW="1280px" mx="auto">
          {/* Logo */}
          <HStack spacing={2} as="a" href="/" style={{ textDecoration: 'none' }}>
            <FiBookOpen size={22} color="var(--color-accent)" />
            <Text
              fontSize="xl"
              fontWeight="800"
              letterSpacing="-0.02em"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Grimoire
            </Text>
          </HStack>

          {/* Right side */}
          <HStack spacing={2}>
            {/* Theme toggle */}
            <IconButton
              aria-label="Toggle theme"
              icon={theme === 'dark' ? <FiSun /> : <FiMoon />}
              size="sm"
              variant="ghost"
              onClick={toggleTheme}
              style={{ color: 'var(--color-text-secondary)' }}
            />

            {user ? (
              <Menu>
                <MenuButton as={Button} variant="ghost" size="sm" rightIcon={<HamburgerIcon />}>
                  <HStack spacing={2}>
                    <Avatar size="xs" name={user.name} bg="var(--color-accent)" color="white" />
                    <Text fontSize="sm" fontWeight={600} display={{ base: 'none', md: 'block' }}
                      style={{ color: 'var(--color-text-primary)' }}>
                      {user.name}
                    </Text>
                  </HStack>
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FiSettings />} onClick={onSettingsOpen}>Settings</MenuItem>
                  {user.role === 'Admin' && (
                    <MenuItem icon={<FiUsers />} onClick={onUsersOpen}>Manage Users</MenuItem>
                  )}
                  <MenuDivider />
                  <MenuItem icon={<FiLogOut />} onClick={logout} style={{ color: 'var(--color-danger)' }}>Sign Out</MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <Button size="sm" onClick={onLoginOpen}
                style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}>
                Sign In
              </Button>
            )}
          </HStack>
        </Flex>
      </Box>

      <LoginModal isOpen={isLoginOpen} onClose={onLoginClose} />
      <SettingsModal isOpen={isSettingsOpen} onClose={onSettingsClose} />
      {user?.role === 'Admin' && (
        <UserManagementModal isOpen={isUsersOpen} onClose={onUsersClose} />
      )}
    </>
  );
}
