let API_BASE = null;

async function getApiBase() {
  if (API_BASE) return API_BASE;
  const res = await fetch('/api/config');
  const data = await res.json();
  API_BASE = data.apiUrl;
  return API_BASE;
}

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const apiFetch = async (path, options = {}) => {
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new APIError(body.message || 'Request failed', res.status);
  }
  return res.json();
};

export const api = {
  // Auth
  auth: {
    login: (data) => apiFetch('/api/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => apiFetch('/api/logout', { method: 'POST' }),
    me: () => apiFetch('/api/me'),
  },

  // IGDB
  igdb: {
    search: (q) => apiFetch(`/api/igdb/search?q=${encodeURIComponent(q)}`),
    getCredentials: ()     => apiFetch('/api/igdb/credentials'),
    setCredentials: (data) => apiFetch('/api/igdb/credentials', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Games
  games: {
    list: (tag) => apiFetch(`/api/games${tag ? `?tag=${tag}` : ''}`),
    get: (id) => apiFetch(`/api/games/${id}`),
    create: (data) => apiFetch('/api/games', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateTag: (id, tag) => apiFetch(`/api/games/${id}/tag`, { method: 'PATCH', body: JSON.stringify({ tag }) }),
    delete: (id) => apiFetch(`/api/games/${id}`, { method: 'DELETE' }),
  },

  // Playthroughs
  playthroughs: {
    list: (gameId) => apiFetch(`/api/games/${gameId}/playthroughs`),
    create: (gameId, data) => apiFetch(`/api/games/${gameId}/playthroughs`, { method: 'POST', body: JSON.stringify(data) }),
    update: (ptId, data) => apiFetch(`/api/playthroughs/${ptId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (ptId) => apiFetch(`/api/playthroughs/${ptId}`, { method: 'DELETE' }),
  },

  // Sessions (scoped to playthrough)
  sessions: {
    list: (ptId) => apiFetch(`/api/playthroughs/${ptId}/sessions`),
    create: (ptId, data) => apiFetch(`/api/playthroughs/${ptId}/sessions`, { method: 'POST', body: JSON.stringify(data) }),
    update: (ptId, sessionId, data) => apiFetch(`/api/playthroughs/${ptId}/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (ptId, sessionId) => apiFetch(`/api/playthroughs/${ptId}/sessions/${sessionId}`, { method: 'DELETE' }),
  },

  // Notes (scoped to playthrough)
  notes: {
    get: (ptId) => apiFetch(`/api/playthroughs/${ptId}/notes`),
    save: (ptId, content) => apiFetch(`/api/playthroughs/${ptId}/notes`, { method: 'PUT', body: JSON.stringify({ content }) }),
  },

  // Note Files (multi-file notes per playthrough)
  noteFiles: {
    list:   (ptId)         => apiFetch(`/api/playthroughs/${ptId}/note-files`),
    create: (ptId, data)   => apiFetch(`/api/playthroughs/${ptId}/note-files`, { method: 'POST', body: JSON.stringify(data) }),
    get:    (fileId)       => apiFetch(`/api/note-files/${fileId}`),
    save:   (fileId, data) => apiFetch(`/api/note-files/${fileId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (fileId)       => apiFetch(`/api/note-files/${fileId}`, { method: 'DELETE' }),
  },

  // Attachments (game-scoped, set = 'maps' | 'notes')
  attachments: {
    list: (gameId, set) => apiFetch(`/api/games/${gameId}/attachments${set ? `?set=${set}` : ''}`),

    // Upload a local file — returns the attachment record
    upload: (gameId, set, file) => {
      const form = new FormData();
      form.append('file', file);
      return fetch(`${API_BASE}/api/games/${gameId}/attachments/${set}`, {
        method: 'POST',
        credentials: 'include',
        body: form, // no Content-Type header — browser sets multipart boundary
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: res.statusText }));
          throw new APIError(body.message || 'Upload failed', res.status);
        }
        return res.json();
      });
    },

    // Fetch a remote URL server-side — returns the attachment record
    fromUrl: (gameId, set, url) =>
      apiFetch(`/api/games/${gameId}/attachments/${set}`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),

    delete: (attachmentId) => apiFetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' }),
  },

  // Maps (scoped to playthrough)
  maps: {
    list:   (ptId)               => apiFetch(`/api/playthroughs/${ptId}/maps`),
    get:    (mapId)              => apiFetch(`/api/maps/${mapId}`),
    // data = { name, attachment_id }
    create: (ptId, data)         => apiFetch(`/api/playthroughs/${ptId}/maps`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (mapId)              => apiFetch(`/api/maps/${mapId}`, { method: 'DELETE' }),
  },

  // Pins
  pins: {
    list:   (mapId)              => apiFetch(`/api/maps/${mapId}/pins`),
    create: (mapId, data)        => apiFetch(`/api/maps/${mapId}/pins`, { method: 'POST', body: JSON.stringify(data) }),
    update: (mapId, pinId, data) => apiFetch(`/api/maps/${mapId}/pins/${pinId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (mapId, pinId)       => apiFetch(`/api/maps/${mapId}/pins/${pinId}`, { method: 'DELETE' }),
  },

  // Users
  users: {
    list:           ()           => apiFetch('/api/users'),
    create:         (data)       => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    delete:         (id)         => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
    changePassword: (id, data)   => apiFetch(`/api/users/${id}/password`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // Calendar
  calendar: {
    sessions: () => apiFetch('/api/calendar/sessions'),
  },

  // User settings (key/value store)
  settings: {
    get: (key)         => apiFetch(`/api/settings/${key}`),
    set: (key, value)  => apiFetch(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  },

  // Bulletin board
  bulletin: {
    list:       ()       => apiFetch('/api/bulletin'),
    publish:    (data)   => apiFetch('/api/bulletin', { method: 'POST', body: JSON.stringify(data) }),
    getContent: (id)     => apiFetch(`/api/bulletin/${id}/content`),
    delete:     (id)     => apiFetch(`/api/bulletin/${id}`, { method: 'DELETE' }),
  },

};

export { APIError as default };
