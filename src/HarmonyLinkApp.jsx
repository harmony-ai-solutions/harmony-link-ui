import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
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
import { SettingsGearIcon, UsersIcon, PuzzleIcon, RobotIcon, LinkIcon, SimulatorIcon, TerminalIcon, SmileIcon, ChevronDownIcon, CheckIcon } from './constants/icons.jsx';
import DeviceApprovalModal from "./components/modals/DeviceApprovalModal.jsx";
import DeviceManagementView from "./components/sync/DeviceManagementView.jsx";
import { deviceApprovalWatcher } from "./services/sync/deviceApprovalWatcher.js";
import { SettingsTabMain, SettingsTabGeneral, SettingsTabEntities, SettingsTabPersonas, SettingsTabCharacters, SettingsTabModules, SettingsTabDevelopment, SettingsTabIntegrations, SettingsTabSimulator } from './constants.jsx'
import { LogDebug, LogError, LogPrint } from "./utils/logger.js";
import useDynamicBackgroundStore from "./store/dynamicBackgroundStore.js";
import TutorialController from './components/tutorial/TutorialController.jsx';
import useTutorialStore from './store/tutorialStore';
import { I18nProvider } from './contexts/I18nContext.jsx';
import { useTheme } from './contexts/ThemeContext';
import LanguagePicker from './components/icons/LanguagePicker.jsx';

/**
 * A single grouped navigation dropdown trigger + panel.
 *
 * Variant C: replaces the flat 8-pill dock with grouped dropdown menus.
 * - Trigger is styled like the existing `.nav-pill`; its label follows
 *   "show the active tab if one in this group is active, else the group label".
 * - Panel is a Headless UI Menu portaled to <body> (via `anchor`, which forces
 *   `portal`) so `.nav-glass-bar { overflow: hidden }` never clips it.
 */
function NavGroupMenu({ group, settingsTab, onSelect }) {
    const activeTabInGroup = group.tabs.find((tab) => tab.id === settingsTab) || null;
    const triggerLabel = activeTabInGroup ? activeTabInGroup.label : group.label;
    const TriggerIcon = activeTabInGroup ? activeTabInGroup.icon : group.icon;
    const isActive = activeTabInGroup !== null;

    return (
        <Menu>
            <MenuButton
                data-tutorial-id={`nav-group-${group.id}`}
                className={`nav-pill ${isActive ? 'nav-pill-active' : ''}`}
            >
                <span className="nav-pill-icon">
                    <TriggerIcon className="w-4 h-4" />
                </span>
                <span className="nav-pill-label">{triggerLabel}</span>
                <ChevronDownIcon className="nav-pill-caret w-3.5 h-3.5" />
                {isActive && <span className="nav-pill-glow" />}
            </MenuButton>

            <MenuItems
                anchor={{ to: 'bottom start', gap: 8 }}
                modal={false}
                className="nav-menu-panel"
            >
                {group.tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const tabActive = settingsTab === tab.id;
                    return (
                        <MenuItem key={tab.id}>
                            {({ focus }) => (
                                <button
                                    type="button"
                                    data-tutorial-id={`nav-tab-${tab.id}`}
                                    onClick={() => onSelect(tab.id)}
                                    className={`nav-menu-item ${tabActive ? 'nav-menu-item-active' : ''} ${focus ? 'nav-menu-item-focus' : ''}`}
                                >
                                    <span className="nav-menu-item-icon">
                                        <TabIcon className="w-4 h-4" />
                                    </span>
                                    <span className="nav-menu-item-label">{tab.label}</span>
                                    {tabActive && (
                                        <span className="nav-menu-item-indicator">
                                            <CheckIcon className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                </button>
                            )}
                        </MenuItem>
                    );
                })}
            </MenuItems>
        </Menu>
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
    const [settingsTab, setSettingsTab] = useState(SettingsTabCharacters);

    // Main Config reference
    const [applicationConfig, setApplicationConfig] = useState(null);

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

                // Auto-launch tutorial if not completed
                if (!result.general?.skiptutorial) {
                    setTimeout(() => {
                        useTutorialStore.getState().startTutorial();
                    }, 1500);
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

    // Tab definitions — grouped into 3 dropdown menus (Variant C)
    const navGroups = [
        {
            id: 'identity',
            label: t('nav.groups.identity'),
            icon: RobotIcon,
            tabs: [
                { id: SettingsTabCharacters, label: t('nav.tabs.characters'), icon: RobotIcon },
                { id: SettingsTabPersonas, label: t('nav.tabs.personas'), icon: SmileIcon },
                { id: SettingsTabEntities, label: t('nav.tabs.entities'), icon: UsersIcon },
            ],
        },
        {
            id: 'system',
            label: t('nav.groups.system'),
            icon: SettingsGearIcon,
            tabs: [
                { id: SettingsTabGeneral, label: t('nav.tabs.general'), icon: SettingsGearIcon },
                { id: SettingsTabModules, label: t('nav.tabs.modules'), icon: PuzzleIcon },
                { id: SettingsTabIntegrations, label: t('nav.tabs.integrations'), icon: LinkIcon },
            ],
        },
        {
            id: 'tools',
            label: t('nav.groups.tools'),
            icon: SimulatorIcon,
            tabs: [
                { id: SettingsTabSimulator, label: t('nav.tabs.simulator'), icon: SimulatorIcon },
                { id: SettingsTabDevelopment, label: t('nav.tabs.dev'), icon: TerminalIcon },
            ],
        },
    ];

    return (
        <>
            {/* Theme-adaptive dynamic background — controlled by Zustand store for instant toggle */}
            <DynamicBackground />

            <div id="App" className="relative z-[1] min-h-screen text-text-primary selection:bg-accent-primary/20">
            {/* Top Navigation Bar — Ultra Glassmorphic Floating Dock */}
            <nav className="sticky top-0 z-50 nav-glass-bar">
                {/* Top-edge glass light catch */}
                <div className="nav-top-edge" />

                <div className="nav-inner relative flex items-center h-full px-8 max-w-[1920px] mx-auto">
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

                    {/* Left flex spacer — shrinks before zones, centers pill dock when space allows */}
                    <div className="flex-1 min-w-0" />

                    {/* Grouped Dropdown Dock — 3 menus instead of 8 pills */}
                    <div className="nav-pill-dock z-0">
                        {navGroups.map((group) => (
                            <NavGroupMenu
                                key={group.id}
                                group={group}
                                settingsTab={settingsTab}
                                onSelect={setSettingsTab}
                            />
                        ))}
                    </div>

                    {/* Right flex spacer */}
                    <div className="flex-1 min-w-0" />

                    {/* Action buttons — fixed right */}
                    <div className="flex items-center gap-4 flex-shrink-0 z-10">
                        {/* Language Picker */}
                        <LanguagePicker />

                        {/* Dark/Light Theme Toggle */}
                        <button
                            className="nav-help-btn"
                            onClick={toggleDarkLight}
                            title={currentTheme === 'soulbits-light' ? t('nav.darkMode') : t('nav.lightMode')}
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
                        <button
                            data-tutorial-id="tutorial-restart-btn"
                            className="nav-help-btn"
                            onClick={handleRestartTutorial}
                            title={t('nav.help')}
                            aria-label="Help"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>

            <div className="flex-1 min-h-[calc(100vh-6rem)]">
                {applicationConfig && settingsTab === SettingsTabGeneral &&
                    <GeneralSettingsView 
                        generalSettings={applicationConfig.general} 
                        saveGeneralSettings={saveGeneralSettings}
                    ></GeneralSettingsView>
                }
                {applicationConfig && settingsTab === SettingsTabEntities &&
                    <EntitySettingsView appName={appName}></EntitySettingsView>
                }
                {settingsTab === SettingsTabCharacters &&
                    <CharacterProfilesView onCreatePersonaFromCard={handleCreatePersonaFromCard}
                        onCreateEntityFromCard={handleCreateEntityFromCard}></CharacterProfilesView>
                }
                {settingsTab === SettingsTabPersonas &&
                    <PersonasView></PersonasView>
                }
                {settingsTab === SettingsTabModules &&
                    <ModuleConfigurationsView></ModuleConfigurationsView>
                }
                {settingsTab === SettingsTabDevelopment &&
                    <DevelopmentView></DevelopmentView>
                }
                {settingsTab === SettingsTabIntegrations &&
                    <IntegrationsView></IntegrationsView>
                }
                {settingsTab === SettingsTabSimulator &&
                    <SimulatorView></SimulatorView>
                }
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

            <footer className="flex items-center justify-center bg-background-glass backdrop-blur-[20px] saturate-[1.3]">
                <p className="py-2.5 px-4 text-text-muted text-[11px] font-medium tracking-wide">
                    <a href="https://project-harmony.ai/technology/" target="_blank" className="hover:text-accent-primary transition-colors">
                        {appName} {appVersion} - {t('footer.copyright')}
                    </a>
                </p>
            </footer>
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
