const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {}
    throw new APIError(message, res.status);
  }

  return res.json();
};

export const api = {
  // Auth
  login: (credentials) => apiFetch('/api/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => apiFetch('/api/logout', { method: 'POST' }),

  // User
  users: {
    me: () => apiFetch('/api/users/me'),
    list: () => apiFetch('/api/users'),
    create: (data) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
    changePassword: (id, data) => apiFetch(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify(data) }),
    updatePassword: (data) => apiFetch('/api/users/change-password', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // IGDB
  igdb: {
    search: (q) => apiFetch(`/api/igdb/search?q=${encodeURIComponent(q)}`),
  },

  // Games
  games: {
    list: (status) => apiFetch(`/api/games${status ? `?status=${status}` : ''}`),
    get: (id) => apiFetch(`/api/games/${id}`),
    create: (data) => apiFetch('/api/games', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id, status) => apiFetch(`/api/games/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    updateRating: (id, rating) => apiFetch(`/api/games/${id}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),
    delete: (id) => apiFetch(`/api/games/${id}`, { method: 'DELETE' }),
  },

  // Notes
  notes: {
    get: (gameId) => apiFetch(`/api/games/${gameId}/notes`),
    save: (gameId, content) => apiFetch(`/api/games/${gameId}/notes`, { method: 'PUT', body: JSON.stringify({ content }) }),
  },

  // Maps
  maps: {
    list: (gameId) => apiFetch(`/api/games/${gameId}/maps`),
    get: (mapId) => apiFetch(`/api/maps/${mapId}`),
    create: (gameId, data) => apiFetch(`/api/games/${gameId}/maps`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (mapId) => apiFetch(`/api/maps/${mapId}`, { method: 'DELETE' }),
  },

  // Pins
  pins: {
    list: (mapId) => apiFetch(`/api/maps/${mapId}/pins`),
    create: (mapId, data) => apiFetch(`/api/maps/${mapId}/pins`, { method: 'POST', body: JSON.stringify(data) }),
    update: (mapId, pinId, data) => apiFetch(`/api/maps/${mapId}/pins/${pinId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (mapId, pinId) => apiFetch(`/api/maps/${mapId}/pins/${pinId}`, { method: 'DELETE' }),
  },
};

export { APIError };
