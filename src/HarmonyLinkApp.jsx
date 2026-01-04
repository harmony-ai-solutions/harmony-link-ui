import {useState, useEffect} from 'react';
import logo from './assets/images/harmony-link-icon-256.png';
import {getConfig, updateConfig, getAppName, getAppVersion} from "./services/management/configService.js";
import EntitySettingsView from "./components/EntitySettingsView.jsx";
import GeneralSettingsView from "./components/GeneralSettingsView.jsx";
import DevelopmentView from "./components/DevelopmentView.jsx";
import IntegrationsView from "./components/IntegrationsView.jsx";
import SimulatorView from "./components/SimulatorView.jsx";
import CharacterProfilesView from "./components/characters/CharacterProfilesView.jsx";
import ModuleConfigurationsView from "./components/modules/ModuleConfigurationsView.jsx";
import {SettingsTabMain, SettingsTabGeneral, SettingsTabEntities, SettingsTabCharacters, SettingsTabModules, SettingsTabDevelopment, SettingsTabIntegrations, SettingsTabSimulator} from './constants.jsx'
import {LogDebug, LogError, LogPrint} from "./utils/logger.js";

function HarmonyLinkApp() {
    const [appName, setAppName] = useState('Harmony Link');
    const [appVersion, setAppVersion] = useState('v0.2.0-dev');
    const [settingsTab, setSettingsTab] = useState(SettingsTabGeneral);

    // Main Config reference
    const [applicationConfig, setApplicationConfig] = useState(null);

    // Save Functions
    const saveGeneralSettings = (newGeneralSettings, createBackup = true) => {
        // Create transfer objects
        const newCompleteSettings = {...applicationConfig, general: newGeneralSettings};
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
        const newCompleteSettings = {...applicationConfig, entities: newEntitySettings};
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

    return (
        <div id="App">
            <div className="border-b-2 border-neutral-500">
                    <ul className="flex cursor-pointer">
                        <li className="mr-1 h-10">
                            <img className="h-10 w-10" src={logo} id="logo" alt="Harmony Link"/>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#general" onClick={() => setSettingsTab(SettingsTabGeneral)}>General</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#entity" onClick={() => setSettingsTab(SettingsTabEntities)}>Entities</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#modules" onClick={() => setSettingsTab(SettingsTabModules)}>Modules</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#characters" onClick={() => setSettingsTab(SettingsTabCharacters)}>Character Profiles</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#integrations" onClick={() => setSettingsTab(SettingsTabIntegrations)}>Integrations</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#simulator" onClick={() => setSettingsTab(SettingsTabSimulator)}>Simulator</a>
                        </li>
                        <li className="mr-1 h-10 bg-neutral-900">
                            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
                               href="#development" onClick={() => setSettingsTab(SettingsTabDevelopment)}>Development</a>
                        </li>
                    </ul>
                <div className="bg-neutral-900 border-t-2 border-b border-neutral-500">
                    {applicationConfig && settingsTab === SettingsTabGeneral &&
                        <GeneralSettingsView generalSettings={applicationConfig.general} saveGeneralSettings={saveGeneralSettings}></GeneralSettingsView>
                    }
                    {applicationConfig && settingsTab === SettingsTabEntities &&
                        <EntitySettingsView appName={appName} entitySettings={applicationConfig.entities} saveEntitySettings={saveEntitySettings}></EntitySettingsView>
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
                <div className="flex items-center justify-center bg-neutral-900">
                    <p className="py-1 px-2 text-orange-400"><a href="https://project-harmony.ai/technology/" target="_blank">{appName} {appVersion} - &copy;2023-2025 Project Harmony.AI</a></p>
                </div>
            </div>

        </div>
    )
}

export default HarmonyLinkApp
