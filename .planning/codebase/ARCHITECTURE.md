# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** React SPA with Zustand State Management and Service Layer Architecture

The Harmony Link frontend is a React-based single-page application (SPA) that serves as the management interface for the Harmony Link backend. It provides configuration and monitoring capabilities through a tabbed interface, communicating with the Go backend via REST APIs.

**Key Characteristics:**
- **Component-Based UI Architecture**: All UI elements are built as reusable React components organized by feature domain
- **Zustand + Immer State Management**: Global state is managed through Zustand stores with Immer for immutable updates
- **Service Layer Pattern**: All backend communication is abstracted through service modules in [`src/services/`](src/services)
- **Dual-Mode Application**: Supports both Harmony Link and Harmony Speech Engine modes via environment-based configuration
- **Tailwind CSS Styling**: Utility-first CSS framework for responsive, themeable UI

## Layers

### Entry Layer
- **Purpose:** Application bootstrap and mode selection
- Location: [`src/main.jsx`](src/main.jsx)
- Contains: React root rendering, ThemeProvider wrapper, mode-based component selection
- Depends on: HarmonyLinkApp, HarmonySpeechEngineApp, ThemeContext
- Used by: Vite build output

### Application Shell Layer
- **Purpose:** Main application layout and navigation
- Location: [`src/HarmonyLinkApp.jsx`](src/HarmonyLinkApp.jsx), [`src/HarmonySpeechEngineApp.jsx`](src/HarmonySpeechEngineApp.jsx)
- Contains: Tab-based navigation, settings views, modal management, device approval watchers
- Depends on: All view components, services, stores
- Used by: main.jsx entry point

### View Layer
- **Purpose:** Feature-specific UI components organized by domain
- Location: [`src/components/`](src/components)
- Contains:
  - [`src/components/DevelopmentView.jsx`](src/components/DevelopmentView.jsx) - Development tools and testing
  - [`src/components/EntitySettingsView.jsx`](src/components/EntitySettingsView.jsx) - Entity configuration
  - [`src/components/GeneralSettingsView.jsx`](src/components/GeneralSettingsView.jsx) - General app settings
  - [`src/components/IntegrationsView.jsx`](src/components/IntegrationsView.jsx) - External integrations
  - [`src/components/ModuleConfigurationsView.jsx`](src/components/ModuleConfigurationsView.jsx) - AI module settings
  - [`src/components/SimulatorView.jsx`](src/components/SimulatorView.jsx) - Event simulation
  - [`src/components/characters/`](src/components/characters) - Character profile management
  - [`src/components/modules/`](src/components/modules) - Provider-specific module settings (35+ components)
  - [`src/components/sync/`](src/components/sync) - Device synchronization UI
  - [`src/components/modals/`](src/components/modals) - Reusable dialog components
- Depends on: Services, stores
- Used by: Application shell

### Service Layer
- **Purpose:** Backend API communication abstraction
- Location: [`src/services/management/`](src/services/management)
- Contains:
  - [`src/services/management/baseService.js`](src/services/management/baseService.js) - API URL/key configuration, auth headers
  - [`src/services/management/configService.js`](src/services/management/configService.js) - App configuration CRUD
  - [`src/services/management/entityService.js`](src/services/management/entityService.js) - Entity management
  - [`src/services/management/characterService.js`](src/services/management/characterService.js) - Character profiles
  - [`src/services/management/moduleService.js`](src/services/management/moduleService.js) - Module configurations
  - [`src/services/management/syncService.js`](src/services/management/syncService.js) - Device sync
  - [`src/services/management/systemService.js`](src/services/management/systemService.js) - System info
  - [`src/services/management/themeService.js`](src/services/management/themeService.js) - Theme management
- Depends on: baseService for API configuration
- Used by: View components, stores

### State Management Layer
- **Purpose:** Global application state with Zustand
- Location: [`src/store/`](src/store)
- Contains:
  - [`src/store/entityStore.js`](src/store/entityStore.js) - Entity state and CRUD operations
  - [`src/store/characterProfileStore.js`](src/store/characterProfileStore.js) - Character profile state
  - [`src/store/moduleConfigStore.js`](src/store/moduleConfigStore.js) - Module configuration state
- Depends on: Services for async operations
- Used by: View components

### Context Layer
- **Purpose:** React context providers for cross-cutting concerns
- Location: [`src/contexts/`](src/contexts)
- Contains:
  - [`src/contexts/ThemeContext.jsx`](src/contexts/ThemeContext.jsx) - Theme state and toggle
- Used by: main.jsx (wraps entire app)

### Utility Layer
- **Purpose:** Shared helper functions
- Location: [`src/utils/`](src/utils)
- Contains: Logger utilities, common helpers
- Used by: All layers

## Data Flow

**Configuration Load Flow:**
1. App shell mounts in [`src/HarmonyLinkApp.jsx`](src/HarmonyLinkApp.jsx)
2. `useEffect` calls `configService.getConfig()`
3. Service makes REST call to management API
4. Response stored in local state (`applicationConfig`)
5. State passed to child view components as props

**State Update Flow:**
1. User modifies settings in a view component
2. View calls save function (e.g., `saveGeneralSettings`)
3. Save function calls `configService.updateConfig()`
4. Service makes PUT request to management API
5. On success, local state is updated
6. UI re-renders with new values

**Store-Based State Flow:**
1. Component calls store action (e.g., `entityStore.loadEntities()`)
2. Store action calls service method
3. Service fetches data from API
4. Store updates state via Zustand `set()`
5. All subscribed components re-render

## Key Abstractions

**Service Abstraction:**
- All API communication goes through service modules
- Base service provides common configuration (URL, auth headers)
- Each domain has its own service file
- Pattern: `src/services/management/{domain}Service.js`

**Store Abstraction:**
- Zustand stores encapsulate domain state
- Immer `produce` used for immutable state updates
- Stores include both state and actions
- Pattern: `src/store/{domain}Store.js`

**Component Organization:**
- View components in [`src/components/`](src/components) root or feature subdirectories
- Reusable UI components in [`src/components/widgets/`](src/components/widgets) (if present)
- Modal components in [`src/components/modals/`](src/components/modals)
- Pattern: `{FeatureName}View.jsx` for main views, `{ComponentName}.jsx` for smaller components

## Entry Points

**Primary Entry:**
- Location: [`src/main.jsx`](src/main.jsx)
- Triggers: Vite dev server or production build
- Responsibilities: React DOM rendering, ThemeProvider setup, mode selection

**Main Application:**
- Location: [`src/HarmonyLinkApp.jsx`](src/HarmonyLinkApp.jsx)
- Triggers: Loaded by main.jsx when not in speech-engine mode
- Responsibilities: Tab navigation, settings views, device approval modal, state management

**Speech Engine Application:**
- Location: [`src/HarmonySpeechEngineApp.jsx`](src/HarmonySpeechEngineApp.jsx)
- Triggers: Loaded by main.jsx when VITE_APP_MODE=speech-engine
- Responsibilities: Simplified UI for speech engine configuration

## Error Handling

**Service Layer:**
- All service methods return Promises
- Errors caught in calling components with try/catch
- Error state stored in Zustand stores
- Error dialogs shown via [`src/components/modals/ErrorDialog.jsx`](src/components/modals/ErrorDialog.jsx)

**Component Level:**
- Loading states managed via `isLoading` flags
- Error messages displayed inline or via modals
- User-friendly error messages from API responses

## Cross-Cutting Concerns

**Logging:** Custom logger utility in [`src/utils/logger.js`](src/utils/logger.js) with `LogDebug`, `LogError`, `LogPrint`

**Theme:** Dynamic theming system with backend-driven JSON themes. ThemeContext fetches theme from API, applies colors as CSS custom properties to `document.documentElement`. Backend stores themes in JSON files (e.g., `themes/midnight-rose.json`) with color definitions for backgrounds, accents, status, text, borders, gradients, and nuances (tab-specific colors).

**Configuration:** All config managed via REST API; no local storage for sensitive data

**Authentication:** API key passed via `X-Admin-API-Key` header (configured in baseService.js)

---

*Architecture analysis: 2026-02-28*