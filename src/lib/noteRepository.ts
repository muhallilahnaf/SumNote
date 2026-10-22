
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface SumNoteDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      "by-updatedAt": string;
    };
  };
}

const DB_NAME = "sumnote-db";
const DB_VERSION = 1;
const LEGACY_PREFIX = "sumnote:draft:";

let databasePromise: Promise<IDBPDatabase<SumNoteDB>> | undefined;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<SumNoteDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("notes")) {
          const store = db.createObjectStore("notes", {
            keyPath: "id"
          });

          store.createIndex("by-updatedAt", "updatedAt");
        }
      }
    });
  }

  return databasePromise;
}

export function createNoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDatabase();
  const notes = await db.getAll("notes");

  return notes.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
  );
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDatabase();
  return db.get("notes", id);
}

export async function saveNote(note: Note): Promise<Note> {
  const db = await getDatabase();

  const savedNote: Note = {
    ...note,
    updatedAt: new Date().toISOString()
  };

  await db.put("notes", savedNote);

  return savedNote;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("notes", id);
}

/**
 * Imports the temporary drafts created in Stage 2.
 * A legacy draft is removed only after its IndexedDB write succeeds.
 */
export async function migrateLegacyDrafts(): Promise<void> {
  if (typeof window === "undefined") return;

  const db = await getDatabase();
  const legacyKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith(LEGACY_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  for (const key of legacyKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("id" in parsed) ||
        !("title" in parsed) ||
        !("body" in parsed) ||
        typeof parsed.id !== "string" ||
        typeof parsed.title !== "string" ||
        typeof parsed.body !== "string"
      ) {
        continue;
      }

      const existing = await db.get("notes", parsed.id);

      if (!existing) {
        const now = new Date().toISOString();

        const createdAt =
          "createdAt" in parsed &&
          typeof parsed.createdAt === "string"
            ? parsed.createdAt
            : now;

        const updatedAt =
          "updatedAt" in parsed &&
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : now;

        await db.put("notes", {
          id: parsed.id,
          title: parsed.title,
          body: parsed.body,
          createdAt,
          updatedAt
        });
      }

      // Remove the old copy only after the migration succeeds.
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Could not migrate a SumNote draft:", error);
    }
  }
}


/**
 * Imports notes from a validated backup while preserving their
 * original IDs and timestamps. Existing IDs are updated.
 */
export async function importNotes(notes: Note[]): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction("notes", "readwrite");

  try {
    for (const note of notes) {
      await tx.store.put(note);
    }

    await tx.done;
  } catch (error) {
    tx.abort();
    throw error;
  }
}
