
import {
  useEffect,
  useRef,
  useState
} from "react";
import "./App.css";
import { calculateNote } from "./lib/calculator";
import {
  createNoteId,
  deleteNote,
  listNotes,
  migrateLegacyDrafts,
  saveNote,
  importNotes,
  type Note
} from "./lib/noteRepository";

import type { ChangeEvent } from "react";

import {
  downloadBackup,
  parseBackupJson
} from "./lib/backup";


function newBlankNote(): Note {
  const now = new Date().toISOString();

  return {
    id: createNoteId(),
    title: "",
    body: "",
    createdAt: now,
    updatedAt: now
  };
}

function upsertNote(notes: Note[], updated: Note): Note[] {
  return [updated, ...notes.filter((note) => note.id !== updated.id)]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );
}

function getNoteTitle(note: Note): string {
  return note.title.trim() || "Untitled note";
}

function getNotePreview(body: string): string {
  return body.trim() || "No content yet";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);


  const [restorePreview, setRestorePreview] = useState<Note[] | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const activeNoteRef = useRef<Note | null>(null);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  // Initialize storage, migrate the Stage 2 draft, and load notes.
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        await migrateLegacyDrafts();
        const result = await listNotes();

        if (!cancelled) {
          setNotes(result);
          setError("");
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Unable to open local storage. Please reload the app.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave for the active note.
  useEffect(() => {
    if (!activeNote) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const saved = await saveNote(activeNote);

        if (!cancelled) {
          setNotes((current) => upsertNote(current, saved));
          setError("");
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Unable to save this note. Check browser storage.");
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeNote]);

  // Best-effort save when the tab is hidden or the page exits.
  useEffect(() => {
    const saveLatest = () => {
      const current = activeNoteRef.current;
      if (current) void saveNote(current).catch(console.error);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveLatest();
    };

    window.addEventListener("pagehide", saveLatest);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", saveLatest);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function openNewNote() {
    const note = newBlankNote();

    try {
      const saved = await saveNote(note);
      setNotes((current) => upsertNote(current, saved));
      setActiveNote(saved);
      setUndoStack([]);
      setRedoStack([]);
      setError("");
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (err) {
      console.error(err);
      setError("Could not create a note. Check browser storage.");
    }
  }

  function openNote(note: Note) {
    setActiveNote(note);
    setUndoStack([]);
    setRedoStack([]);
    setError("");
  }

  async function goHome() {
    const current = activeNoteRef.current;

    if (current) {
      try {
        const saved = await saveNote(current);
        setNotes((existing) => upsertNote(existing, saved));
      } catch (err) {
        console.error(err);
        setError("The note could not be saved. Please try again.");
        return;
      }
    }

    setActiveNote(null);
    setUndoStack([]);
    setRedoStack([]);
    setSearch("");
  }

  async function handleDelete(note: Note) {
    const confirmed = window.confirm(
      `Delete "${getNoteTitle(note)}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteNote(note.id);
      setNotes((current) =>
        current.filter((item) => item.id !== note.id)
      );

      if (activeNoteRef.current?.id === note.id) {
        setActiveNote(null);
      }

      setError("");
    } catch (err) {
      console.error(err);
      setError("Could not delete this note. Please try again.");
    }
  }

  function updateTitle(title: string) {
    setActiveNote((current) =>
      current ? { ...current, title } : current
    );
  }

  function updateBody(body: string) {
    if (!activeNote || activeNote.body === body) return;

    setUndoStack((stack) => [...stack, activeNote.body].slice(-100));
    setRedoStack([]);
    setActiveNote({ ...activeNote, body });
  }

  function undo() {
    if (!activeNote || undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];

    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, activeNote.body].slice(-100));
    setActiveNote({ ...activeNote, body: previous });

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      editor.setSelectionRange(previous.length, previous.length);
    });
  }

  function redo() {
    if (!activeNote || redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];

    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, activeNote.body].slice(-100));
    setActiveNote({ ...activeNote, body: next });

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      editor.setSelectionRange(next.length, next.length);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!activeNote || !(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();

    if (key === "s") {
      event.preventDefault();
      void saveNote(activeNote)
        .then((saved) => {
          setNotes((current) => upsertNote(current, saved));
          setError("");
        })
        .catch(() => setError("Unable to save this note."));
    } else if (key === "z" && event.shiftKey) {
      event.preventDefault();
      redo();
    } else if (key === "z") {
      event.preventDefault();
      undo();
    } else if (key === "y") {
      event.preventDefault();
      redo();
    }
  }

  function syncScroll() {
    const editor = editorRef.current;
    const highlight = highlightRef.current;

    if (editor && highlight) {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    }
  }

  const filteredNotes = notes.filter((note) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
    );
  });


  async function handleRestoreFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    // Allow selecting the same file again after an error or cancellation.
    event.target.value = "";

    if (!file) return;

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Backup files must be 10 MB or smaller.");
      }

      const parsedNotes = parseBackupJson(await file.text());

      setRestorePreview(parsedNotes);
      setRestoreError("");
    } catch (error) {
      setRestorePreview(null);
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Could not read this backup file."
      );
    }
  }

  async function confirmRestore() {
    if (!restorePreview || restoreBusy) return;

    setRestoreBusy(true);
    setRestoreError("");

    try {
      await importNotes(restorePreview);

      const updatedNotes = await listNotes();
      setNotes(updatedNotes);
      setRestorePreview(null);
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Could not restore the backup."
      );
    } finally {
      setRestoreBusy(false);
    }
  }

  function cancelRestore() {
    setRestorePreview(null);
    setRestoreError("");
  }


  if (loading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">Σ</div>
        <p>Opening SumNote…</p>
      </main>
    );
  }

  if (activeNote) {
    const calculation = calculateNote(activeNote.body);
    const lines = activeNote.body.split("\n");
    const ambiguousCount = calculation.lines.filter(
      (line) => line.status === "ambiguous"
    ).length;



    return (
      <div className="editor-shell" onKeyDown={handleKeyDown}>
        <header className="editor-header">
          <div className="header-inner">
            <div className="toolbar">
              <button
                className="back-button"
                type="button"
                onClick={() => void goHome()}
              >
                <span aria-hidden="true">←</span>
                <span>All notes</span>
              </button>

              <div className="toolbar-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Undo"
                  title="Undo (Ctrl+Z)"
                  disabled={undoStack.length === 0}
                  onClick={undo}
                >
                  ↶
                </button>

                <button
                  type="button"
                  className="icon-button"
                  aria-label="Redo"
                  title="Redo (Ctrl+Y)"
                  disabled={redoStack.length === 0}
                  onClick={redo}
                >
                  ↷
                </button>
              </div>
            </div>

            <div className="title-total-row">
              <input
                className="title-input"
                type="text"
                placeholder="Untitled note"
                aria-label="Note title"
                maxLength={200}
                value={activeNote.title}
                onChange={(event) => updateTitle(event.target.value)}
              />

              <div className="total-panel">
                <span className="total-label">TOTAL</span>
                <output
                  className={`total-value ${calculation.total > 0
                    ? "positive"
                    : calculation.total < 0
                      ? "negative"
                      : ""
                    }`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {calculation.formattedTotal}
                </output>
              </div>
            </div>

            <div className="save-status" role="status">
              {error || "Changes save automatically on this device"}
            </div>
          </div>
        </header>

        <main className="editor-workspace">
          <section className="writing-area" aria-label="Note editor">
            <div
              ref={highlightRef}
              className="highlight-layer"
              aria-hidden="true"
            >
              {activeNote.body.length === 0 ? (
                <div className="highlight-line placeholder">
                  {"Start typing…\n\nExamples:\nPocket money 200\nBread -50\nRice 2 x 50"}
                </div>
              ) : (
                lines.map((line, index) => (
                  <div
                    key={index}
                    className={`highlight-line ${calculation.lines[index]?.status === "ambiguous"
                      ? "ambiguous"
                      : ""
                      }`}
                  >
                    {line || "\u00a0"}
                  </div>
                ))
              )}
            </div>

            <textarea
              ref={editorRef}
              className="body-textarea"
              aria-label="Note body"
              spellCheck
              value={activeNote.body}
              onChange={(event) => updateBody(event.target.value)}
              onScroll={syncScroll}
            />
          </section>

          <footer className="editor-footer">
            {ambiguousCount > 0 ? (
              <span className="warning-indicator">
                {ambiguousCount} ambiguous line(s) excluded from total
              </span>
            ) : (
              <span>Type naturally. Your total updates automatically.</span>
            )}
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-header-inner">
          <div className="brand">
            <div className="brand-icon" aria-hidden="true">
              <img src="/sumnote-icon.svg" alt="" />
            </div>
            <div>
              <h1>SumNote</h1>
              <p>A notepad that calculates as you write.</p>
            </div>
          </div>


          <div className="home-actions">
            <button
              type="button"
              className="new-note-button"
              onClick={openNewNote}
            >
              <span aria-hidden="true">+</span>
            </button>

            <div className="more-menu">
              <button
                type="button"
                className="more-menu-trigger"
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">⋮</span>
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="menu-dismiss"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                  />

                  <div className="more-menu-dropdown" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        downloadBackup(notes);
                      }}
                      disabled={notes.length === 0}
                    >
                      Export backup
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setRestoreError("");
                        restoreInputRef.current?.click();
                      }}
                    >
                      Restore backup
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        window.open(
                          "https://github.com/muhallilahnaf/SumNote",
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      GitHub repo ↗
                    </button>
                  </div>
                </>
              )}

              <input
                ref={restoreInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={handleRestoreFileChange}
              />
            </div>
          </div>


        </div>
      </header>

      <main className="home-content">

        {restoreError && (
          <div className="restore-error" role="alert">
            {restoreError}
          </div>
        )}

        {restorePreview !== null && (
          <section className="restore-panel">
            <h2>Review backup</h2>

            <p>
              Notes in backup: <strong>{restorePreview.length}</strong>
            </p>

            <p>
              New notes to add:{" "}
              <strong>
                {restorePreview.filter(
                  (note) => !notes.some((existing) => existing.id === note.id)
                ).length}
              </strong>
            </p>

            <p>
              Existing notes to update:{" "}
              <strong>
                {restorePreview.filter(
                  (note) => notes.some((existing) => existing.id === note.id)
                ).length}
              </strong>
            </p>

            <p>
              Notes already on this device that aren't in the backup will be kept.
              Matching IDs will be updated using the backup's content and timestamps.
            </p>

            <div className="backup-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={cancelRestore}
                disabled={restoreBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmRestore}
                disabled={restoreBusy}
              >
                {restoreBusy ? "Restoring…" : "Confirm restore"}
              </button>
            </div>
          </section>
        )}

        <div className="collection-heading">
          <div>
            <h2>Your notes</h2>
            <p>
              {notes.length} {notes.length === 1 ? "note" : "notes"} saved on this device
            </p>
          </div>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search notes…"
              aria-label="Search notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        {filteredNotes.length > 0 ? (
          <section className="notes-grid" aria-label="Saved notes">
            {filteredNotes.map((note) => {
              const calculation = calculateNote(note.body);

              return (
                <article className="note-card" key={note.id}>
                  <button
                    type="button"
                    className="note-card-main"
                    onClick={() => openNote(note)}
                    aria-label={`Open ${getNoteTitle(note)}`}
                  >
                    <div className="note-card-heading">
                      <h3>{getNoteTitle(note)}</h3>
                      <span className="card-total">
                        {calculation.formattedTotal}
                      </span>
                    </div>

                    <p className="note-preview">
                      {getNotePreview(note.body)}
                    </p>

                    <div className="note-card-meta">
                      <span>{formatDate(note.updatedAt)}</span>
                      <span>
                        {note.body.trim()
                          ? note.body.trim().split("\n").length
                          : 0}{" "}
                        lines
                      </span>
                    </div>
                  </button>

                  <div className="note-card-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => openNote(note)}
                    >
                      Open note
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      aria-label={`Delete ${getNoteTitle(note)}`}
                      onClick={() => void handleDelete(note)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="empty-state">
            <div className="empty-icon" aria-hidden="true">✎</div>

            {notes.length === 0 ? (
              <>
                <h2>Your notes start here</h2>
                <p>
                  Create a note, type your amounts, and let SumNote
                  calculate the total automatically.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void openNewNote()}
                >
                  ＋ Create your first note
                </button>
              </>
            ) : (
              <>
                <h2>No matching notes</h2>
                <p>Try a different search term.</p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="home-footer">
        Your notes stay in this browser on this device.
      </footer>
    </div>
  );
}
