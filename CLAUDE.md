# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev      # Dev mode: compiles main process TS, starts Vite dev server (port 5173) + Electron
npm run build    # Production build: compiles main process TS + Vite bundle to dist/
npm start        # Run the built Electron app (requires build first)
npm run pack     # Build + package as portable Windows exe (output in release/)
npm test         # Run tests in watch mode (Vitest)
npm run test:run # Run tests once
```

## Architecture

Electron desktop app (v33) with React 19 renderer, built with Vite 6 and TypeScript 5.

### Process Model

- **Main process** (`src/main/main.ts`): Creates the BrowserWindow, handles IPC for file I/O. Saves/loads day data as markdown files in `{userData}/days/YYYY-MM-DD.md`.
- **Preload** (`src/main/preload.ts`): Bridges main↔renderer via `window.electronAPI`. Context isolation is enabled. Exposes file I/O methods (`saveDay`, `loadDay`, `getDataDir`) and widget IPC methods (`toggleWidget`, `sendActiveEntry`, `onActiveEntryUpdate`, `focusMainWindow`, `onWidgetToggled`).
- **Renderer** (`src/renderer/`): React app with all UI logic. Falls back to localStorage when `electronAPI` is unavailable (browser-only dev).
- **Widget window**: A second frameless, always-on-top BrowserWindow (`widget.html` / `Widget.tsx`) that shows the active time block with a live countdown. The main process relays the active entry from the main renderer to the widget via IPC (`active-entry-changed` → `active-entry-update`).

### TypeScript Build

Two separate TS configs:
- `tsconfig.json` — renderer (Vite handles compilation)
- `tsconfig.main.json` — main process (compiled by `tsc` to `dist/main/`)

### Component Hierarchy

```
App.tsx              — Holds TimeEntry[] state, handles load/save with 300ms debounced auto-save
└── Timeline.tsx     — Core interaction layer: drag-to-create, move, resize, multi-select, color menu
    ├── TimeBlock.tsx — Individual entry: inline title editing, resize handles, done checkbox, time display
    └── ColorMenu.tsx — Right-click context menu with 10 preset colors + duplicate + delete

Widget.tsx           — Floating widget: shows active entry title, time range, and live countdown
  (separate React root via widget-main.tsx, loaded in the widget BrowserWindow)
```

### Key Data Structures

`TimeEntry` (`src/renderer/types.ts`): `id`, `title`, `startMinutes`, `endMinutes` (minutes from midnight, 0–1440), `color` (hex), `done?` (boolean).

### Timeline Constants (`src/renderer/utils/time.ts`)

Day renders from 6 AM to 11 PM (17 hours). Each hour is 60px tall (1020px total). All times snap to a 15-minute grid. Ctrl+scroll zooms the timeline by changing the pixels-per-hour scale.

### Persistence

Data serializes to markdown via `src/renderer/utils/markdown.ts`. Format: H1 for date, H2 for each entry (`## HH:MM - HH:MM | Title`), with color and ID as bullet metadata. The markdown format is designed to be human-readable in external editors.

### Overlap Layout (`src/renderer/utils/overlap.ts`)

When blocks overlap in time, `computeOverlapLayout()` assigns each to a column (like Google Calendar side-by-side rendering). Uses a sweep-line algorithm to group overlapping entries, then greedy-assigns columns within each group.

### Drag Interaction State Machine (Timeline.tsx)

`dragMode` tracks the current interaction: `none`, `creating`, `moving`, `resizing`. Global mousemove/mouseup listeners handle all drag operations. Supports multi-block dragging via Ctrl+click selection.

## README Maintenance

**MANDATORY:** After every code change, you MUST review `README.md` and update it before committing. Do not treat this as optional. Gaps in the README are bugs.

Update the README when any of the following apply:
- A user-facing feature is added, removed, or changed (new UI elements, keyboard shortcuts, context menu options, panels, widgets, animations, etc.)
- Build/run commands or prerequisites change
- The data storage format changes
- The tech stack or major dependencies change

When adding a feature, read through the existing Features list in the README and confirm the new capability is documented there. If you are unsure whether the README needs updating, update it — it is better to over-document than to leave gaps.
