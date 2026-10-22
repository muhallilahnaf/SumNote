
export interface NoteDraft {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

const STORAGE_PREFIX = "sumnote:draft:";

export function loadDraft(id: string): NoteDraft | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);

    if (!raw) return null;

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
      return null;
    }

    return {
      id: parsed.id,
      title: parsed.title,
      body: parsed.body,
      updatedAt:
        "updatedAt" in parsed &&
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function saveDraft(
  note: Pick<NoteDraft, "id" | "title" | "body">
): void {
  const record: NoteDraft = {
    ...note,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(
    `${STORAGE_PREFIX}${note.id}`,
    JSON.stringify(record)
  );
}
