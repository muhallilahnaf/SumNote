import type { Note } from "../lib/noteRepository";

interface BackupRestoreProps {
  preview: Note[] | null;
  notes: Note[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function BackupRestore({
  preview,
  notes,
  busy,
  onCancel,
  onConfirm,
}: BackupRestoreProps) {
  if (preview === null) return null;

  <section className="restore-panel">
    <h2>Review backup</h2>

    <p>
      Notes in backup: <strong>{preview.length}</strong>
    </p>

    <p>
      New notes to add:{" "}
      <strong>
        {preview.filter(
          (note) => !notes.some((existing) => existing.id === note.id)
        ).length}
      </strong>
    </p>

    <p>
      Existing notes to update:{" "}
      <strong>
        {preview.filter(
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
        onClick={onCancel}
        disabled={busy}
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? "Restoring…" : "Confirm restore"}
      </button>
    </div>
  </section>
}