import { useRef } from "react";
import { calculateNote } from "../lib/calculator";
import type { Note } from "../lib/noteRepository";

interface NoteEditorProps {
  note: Note;
  error: string;
  undoStack: string[];
  redoStack: string[];
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export default function NoteEditor({
  note,
  error,
  undoStack,
  redoStack,
  onClose,
  onTitleChange,
  onBodyChange,
  onUndo,
  onRedo,
  onKeyDown,
}: NoteEditorProps) {

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  function syncScroll() {
    const editor = editorRef.current;
    const highlight = highlightRef.current;

    if (editor && highlight) {
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    }
  }

  const calculation = calculateNote(note.body);
  const lines = note.body.split("\n");
  const ambiguousCount = calculation.lines.filter(
    (line) => line.status === "ambiguous"
  ).length;


  return (
    <div className="editor-shell" onKeyDown={onKeyDown}>
      <header className="editor-header">
        <div className="header-inner">
          <div className="toolbar">
            <button
              className="back-button"
              type="button"
              onClick={() => void onClose()}
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
                onClick={onUndo}
              >
                ↶
              </button>

              <button
                type="button"
                className="icon-button"
                aria-label="Redo"
                title="Redo (Ctrl+Y)"
                disabled={redoStack.length === 0}
                onClick={onRedo}
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
              value={note.title}
              onChange={(event) => onTitleChange(event.target.value)}
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
            {note.body.length === 0 ? (
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
            value={note.body}
            onChange={(event) => onBodyChange(event.target.value)}
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