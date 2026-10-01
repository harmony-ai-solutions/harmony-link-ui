import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig, updateConfig, getAppName, getAppVersion } from "./services/management/configService.js";
import EntitySettingsView from "./components/EntitySettingsView.jsx";
import GeneralSettingsView from "./components/GeneralSettingsView.jsx";
import DevelopmentView from "./components/DevelopmentView.jsx";
import IntegrationsView from "./components/IntegrationsView.jsx";
import SimulatorView from "./components/SimulatorView.jsx";
import CharacterProfilesView from "./components/characters/CharacterProfilesView.jsx";
import PersonasView from "./components/personas/PersonasView.jsx";
import ModuleConfigurationsView from "./components/ModuleConfigurationsView.jsx";
import DynamicBackground from "./components/DynamicBackground.jsx";
import { SettingsGearIcon, UsersIcon, PuzzleIcon, RobotIcon, LinkIcon, SimulatorIcon, TerminalIcon, SmileIcon, ChevronRightIcon, MessageIcon } from './constants/icons.jsx';
import DeviceApprovalModal from "./components/modals/DeviceApprovalModal.jsx";
import DeviceManagementView from "./components/sync/DeviceManagementView.jsx";
import { deviceApprovalWatcher } from "./services/sync/deviceApprovalWatcher.js";
import { SettingsTabMain, SettingsTabChat, SettingsTabGeneral, SettingsTabEntities, SettingsTabPersonas, SettingsTabCharacters, SettingsTabModules, SettingsTabDevelopment, SettingsTabIntegrations, SettingsTabSimulator } from './constants.jsx'
import { LogDebug, LogError, LogPrint } from "./utils/logger.js";
import useDynamicBackgroundStore from "./store/dynamicBackgroundStore.js";
import useUIModeStore, { isModeAllowed } from "./store/uiModeStore.js";
import ChatView from "./components/chat/ChatView.jsx";
import TutorialController from './components/tutorial/TutorialController.jsx';
import useTutorialStore from './store/tutorialStore';
import { I18nProvider } from './contexts/I18nContext.jsx';
import { useTheme } from './contexts/ThemeContext';
import LanguagePicker from './components/icons/LanguagePicker.jsx';
import Tooltip from './components/ui/Tooltip.jsx';

/**
 * Left sidebar rail — the primary navigation.
 *
 * Desktop-app layout (VS Code / Discord style): a fixed vertical rail of
 * always-visible sections grouped under labelled headers. Replaces the old
 * grouped-dropdown pill dock, which hid destinations behind menus.
 *
 * - Collapsible to a compact icon-only rail (state persisted to localStorage).
 * - Auto-collapses to the icon rail on narrow viewports (see CSS @media).
 * - Preserves the tutorial anchors `data-tutorial-id="nav-group-*"` /
 *   `"nav-tab-*"` that the onboarding tour targets.
 */
function SidebarNav({ groups, settingsTab, onSelect, collapsed, onToggleCollapse }) {
    const { t } = useTranslation();

    return (
        <aside
            className={`app-sidebar ${collapsed ? 'app-sidebar-collapsed' : ''}`}
            aria-label={t('nav.primaryNavigation')}
        >
            <div className="app-sidebar-scroll">
                {groups.map((group) => (
                    <div
                        key={group.id}
                        className={`app-sidebar-group ${group.primary ? 'app-sidebar-group-primary' : ''}`}
                        data-tutorial-id={`nav-group-${group.id}`}
                    >
                        {group.label && <div className="app-sidebar-group-label">{group.label}</div>}
                        <div className="app-sidebar-group-items">
                            {group.tabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = settingsTab === tab.id;
                                return (
                                    <Tooltip key={tab.id} content={tab.label} placement="right" disabled={!collapsed}>
                                        <button
                                            type="button"
                                            data-tutorial-id={`nav-tab-${tab.id}`}
                                            onClick={() => onSelect(tab.id)}
                                            className={`app-sidebar-item ${active ? 'app-sidebar-item-active' : ''}`}
                                            aria-current={active ? 'page' : undefined}
                                        >
                                            <span className="app-sidebar-item-icon">
                                                <Icon className="w-4 h-4" />
                                            </span>
                                            <span className="app-sidebar-item-label">{tab.label}</span>
                                        </button>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <Tooltip content={collapsed ? t('nav.expand') : t('nav.collapse')} placement="right" disabled={!collapsed}>
                <button
                    type="button"
                    className="app-sidebar-toggle"
                    onClick={onToggleCollapse}
                    aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
                    aria-expanded={!collapsed}
                >
                    <ChevronRightIcon className={`app-sidebar-toggle-icon w-4 h-4 ${collapsed ? '' : 'app-sidebar-toggle-icon-flip'}`} />
                    <span className="app-sidebar-toggle-label">{t('nav.collapse')}</span>
                </button>
            </Tooltip>
        </aside>
    );
}

/**
 * Inner component that has access to the useTranslation hook.
 * Separated so I18nProvider sits above it in the tree.
 */
function HarmonyLinkAppInner() {
    const { t } = useTranslation();
    const { currentTheme, toggleDarkLight } = useTheme();

    const [appName, setAppName] = useState('Harmony Link');
    const [appVersion, setAppVersion] = useState('v0.2.0-dev');
    const [settingsTab, setSettingsTab] = useState(SettingsTabChat);

    // Progressive-disclosure UI mode (simple / pro / dev). Mirrors
    // config.general.uimode so the menu can react instantly.
    const [uiMode, setUiMode] = useState(() => useUIModeStore.getState().mode);
    useEffect(() => useUIModeStore.subscribe((state) => setUiMode(state.mode)), []);

    // Main Config reference
    const [applicationConfig, setApplicationConfig] = useState(null);

    // Sidebar rail collapse state (persisted across sessions)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('hl.sidebar.collapsed') === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('hl.sidebar.collapsed', sidebarCollapsed ? '1' : '0');
        } catch {
            /* localStorage unavailable — non-fatal */
        }
    }, [sidebarCollapsed]);

    // Device approval state
    const [pendingDevices, setPendingDevices] = useState([]);
    const [currentDevice, setCurrentDevice] = useState(null);

    // Save Functions
    const saveGeneralSettings = (newGeneralSettings, createBackup = true) => {
        // Create transfer objects
        const newCompleteSettings = { ...applicationConfig, general: newGeneralSettings };
        // Update base config
        //LogDebug(JSON.stringify(newCompleteSettings));
        updateConfig(newCompleteSettings, createBackup)
            .then(() => LogDebug("Successfully Updated General Settings"))
            .catch((onError) => {
                LogError("Unable to Update General Settings");
                LogError(onError);
            });
        setApplicationConfig(newCompleteSettings);
    }
    const saveEntitySettings = (newEntitySettings, createBackup = true) => {
        // Create transfer objects
        const newCompleteSettings = { ...applicationConfig, entities: newEntitySettings };
        // Update base config
        //LogDebug(JSON.stringify(newCompleteSettings));
        updateConfig(newCompleteSettings, createBackup)
            .then(() => LogDebug("Successfully Updated Entity Settings"))
            .catch((onError) => {
                LogError("Unable to Update Entity Settings");
                LogError(onError);
            });
        setApplicationConfig(newCompleteSettings);
    }

    const handleRestartTutorial = () => {
        useTutorialStore.getState().resetTutorial();
        setTimeout(() => {
            useTutorialStore.getState().startTutorial();
        }, 300);
    };

    // 2-4: "Create persona from this card" — the Characters tab performs the
    // full-copy create (duplicate profile → persona entity → alias sync) and
    // stashes the new persona id in the persona store; this callback just flips
    // to the Personas tab, whose editor then opens on the new persona.
    const handleCreatePersonaFromCard = () => {
        setSettingsTab(SettingsTabPersonas);
    };

    // "Create AI entity from this card" — the Characters tab links the profile
    // LIVE to a new AI entity (no card copy), refreshes the entity list and
    // preselects it in the entity store; this callback just flips to the
    // Entities tab, where the new entity is already the selection.
    const handleCreateEntityFromCard = () => {
        setSettingsTab(SettingsTabEntities);
    };

    // "Start chatting" on a card — the Characters tab resolves (or creates) the
    // profile's AI partner and stashes a start-chat request in chatStore; this
    // callback just flips to the Chat tab, whose ChatView consumes the request
    // on mount and opens the new conversation.
    const handleStartChatFromCard = () => {
        setSettingsTab(SettingsTabChat);
    };

    // On Application Loaded
    useEffect(() => {
        // Load Config on Start
        try {
            getAppName().then((result) => setAppName(result));
            getAppVersion().then((result) => setAppVersion(result));
            getConfig().then((result) => {
                setApplicationConfig(result);

                // Sync dynamic background store with loaded config
                useDynamicBackgroundStore.getState().syncFromConfig(result);

                // Sync UI mode store with loaded config
                useUIModeStore.getState().syncFromConfig(result);

                // Auto-launch tutorial if not completed.
                // Delay clears the launch splash (min 1.8s + 0.7s exit) so the
                // first tutorial step isn't shown underneath / mid-fade.
                if (!result.general?.skiptutorial) {
                    setTimeout(() => {
                        useTutorialStore.getState().startTutorial();
                    }, 3200);
                }
            });
            LogDebug(JSON.stringify(applicationConfig));
        } catch (error) {
            LogError("Unable to Load Application Config");
            LogError(error);
        }
    }, []);

    // Device approval watcher effect
    useEffect(() => {
        // Start watching for device approval requests
        deviceApprovalWatcher.start();

        // Listen for pending devices
        const handlePendingDevices = (devices) => {
            setPendingDevices(devices);

            // Show modal for first device if not already showing
            if (devices.length > 0 && !currentDevice) {
                setCurrentDevice(devices[0]);
            }
        };

        deviceApprovalWatcher.addListener(handlePendingDevices);

        return () => {
            deviceApprovalWatcher.removeListener(handlePendingDevices);
            deviceApprovalWatcher.stop();
        };
    }, [currentDevice]);

    // Handle device approval
    const handleApproveDevice = async () => {
        if (!currentDevice) return;

        try {
            await deviceApprovalWatcher.approveDevice(currentDevice.device_id);

            // Move to next device or close modal
            const remaining = pendingDevices.filter(d => d.device_id !== currentDevice.device_id);
            setPendingDevices(remaining);
            setCurrentDevice(remaining.length > 0 ? remaining[0] : null);
        } catch (error) {
            LogError('Failed to approve device:', error);
            alert(t('deviceApproval.failed'));
        }
    };

    // Handle device rejection
    const handleRejectDevice = async () => {
        if (!currentDevice) return;

        try {
            await deviceApprovalWatcher.rejectDevice(currentDevice.device_id);

            // Move to next device or close modal
            const remaining = pendingDevices.filter(d => d.device_id !== currentDevice.device_id);
            setPendingDevices(remaining);
            setCurrentDevice(remaining.length > 0 ? remaining[0] : null);
        } catch (error) {
            LogError('Failed to reject device:', error);
            alert(t('deviceApproval.rejected'));
        }
    };

    // Navigation groups — rendered as labelled sections in the left sidebar rail.
    // Every tab declares the lowest UI mode that can see it (`minMode`); the
    // menu is then filtered against the active mode so Simple users only see
    // the essentials, Pro adds power features, and Dev adds the tooling.
    // Kept intentionally flat: a headerless primary item (Chat) at the top, then
    // three clearly-named sections. Fewer headers than destinations avoids the
    // "header repeats the only item" clutter that single-item groups created.
    const allNavGroups = [
        {
            // Primary landing destination — no header, sits above the sections.
            id: 'chat',
            label: null,
            primary: true,
            icon: MessageIcon,
            minMode: 'simple',
            tabs: [
                { id: SettingsTabChat, label: t('nav.tabs.chat'), icon: MessageIcon, minMode: 'simple' },
            ],
        },
        {
            // AI Characters — who the AI is (character cards) and who you are
            // (personas), plus the Pro-only entity that wires a character to AI
            // capabilities.
            id: 'characters',
            label: t('nav.groups.characters'),
            icon: RobotIcon,
            minMode: 'simple',
            tabs: [
                { id: SettingsTabCharacters, label: t('nav.tabs.characters'), icon: RobotIcon, minMode: 'simple' },
                { id: SettingsTabPersonas, label: t('nav.tabs.personas'), icon: SmileIcon, minMode: 'simple' },
                { id: SettingsTabEntities, label: t('nav.tabs.entities'), icon: UsersIcon, minMode: 'pro' },
            ],
        },
        {
            // Settings — app preferences first, then the Pro-only screens that
            // connect and manage the AI services.
            id: 'settings',
            label: t('nav.groups.settings'),
            icon: SettingsGearIcon,
            minMode: 'simple',
            tabs: [
                { id: SettingsTabGeneral, label: t('nav.tabs.general'), icon: SettingsGearIcon, minMode: 'simple' },
                { id: SettingsTabModules, label: t('nav.tabs.modules'), icon: PuzzleIcon, minMode: 'pro' },
                { id: SettingsTabIntegrations, label: t('nav.tabs.integrations'), icon: LinkIcon, minMode: 'pro' },
            ],
        },
        {
            id: 'developer',
            label: t('nav.groups.developer'),
            icon: SimulatorIcon,
            minMode: 'dev',
            tabs: [
                { id: SettingsTabSimulator, label: t('nav.tabs.simulator'), icon: SimulatorIcon, minMode: 'dev' },
                { id: SettingsTabDevelopment, label: t('nav.tabs.dev'), icon: TerminalIcon, minMode: 'dev' },
            ],
        },
    ];

    const navGroups = useMemo(
        () => allNavGroups
            .map((group) => ({
                ...group,
                tabs: group.tabs.filter((tab) => isModeAllowed(uiMode, tab.minMode)),
            }))
            .filter((group) => group.tabs.length > 0),
        [uiMode, t],
    );

    // Downgrade safety — if the active tab is no longer visible in the current
    // mode (e.g. the user switched Pro → Simple while on a hidden tab), move to
    // the Chat landing screen rather than leaving a blank panel.
    useEffect(() => {
        const visibleTabs = navGroups.flatMap((group) => group.tabs.map((tab) => tab.id));
        if (!visibleTabs.includes(settingsTab)) {
            setSettingsTab(SettingsTabChat);
        }
    }, [navGroups, settingsTab]);

    return (
        <>
            {/* Theme-adaptive dynamic background — controlled by Zustand store for instant toggle */}
            <DynamicBackground />

            <div id="App" className="app-shell relative z-[1] text-text-primary selection:bg-accent-primary/20">
            {/* Top Bar — brand + global actions (navigation now lives in the left rail).
                Fixed via CSS (.nav-glass-bar) so it stays pinned while content scrolls. */}
            <nav className="nav-glass-bar">
                {/* Top-edge glass light catch */}
                <div className="nav-top-edge" />

                <div className="nav-inner relative flex items-center h-full px-6 max-w-[1920px] mx-auto">
                    {/* Brand — fixed left */}
                    <div className="flex items-center gap-4 flex-shrink-0 z-10">
                        {/* Brand logo dot — small glowing accent orb */}
                        <div className="relative flex-shrink-0 mr-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-primary shadow-[0_0_10px_var(--color-glow-accent-soft),0_0_24px_var(--color-glow-accent-strong)] animate-[nav-glow-pulse_3s_var(--ease-spring)_infinite]" />
                            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-gradient-primary blur-[6px] opacity-60 animate-[nav-glow-pulse_3s_var(--ease-spring)_infinite_0.5s]" />
                        </div>
                        <div className="flex items-baseline gap-1.5 leading-none">
                            <span className="nav-brand-text text-base font-black tracking-[0.15em] text-gradient-primary uppercase select-none">{t('nav.brand')}</span>
                            <span className="nav-brand-sub text-[10px] font-bold tracking-[0.18em] text-text-muted opacity-60 uppercase select-none">{t('nav.brandSub')}</span>
                        </div>
                    </div>

                    {/* Action buttons — fixed right */}
                    <div className="flex items-center gap-4 flex-shrink-0 ml-auto z-10">
                        {/* Language Picker */}
                        <LanguagePicker />

                        {/* Dark/Light Theme Toggle */}
                        <Tooltip content={currentTheme === 'soulbits-light' ? t('nav.darkMode') : t('nav.lightMode')} placement="bottom">
                            <button
                                className="nav-help-btn"
                                onClick={toggleDarkLight}
                                aria-label={currentTheme === 'soulbits-light' ? t('nav.darkMode') : t('nav.lightMode')}
                            >
                                {currentTheme === 'soulbits-light' ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                )}
                            </button>
                        </Tooltip>
                        <Tooltip content={t('nav.help')} placement="bottom">
                            <button
                                data-tutorial-id="tutorial-restart-btn"
                                className="nav-help-btn"
                                onClick={handleRestartTutorial}
                                aria-label="Help"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </nav>

            {/* Body — left sidebar rail + main content column */}
            <div className="app-body">
                <SidebarNav
                    groups={navGroups}
                    settingsTab={settingsTab}
                    onSelect={setSettingsTab}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                />

                <main className="app-main">
                    <div className="app-content">
                        {/* Render guards: a view only renders when its tab is
                            permitted in the current mode, so hidden tabs can
                            never appear (defence-in-depth alongside the menu filter). */}
                        {settingsTab === SettingsTabChat &&
                            <ChatView onNavigate={setSettingsTab} />
                        }
                        {applicationConfig && settingsTab === SettingsTabGeneral &&
                            <GeneralSettingsView 
                                generalSettings={applicationConfig.general} 
                                saveGeneralSettings={saveGeneralSettings}
                            ></GeneralSettingsView>
                        }
                        {applicationConfig && isModeAllowed(uiMode, 'pro') && settingsTab === SettingsTabEntities &&
                            <EntitySettingsView appName={appName}></EntitySettingsView>
                        }
                        {isModeAllowed(uiMode, 'simple') && settingsTab === SettingsTabCharacters &&
                            <CharacterProfilesView onCreatePersonaFromCard={handleCreatePersonaFromCard}
                                onCreateEntityFromCard={handleCreateEntityFromCard}
                                onStartChatFromCard={handleStartChatFromCard}></CharacterProfilesView>
                        }
                        {isModeAllowed(uiMode, 'simple') && settingsTab === SettingsTabPersonas &&
                            <PersonasView></PersonasView>
                        }
                        {isModeAllowed(uiMode, 'pro') && settingsTab === SettingsTabModules &&
                            <ModuleConfigurationsView></ModuleConfigurationsView>
                        }
                        {isModeAllowed(uiMode, 'dev') && settingsTab === SettingsTabDevelopment &&
                            <DevelopmentView></DevelopmentView>
                        }
                        {isModeAllowed(uiMode, 'pro') && settingsTab === SettingsTabIntegrations &&
                            <IntegrationsView></IntegrationsView>
                        }
                        {isModeAllowed(uiMode, 'dev') && settingsTab === SettingsTabSimulator &&
                            <SimulatorView></SimulatorView>
                        }
                    </div>

                    <footer className="app-footer">
                        <a href="https://project-harmony.ai/technology/" target="_blank" rel="noreferrer">
                            {appName} {appVersion} - {t('footer.copyright')}
                        </a>
                    </footer>
                </main>
            </div>

            {/* Tutorial Controller */}
            <TutorialController setSettingsTab={setSettingsTab} settingsTab={settingsTab} />

            {/* Device Approval Modal */}
            <DeviceApprovalModal
                device={currentDevice}
                onApprove={handleApproveDevice}
                onReject={handleRejectDevice}
                show={currentDevice !== null}
            />
            </div>
        </>
    );
}

function HarmonyLinkApp() {
    const [appLanguage, setAppLanguage] = useState(null);

    // Load language from config on mount
    useEffect(() => {
        getConfig().then((config) => {
            if (config?.general?.applanguage) {
                setAppLanguage(config.general.applanguage);
            }
        }).catch(() => {
            // Use default - i18n will fall back to browser detection
        });
    }, []);

    const handleLanguageChange = (lang) => {
        setAppLanguage(lang);
        // Persist to app config
        getConfig().then((config) => {
            const updated = {
                ...config,
                general: { ...config.general, applanguage: lang },
            };
            updateConfig(updated, false)
                .then(() => LogDebug(`Language changed to: ${lang}`))
                .catch((err) => LogError(`Failed to persist language: ${err}`));
        }).catch(() => {});
    };

    return (
        <I18nProvider appLanguage={appLanguage} onLanguageChange={handleLanguageChange}>
            <HarmonyLinkAppInner />
        </I18nProvider>
    );
}

export default HarmonyLinkApp
