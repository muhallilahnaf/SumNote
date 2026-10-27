import type { Note } from "./noteRepository";




export function getNoteTitle(note: Note): string {
  return note.title.trim() || "Untitled note";
}
