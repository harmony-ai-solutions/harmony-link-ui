# External Integrations

**Analysis Date:** 2026-02-28

## Application Modes

The frontend supports two run modes via `VITE_APP_MODE` environment variable:

| Mode | Value | Description |
|------|-------|-------------|
| Harmony Link | `harmony-link` | Full AI companion application (default) |
| Harmony Speech Engine | `speech-engine` | Standalone speech processing UI |

**Mode Detection:**
- Configured in: `src/config/appMode.js`
- Entry point: `src/main.jsx` conditionally renders `HarmonyLinkApp.jsx` or `HarmonySpeechEngineApp.jsx`

## APIs & External Services

### Backend API (Primary Integration)

**Harmony Link Management API:**
- Purpose: Core application backend
- Communication: REST over HTTP
- Base URL: `VITE_MGMT_API_URL:VITE_MGMT_API_PORT` (default: `http://localhost:28081`)
- Authentication: API Key via `X-Admin-API-Key` header
- Path: `/api` (configurable via `VITE_MGMT_API_PATH`)
- SDK: Custom fetch-based service layer

### Harmony Speech Engine API

When running in `speech-engine` mode, the frontend connects to the Harmony Speech Engine service:
- Purpose: Standalone speech processing (TTS/STT/VAD)
- SDK: `@harmony-ai/harmonyspeech` npm package
- Config: `VITE_APP_MODE=speech-engine`

### Service Layer Architecture

The frontend uses a modular service layer located in `src/services/management/`:

| Service | Purpose | File |
|---------|---------|------|
| Character Service | Character profile management | `characterService.js` |
| Config Service | Application configuration | `configService.js` |
| Development Service | Dev mode controls | `developmentService.js` |
| Entity Service | Entity management | `entityService.js` |
| Integrations Service | External integrations | `integrationsService.js` |
| Module Service | Module configuration | `moduleService.js` |
| Rag Service | RAG (Retrieval-Augmented Generation) | `ragService.js` |
| Simulator Service | AI simulation controls | `simulatorService.js` |
| Sync Service | Data synchronization | `syncService.js` |
| System Service | System operations | `systemService.js` |
| Theme Service | Theme management | `themeService.js` |

### Storage Services

**Local Storage:**
- `src/services/storage/` - Browser localStorage wrappers for persistence
- Used for: User preferences, cached data

**Sync Services:**
- `src/services/sync/` - Cross-device synchronization
- Used for: Keeping settings/data in sync across instances

## Authentication & Identity

**API Key Authentication:**
- Header: `X-Admin-API-Key`
- Default key: `"admin"` (configurable via `VITE_MGMT_API_KEY`)
- Configured in: `src/services/management/baseService.js`

## Data Storage

**Client-Side:**
- Browser localStorage - Persistent key-value storage
- Used for: Theme preferences, UI state, cached API responses

**Server-Side:**
- SQLite database (Go backend)
- Encryption support for sensitive data

## Environment Configuration

**Required env vars:**
- `VITE_MGMT_API_URL` - Backend URL
- `VITE_MGMT_API_PORT` - Backend port
- `VITE_MGMT_API_KEY` - Authentication key

**Optional env vars:**
- `VITE_MGMT_API_PATH` - API path prefix
- `VITE_MGMT_PUBLIC_API_PATH` - Public API path
- `VITE_APP_MODE` - Application mode (`harmony-link` or `speech-engine`)

## WebSocket Connections

The frontend communicates with the backend via:
- HTTP REST API (management endpoints)
- WebSocket (real-time event streaming - handled by Go backend)

## Docker Integration

**Docker Compose:**
- Frontend built as Docker image
- Environment variables injected at container build time
- Uses `.env.speech-engine` for speech engine mode

---

*Integration audit: 2026-02-28*
