# Coding Conventions

**Analysis Date:** 2026-02-28

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `HarmonyLinkApp.jsx`, `EntitySettingsView.jsx`)
- JavaScript modules: camelCase with `.js` extension (e.g., `entityStore.js`, `logger.js`)
- Constants: PascalCase (e.g., `SettingsTabMain`, `SettingsTabGeneral`)

**Functions:**
- camelCase (e.g., `loadEntities`, `createEntity`, `getNestedValue`, `setNestedValue`)
- Async functions use `async/await` pattern

**Variables:**
- camelCase (e.g., `applicationConfig`, `pendingDevices`, `currentDevice`)
- State variables often prefixed with `is` for booleans (e.g., `isLoading`)

**Types:**
- Not explicitly typed (no TypeScript except React type definitions)
- Uses JSDoc comments in some places

## Code Style

**Formatting:**
- No explicit ESLint or Prettier configuration found in project root
- Uses Tailwind CSS 4.x with `@tailwindcss/vite` plugin
- PostCSS for CSS transformation

**Linting:**
- No linting configuration detected in project root
- Dependencies include React types but no linting tools in devDependencies

**Indentation:**
- 4 spaces for JSX elements (based on Tailwind class patterns)
- 4 spaces for JavaScript code

## Import Organization

**Order:**
1. React imports (e.g., `useState`, `useEffect`)
2. Local assets (e.g., `import logo from './assets/images/...'`)
3. Service imports (e.g., `import { getConfig, updateConfig } from "./services/management/configService.js"`)
4. Component imports (e.g., `import EntitySettingsView from "./components/EntitySettingsView.jsx"`)
5. Utility imports (e.g., `import { LogDebug, LogError } from "./utils/logger.js"`)

**Path Aliases:**
- Relative paths from component location
- Uses `.js` extension for local imports (ESM style)

**Example from** [`src/HarmonyLinkApp.jsx`](src/HarmonyLinkApp.jsx):
```javascript
import { useState, useEffect } from 'react';
import logo from './assets/images/harmony-link-icon-256.png';
import { getConfig, updateConfig, getAppName, getAppVersion } from "./services/management/configService.js";
import EntitySettingsView from "./components/EntitySettingsView.jsx";
import { SettingsTabMain, SettingsTabGeneral, ... } from './constants.jsx'
import { LogDebug, LogError, LogPrint } from "./utils/logger.js";
```

## Error Handling

**Patterns:**
- Try-catch blocks in async functions
- Error state stored in store (e.g., `error: null`)
- Error logging via custom logger (LogError)
- Error messages displayed via modal dialogs (`showModal`)

**Example from** [`src/HarmonyLinkApp.jsx`](src/HarmonyLinkApp.jsx):
```javascript
try {
    getConfig().then((result) => setApplicationConfig(result));
} catch (error) {
    LogError("Unable to Load Application Config");
    LogError(error);
}
```

## Logging

**Framework:** Custom logger in [`src/utils/logger.js`](src/utils/logger.js)

**Exports:**
- `LogPrint` - General output
- `LogTrace` - Trace level
- `LogDebug` - Debug level
- `LogInfo` - Info level
- `LogWarning` - Warning level
- `LogError` - Error level
- `LogFatal` - Fatal errors

**Pattern:**
```javascript
import { LogDebug, LogError, LogPrint } from "./utils/logger.js";

LogDebug("Successfully Updated General Settings");
LogError("Unable to Update General Settings");
LogError(onError);
```

## Comments

**When to Comment:**
- Complex logic in validation functions
- API service methods
- State management actions

**JSDoc/TSDoc:**
- Minimal usage; not consistently applied

## Function Design

**Size:**
- Components tend to be large (200+ lines for main app)
- Helper functions extracted for complex operations (e.g., `getNestedValue`, `setNestedValue`)

**Parameters:**
- Destructured props in components
- Multiple parameters for service calls

**Return Values:**
- Async functions return Promises
- Store actions return updated state or throw errors

## Module Design

**Exports:**
- Named exports for utilities (e.g., `export const LogDebug = ...`)
- Default exports for React components (e.g., `export default function EntitySettingsView()`)
- Store hooks as named exports (e.g., `export const useEntityStore = create(...)`)

**Barrel Files:**
- Not used; direct imports from service files

## State Management

**Pattern:** Zustand with Immer

**Example from** [`src/store/entityStore.js`](src/store/entityStore.js):
```javascript
import { create } from 'zustand';
import { produce } from 'immer';

const useEntityStore = create((set, get) => ({
    entities: null,
    selectedEntityId: null,
    isLoading: false,
    error: null,
    
    loadEntities: async () => {
        set({ isLoading: true, error: null });
        try {
            const entities = await entityService.listEntities();
            set({ entities, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    
    createEntity: async (id, characterProfileId) => {
        set({ isLoading: true, error: null });
        try {
            const newEntity = await entityService.createEntity(id, characterProfileId);
            set(produce(state => {
                state.entities.push(newEntity);
                state.selectedEntityId = id;
            }));
            return newEntity;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
}));
```

## Component Patterns

**Functional Components:**
- React 19 functional components with hooks
- useState for local state
- useEffect for side effects (data loading, watchers)

**Example:**
```javascript
function HarmonyLinkApp() {
    const [appName, setAppName] = useState('Harmony Link');
    const [applicationConfig, setApplicationConfig] = useState(null);
    
    useEffect(() => {
        try {
            getConfig().then((result) => setApplicationConfig(result));
        } catch (error) {
            LogError("Unable to Load Application Config");
        }
    }, []);
    
    // ... render logic
}
```

## Validation Patterns

**URL Validation:**
- Uses regex pattern: `/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/`

**Entity ID Validation:**
- Pattern: `/^[a-zA-Z0-9_-]+$/` - alphanumeric, dashes, underscores only

**Example from** [`src/components/EntitySettingsView.jsx`](src/components/EntitySettingsView.jsx):
```javascript
if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return 'Entity ID can only contain letters, numbers, hyphens, and underscores';
}
```

---

*Convention analysis: 2026-02-28*