
import {
  useEffect,
  useRef,
  useState
} from "react";
import "./App.css";
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

import NoteEditor from "./components/NoteEditor";
import HomePage from "./components/HomePage";

import { getNoteTitle } from "./lib/utils";

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

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const activeNoteRef = useRef<Note | null>(null);
  const savedSnapshotRef = useRef<Note | null>(null);
  const isNewNoteRef = useRef(false);

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

  function hasNoteContent(note: Note): boolean {
    return Boolean(note.title.trim() || note.body.trim());
  }

  function hasUnsavedChanges(note: Note): boolean {
    const saved = savedSnapshotRef.current;
    return !saved || note.title !== saved.title || note.body !== saved.body;
  }

  async function saveIfChanged(note: Note): Promise<Note | null> {
    // Do not persist a newly opened note until the user enters a title or body.
    if (isNewNoteRef.current && !hasNoteContent(note)) return null;
    if (!hasUnsavedChanges(note)) return null;

    const saved = await saveNote(note);
    savedSnapshotRef.current = saved;
    return saved;
  }

  // Debounced autosave for actual edits only.
  useEffect(() => {
    if (!activeNote) return;
    if (!hasUnsavedChanges(activeNote)) return;
    if (isNewNoteRef.current && !hasNoteContent(activeNote)) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      // Ignore a timer belonging to a note that has already been closed.
      if (activeNoteRef.current?.id !== activeNote.id) return;

      try {
        const saved = await saveIfChanged(activeNote);

        if (!cancelled && saved) {
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

  // Best-effort save changed notes when the tab is hidden or the page exits.
  useEffect(() => {
    const saveLatest = () => {
      const current = activeNoteRef.current;
      if (current) void saveIfChanged(current).catch(console.error);
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
    isNewNoteRef.current = true;
    savedSnapshotRef.current = note;
    activeNoteRef.current = note;
    setActiveNote(note);
    setUndoStack([]);
    setRedoStack([]);
    setError("");
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function openNote(note: Note) {
    isNewNoteRef.current = false;
    savedSnapshotRef.current = note;
    activeNoteRef.current = note;
    setActiveNote(note);
    setUndoStack([]);
    setRedoStack([]);
    setError("");
  }

  async function goHome() {
    const current = activeNoteRef.current;
    const isNewNote = isNewNoteRef.current;

    if (current) {
      try {
        if (isNewNote && !hasNoteContent(current)) {
          // A blank new note may have been autosaved before its contents were
          // cleared, so remove it from storage as well as from the homepage.
          await deleteNote(current.id);
          setNotes((existing) => existing.filter((note) => note.id !== current.id));
        } else {
          const saved = await saveIfChanged(current);
          if (saved) {
            setNotes((existing) => upsertNote(existing, saved));
          }
        }
      } catch (err) {
        console.error(err);
        setError("The note could not be saved. Please try again.");
        return;
      }
    }

    activeNoteRef.current = null;
    savedSnapshotRef.current = null;
    isNewNoteRef.current = false;
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
        activeNoteRef.current = null;
        savedSnapshotRef.current = null;
        isNewNoteRef.current = false;
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
      void saveIfChanged(activeNote)
        .then((saved) => {
          if (saved) setNotes((current) => upsertNote(current, saved));
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
    return (
      <NoteEditor
        note={activeNote}
        error={error}
        undoStack={undoStack}
        redoStack={redoStack}
        onClose={() => void goHome()}
        onTitleChange={updateTitle}
        onBodyChange={updateBody}
        onUndo={undo}
        onRedo={redo}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <HomePage
      notes={notes}
      filteredNotes={filteredNotes}
      search={search}
      error={error}
      restoreError={restoreError}
      restorePreview={restorePreview}
      restoreBusy={restoreBusy}
      onSearchChange={setSearch}
      onNewNote={() => void openNewNote()}
      onOpenNote={openNote}
      onDeleteNote={(note) => void handleDelete(note)}
      onExportBackup={() => downloadBackup(notes)}
      onRestoreFileChange={handleRestoreFileChange}
      onCancelRestore={cancelRestore}
      onConfirmRestore={() => void confirmRestore()}
    />
  );
}
