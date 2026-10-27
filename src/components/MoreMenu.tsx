import { useRef, useState } from "react";

interface MoreMenuProps {
  canExport: boolean;
  onExport: () => void;
  onRestoreFileChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

export default function MoreMenu({
  canExport,
  onExport,
  onRestoreFileChange
}: MoreMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="more-menu">
      <button
        type="button"
        className="more-menu-trigger"
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="menu-dismiss"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />

          <div className="more-menu-dropdown" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onExport();
              }}
              disabled={!canExport}
            >
              Export backup
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                restoreInputRef.current?.click();
              }}
            >
              Restore backup
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                window.open(
                  "https://github.com/muhallilahnaf/SumNote",
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
            >
              GitHub repo ↗
            </button>
          </div>
        </>
      )}

      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={onRestoreFileChange}
      />
    </div>
  )
}