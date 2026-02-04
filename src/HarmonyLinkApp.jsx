import { useState, useEffect } from 'react';
import logo from './assets/images/harmony-link-icon-256.png';
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


    // On Application Loaded
    useEffect(() => {
        // Load Config on Start
        try {
            getAppName().then((result) => setAppName(result));
            getAppVersion().then((result) => setAppVersion(result));
            getConfig().then((result) => setApplicationConfig(result));
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
            {/* Top Navigation Bar */}
            <nav className="sticky top-0 z-50 bg-background-base/90 backdrop-blur-md border-b border-white/10 h-16 overflow-hidden">
                <div className="flex items-center justify-between h-full px-6 max-w-[1920px] mx-auto">
                    <div className="flex items-center gap-10 h-full">
                        {/* Original Logo */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <img src={logo} className="h-9 w-auto drop-shadow-md" alt="Harmony AI" />
                            <div className="flex flex-col leading-none">
                                <span className="text-sm font-black tracking-widest text-white uppercase">Harmony</span>
                                <span className="text-[11px] font-bold tracking-[0.12em] text-accent-primary opacity-90 uppercase">Link</span>
                            </div>
                        </div>

                        {/* Theme-Aware Tab Panel */}
                        <ul className="flex items-center h-full gap-3 overflow-x-auto no-scrollbar">
                            {[
                                { id: SettingsTabGeneral, label: 'General', var: '--color-nuance-general' },
                                { id: SettingsTabEntities, label: 'Entities', var: '--color-nuance-entities' },
                                { id: SettingsTabModules, label: 'Modules', var: '--color-nuance-modules' },
                                { id: SettingsTabCharacters, label: 'Characters', var: '--color-nuance-characters' },
                                { id: SettingsTabIntegrations, label: 'Integrations', var: '--color-nuance-integrations' },
                                { id: SettingsTabSimulator, label: 'Simulator', var: '--color-nuance-simulator' },
                                { id: SettingsTabDevelopment, label: 'Dev', var: '--color-nuance-development' },
                            ].map((tab) => (
                                <li key={tab.id} className="h-full flex items-center">
                                    <button
                                        onClick={() => setSettingsTab(tab.id)}
                                        className="px-4 h-full text-base font-bold transition-all duration-200 relative whitespace-nowrap flex items-center"
                                        style={{
                                            color: settingsTab === tab.id ? `var(${tab.var})` : 'var(--color-text-muted)',
                                            backgroundColor: settingsTab === tab.id ? `color-mix(in srgb, var(${tab.var}), transparent 88%)` : 'transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (settingsTab !== tab.id) {
                                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (settingsTab !== tab.id) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--color-text-muted)';
                                            }
                                        }}
                                    >
                                        <div
                                            className={`px-3 py-1.5 rounded-md transition-all duration-200 ${settingsTab === tab.id ? 'bg-opacity-10' : ''}`}
                                            style={{
                                                backgroundColor: settingsTab === tab.id ? `color-mix(in srgb, var(${tab.var}), transparent 85%)` : 'transparent'
                                            }}
                                        >
                                            {tab.label}
                                        </div>
                                        {settingsTab === tab.id && (
                                            <span
                                                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full shadow-[0_-2px_12px_rgba(0,0,0,0.5)]"
                                                style={{ backgroundColor: `var(${tab.var})` }}
                                            />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
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

            {/* Device Approval Modal */}
            <DeviceApprovalModal
                device={currentDevice}
                onApprove={handleApproveDevice}
                onReject={handleRejectDevice}
                show={currentDevice !== null}
            />

            <footer className="flex items-center justify-center bg-background-base border-t border-white/5">
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
