# Technology Stack

**Analysis Date:** 2026-02-28

## Languages

**Primary:**
- JavaScript (ES2022+) - Frontend application logic
- TypeScript - Type-safe JavaScript development (via React types)

**Secondary:**
- JSX - React component syntax

## Runtime

**Environment:**
- Node.js 20+ (development)
- Web browser (production) via WebView2 (Windows) / WebKit (macOS/Linux)

**Package Manager:**
- npm (package.json)
- Lockfile: Present (package-lock.json)

## Frameworks

**Core:**
- React 19.1.1 - UI framework
- Vite 7.1.2 - Build tool and dev server
- Tailwind CSS 4.1.12 - Utility-first CSS framework

**State Management:**
- Zustand 4.5.7 - Lightweight state management
- Immer 10.1.1 - Immutable state updates

**UI Components:**
- @headlessui/react 2.2.7 - Accessible UI components
- @monaco-editor/react 4.7.0 - Code editor component
- @uiw/react-json-view 2.0.0-alpha.34 - JSON viewer
- rc-tree 5.13.1 - Tree component

**Data Visualization:**
- plotly.js 3.1.0 - Charting library
- react-plotly.js 2.6.0 - React wrapper for Plotly

**Audio:**
- react-audio-player 0.17.0 - Audio playback
- react-h5-audio-player 3.10.0 - HTML5 audio player

**File Handling:**
- react-dropzone 14.3.8 - Drag-and-drop file uploads

**Development:**
- @vitejs/plugin-react 5.0.0 - React Fast Refresh
- @tailwindcss/vite 4.1.12 - Vite plugin for Tailwind
- @tailwindcss/postcss 4.1.12 - PostCSS plugin for Tailwind
- autoprefixer 10.4.21 - CSS vendor prefixes
- postcss 8.5.6 - CSS transformation

## Key Dependencies

**Core:**
- react 19.1.1 - UI library
- react-dom 19.1.1 - React DOM renderer

**State & Data:**
- zustand 4.5.7 - State management
- immer 10.1.1 - Immutable updates

**Utilities:**
- lodash 4.17.21 - Utility functions

**Specialized:**
- @harmony-ai/harmonyspeech 0.1.1 - Speech engine client

## Configuration

**Environment Variables:**
- `VITE_MGMT_API_URL` - Management API URL (default: "http://localhost")
- `VITE_MGMT_API_PORT` - Management API port (default: "28081")
- `VITE_MGMT_API_PATH` - API path (default: "/api")
- `VITE_MGMT_PUBLIC_API_PATH` - Public API path (default: "/public")
- `VITE_MGMT_API_KEY` - API key for authentication (default: "admin")

**Build Configuration:**
- `vite.config.js` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration with custom color palette
- `postcss.config.js` - PostCSS configuration
- `index.html` - Entry HTML file

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- Browser for dev preview (Chrome, Firefox, Edge, Safari)

**Production:**
- WebView2 (Windows) / WebKit (macOS/Linux)
- Runs embedded in Wails desktop application (Go backend)
- Docker container deployment (Alpine-based)

---

*Stack analysis: 2026-02-28*
