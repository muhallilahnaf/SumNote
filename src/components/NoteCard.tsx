import { calculateNote } from "../lib/calculator";
import type { Note } from "../lib/noteRepository";
import { getNoteTitle } from "../lib/utils";

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onDelete: (note: Note) => void;
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


export default function NoteCard({
  note,
  onOpen,
  onDelete,
}: NoteCardProps) {
  const calculation = calculateNote(note.body);

  return (
    <article className="note-card" key={note.id}>
      <button
        type="button"
        className="note-card-main"
        onClick={() => onOpen(note)}
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
          onClick={() => onOpen(note)}
        >
          Open note
        </button>

        <button
          type="button"
          className="delete-button"
          aria-label={`Delete ${getNoteTitle(note)}`}
          onClick={() => void onDelete(note)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}