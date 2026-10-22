# SumNote

[sumnote.vercel.app](https://sumnote.vercel.app/)

**SumNote** is an offline-first notepad with live calculations. Write
ordinary notes and amounts line by line, and SumNote calculates a
running total as you type.

Notes are stored locally in the browser using IndexedDB. SumNote does
not require an account or a backend service.

## Features

-   **Live calculations:** Each line can contribute an amount to the
    note total.
-   **Plain-text notes:** Keep descriptions and amounts together in a
    simple text editor.
-   **Note management:** Create, edit, search, and delete notes.
-   **Autosave:** Changes are saved locally as you type.
-   **Undo and redo:** Recover recent edits in the editor.
-   **Ambiguous-line highlighting:** Lines that look like unsupported or
    unclear calculations are highlighted and excluded from the total.
-   **Homepage summaries:** Browse note cards with a preview and
    calculated total.
-   **Offline-first PWA:** Install SumNote on supported browsers and use
    the cached app shell offline.
-   **JSON backup and restore:** Export all notes to a JSON file and
    restore them later.
-   **Plain-text data model:** Notes remain readable and portable.
-   **Responsive interface:** Designed for desktop and mobile screens.

## Calculation behavior

Each line is evaluated independently.

Examples:

  Line                        Contribution
  ------------------------- --------------
  `Pocket money 200`                `+200`
  `Bread -50`                        `-50`
  `Eggs +100`                       `+100`
  `Rice 2 x 50`                     `+100`
  `Rice -2 x 50`                    `-100`
  `Share 100 / 4`                    `+25`
  `Bought 2 packs for 50`            `+50`
  `Meeting tomorrow`                   `0`

Supported operations are multiplication (`x`, `X`, `×`, `*`) and
division (`/`) with a single operation on a line. Lines containing
unsupported or ambiguous arithmetic---such as `Cost 2 + 3`, chained
operations, incomplete operands, or division by zero---are highlighted
and excluded from the total.

Dates such as `20/10/2026` and `2026-10-20` are ignored as amounts. A
line without a recognizable amount is treated as text and contributes
zero. If any valid amount contains a decimal, the displayed total uses
two decimal places; otherwise it is displayed as a whole number.

## Technology

-   React
-   TypeScript
-   Vite
-   IndexedDB via `idb`
-   Vitest
-   `vite-plugin-pwa` for the web app manifest and service worker
-   Plain CSS

## Requirements

-   Node.js and npm
-   A modern browser with IndexedDB and service-worker support

## Run locally

Install dependencies:

``` bash
npm install
```

Start the development server:

``` bash
npm run dev
```

Vite prints a local URL in the terminal. Open it in your browser.

## Tests and production build

Run the test suite:

``` bash
npm run test
```

Create a production build:

``` bash
npm run build
```

Preview the production build locally:

``` bash
npm run preview
```

Test PWA and offline behavior against the production preview as well as
after deployment. Development-server behavior alone does not verify
production service-worker caching.


## Deployment

SumNote can be deployed to a static hosting provider that supports
serving the Vite production build. Build the app with:

``` bash
npm run build
```

Deploy the generated `dist/` directory. Use HTTPS for production PWA
installation and service-worker support.


## Data storage and backups

-   Notes are stored in the browser's IndexedDB database (`sumnote-db`).
-   There is no login, remote database, or automatic cloud
    synchronization.
-   Browser storage can be cleared by the user, browser settings, or
    device-management tools. Export backups regularly if notes matter.
-   JSON backup files contain note content and timestamps. Store them
    somewhere private.
-   Restoring a backup merges it with local notes: new IDs are added,
    matching IDs are updated, and local notes not included in the backup
    are retained.

## Project structure

A simplified view of the important files:

``` text
sumnote-react/
├── public/                  # PWA and browser icon assets
├── src/
│   ├── lib/
│   │   ├── calculator.ts    # Line and note calculation logic
│   │   ├── calculator.test.ts
│   │   ├── noteRepository.ts # IndexedDB note storage
│   │   └── backup.ts        # JSON backup and export utilities
│   ├── App.tsx              # Main application and screen state
│   ├── App.css              # Application styling
│   └── main.tsx             # React entry point
├── index.html
├── vite.config.ts
└── package.json
```

## Privacy

SumNote is designed to keep notes on the device where they are created.
JSON backups are downloaded to a location chosen by the user. There is
no built-in account system or cloud sync.

## License

No license has been specified yet.
