'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, VStack, HStack, Text, Table,
  Thead, Tbody, Tr, Th, Td, IconButton, useToast, Badge, Input,
  FormControl, FormLabel, Select, Code, Box,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { FiKey } from 'react-icons/fi';
import { api } from '@/utils/api';

export default function UserManagementModal({ isOpen, onClose }) {
  const toast = useToast();
  const [users, setUsers]             = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [generatedPw, setGeneratedPw] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToReset, setUserToReset]   = useState(null);
  const [newPw, setNewPw]               = useState('');
  const cancelRef = useRef();

  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Normal User' });

  const fetchUsers = async () => {
    try {
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      toast({ title: 'Error loading users', status: 'error', duration: 3000 });
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newUser.name || !newUser.email) {
      toast({ title: 'Name and email are required', status: 'warning', duration: 3000 });
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.users.create(newUser);
      setGeneratedPw(data.generatedPassword);
      setNewUser({ name: '', email: '', role: 'Normal User' });
      setShowCreate(false);
      await fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsLoading(true);
    try {
      await api.users.delete(userToDelete.id);
      toast({ title: `${userToDelete.name} deleted`, status: 'success', duration: 2000 });
      setUserToDelete(null);
      await fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToReset || !newPw) return;
    setIsLoading(true);
    try {
      await api.users.changePassword(userToReset.id, { newPassword: newPw });
      toast({ title: 'Password reset', status: 'success', duration: 2000 });
      setUserToReset(null);
      setNewPw('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent
          bg="var(--color-bg-surface)"
          borderColor="var(--color-border)"
          borderWidth="1px"
          color="var(--color-text-primary)"
          maxH="80vh"
        >
          <ModalHeader borderBottomWidth="1px" borderColor="var(--color-border-subtle)">
            <HStack justify="space-between" pr={8}>
              <Text>User Management</Text>
              <Button size="sm" leftIcon={<AddIcon />}
                bg="var(--color-accent)" color="white"
                _hover={{ bg: 'var(--color-accent-hover)' }}
                onClick={() => setShowCreate(!showCreate)}
              >
                New User
              </Button>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" py={4}>
            <VStack spacing={4} align="stretch">
              {showCreate && (
                <Box p={4} bg="var(--color-bg-subtle)" borderRadius="md" borderWidth="1px" borderColor="var(--color-border-subtle)">
                  <VStack spacing={3}>
                    <FormControl>
                      <FormLabel fontSize="xs" color="var(--color-text-secondary)">Username</FormLabel>
                      <Input size="sm" value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        bg="var(--color-bg-page)" borderColor="var(--color-border)"
                        _focus={{ borderColor: 'var(--color-accent)' }}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" color="var(--color-text-secondary)">Email</FormLabel>
                      <Input size="sm" type="email" value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        bg="var(--color-bg-page)" borderColor="var(--color-border)"
                        _focus={{ borderColor: 'var(--color-accent)' }}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs" color="var(--color-text-secondary)">Role</FormLabel>
                      <Select size="sm" value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        bg="var(--color-bg-page)" borderColor="var(--color-border)"
                      >
                        <option value="Normal User">Normal User</option>
                        <option value="Admin">Admin</option>
                      </Select>
                    </FormControl>
                    <HStack>
                      <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                      <Button size="sm" bg="var(--color-accent)" color="white"
                        _hover={{ bg: 'var(--color-accent-hover)' }}
                        onClick={handleCreate} isLoading={isLoading}
                      >
                        Create
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              )}

              {generatedPw && (
                <Box p={3} borderRadius="md" borderWidth="1px"
                  style={{
                    background: 'var(--color-accent-subtle)',
                    borderColor: 'var(--color-accent)',
                  }}
                >
                  <Text fontSize="sm" mb={1} style={{ color: 'var(--color-accent)' }}>User created! Generated password:</Text>
                  <Code px={3} py={1}
                    style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                  >{generatedPw}</Code>
                  <Button size="xs" variant="ghost" ml={2} onClick={() => setGeneratedPw('')}>Dismiss</Button>
                </Box>
              )}

              {userToReset && (
                <Box p={4} bg="var(--color-bg-subtle)" borderRadius="md" borderWidth="1px" borderColor="var(--color-border-subtle)">
                  <Text fontSize="sm" mb={2} color="var(--color-text-secondary)">
                    Reset password for <strong>{userToReset.name}</strong>
                  </Text>
                  <HStack>
                    <Input size="sm" type="password" placeholder="New password" value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      bg="var(--color-bg-page)" borderColor="var(--color-border)"
                    />
                    <Button size="sm" bg="var(--color-accent)" color="white"
                      _hover={{ bg: 'var(--color-accent-hover)' }}
                      onClick={handleResetPassword} isLoading={isLoading} isDisabled={!newPw}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setUserToReset(null); setNewPw(''); }}>
                      Cancel
                    </Button>
                  </HStack>
                </Box>
              )}

              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th color="var(--color-text-muted)">Name</Th>
                    <Th color="var(--color-text-muted)">Email</Th>
                    <Th color="var(--color-text-muted)">Role</Th>
                    <Th color="var(--color-text-muted)"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {users.map((u) => (
                    <Tr key={u.id} _hover={{ bg: 'var(--color-bg-subtle)' }}>
                      <Td color="var(--color-text-primary)" fontWeight="500">{u.name}</Td>
                      <Td color="var(--color-text-secondary)" fontSize="sm">{u.email}</Td>
                      <Td>
                        <Badge fontSize="0.65rem"
                          style={{
                            background: u.role === 'Admin' ? 'var(--color-accent-subtle)' : 'var(--color-bg-hover)',
                            color: u.role === 'Admin' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          }}
                        >
                          {u.role}
                        </Badge>
                      </Td>
                      <Td>
                        {u.id !== 1 && (
                          <HStack spacing={1}>
                            <IconButton size="xs" variant="ghost" icon={<FiKey />} aria-label="Reset password"
                              onClick={() => setUserToReset(u)}
                            />
                            <IconButton size="xs" variant="ghost" icon={<DeleteIcon />}
                              aria-label="Delete user" onClick={() => setUserToDelete(u)}
                              style={{ color: 'var(--color-danger)' }}
                            />
                          </HStack>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </VStack>
          </ModalBody>
          <ModalFooter borderTopWidth="1px" borderColor="var(--color-border-subtle)">
            <Button size="sm" variant="ghost" bg="transparent" border="none" boxShadow="none"
              _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!userToDelete} leastDestructiveRef={cancelRef} onClose={() => setUserToDelete(null)} isCentered>
        <AlertDialogOverlay backdropFilter="blur(4px)">
          <AlertDialogContent bg="var(--color-bg-surface)" borderColor="var(--color-border)" borderWidth="1px" color="var(--color-text-primary)">
            <AlertDialogHeader>Delete {userToDelete?.name}?</AlertDialogHeader>
            <AlertDialogBody color="var(--color-text-secondary)">
              This will permanently delete the user and all their data. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter gap={2}>
              <Button ref={cancelRef} size="sm" variant="ghost" bg="transparent" border="none" boxShadow="none"
                _hover={{ bg: 'transparent', opacity: 0.75 }} onClick={() => setUserToDelete(null)}>Cancel</Button>
              <Button size="sm" onClick={handleDelete} isLoading={isLoading}
                style={{ background: 'var(--color-danger)', color: 'white' }}
              >Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
