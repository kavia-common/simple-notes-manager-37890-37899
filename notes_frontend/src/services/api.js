//
// Notes API facade. Uses backend if REACT_APP_API_BASE is reachable, otherwise falls back to localStorage.
//
/* eslint-disable no-undef */

// PUBLIC_INTERFACE
export async function healthCheck() {
  /** Try to hit /notes or /health endpoint to determine backend availability. Returns boolean. */
  const base = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || '';
  if (!base) return false;
  try {
    const r = await fetch(`${base}/notes`);
    if (r.ok) return true;
  } catch (_) { /* ignore */ }
  try {
    const r = await fetch(`${base}/health`);
    return r.ok;
  } catch (_) {
    return false;
  }
}

// PUBLIC_INTERFACE
export function createLocalStorageAdapter(storageKey = 'notes.data.v1') {
  /** Returns a localStorage backed CRUD adapter with the same shape as backend adapter. */
  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function save(list) {
    localStorage.setItem(storageKey, JSON.stringify(list));
  }
  return {
    async list() {
      const data = load();
      if (!data.length) {
        const now = Date.now();
        const seed = [
          { id: crypto.randomUUID(), title: 'Welcome to Simple Notes', body: 'This is your first note.', updatedAt: now },
        ];
        save(seed);
        return seed;
      }
      return data;
    },
    async create(note) {
      const data = load();
      data.unshift(note);
      save(data);
      return note;
    },
    async update(id, patch) {
      const data = load();
      const updated = data.map(n => n.id === id ? { ...n, ...patch } : n);
      save(updated);
      return updated.find(n => n.id === id);
    },
    async remove(id) {
      const data = load().filter(n => n.id !== id);
      save(data);
      return true;
    }
  };
}

// PUBLIC_INTERFACE
export function createBackendAdapter(base) {
  /** Returns a fetch-backed CRUD adapter talking to a backend. */
  async function j(path, options = {}) {
    const r = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return options.method === 'DELETE' ? true : r.json();
  }
  return {
    async list() { return j('/notes'); },
    async create(note) { return j('/notes', { method: 'POST', body: JSON.stringify(note) }); },
    async update(id, patch) { return j(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(patch) }); },
    async remove(id) { return j(`/notes/${id}`, { method: 'DELETE' }); },
  };
}
