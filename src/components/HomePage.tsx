import type { Note } from "../lib/noteRepository";
import NoteCard from "./NoteCard";
import BackupRestore from "./BackupRestore";
import MoreMenu from "./MoreMenu";

interface HomePageProps {
  notes: Note[];
  filteredNotes: Note[];
  search: string;
  error: string;
  restoreError: string;
  restorePreview: Note[] | null;
  restoreBusy: boolean;
  onSearchChange: (value: string) => void;
  onNewNote: () => void;
  onOpenNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onExportBackup: () => void;
  onRestoreFileChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onCancelRestore: () => void;
  onConfirmRestore: () => void;
}


export default function HomePage({
  notes,
  filteredNotes,
  search,
  error,
  restoreError,
  restorePreview,
  restoreBusy,
  onSearchChange,
  onNewNote,
  onOpenNote,
  onDeleteNote,
  onExportBackup,
  onRestoreFileChange,
  onCancelRestore,
  onConfirmRestore,
}: HomePageProps) {
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
              onClick={onNewNote}
            >
              <span aria-hidden="true">+</span>
            </button>

            <MoreMenu
              canExport={notes.length > 0}
              onExport={() => onExportBackup()}
              onRestoreFileChange={onRestoreFileChange}
            />
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
          <BackupRestore
            preview={restorePreview}
            notes={notes}
            busy={restoreBusy}
            onCancel={onCancelRestore}
            onConfirm={() => void onConfirmRestore()}
          />
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
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}

        {filteredNotes.length > 0 ? (
          <section className="notes-grid" aria-label="Saved notes">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onOpen={onOpenNote}
                onDelete={(selectedNote) => void onDeleteNote(selectedNote)}
              />
            ))}
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
                  onClick={() => void onNewNote()}
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
                  onClick={() => onSearchChange("")}
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
  )
}



