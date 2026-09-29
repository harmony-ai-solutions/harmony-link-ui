import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentTheme, setCurrentTheme as apiSetCurrentTheme, listThemes } from '../services/management/themeService';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// Fallback theme (SoulBits Dark — portal Haute Goth palette). Hoisted to module
// scope so it is a stable reference and can be reused by both the initial load
// and the error/rollback paths without being re-created on every render.
const FALLBACK_THEME = {
    colors: {
        background: {
            base: '#0b0f19',
            surface: '#0f1525',
            elevated: '#151d30',
            hover: '#1e2842'
        },
        accent: {
            primary: '#b84fd0',
            primaryHover: '#cf6be5',
            secondary: '#4a5fcf',
            secondaryHover: '#6b7de8'
        },
        status: {
            success: '#4caf82',
            successBg: 'rgba(76, 175, 130, 0.12)',
            warning: '#f0a23b',
            warningBg: 'rgba(240, 162, 59, 0.12)',
            error: '#ef5350',
            errorBg: 'rgba(239, 83, 80, 0.12)',
            info: '#4d9bf0',
            infoBg: 'rgba(77, 155, 240, 0.12)'
        },
        text: {
            primary: '#f0edf6',
            secondary: '#d2cde3',
            muted: '#9692b0',
            disabled: '#6b6780'
        },
        border: {
            default: '#2e2355',
            focus: '#b84fd0',
            hover: '#3e2a6b',
            accent: '#b84fd0'
        },
        gradients: {
            primary: 'linear-gradient(to right, #b84fd0, #4a5fcf, #3a2d99)',
            secondary: 'linear-gradient(135deg, #0b0f19 0%, #0f1525 100%)',
            surface: 'linear-gradient(135deg, rgba(184, 79, 208, 0.10) 0%, rgba(74, 95, 207, 0.10) 100%)'
        },
        glass: {
            borderGradientStart: 'rgba(255, 255, 255, 0.45)',
            borderGradientEnd: 'rgba(184, 79, 208, 0.30)'
        }
    }
};

// Number of frames the `data-theme-switching` flag stays on <html>. Two frames
// is enough for the browser to complete the full-document restyle in one clean
// pass before we re-enable transitions.
const THEME_SWITCH_FRAMES = 2;

// Converts a #rrggbb hex colour to an "r, g, b" string for use in rgba().
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '0, 0, 0';
};

// Derive glassmorphism tokens from the core theme colors.
// This means ALL existing themes get glassmorphism for free — no backend changes needed.
// Light themes get near-opaque glass tokens so windows look solid white instead of
// transparent; dark themes keep the original glassmorphism transparency.
const applyDerivedTokens = (root, colors) => {
    const bgBase = colors.background.base;
    const bgSurface = colors.background.surface;
    const bgElevated = colors.background.elevated;
    const bgHover = colors.background.hover;
    const accentPrimary = colors.accent.primary;
    const accentRgb = hexToRgb(accentPrimary);
    const accentSecondary = colors.accent.secondary;
    const accentRgb2 = hexToRgb(accentSecondary);
    const borderDefault = colors.border.default;
    const borderHover = colors.border.hover;
    const statusError = colors.status.error;
    const statusWarning = colors.status.warning;
    const statusSuccess = colors.status.success;
    const statusInfo = colors.status.info;

    // Detect whether the theme is light or dark by measuring luminance of bgBase.
    // Use perceived brightness: Y = 0.299R + 0.587G + 0.114B.  Values > 140 = light.
    const isLight = (() => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgBase);
        if (!m) return false;
        const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
    })();

    // ── Glass Background Tokens ──────────────────────────────────────────
    // Light themes: near-opaque so windows look solid (no see-through ghosting).
    // Dark themes: lower alpha for genuine glassmorphism with backdrop blur.
    if (isLight) {
        root.style.setProperty('--color-background-glass', `rgba(${hexToRgb(bgElevated)}, 0.92)`);
        root.style.setProperty('--color-background-surface-translucent', `rgba(${hexToRgb(bgElevated)}, 0.88)`);
        root.style.setProperty('--color-background-nav', `rgba(${hexToRgb(bgBase)}, 0.90)`);
        root.style.setProperty('--color-background-hover-glass', `rgba(${hexToRgb(bgHover)}, 0.92)`);
    } else {
        root.style.setProperty('--color-background-glass', `rgba(${hexToRgb(bgElevated)}, 0.4)`);
        root.style.setProperty('--color-background-surface-translucent', `rgba(${hexToRgb(bgElevated)}, 0.35)`);
        root.style.setProperty('--color-background-nav', `rgba(${hexToRgb(bgBase)}, 0.55)`);
        root.style.setProperty('--color-background-hover-glass', `rgba(${hexToRgb(bgElevated)}, 0.45)`);
    }

    // ── Glass Border Tokens ──────────────────────────────────────────────
    root.style.setProperty('--color-border-glass', `rgba(${accentRgb}, ${isLight ? 0.18 : 0.12})`);
    root.style.setProperty('--color-border-glow', `rgba(${accentRgb}, 0.35)`);

    // ── Glow Tokens ──────────────────────────────────────────────────────
    root.style.setProperty('--color-glow-accent-soft', `rgba(${accentRgb}, ${isLight ? 0.12 : 0.2})`);
    root.style.setProperty('--color-glow-accent-strong', `rgba(${accentRgb}, ${isLight ? 0.25 : 0.4})`);

    // ── Shadow Tokens ────────────────────────────────────────────────────
    if (isLight) {
        root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0, 0, 0, 0.06)');
        root.style.setProperty('--shadow-md', '0 4px 12px -2px rgba(0, 0, 0, 0.08)');
        root.style.setProperty('--shadow-lg', '0 10px 30px -6px rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--shadow-xl', '0 20px 50px -10px rgba(0, 0, 0, 0.12)');
        root.style.setProperty('--shadow-glass', '0 4px 20px rgba(0, 0, 0, 0.06)');
        root.style.setProperty('--glow-accent', `0 0 40px -4px rgba(${accentRgb}, 0.2)`);
    } else {
        root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.35)');
        root.style.setProperty('--shadow-md', '0 6px 18px -4px rgba(0, 0, 0, 0.45)');
        root.style.setProperty('--shadow-lg', '0 14px 40px -8px rgba(0, 0, 0, 0.55)');
        root.style.setProperty('--shadow-xl', '0 28px 60px -12px rgba(0, 0, 0, 0.65)');
        root.style.setProperty('--shadow-glass', '0 8px 32px rgba(0, 0, 0, 0.5)');
        root.style.setProperty('--glow-accent', `0 0 40px -4px rgba(${accentRgb}, 0.45)`);
    }

    // ── Border Radius Tokens ─────────────────────────────────────────────
    root.style.setProperty('--radius-sm', '0.375rem');
    root.style.setProperty('--radius-md', '0.5rem');
    root.style.setProperty('--radius-lg', '0.75rem');
    root.style.setProperty('--radius-xl', '1rem');
    root.style.setProperty('--radius-full', '9999px');

    // ── Transition Curve (portal's signature ease) ───────────────────────
    root.style.setProperty('--ease-spring', 'cubic-bezier(0.16, 1, 0.3, 1)');
};

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentThemeState] = useState(null);
    const [themeConfig, setThemeConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    // themeId -> full theme object cache. Populated from listThemes() so a theme
    // switch can apply its CSS variables INSTANTLY (no network round-trip) and
    // only then persist to the backend in the background.
    const themeCacheRef = useRef({});

    // Handle for the temporary `.theme-switching` cross-fade class.
    const transitionTimerRef = useRef(null);

    // True once the initial theme has been painted, so the cross-fade only runs
    // on user-initiated switches (never on first load / during the splash).
    const initializedRef = useRef(false);

    const applyTheme = (theme) => {
        if (!theme || !theme.colors) return;

        const root = document.documentElement;
        const { colors } = theme;

        // Expose light/dark mode so CSS can adapt (e.g. dynamic background scenes)
        const isLightMode = (() => {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colors.background.base || '');
            if (!m) return false;
            const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
            return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
        })();
        root.setAttribute('data-theme-mode', isLightMode ? 'light' : 'dark');

        // Backgrounds
        root.style.setProperty('--color-background-base', colors.background.base);
        root.style.setProperty('--color-background-surface', colors.background.surface);
        root.style.setProperty('--color-background-elevated', colors.background.elevated);
        root.style.setProperty('--color-background-hover', colors.background.hover);

        // Accents
        root.style.setProperty('--color-accent-primary', colors.accent.primary);
        root.style.setProperty('--color-accent-primary-rgb', hexToRgb(colors.accent.primary));
        root.style.setProperty('--color-accent-primary-hover', colors.accent.primaryHover);
        root.style.setProperty('--color-accent-secondary', colors.accent.secondary);
        root.style.setProperty('--color-accent-secondary-rgb', hexToRgb(colors.accent.secondary));
        root.style.setProperty('--color-accent-secondary-hover', colors.accent.secondaryHover);

        // Status
        root.style.setProperty('--color-success', colors.status.success);
        root.style.setProperty('--color-success-rgb', hexToRgb(colors.status.success));
        root.style.setProperty('--color-success-bg', colors.status.successBg);
        root.style.setProperty('--color-warning', colors.status.warning);
        root.style.setProperty('--color-warning-bg', colors.status.warningBg);
        root.style.setProperty('--color-error', colors.status.error);
        root.style.setProperty('--color-error-rgb', hexToRgb(colors.status.error));
        root.style.setProperty('--color-error-bg', colors.status.errorBg);
        root.style.setProperty('--color-info', colors.status.info);
        root.style.setProperty('--color-info-bg', colors.status.infoBg);

        // Text
        root.style.setProperty('--color-text-primary', colors.text.primary);
        root.style.setProperty('--color-text-primary-rgb', hexToRgb(colors.text.primary));
        root.style.setProperty('--color-text-secondary', colors.text.secondary);
        root.style.setProperty('--color-text-muted', colors.text.muted);
        root.style.setProperty('--color-text-disabled', colors.text.disabled);

        // Border
        root.style.setProperty('--color-border-default', colors.border.default);
        root.style.setProperty('--color-border-focus', colors.border.focus);
        root.style.setProperty('--color-border-hover', colors.border.hover);
        root.style.setProperty('--color-border-accent', colors.border.accent);

        // Gradients
        root.style.setProperty('--gradient-primary', colors.gradients.primary);
        root.style.setProperty('--gradient-secondary', colors.gradients.secondary);
        root.style.setProperty('--gradient-surface', colors.gradients.surface);

        // Nuances (Tab Colors)
        if (colors.nuances) {
            root.style.setProperty('--color-nuance-general', colors.nuances.general);
            root.style.setProperty('--color-nuance-entities', colors.nuances.entities);
            root.style.setProperty('--color-nuance-modules', colors.nuances.modules);
            root.style.setProperty('--color-nuance-characters', colors.nuances.characters);
            root.style.setProperty('--color-nuance-integrations', colors.nuances.integrations);
            root.style.setProperty('--color-nuance-simulator', colors.nuances.simulator);
            root.style.setProperty('--color-nuance-development', colors.nuances.development);
        } else {
            const primary = colors.accent.primary;
            root.style.setProperty('--color-nuance-general', primary);
            root.style.setProperty('--color-nuance-entities', colors.accent.secondary || primary);
            root.style.setProperty('--color-nuance-modules', primary);
            root.style.setProperty('--color-nuance-characters', primary);
            root.style.setProperty('--color-nuance-integrations', primary);
            root.style.setProperty('--color-nuance-simulator', colors.accent.secondary || primary);
            root.style.setProperty('--color-nuance-development', primary);
        }

        // Glass tokens (official palette overrides; fall back to derived values)
        root.style.setProperty('--color-border-gradient-start', colors.glass?.borderGradientStart || `rgba(255, 255, 255, ${isLightMode ? 0.5 : 0.45})`);
        root.style.setProperty('--color-border-gradient-end', colors.glass?.borderGradientEnd || `rgba(${hexToRgb(colors.accent.primary)}, 0.3)`);

        // ── Derive glassmorphism + radius + shadow tokens ──────────────
        applyDerivedTokens(root, colors);
    };

    // ── Instant-swap helper ──────────────────────────────────────────────
    // Theme changes must be an instant token swap, not a fade. If the swap were
    // left to animate, the components' own 0.3–0.6s hover transitions would
    // make the theme change *itself* animate — which is exactly what reads as
    // "slow and delayed". Instead we set `data-theme-switching` on <html> so the
    // CSS rule in style.css disables ALL transitions for the two frames the
    // swap takes (the theme snaps instantly), then clear the flag on the next
    // frame so normal hover animations are unaffected. This mirrors the
    // proven approach used by the portal.
    const runThemeTransition = () => {
        const root = document.documentElement;
        if (transitionTimerRef.current) {
            cancelAnimationFrame(transitionTimerRef.current);
            transitionTimerRef.current = null;
        }
        root.setAttribute('data-theme-switching', '');
        let remaining = THEME_SWITCH_FRAMES;
        const clear = () => {
            remaining -= 1;
            if (remaining > 0) {
                transitionTimerRef.current = requestAnimationFrame(clear);
            } else {
                root.removeAttribute('data-theme-switching');
                transitionTimerRef.current = null;
            }
        };
        transitionTimerRef.current = requestAnimationFrame(clear);
    };

    // Prime the cache with every available theme so subsequent switches are
    // instant. Runs once, in parallel with the initial theme load.
    const primeThemeCache = useCallback(async () => {
        try {
            const themes = await listThemes();
            if (Array.isArray(themes)) {
                themes.forEach((theme) => {
                    if (theme && theme.id) themeCacheRef.current[theme.id] = theme;
                });
            }
        } catch (error) {
            // Non-fatal: switches simply fall back to fetching the theme.
            console.warn('Failed to prime theme cache:', error);
        }
    }, []);

    // Applies a theme to the DOM + React state. `animate` arms the two-frame
    // instant-swap flag (skipped on first load so the initial paint never
    // flashes). The token writes happen synchronously right after, so the whole
    // document restyles in a single paint.
    const applyThemeInstant = (themeId, theme, animate) => {
        if (!theme || !theme.colors) return;
        if (animate && !document.hidden) runThemeTransition();
        setCurrentThemeState(themeId);
        setThemeConfig(theme);
        applyTheme(theme);
    };

    const loadTheme = async () => {
        try {
            const { themeId, theme } = await getCurrentTheme();
            if (theme && theme.id) themeCacheRef.current[theme.id] = theme;
            setCurrentThemeState(themeId);
            setThemeConfig(theme);
            applyTheme(theme);
        } catch (error) {
            console.error('Failed to load theme:', error);
            // Fallback to SoulBits Dark (portal Haute Goth palette)
            setCurrentThemeState('soulbits-dark');
            setThemeConfig(FALLBACK_THEME);
            applyTheme(FALLBACK_THEME);
        } finally {
            initializedRef.current = true;
            setLoading(false);
        }
    };

    const switchTheme = async (themeId) => {
        if (!themeId || themeId === currentTheme) return;

        const previousThemeId = currentTheme;
        const previousTheme = themeConfig;
        const cached = themeCacheRef.current[themeId];

        // 1) Instant path — paint from cache immediately (no network wait).
        if (cached) {
            applyThemeInstant(themeId, cached, initializedRef.current);
        }

        // 2) Persist + reconcile in the background.
        try {
            await apiSetCurrentTheme(themeId);

            // Cache miss: fetch the theme (cached themes are already painted).
            if (!cached) {
                const { themeId: activeId, theme } = await getCurrentTheme();
                if (theme && theme.id) themeCacheRef.current[theme.id] = theme;
                applyThemeInstant(activeId || themeId, theme, initializedRef.current);
            }
        } catch (error) {
            console.error('Failed to switch theme:', error);
            // Roll back the optimistic paint so UI + backend stay consistent.
            if (cached && previousThemeId && previousTheme) {
                applyThemeInstant(previousThemeId, previousTheme, initializedRef.current);
            }
        }
    };

    const toggleDarkLight = () => {
        // Toggle between the two official themes: soulbits-dark ↔ soulbits-light
        const target = currentTheme === 'soulbits-light' ? 'soulbits-dark' : 'soulbits-light';
        return switchTheme(target);
    };

    useEffect(() => {
        loadTheme();
        primeThemeCache();
        return () => {
            // transitionTimerRef now holds a requestAnimationFrame handle.
            if (transitionTimerRef.current) cancelAnimationFrame(transitionTimerRef.current);
            document.documentElement.removeAttribute('data-theme-switching');
        };
    }, [primeThemeCache]);

    return (
        <ThemeContext.Provider value={{ currentTheme, themeConfig, switchTheme, toggleDarkLight, loading }}>
            {!loading && children}
        </ThemeContext.Provider>
    );
};
