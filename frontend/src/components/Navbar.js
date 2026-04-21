'use client';

import { useState } from 'react';
import {
  Box, Flex, HStack, Text, IconButton, Menu, MenuButton,
  MenuList, MenuItem, useDisclosure, Avatar, Tooltip,
} from '@chakra-ui/react';
import { FiBookOpen, FiSettings, FiLogOut, FiUsers, FiList, FiCalendar, FiCoffee } from 'react-icons/fi';

import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import LoginModal from './LoginModal';
import SettingsModal from './SettingsModal';
import UserManagementModal from './UserManagementModal';
import GamepadSprites from './GamepadSprites';

// Lightweight inline MD5 for Gravatar email hashing
const md5 = (str) => {
  let [a, b, c, d] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const rotate = (v, n) => (v << n) | (v >>> (32 - n));
  const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const bytes = [...str].map((ch) => ch.charCodeAt(0));
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = str.length * 8;
  for (let i = 0; i < 8; i++) bytes.push((bitLen / 2 ** (i * 8)) & 0xff);
  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const M = Array.from({ length: 16 }, (_, i) =>
      bytes[chunk + i * 4] | (bytes[chunk + i * 4 + 1] << 8) |
      (bytes[chunk + i * 4 + 2] << 16) | (bytes[chunk + i * 4 + 3] << 24)
    );
    let [A, B, C, D] = [a, b, c, d];
    const rounds = [[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
    const fns = [
      (b,c,d) => (b & c) | (~b & d),
      (b,c,d) => (d & b) | (~d & c),
      (b,c,d) =>  b ^ c ^ d,
      (b,c,d) =>  c ^ (b | ~d),
    ];
    const gIdx = [(i) => i, (i) => (5*i+1)%16, (i) => (3*i+5)%16, (i) => (7*i)%16];
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 16);
      const F = fns[r](B, C, D);
      const g = gIdx[r](i);
      const tmp = D; D = C; C = B;
      B = (B + rotate((A + F + M[g] + T[i]) >>> 0, rounds[r][i % 4])) >>> 0;
      A = tmp;
    }
    a = (a + A) >>> 0; b = (b + B) >>> 0;
    c = (c + C) >>> 0; d = (d + D) >>> 0;
  }
  return [a, b, c, d]
    .map((v) => v.toString(16).padStart(8, '0').match(/../g).reverse().join(''))
    .join('');
};

const gravatarUrl = (email, size = 80) => {
  if (!email) return undefined;
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const { isOpen: isLoginOpen,    onOpen: onLoginOpen,    onClose: onLoginClose    } = useDisclosure();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const { isOpen: isUsersOpen,    onOpen: onUsersOpen,    onClose: onUsersClose    } = useDisclosure();

  const activeTab = pathname === '/calendar' ? 'calendar' : 'journal';

  const NAV_TABS = [
    { key: 'journal',  label: 'List',     icon: FiList,     href: '/',         enabled: true, tooltip: null },
    { key: 'calendar', label: 'Timeline', icon: FiCalendar, href: '/calendar', enabled: true, tooltip: null },
  ];

  const handleTabClick = (tab) => {
    if (!tab.enabled || !tab.href) return;
    router.push(tab.href);
  };

  return (
    <>
      <Box className="grimoire-navbar" px={6} py={0}>
        <Flex align="center" justify="space-between" maxW="1280px" mx="auto" h="56px">

          {/* Logo */}
          <HStack spacing={2} as="a" href="/" style={{ textDecoration: 'none' }}>
            <img src="/grimoire.png" alt="Grimoire" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            <Text
              fontSize="xl"
              fontWeight="800"
              letterSpacing="-0.02em"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Grimoire
            </Text>
          </HStack>

          {/* Center tabs */}
          {user && (
            <HStack spacing={1} position="absolute" left="50%" transform="translateX(-50%)" display={{ base: 'none', md: 'flex' }}>
              {NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <span key={tab.key}>
                    <button
                      onClick={() => handleTabClick(tab)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.35rem 0.85rem', borderRadius: '6px', border: 'none',
                        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        fontWeight: isActive ? 600 : 500, fontSize: '0.875rem',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--color-bg-hover)';
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }
                      }}
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  </span>
                );
              })}
            </HStack>
          )}

          {/* Right side */}
          <HStack spacing={2}>
            {user ? (
              <Menu placement="bottom-end" gutter={6}>
                <MenuButton
                  as={IconButton}
                  icon={<Avatar size="xs" name={user.name} src={gravatarUrl(user.email, 40)} bg="var(--color-accent)" color="white" />}
                  size="sm" variant="ghost" aria-label="Menu" borderRadius="full"
                  _hover={{ bg: 'var(--color-bg-hover)' }} _active={{ bg: 'var(--color-bg-hover)' }}
                />
                <MenuList
                  minW="200px" p="6px" border="none"
                  borderRadius="var(--radius-md)" bg="var(--color-bg-surface)"
                  boxShadow="var(--shadow-md)" overflow="hidden"
                >
                  <Box px={2} py={1.5} mb={1}>
                    <HStack spacing={2.5} align="center">
                      <Avatar size="sm" name={user.name} src={gravatarUrl(user.email, 80)} bg="var(--color-accent)" color="white" />
                      <Box lineHeight="tight">
                        <Text fontSize="0.8rem" fontWeight={600} color="var(--color-text-primary)">{user.name}</Text>
                        <Text fontSize="0.7rem" color="var(--color-text-muted)">{user.role}</Text>
                      </Box>
                    </HStack>
                  </Box>
                  {/* Mobile nav — only shown when center tabs are hidden */}
                  <Box display={{ base: 'block', md: 'none' }}>
                    {NAV_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;
                      return (
                        <MenuItem
                          key={tab.key}
                          icon={<Icon size={13} />}
                          onClick={() => handleTabClick(tab)}
                          borderRadius="6px"
                          fontSize="0.82rem"
                          fontWeight={isActive ? 600 : 500}
                          color={isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
                          bg={isActive ? 'var(--color-accent-subtle)' : 'transparent'}
                          _hover={{ bg: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                          px={2} py={1.5}
                        >
                          {tab.label}
                        </MenuItem>
                      );
                    })}
                    <Box mx={2} mb={1} borderTop="1px solid var(--color-border-subtle)" />
                  </Box>
                  <MenuItem icon={<FiSettings size={14} />} onClick={onSettingsOpen}
                    fontSize="0.85rem" borderRadius="6px"
                    _hover={{ bg: 'var(--color-bg-hover)' }} color="var(--color-text-secondary)">
                    Settings
                  </MenuItem>
                  {user.role === 'Admin' && (
                    <MenuItem icon={<FiUsers size={14} />} onClick={onUsersOpen}
                      fontSize="0.85rem" borderRadius="6px"
                      _hover={{ bg: 'var(--color-bg-hover)' }} color="var(--color-text-secondary)">
                      Manage users
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<FiCoffee size={13} />}
                    onClick={() => window.open('https://www.paypal.com/ncp/payment/WGP5P2UEDDSBE', '_blank', 'noopener,noreferrer')}
                    fontSize="0.85rem" borderRadius="6px"
                    color="var(--color-text-secondary)"
                    _hover={{ bg: 'var(--color-bg-hover)', color: 'var(--color-text-primary)' }}
                    _focus={{ bg: 'var(--color-bg-hover)' }}
                  >
                    Buy me a coffee
                  </MenuItem>

                  {/* Thin separator before sign out */}
                  <Box mx={2} my={1} borderTop="1px solid var(--color-border-subtle)" />

                  <MenuItem icon={<FiLogOut size={14} />} onClick={logout}
                    fontSize="0.85rem" borderRadius="6px"
                    _hover={{ bg: 'var(--color-bg-hover)' }} color="var(--color-text-secondary)">
                    Sign out
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <button onClick={onLoginOpen} style={{
                padding: '0.35rem 0.85rem', borderRadius: '6px',
                border: '1px solid var(--color-border)', background: 'transparent',
                color: 'var(--color-text-secondary)', fontSize: '0.875rem',
                fontWeight: 500, cursor: 'pointer',
              }}>
                Sign in
              </button>
            )}
          </HStack>

        </Flex>
      </Box>

      <LoginModal    isOpen={isLoginOpen}    onClose={onLoginClose} />
      <SettingsModal isOpen={isSettingsOpen} onClose={onSettingsClose} />
      {user?.role === 'Admin' && (
        <UserManagementModal isOpen={isUsersOpen} onClose={onUsersClose} />
      )}
      <GamepadSprites />
    </>
  );
}
