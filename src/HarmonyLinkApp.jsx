import { useState, useEffect } from 'react';
import { getConfig, updateConfig, getAppName, getAppVersion } from "./services/management/configService.js";
import EntitySettingsView from "./components/EntitySettingsView.jsx";
import GeneralSettingsView from "./components/GeneralSettingsView.jsx";
import DevelopmentView from "./components/DevelopmentView.jsx";
import IntegrationsView from "./components/IntegrationsView.jsx";
import SimulatorView from "./components/SimulatorView.jsx";
import CharacterProfilesView from "./components/characters/CharacterProfilesView.jsx";
import ModuleConfigurationsView from "./components/ModuleConfigurationsView.jsx";
import DeviceApprovalModal from "./components/modals/DeviceApprovalModal.jsx";
import DeviceManagementView from "./components/sync/DeviceManagementView.jsx";
import { deviceApprovalWatcher } from "./services/sync/deviceApprovalWatcher.js";
import { SettingsTabMain, SettingsTabGeneral, SettingsTabEntities, SettingsTabCharacters, SettingsTabModules, SettingsTabDevelopment, SettingsTabIntegrations, SettingsTabSimulator } from './constants.jsx'
import { LogDebug, LogError, LogPrint } from "./utils/logger.js";
import TutorialController from './components/tutorial/TutorialController.jsx';
import useTutorialStore from './store/tutorialStore';

function HarmonyLinkApp() {
    const [appName, setAppName] = useState('Harmony Link');
    const [appVersion, setAppVersion] = useState('v0.2.0-dev');
    const [settingsTab, setSettingsTab] = useState(SettingsTabGeneral);

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

    // On Application Loaded
    useEffect(() => {
        // Load Config on Start
        try {
            getAppName().then((result) => setAppName(result));
            getAppVersion().then((result) => setAppVersion(result));
            getConfig().then((result) => {
                setApplicationConfig(result);

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
            alert('Failed to approve device. Please try again.');
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
            alert('Failed to reject device. Please try again.');
        }
    };

    return (
        <div id="App" className="min-h-screen bg-background-base text-text-primary selection:bg-accent-primary/20">
            {/* Top Navigation Bar — Ultra Glassmorphic Floating Dock */}
            <nav className="sticky top-0 z-50 nav-glass-bar">
                {/* Top-edge glass light catch */}
                <div className="nav-top-edge" />

                <div className="relative flex items-center h-full px-8 max-w-[1920px] mx-auto">
                    {/* Brand — fixed left */}
                    <div className="flex items-center gap-4 flex-shrink-0 z-10">
                        {/* Brand logo dot — small glowing accent orb */}
                        <div className="relative flex-shrink-0 mr-1">
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-primary shadow-[0_0_10px_var(--color-glow-accent-soft),0_0_24px_var(--color-glow-accent-strong)] animate-[nav-glow-pulse_3s_var(--ease-spring)_infinite]" />
                            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-gradient-primary blur-[6px] opacity-60 animate-[nav-glow-pulse_3s_var(--ease-spring)_infinite_0.5s]" />
                        </div>
                        <div className="flex items-baseline gap-1.5 leading-none">
                            <span className="text-base font-black tracking-[0.15em] text-gradient-primary uppercase select-none">Harmony</span>
                            <span className="text-[10px] font-bold tracking-[0.18em] text-text-muted opacity-60 uppercase select-none">Link</span>
                        </div>
                    </div>

                    {/* Pill Dock — absolutely centered */}
                    <div className="absolute left-1/2 -translate-x-1/2 nav-pill-dock z-0">
                        {[
                            { id: SettingsTabGeneral, label: 'General' },
                            { id: SettingsTabEntities, label: 'Entities' },
                            { id: SettingsTabModules, label: 'Modules' },
                            { id: SettingsTabCharacters, label: 'Characters' },
                            { id: SettingsTabIntegrations, label: 'Integrations' },
                            { id: SettingsTabSimulator, label: 'Simulator' },
                            { id: SettingsTabDevelopment, label: 'Dev' },
                        ].map((tab) => {
                            const isActive = settingsTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    data-tutorial-id={`nav-tab-${tab.id}`}
                                    onClick={() => setSettingsTab(tab.id)}
                                    className={`nav-pill ${isActive ? 'nav-pill-active' : ''}`}
                                >
                                    <span className="nav-pill-label">{tab.label}</span>
                                    {isActive && <span className="nav-pill-glow" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Help button — fixed right */}
                    <div className="flex items-center gap-4 flex-shrink-0 ml-auto z-10">
                        <button
                            data-tutorial-id="tutorial-restart-btn"
                            className="nav-help-btn"
                            onClick={handleRestartTutorial}
                            title="Help / Restart Tutorial"
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

            <div className="flex-1 bg-background-base min-h-[calc(100vh-6rem)]">
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
                    <CharacterProfilesView></CharacterProfilesView>
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
                        {appName} {appVersion} - &copy;2023-2026 Project Harmony.AI
                    </a>
                </p>
            </footer>
        </div>
    );
}

export default HarmonyLinkApp
