import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useI18nContext } from '../../contexts/I18nContext.jsx';
import { SUPPORTED_LANGUAGES, LANGUAGE_MAP } from '../../i18n/i18n.js';
import FlagIcon from './FlagIcon.jsx';
import { GlobeIcon, CheckIcon, ChevronDownIcon } from '../../constants/icons.jsx';

/**
 * Language picker for the top navigation bar.
 * Glassmorphic trigger button matching `.nav-help-btn`, with a portaled
 * dropdown menu listing all supported languages (flag + native name).
 */
export default function LanguagePicker({ className = '' }) {
    const { t } = useTranslation();
    const { changeLanguage, currentLanguage } = useI18nContext();
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState(null);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);

    const currentLang = LANGUAGE_MAP[currentLanguage] || LANGUAGE_MAP.en;

    // Keep the anchor rect fresh while the menu is open (handles nav becoming
    // sticky, viewport resizes, etc.) so the menu stays glued to the trigger.
    const updateAnchor = useCallback(() => {
        if (open && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setAnchor({ top: r.bottom + 8, left: r.left, width: r.width });
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            updateAnchor();
            window.addEventListener('resize', updateAnchor);
            window.addEventListener('scroll', updateAnchor, true);
            // Close on outside click / Escape
            const onPointerDown = (e) => {
                if (menuRef.current && menuRef.current.contains(e.target)) return;
                if (triggerRef.current && triggerRef.current.contains(e.target)) return;
                setOpen(false);
            };
            const onKeyDown = (e) => {
                if (e.key === 'Escape') setOpen(false);
            };
            document.addEventListener('pointerdown', onPointerDown);
            document.addEventListener('keydown', onKeyDown);
            return () => {
                window.removeEventListener('resize', updateAnchor);
                window.removeEventListener('scroll', updateAnchor, true);
                document.removeEventListener('pointerdown', onPointerDown);
                document.removeEventListener('keydown', onKeyDown);
            };
        }
        return undefined;
    }, [open, updateAnchor]);

    const handleSelect = (value) => {
        changeLanguage(value);
        setOpen(false);
        triggerRef.current?.focus();
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-tutorial-id="nav-language-picker"
                className={`nav-help-btn nav-lang-btn ${open ? 'nav-lang-btn-active' : ''} ${className}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={t('nav.language')}
                title={t('nav.language')}
            >
                <GlobeIcon className="nav-lang-icon w-4 h-4" />
                <FlagIcon code={currentLang.flag} className="nav-lang-flag w-6 h-4" />
                <span className="nav-lang-code">{currentLang.value.toUpperCase()}</span>
                <ChevronDownIcon className={`nav-lang-chevron w-3.5 h-3.5 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        aria-label="Language"
                        className="nav-lang-menu"
                        style={{
                            top: anchor ? anchor.top : 0,
                            left: anchor ? Math.max(8, anchor.left - 96) : 0,
                            minWidth: anchor ? Math.max(anchor.width, 216) : 216,
                        }}
                    >
                        {SUPPORTED_LANGUAGES.map((lang) => {
                            const isActive = lang.value === currentLang.value;
                            return (
                                <button
                                    key={lang.value}
                                    role="option"
                                    aria-selected={isActive}
                                    type="button"
                                    className={`nav-lang-item ${isActive ? 'nav-lang-item-active' : ''}`}
                                    onClick={() => handleSelect(lang.value)}
                                >
                                    <span className="nav-lang-item-flag">
                                        <FlagIcon code={lang.flag} className="w-6 h-4" />
                                    </span>
                                    <span className="nav-lang-item-name">{lang.nativeName}</span>
                                    {isActive && <CheckIcon className="nav-lang-item-check w-3.5 h-3.5" />}
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </>
    );
}
