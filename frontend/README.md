# InterviewOS — AI Interview Layer for Any Hiring Platform

Production-ready Chrome Extension Frontend (Manifest V3) built with React, TypeScript, Vite, and Tailwind CSS.

## Architecture Highlights
- **Manifest V3 Specification**: Multi-entry build target for Popup, Side Panel, Content Script (Floating Widget), and Background Service Worker.
- **Transparent Frosted Glass UI**: High-end translucent panels (`backdrop-filter: blur(20px)`), ambient glow layers, and custom typography.
- **Enterprise Modular Structure**:
  - `src/core/`: Centralized environment loader, Chrome API wrappers, logger, and core constants.
  - `src/config/`: App configuration schemas (API, extension options, routes, theme).
  - `src/theme/`: Strongly typed design tokens (colors, typography, spacing, radii).
  - `src/messaging/`: Type-safe Chrome extension messaging bus (`runtime`, `tabs`, `background`, `content`).
  - `src/store/`: Domain-driven state slices (`ui`, `interview`, `session`, `settings`).
  - `src/api/`: Typed REST client modules (`health`, `interview`, `session`, `report`).
  - `src/layout/`: Structural layout shells (`PopupLayout`, `SidePanelLayout`, `DashboardLayout`).
  - `src/dev/`: Interactive extension dev workbench (`DevWorkbench.tsx`).
  - `frontend-log.txt`: Prompt changelog tracking file.

## How to Build & Load in Chrome

### 1. Build the Extension Bundle
Run the production build command in your terminal:
```bash
npm run build
```
This generates the extension dist package in `d:\AI Interview Frontend\dist`.

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `dist` folder (`d:\AI Interview Frontend\dist`).
5. Your extension **InterviewOS — AI Interview Layer** is now active!
