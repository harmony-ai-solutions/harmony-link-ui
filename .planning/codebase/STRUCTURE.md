# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
frontend/
├── .github/                    # GitHub workflows and CI/CD
├── src/
│   ├── assets/                 # Static assets (images, fonts)
│   ├── components/             # React UI components
│   ├── config/                 # Application configuration
│   ├── constants/              # Application constants
│   ├── contexts/               # React context providers
│   ├── services/               # API service layer
│   ├── store/                  # Zustand state stores
│   ├── styles/                 # Additional styles
│   ├── utils/                  # Utility functions
│   ├── constants.jsx           # Tab and navigation constants
│   ├── HarmonyLinkApp.jsx      # Main application component
│   ├── HarmonySpeechEngineApp.jsx  # Speech engine variant
│   ├── main.jsx                # Application entry point
│   └── style.css               # Global styles
├── .env.example                # Environment variable template
├── .env.speech-engine          # Speech engine env config
├── index.html                  # HTML entry point
├── package.json                # NPM dependencies
├── tailwind.config.js          # Tailwind CSS configuration
├── vite.config.js              # Vite build configuration
└── postcss.config.js           # PostCSS configuration
```

## Directory Purposes

### `src/components/`
- **Purpose:** All React UI components
- **Contains:** View components, widgets, modals, feature-specific components
- **Key files:**
  - [`src/components/DevelopmentView.jsx`](src/components/DevelopmentView.jsx) - Development tools
  - [`src/components/EntitySettingsView.jsx`](src/components/EntitySettingsView.jsx) - Entity configuration
  - [`src/components/GeneralSettingsView.jsx`](src/components/GeneralSettingsView.jsx) - General settings
  - [`src/components/IntegrationsView.jsx`](src/components/IntegrationsView.jsx) - Integrations
  - [`src/components/ModuleConfigurationsView.jsx`](src/components/ModuleConfigurationsView.jsx) - Module config
  - [`src/components/SimulatorView.jsx`](src/components/SimulatorView.jsx) - Event simulator
  - [`src/components/characters/`](src/components/characters) - Character profile management
  - [`src/components/modals/`](src/components/modals) - Reusable dialogs
  - [`src/components/modules/`](src/components/modules) - 35+ provider-specific settings components
  - [`src/components/sync/`](src/components/sync) - Device synchronization UI

### `src/services/`
- **Purpose:** Backend API communication layer
- **Contains:** Service modules for each domain
- **Key files:**
  - [`src/services/management/baseService.js`](src/services/management/baseService.js) - API configuration
  - [`src/services/management/configService.js`](src/services/management/configService.js) - App config
  - [`src/services/management/entityService.js`](src/services/management/entityService.js) - Entities
  - [`src/services/management/characterService.js`](src/services/management/characterService.js) - Characters
  - [`src/services/management/moduleService.js`](src/services/management/moduleService.js) - Modules
  - [`src/services/management/syncService.js`](src/services/management/syncService.js) - Sync
  - [`src/services/management/themeService.js`](src/services/management/themeService.js) - Themes
  - [`src/services/storage/`](src/services/storage) - Local storage utilities
  - [`src/services/sync/`](src/services/sync) - Sync-specific services

### `src/store/`
- **Purpose:** Zustand state management stores
- **Contains:** Domain-specific state stores with actions
- **Key files:**
  - [`src/store/entityStore.js`](src/store/entityStore.js) - Entity state and CRUD
  - [`src/store/characterProfileStore.js`](src/store/characterProfileStore.js) - Character profiles
  - [`src/store/moduleConfigStore.js`](src/store/moduleConfigStore.js) - Module configs

### `src/contexts/`
- **Purpose:** React context providers
- **Contains:** Theme provider
- **Key files:**
  - [`src/contexts/ThemeContext.jsx`](src/contexts/ThemeContext.jsx) - Theme state and application

### `src/config/`
- **Purpose:** Application configuration utilities
- **Contains:** Mode detection
- **Key files:**
  - [`src/config/appMode.js`](src/config/appMode.js) - Mode detection (Harmony Link vs Speech Engine)

### `src/utils/`
- **Purpose:** Shared utility functions
- **Contains:** Logger, helpers
- **Key files:**
  - [`src/utils/logger.js`](src/utils/logger.js) - Logging utilities

### `src/constants/`
- **Purpose:** Application constants
- **Contains:** Tab identifiers, navigation constants

## Key File Locations

**Entry Points:**
- [`frontend/src/main.jsx`](frontend/src/main.jsx) - React application bootstrap
- [`frontend/index.html`](frontend/index.html) - HTML entry point

**Configuration:**
- [`frontend/vite.config.js`](frontend/vite.config.js) - Vite build configuration
- [`frontend/tailwind.config.js`](frontend/tailwind.config.js) - Tailwind CSS configuration
- [`frontend/package.json`](frontend/package.json) - NPM dependencies and scripts

**Core Logic:**
- [`frontend/src/HarmonyLinkApp.jsx`](frontend/src/HarmonyLinkApp.jsx) - Main application component (246 lines)
- [`frontend/src/HarmonySpeechEngineApp.jsx`](frontend/src/HarmonySpeechEngineApp.jsx) - Speech engine variant

**State Management:**
- [`frontend/src/store/entityStore.js`](frontend/src/store/entityStore.js) - Entity store (94 lines)
- [`frontend/src/store/characterProfileStore.js`](frontend/src/store/characterProfileStore.js) - Character profile store
- [`frontend/src/store/moduleConfigStore.js`](frontend/src/store/moduleConfigStore.js) - Module config store

**API Services:**
- [`frontend/src/services/management/baseService.js`](frontend/src/services/management/baseService.js) - Base API configuration (73 lines)

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `CharacterProfilesView.jsx`, `DeviceApprovalModal.jsx`)
- Service files: camelCase with `Service` suffix (e.g., `configService.js`, `entityService.js`)
- Store files: camelCase with `Store` suffix (e.g., `entityStore.js`, `characterProfileStore.js`)
- Utility files: camelCase (e.g., `logger.js`, `appMode.js`)

**Directories:**
- Feature directories: camelCase (e.g., `services/management`, `components/characters`)
- Component directories: camelCase (e.g., `components/modals`, `components/modules`)

**Constants:**
- Export constants from [`src/constants.jsx`](src/constants.jsx) using PascalCase (e.g., `SettingsTabGeneral`)

## Where to Add New Code

**New Feature/View:**
- Primary code: [`src/components/`](src/components) - Create new `{FeatureName}View.jsx`
- If feature has sub-components: Create directory `src/components/{feature}/`
- Tests: Not currently present (no test directory)

**New Service:**
- Implementation: [`src/services/management/`](src/services/management) - Create `{domain}Service.js`
- Follow pattern: Import from `baseService.js`, export async functions

**New State Store:**
- Implementation: [`src/store/`](src/store) - Create `{domain}Store.js`
- Use Zustand `create()` with Immer `produce` for immutable updates

**New Modal/Dialog:**
- Implementation: [`src/components/modals/`](src/components/modals) - Create `{DialogName}.jsx`

**New Module Settings Component:**
- Implementation: [`src/components/modules/`](src/components/modules) - Create `{ModuleType}{Provider}SettingsView.jsx`
- Pattern: 35+ existing components follow this naming (e.g., `BackendOpenAISettingsView.jsx`, `TTSElevenlabsSettingsView.jsx`)

## Special Directories

### `src/components/modules/`
- **Purpose:** Provider-specific configuration UI for AI modules
- **Contains:** 35+ settings view components for different providers
- **Generated:** No (manually maintained)
- **Committed:** Yes

### `src/components/characters/`
- **Purpose:** Character profile management UI
- **Contains:** Profile cards, editors, import/display components
- **Generated:** No
- **Committed:** Yes

### `src/services/management/`
- **Purpose:** REST API client services
- **Contains:** 12 service modules for different backend domains
- **Generated:** No
- **Committed:** Yes

### `src/store/`
- **Purpose:** Global state management
- **Contains:** 3 Zustand stores
- **Generated:** No
- **Committed:** Yes

---

*Structure analysis: 2026-02-28*