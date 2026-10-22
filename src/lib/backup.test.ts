
import { describe, expect, it } from "vitest";
import {
  createBackupJson,
  parseBackupJson
} from "./backup";
import type { Note } from "./noteRepository";

const sampleNotes: Note[] = [
  {
    id: "note-1",
    title: "October expenses",
    body: "Lunch 150\nTransport 50",
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-21T10:00:00.000Z"
  }
];

describe("SumNote backup", () => {
  it("creates a versioned JSON backup", () => {
    const json = createBackupJson(sampleNotes);
    const parsed = JSON.parse(json);

    expect(parsed.format).toBe("sumnote-backup");
    expect(parsed.version).toBe(1);
    expect(parsed.notes).toEqual(sampleNotes);
  });

  it("restores valid notes from JSON", () => {
    const json = createBackupJson(sampleNotes);

    expect(parseBackupJson(json)).toEqual(sampleNotes);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBackupJson("{invalid")).toThrow();
  });

  it("rejects an unsupported backup format", () => {
    const json = JSON.stringify({
      format: "other-app",
      version: 1,
      notes: []
    });

    expect(() => parseBackupJson(json)).toThrow();
  });

  it("rejects duplicate note IDs", () => {
    const json = createBackupJson([
      sampleNotes[0],
      { ...sampleNotes[0], title: "Duplicate" }
    ]);

    expect(() => parseBackupJson(json)).toThrow(
      /duplicate note IDs/i
    );
  });

  it("rejects notes with missing required fields", () => {
    const json = JSON.stringify({
      format: "sumnote-backup",
      version: 1,
      exportedAt: "2026-10-22T00:00:00.000Z",
      notes: [{ id: "note-1", title: "Incomplete" }]
    });

    expect(() => parseBackupJson(json)).toThrow(
      /invalid note/i
    );
  });

  it("supports an empty backup", () => {
    const json = createBackupJson([]);

    expect(parseBackupJson(json)).toEqual([]);
  });
});
