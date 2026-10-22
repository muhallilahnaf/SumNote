
import type { Note } from "./noteRepository";

const BACKUP_FORMAT = "sumnote-backup";
const BACKUP_VERSION = 1;

export interface SumNoteBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  notes: Note[];
}

/**
 * Convert all notes into a portable JSON backup.
 */
export function createBackupJson(notes: Note[]): string {
  const backup: SumNoteBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Parse and validate a SumNote JSON backup.
 * No database changes are made by this function.
 */
export function parseBackupJson(json: string): Note[] {
  const data: unknown = JSON.parse(json);

  if (
    typeof data !== "object" ||
    data === null ||
    !("format" in data) ||
    !("version" in data) ||
    !("exportedAt" in data) ||
    !("notes" in data) ||
    data.format !== BACKUP_FORMAT ||
    data.version !== BACKUP_VERSION ||
    typeof data.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(data.exportedAt)) ||
    !Array.isArray(data.notes)
  ) {
    throw new Error(
      "This file is not a supported SumNote backup."
    );
  }

  const seenIds = new Set<string>();

  const notes = data.notes.map((item: unknown): Note => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      !("title" in item) ||
      !("body" in item) ||
      !("createdAt" in item) ||
      !("updatedAt" in item) ||
      typeof item.id !== "string" ||
      item.id.trim() === "" ||
      typeof item.title !== "string" ||
      typeof item.body !== "string" ||
      typeof item.createdAt !== "string" ||
      typeof item.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(item.createdAt)) ||
      !Number.isFinite(Date.parse(item.updatedAt))
    ) {
      throw new Error(
        "The backup contains an invalid note."
      );
    }

    if (seenIds.has(item.id)) {
      throw new Error(
        "The backup contains duplicate note IDs."
      );
    }

    seenIds.add(item.id);

    return {
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  });

  return notes;
}

/**
 * Trigger a browser download.
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download all notes as a JSON backup.
 */
export function downloadBackup(notes: Note[]): void {
  const date = new Date().toISOString().slice(0, 10);

  downloadFile(
    `sumnote-backup-${date}.json`,
    createBackupJson(notes),
    "application/json;charset=utf-8"
  );
}

