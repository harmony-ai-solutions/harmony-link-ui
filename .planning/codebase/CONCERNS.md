# Codebase Concerns

**Analysis Date:** 2026-02-28

## Tech Debt

### No Testing Framework
- **Issue:** No test runner, test configuration, or test files exist in the project
- **Files:** [`package.json`](package.json) - no test scripts or testing dependencies
- **Impact:** No automated testing, high risk of regressions
- **Fix approach:** Install Vitest, add test scripts, create unit tests for critical paths

### No Linting or Formatting
- **Issue:** No ESLint or Prettier configuration detected
- **Files:** Project root lacks `.eslintrc*`, `eslint.config.*`, `.prettierrc*`
- **Impact:** Inconsistent code style, potential bugs from uncaught issues
- **Fix approach:** Add ESLint with React plugin and Prettier for consistent formatting

### Incomplete TTS Settings Implementation
- **Issue:** Multiple TODO comments for dynamic operation modes and output options
- **Files:** [`src/components/modules/TTSHarmonySpeechSettingsView.jsx:84`](src/components/modules/TTSHarmonySpeechSettingsView.jsx:84), [`src/components/modules/TTSHarmonySpeechSettingsView.jsx:645`](src/components/modules/TTSHarmonySpeechSettingsView.jsx:645), [`src/components/modules/TTSHarmonySpeechSettingsView.jsx:646`](src/components/modules/TTSHarmonySpeechSettingsView.jsx:646)
- **Impact:** Incomplete TTS configuration UI
- **Fix approach:** Implement dynamic operation mode fetching and output options

### Large Component Files
- **Issue:** Several components exceed 700 lines, making them difficult to maintain
- **Files:** 
  - [`src/components/modules/TTSHarmonySpeechSettingsView.jsx`](src/components/modules/TTSHarmonySpeechSettingsView.jsx) - 1183 lines
  - [`src/components/modules/RAGCollectionManager.jsx`](src/components/modules/RAGCollectionManager.jsx) - 787 lines
  - [`src/components/EntitySettingsView.jsx`](src/components/EntitySettingsView.jsx) - 727 lines
- **Impact:** Hard to understand, test, and modify
- **Fix approach:** Extract sub-components, use composition patterns

### No TypeScript (Except React Types)
- **Issue:** Project uses plain JavaScript with only React type definitions
- **Files:** All source files in [`src/`](src) are `.jsx` or `.js`
- **Impact:** No compile-time type checking, higher risk of runtime errors
- **Fix approach:** Migrate to TypeScript incrementally or add JSDoc type annotations

### Duplicate Module Configuration Components
- **Issue:** 35+ nearly identical provider-specific settings components with repetitive patterns
- **Files:** [`src/components/modules/`](src/components/modules) - BackendOpenAISettingsView.jsx, BackendOpenRouterSettingsView.jsx, etc.
- **Impact:** High code duplication, maintenance burden
- **Fix approach:** Create generic configuration component with provider-specific props

---

## Known Bugs

### Inconsistent Error Handling
- **Symptoms:** Mix of `console.error`, `LogError`, `alert()`, and `setError` across codebase
- **Files:** 174 catch blocks found with inconsistent error handling patterns
- **Trigger:** Any API call or async operation
- **Workaround:** None - errors may be silently swallowed or show unhelpful messages

### Silent Failures in Error Catches
- **Symptoms:** Many catch blocks only log errors without user feedback
- **Files:** [`src/store/entityStore.js`](src/store/entityStore.js), [`src/store/moduleConfigStore.js`](src/store/moduleConfigStore.js), [`src/services/management/syncService.js`](src/services/management/syncService.js)
- **Trigger:** Network failures or API errors
- **Workaround:** None - users may not know operations failed

### Alert-Based Error Display
- **Symptoms:** Using `alert()` for error messages instead of proper UI
- **Files:** [`src/components/modules/ModuleConfigEditor.jsx:204`](src/components/modules/ModuleConfigEditor.jsx:204), [`src/components/characters/ImageGallery.jsx`](src/components/characters/ImageGallery.jsx)
- **Impact:** Poor UX, interrupts user flow
- **Fix approach:** Use toast notifications or error modals

---

## Security Considerations

### Hardcoded API Key
- **Risk:** Default API key "admin" is hardcoded in frontend
- **Files:** [`src/services/management/baseService.js`](src/services/management/baseService.js)
- **Current mitigation:** None
- **Recommendations:** 
  - Implement proper authentication flow
  - Use secure token-based auth
  - Add API key management UI

### Environment Variable Exposure
- **Risk:** Environment variables like `VITE_MGMT_API_KEY` are bundled in frontend
- **Files:** [`vite.config.js`](vite.config.js), build output
- **Current mitigation:** None
- **Recommendations:** 
  - Never expose secrets in frontend code
  - Use backend proxy for sensitive API calls

### No Input Sanitization
- **Risk:** User inputs may not be sanitized before display or API calls
- **Files:** Various form components in [`src/components/`](src/components)
- **Current mitigation:** None detected
- **Recommendations:** Add input validation and sanitization

---

## Performance Bottlenecks

### Large Bundle Size
- **Problem:** No code splitting, all code loaded at once
- **Files:** [`vite.config.js`](vite.config.js) - no dynamic imports configured
- **Cause:** Single-page app without lazy loading
- **Improvement path:** Implement React.lazy() for route-based code splitting

### Large Dependencies
- **Problem:** Heavy dependencies bundled without optimization
- **Files:** [`package.json`](package.json) - plotly.js (3.1.0), @monaco-editor/react (4.7.0)
- **Cause:** No tree-shaking optimization, full imports
- **Improvement path:** Use dynamic imports for heavy components

### No Caching Strategy
- **Problem:** No HTTP caching or local caching for API responses
- **Files:** Service layer in [`src/services/management/`](src/services/management)
- **Cause:** Every load fetches fresh data
- **Improvement path:** Implement SWR or React Query for caching

### Large Component Re-renders
- **Problem:** Components may re-render unnecessarily
- **Files:** Various components without memoization
- **Cause:** Missing React.memo, useMemo, useCallback
- **Improvement path:** Add performance optimizations for frequently rendered components

---

## Fragile Areas

### Service Layer Error Handling
- **Files:** [`src/services/management/`](src/services/management)
- **Why fragile:** Inconsistent error handling across 10+ service files
- **Safe modification:** Standardize error handling pattern across all services
- **Test coverage:** No tests exist

### Module Configuration Components
- **Files:** [`src/components/modules/`](src/components/modules) - 35+ components
- **Why fragile:** Copy-paste pattern with minor variations, easy to miss updates
- **Safe modification:** Create base component and extend via props
- **Test coverage:** No tests exist

### State Management Stores
- **Files:** [`src/store/entityStore.js`](src/store/entityStore.js), [`src/store/characterProfileStore.js`](src/store/characterProfileStore.js), [`src/store/moduleConfigStore.js`](src/store/moduleConfigStore.js)
- **Why fragile:** Similar patterns repeated, error handling inconsistent
- **Safe modification:** Extract common patterns to base store utilities
- **Test coverage:** No tests exist

### Validation Rules
- **Files:** [`src/utils/validationRules.js`](src/utils/validationRules.js) - 473 lines
- **Why fragile:** Large file with complex validation logic, hard to modify safely
- **Safe modification:** Add unit tests, break into smaller modules
- **Test coverage:** No tests exist

---

## Scaling Limits

### No Pagination
- **Current capacity:** All entities, collections, documents loaded at once
- **Limit:** Memory issues with large datasets
- **Scaling path:** Implement pagination in API calls and UI

### No Offline Support
- **Current capacity:** Fully online application
- **Limit:** No functionality without network
- **Scaling path:** Add service worker for offline capability

### Single API Endpoint
- **Current capacity:** One backend connection
- **Limit:** Cannot scale to multiple servers
- **Scaling path:** Add connection pooling or load balancing

---

## Dependencies at Risk

### Alpha/Very Early Version Dependencies
- **Package:** `@uiw/react-json-view` - version 2.0.0-alpha.34
- **Risk:** Alpha software may have breaking changes, bugs, or be abandoned
- **Impact:** UI component for JSON display may break
- **Migration plan:** Monitor for stable release, consider alternatives

### Large Unused Dependencies
- **Package:** `plotly.js` (3.1.0) - ~3MB minified
- **Risk:** Large bundle size, only used in simulator charts
- **Impact:** Slower initial load time
- **Migration plan:** Use lighter charting library or lazy load

### Custom Speech Package
- **Package:** `@harmony-ai/harmonyspeech` - version 0.1.1
- **Risk:** Very early version, may have limited support
- **Impact:** Speech engine integration may break
- **Migration plan:** Monitor updates, ensure backward compatibility

---

## Missing Critical Features

### No Error Boundaries
- **Problem:** React error boundaries not implemented
- **Impact:** Entire app crashes on component errors
- **Priority:** High

### No Loading States
- **Problem:** Many components lack loading indicators
- **Impact:** Poor UX during async operations
- **Priority:** Medium

### No Form Validation Library
- **Problem:** Custom validation in `validationRules.js` without library
- **Impact:** Inconsistent validation, harder to maintain
- **Priority:** Medium

### No Accessibility Features
- **Problem:** Limited ARIA labels, keyboard navigation
- **Impact:** Not usable by screen readers
- **Priority:** Medium

---

## Test Coverage Gaps

### No Unit Tests
- **What's not tested:** All business logic, utilities, stores
- **Files:** Entire [`src/`](src) directory
- **Risk:** Bugs in critical paths go undetected
- **Priority:** High

### No Integration Tests
- **What's not tested:** Service layer, API communication
- **Files:** [`src/services/`](src/services)
- **Risk:** API changes break frontend silently
- **Priority:** High

### No E2E Tests
- **What's not tested:** User flows, critical paths
- **Risk:** User-facing bugs in production
- **Priority:** High

### No Component Tests
- **What's not tested:** UI components, rendering logic
- **Files:** [`src/components/`](src/components)
- **Risk:** UI regressions undetected
- **Priority:** High

---

*Concerns audit: 2026-02-28*