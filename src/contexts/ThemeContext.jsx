import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentTheme, setCurrentTheme as apiSetCurrentTheme } from '../services/management/themeService';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// Converts a #rrggbb hex colour to an "r, g, b" string for use in rgba().
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '0, 0, 0';
};

// Derive glassmorphism tokens from the core theme colors.
// This means ALL existing themes get glassmorphism for free — no backend changes needed.
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

    // ── Glass Background Tokens ──────────────────────────────────────────
    root.style.setProperty('--color-background-glass', `rgba(${hexToRgb(bgBase)}, 0.4)`);
    root.style.setProperty('--color-background-surface-translucent', `rgba(${hexToRgb(bgSurface)}, 0.35)`);
    root.style.setProperty('--color-background-nav', `rgba(${hexToRgb(bgBase)}, 0.55)`);
    root.style.setProperty('--color-background-hover-glass', `rgba(${hexToRgb(bgHover)}, 0.45)`);

    // ── Glass Border Tokens ──────────────────────────────────────────────
    root.style.setProperty('--color-border-glass', `rgba(${accentRgb}, 0.12)`);
    root.style.setProperty('--color-border-glow', `rgba(${accentRgb}, 0.35)`);

    // ── Glow Tokens ──────────────────────────────────────────────────────
    root.style.setProperty('--color-glow-accent-soft', `rgba(${accentRgb}, 0.2)`);
    root.style.setProperty('--color-glow-accent-strong', `rgba(${accentRgb}, 0.4)`);

    // ── Shadow Tokens ────────────────────────────────────────────────────
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.35)');
    root.style.setProperty('--shadow-md', '0 6px 18px -4px rgba(0, 0, 0, 0.45)');
    root.style.setProperty('--shadow-lg', '0 14px 40px -8px rgba(0, 0, 0, 0.55)');
    root.style.setProperty('--shadow-xl', '0 28px 60px -12px rgba(0, 0, 0, 0.65)');
    root.style.setProperty('--shadow-glass', '0 8px 32px rgba(0, 0, 0, 0.5)');
    root.style.setProperty('--glow-accent', `0 0 40px -4px rgba(${accentRgb}, 0.45)`);

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

    const applyTheme = (theme) => {
        if (!theme || !theme.colors) return;

        const root = document.documentElement;
        const { colors } = theme;

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

        // ── Derive glassmorphism + radius + shadow tokens ──────────────
        applyDerivedTokens(root, colors);
    };

    const loadTheme = async () => {
        try {
            const { themeId, theme } = await getCurrentTheme();
            setCurrentThemeState(themeId);
            setThemeConfig(theme);
            applyTheme(theme);
        } catch (error) {
            console.error('Failed to load theme:', error);
            // Fallback to SoulBits Dark (portal Haute Goth palette)
            const fallbackTheme = {
                colors: {
                    background: {
                        base: '#0b0f19',
                        surface: '#0f1525',
                        elevated: '#1a1f2e',
                        hover: '#282f42'
                    },
                    accent: {
                        primary: '#8f3ba7',
                        primaryHover: '#b04fce',
                        secondary: '#22318e',
                        secondaryHover: '#3a3d99'
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
                        primary: '#e8e6f0',
                        secondary: '#c8c3dc',
                        muted: '#8c87a8',
                        disabled: '#5a5578'
                    },
                    border: {
                        default: '#2a2147',
                        focus: '#8f3ba7',
                        hover: '#3a2159',
                        accent: '#8f3ba7'
                    },
                    gradients: {
                        primary: 'linear-gradient(to right, #8f3ba7, #22318e, #2d2370)',
                        secondary: 'linear-gradient(135deg, #0b0f19 0%, #0f1525 100%)',
                        surface: 'linear-gradient(135deg, rgba(143, 59, 167, 0.08) 0%, rgba(34, 49, 142, 0.08) 100%)'
                    }
                }
            };
            applyTheme(fallbackTheme);
        } finally {
            setLoading(false);
        }
    };

    const switchTheme = async (themeId) => {
        try {
            await apiSetCurrentTheme(themeId);
            await loadTheme();
        } catch (error) {
            console.error('Failed to switch theme:', error);
        }
    };

    useEffect(() => {
        loadTheme();
    }, []);

    return (
        <ThemeContext.Provider value={{ currentTheme, themeConfig, switchTheme, loading }}>
            {!loading && children}
        </ThemeContext.Provider>
    );
};
