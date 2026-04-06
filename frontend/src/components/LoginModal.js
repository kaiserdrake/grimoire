'use client';

import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, FormControl, FormLabel, Input, Button,
  VStack, Text, useToast, InputGroup, InputRightElement, IconButton,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { useAuth } from '@/context/AuthContext';

export default function LoginModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const toast = useToast();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!usernameOrEmail || !password) {
      toast({ title: 'Please fill in all fields', status: 'warning', duration: 3000 });
      return;
    }
    setIsLoading(true);
    const result = await login(usernameOrEmail, password);
    setIsLoading(false);
    if (result.success) {
      toast({ title: 'Welcome back!', status: 'success', duration: 2000 });
      setUsernameOrEmail('');
      setPassword('');
      onClose();
    } else {
      toast({ title: 'Login failed', description: result.message, status: 'error', duration: 4000 });
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        bg="var(--color-bg-surface)"
        borderColor="var(--color-border)"
        borderWidth="1px"
        color="var(--color-text-primary)"
      >
        <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
          Sign in to Grimoire
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm" color="var(--color-text-secondary)">Username or Email</FormLabel>
              <Input
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter username or email"
                bg="var(--color-bg-subtle)"
                borderColor="var(--color-border)"
                _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" color="var(--color-text-secondary)">Password</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter password"
                  bg="var(--color-bg-subtle)"
                  borderColor="var(--color-border)"
                  _focus={{ borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' }}
                />
                <InputRightElement>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={2} borderTopWidth="1px" borderColor="var(--color-border-subtle)">
          <Button variant="ghost" onClick={onClose} size="sm">Cancel</Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            size="sm"
            bg="var(--color-accent)"
            color="white"
            _hover={{ bg: 'var(--color-accent-hover)' }}
          >
            Sign In
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
