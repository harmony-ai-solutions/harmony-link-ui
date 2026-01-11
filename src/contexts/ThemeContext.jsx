import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentTheme, setCurrentTheme as apiSetCurrentTheme } from '../services/management/themeService';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

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
        root.style.setProperty('--color-accent-primary-hover', colors.accent.primaryHover);
        root.style.setProperty('--color-accent-secondary', colors.accent.secondary);
        root.style.setProperty('--color-accent-secondary-hover', colors.accent.secondaryHover);

        // Status
        root.style.setProperty('--color-success', colors.status.success);
        root.style.setProperty('--color-success-bg', colors.status.successBg);
        root.style.setProperty('--color-warning', colors.status.warning);
        root.style.setProperty('--color-warning-bg', colors.status.warningBg);
        root.style.setProperty('--color-error', colors.status.error);
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
            // Dynamic Generation Bridge: 
            // If the theme doesn't provide nuances, we derive them from the primary accent 
            // to ensure they "change with the style changes" as requested.
            const primary = colors.accent.primary;

            // We'll use color-mix in CSS to vary these if needed, 
            // but for now setting them to primary ensures they are at least themed.
            root.style.setProperty('--color-nuance-general', primary);
            root.style.setProperty('--color-nuance-entities', colors.accent.secondary || primary);
            root.style.setProperty('--color-nuance-modules', primary);
            root.style.setProperty('--color-nuance-characters', primary);
            root.style.setProperty('--color-nuance-integrations', primary);
            root.style.setProperty('--color-nuance-simulator', colors.accent.secondary || primary);
            root.style.setProperty('--color-nuance-development', primary);
        }
    };

    const loadTheme = async () => {
        try {
            const { themeId, theme } = await getCurrentTheme();
            setCurrentThemeState(themeId);
            setThemeConfig(theme);
            applyTheme(theme);
        } catch (error) {
            console.error('Failed to load theme:', error);
            // Fallback to Midnight Rose if failed
            const fallbackTheme = {
                colors: {
                    background: { base: '#0f172a', surface: '#1e293b', elevated: '#334155', hover: '#475569' },
                    accent: { primary: '#ec4899', primaryHover: '#f472b6', secondary: '#a78bfa', secondaryHover: '#c4b5fd' },
                    status: { success: '#10b981', successBg: 'rgba(16, 185, 129, 0.1)', warning: '#f59e0b', warningBg: 'rgba(245, 158, 11, 0.1)', error: '#ef4444', errorBg: 'rgba(239, 68, 68, 0.1)', info: '#3b82f6', infoBg: 'rgba(59, 130, 246, 0.1)' },
                    text: { primary: '#f1f5f9', secondary: '#cbd5e1', muted: '#94a3b8', disabled: '#64748b' },
                    border: { default: '#334155', focus: '#ec4899', hover: '#475569' },
                    gradients: { primary: 'linear-gradient(135deg, #ec4899 0%, #a78bfa 100%)', secondary: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', surface: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(167, 139, 250, 0.05) 100%)' }
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
