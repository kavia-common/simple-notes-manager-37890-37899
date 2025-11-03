import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

/**
 * Utilities
 */
// PUBLIC_INTERFACE
export function formatDate(ts) {
  /** Format a timestamp or Date to a friendly string like "Mar 10, 2:14 PM". */
  const d = typeof ts === 'number' ? new Date(ts) : ts instanceof Date ? ts : new Date();
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Local storage strategy
 */
const LS_KEY = 'notes.data.v1';

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return [];
}

function seedIfEmpty() {
  const curr = loadFromLocal();
  if (curr.length) return curr;
  const now = Date.now();
  const seed = [
    { id: crypto.randomUUID(), title: 'Welcome to Simple Notes', body: 'Start typing to edit this note. Use the sidebar to create and switch notes.', updatedAt: now },
    { id: crypto.randomUUID(), title: 'Tips', body: '- Use the search box to filter\n- Changes autosave\n- Try the theme toggle in your system settings', updatedAt: now }
  ];
  localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return seed;
}

function saveToLocal(notes) {
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
}

/**
 * Backend strategy (optional)
 */
const API_BASE = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || '';

async function tryFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function detectBackend() {
  /** Attempt to detect backend availability by calling /notes or /health. Returns boolean. */
  if (!API_BASE) return false;
  try {
    // Prefer notes list if exists
    await tryFetch('/notes');
    return true;
  } catch (_) {
    try {
      await tryFetch('/health');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * API facade that uses backend if available, otherwise localStorage.
 */
function useNotesApi() {
  const [useBackend, setUseBackend] = useState(false);

  useEffect(() => {
    let mounted = true;
    detectBackend().then((ok) => mounted && setUseBackend(ok));
    return () => { mounted = false; };
  }, []);

  const api = useMemo(() => {
    if (useBackend) {
      return {
        async list() { return tryFetch('/notes'); },
        async create(note) { return tryFetch('/notes', { method: 'POST', body: JSON.stringify(note) }); },
        async update(id, note) { return tryFetch(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(note) }); },
        async remove(id) { await tryFetch(`/notes/${id}`, { method: 'DELETE' }); return true; },
      };
    }
    return {
      async list() { return seedIfEmpty(); },
      async create(note) {
        const notes = loadFromLocal();
        notes.unshift(note);
        saveToLocal(notes);
        return note;
      },
      async update(id, patch) {
        const notes = loadFromLocal().map(n => n.id === id ? { ...n, ...patch } : n);
        saveToLocal(notes);
        return notes.find(n => n.id === id);
      },
      async remove(id) {
        const notes = loadFromLocal().filter(n => n.id !== id);
        saveToLocal(notes);
        return true;
      }
    };
  }, [useBackend]);

  return { api, useBackend };
}

/**
 * Components
 */
function Sidebar({ notes, activeId, onSelect, onCreate, query, setQuery }) {
  return (
    <aside className="sidebar" aria-label="Notes sidebar">
      <div className="brand" role="banner">
        <div className="logo" aria-hidden="true" />
        <div>
          <div className="title">Simple Notes</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ocean Professional</div>
        </div>
      </div>
      <div className="search">
        <input
          className="input"
          placeholder="Search notes..."
          aria-label="Search notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" onClick={onCreate} aria-label="Create new note">New</button>
      </div>
      <div className="notes-list" role="list" aria-label="Notes">
        {notes.length === 0 && (
          <div className="note-meta" style={{ padding: 12 }}>No notes found.</div>
        )}
        {notes.map(n => (
          <button
            key={n.id}
            className={`note-list-item ${activeId === n.id ? 'active' : ''}`}
            role="listitem"
            onClick={() => onSelect(n.id)}
            aria-pressed={activeId === n.id}
            title={n.title || 'Untitled'}
          >
            <div>
              <div className="note-title">{n.title || 'Untitled'}</div>
              <div className="note-meta">Updated {formatDate(n.updatedAt)}</div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Header({ title, onTitleChange, onSave, onDelete, canDelete, backendActive }) {
  return (
    <div className="header">
      <div className="title-area">
        <span aria-hidden="true" style={{
          width: 8, height: 24, borderRadius: 4,
          background: 'linear-gradient(180deg, var(--color-secondary), #d97706)'
        }} />
        <input
          className="title-input"
          placeholder="Note title"
          aria-label="Note title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>
      <div className="toolbar" role="toolbar" aria-label="Editor toolbar">
        <span className="btn btn-ghost" aria-live="polite" aria-atomic="true" title={backendActive ? 'Connected to backend' : 'Using local storage'}>
          {backendActive ? 'Cloud' : 'Local'}
        </span>
        <button className="btn" onClick={onSave} aria-label="Save note">Save</button>
        <button className="btn btn-danger" onClick={onDelete} aria-label="Delete note" disabled={!canDelete}>Delete</button>
      </div>
    </div>
  );
}

function Editor({ body, onBodyChange }) {
  return (
    <div className="editor">
      <label htmlFor="note-body" style={{ fontSize: 12, color: 'var(--muted)' }}>Body</label>
      <textarea
        id="note-body"
        className="body"
        placeholder="Write your note here..."
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
      />
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Main app: manages notes state, selection, CRUD operations and backend/local fallback. */
  const [theme, setTheme] = useState('light');
  const { api, useBackend } = useNotesApi();

  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load notes
  useEffect(() => {
    let mounted = true;
    api.list()
      .then((list) => {
        if (!mounted) return;
        setNotes(list.sort((a, b) => b.updatedAt - a.updatedAt));
        if (list.length) {
          setActiveId(list[0].id);
          setTitle(list[0].title || '');
          setBody(list[0].body || '');
        } else {
          setActiveId(null);
          setTitle('');
          setBody('');
        }
        setError('');
      })
      .catch(() => setError('Failed to load notes'));
    return () => { mounted = false; };
  }, [api]);

  // Autosave on typing (debounced)
  useEffect(() => {
    if (!activeId) return;
    const handle = setTimeout(() => {
      const updatedAt = Date.now();
      api.update(activeId, { title, body, updatedAt })
        .then((updated) => {
          setNotes((prev) => {
            const arr = prev.map(n => n.id === activeId ? { ...n, ...updated } : n);
            return arr.sort((a, b) => b.updatedAt - a.updatedAt);
          });
          setError('');
        })
        .catch(() => setError('Autosave failed'));
    }, 500);
    return () => clearTimeout(handle);
  }, [title, body, activeId, api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q)
    );
  }, [notes, query]);

  function selectNote(id) {
    const n = notes.find(x => x.id === id);
    setActiveId(id);
    setTitle(n?.title || '');
    setBody(n?.body || '');
  }

  async function createNote() {
    const now = Date.now();
    const newNote = { id: crypto.randomUUID(), title: 'Untitled', body: '', updatedAt: now };
    try {
      await api.create(newNote);
      setNotes((prev) => [newNote, ...prev]);
      selectNote(newNote.id);
      setError('');
    } catch {
      setError('Failed to create note');
    }
  }

  async function saveNote() {
    if (!activeId) return;
    try {
      const updated = await api.update(activeId, { title, body, updatedAt: Date.now() });
      setNotes((prev) => {
        const arr = prev.map(n => n.id === activeId ? { ...n, ...updated } : n);
        return arr.sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setError('');
    } catch {
      setError('Failed to save note');
    }
  }

  async function deleteNote() {
    if (!activeId) return;
    try {
      await api.remove(activeId);
      setNotes((prev) => prev.filter(n => n.id !== activeId));
      const remaining = notes.filter(n => n.id !== activeId);
      const next = remaining[0];
      setActiveId(next?.id || null);
      setTitle(next?.title || '');
      setBody(next?.body || '');
      setError('');
    } catch {
      setError('Failed to delete note');
    }
  }

  const active = notes.find(n => n.id === activeId);

  return (
    <div className="App">
      <div className="notes-app">
        <Sidebar
          notes={filtered}
          activeId={activeId}
          onSelect={selectNote}
          onCreate={createNote}
          query={query}
          setQuery={setQuery}
        />
        <main className="main" aria-label="Editor area">
          <div className="panel">
            <Header
              title={title}
              onTitleChange={setTitle}
              onSave={saveNote}
              onDelete={deleteNote}
              canDelete={!!activeId}
              backendActive={useBackend}
            />
            {active ? (
              <Editor body={body} onBodyChange={setBody} />
            ) : (
              <div className="empty-state">
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>No note selected</div>
                  <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                    Create one with the
                    {' '}
                    <kbd>New</kbd>
                    {' '}
                    button
                  </div>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div role="alert" style={{
              marginTop: 12,
              padding: '10px 12px',
              border: '1px solid transparent',
              borderRadius: 10,
              background: 'linear-gradient(180deg, var(--color-error), #b91c1c)',
              color: 'white',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {error}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Tip: Your notes {useBackend ? 'are synced with the backend.' : 'are saved in your browser.'}
          </div>
          <div style={{ marginTop: 4 }}>
            <button
              className="btn"
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              aria-label="Toggle theme"
            >
              Toggle Theme
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
