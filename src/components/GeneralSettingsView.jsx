import { useEffect, useState } from 'react';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import { LogDebug, LogPrint } from "../utils/logger.js";
import { useTheme } from '../contexts/ThemeContext';
import { listThemes } from '../services/management/themeService';
import ConfirmDialog from './modals/ConfirmDialog.jsx';
import ErrorDialog from './modals/ErrorDialog.jsx';

const GeneralSettingsView = ({ generalSettings, saveGeneralSettings }) => {
    const { currentTheme, switchTheme } = useTheme();
    const [themes, setThemes] = useState([]);
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState(() => { });
    const [confirmModalNo, setConfirmModalNo] = useState(() => { });

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };
    const showConfirmModal = (message) => {
        setConfirmModalMessage(message);
        setConfirmModalVisible(true);
    };

    // Fields
    const [workingDir, setWorkingDir] = useState("");
    const [dataDir, setDataDir] = useState("");
    const [databaseFileName, setDatabaseFileName] = useState("");
    const [authEndpoint, setAuthEndpoint] = useState("");
    const [userApiKey, setUserApiKey] = useState("");
    const [useHarmonyCloud, setUseHarmonyCloud] = useState(false);
    const [confirmEvents, setConfirmEvents] = useState(false);
    const [logFile, setLogFile] = useState(false);
    const [port, setPort] = useState(28080);
    const [clientConnectionBuffer, setClientConnectionBuffer] = useState(8192);

    // Validation Functions
    const validateWorkingDir = (value) => {
        if (value.trim() === "") {
            showModal("Working Directory cannot be empty.");
            setWorkingDir(generalSettings.workingdir);
            return false;
        }
        return true;
    };
    const validateDataDir = (value) => {
        if (value.trim() === "") {
            showModal("Data Directory cannot be empty.");
            setDataDir(generalSettings.datadir);
            return false;
        }
        return true;
    };
    const validateDatabaseFileName = (value) => {
        if (value.trim() === "") {
            showModal("Database File Name cannot be empty.");
            setDatabaseFileName(generalSettings.databasefilename);
            return false;
        }
        return true;
    };
    const validateAuthEndpoint = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if (urlRegex.test(value) === false) {
            showModal("Auth Endpoint must be a valid URL.");
            setAuthEndpoint(generalSettings.authendpoint);
            return false;
        }
        return true;
    };
    const validateUserApiKey = (value) => {
        if (value.trim() === "") {
            showModal("User API Key cannot be empty.");
            setUserApiKey(generalSettings.userapikey);
            return false;
        }
        return true;
    };
    const validatePort = (value) => {
        if (isNaN(value) || value < 1024 || value > 65535) {
            showModal("Port must be a number between 1024 and 65535.");
            setPort(generalSettings.port);
            return false;
        }
        return true;
    };
    const validateClientConnectionBuffer = (value) => {
        if (isNaN(value) || value <= 0) {
            showModal("Client Connection Buffer must be a positive number.");
            setClientConnectionBuffer(generalSettings.clientconnectionbuffer);
            return false;
        }
        return true;
    };

    const setInitialValues = () => {
        setWorkingDir(generalSettings.workingdir);
        setDataDir(generalSettings.datadir);
        setDatabaseFileName(generalSettings.databasefilename);
        setAuthEndpoint(generalSettings.authendpoint);
        setUserApiKey(generalSettings.userapikey);
        setUseHarmonyCloud(generalSettings.useharmonycloud)
        setConfirmEvents(generalSettings.confirmevents);
        setLogFile(generalSettings.logfile);
        setPort(generalSettings.port);
        setClientConnectionBuffer(generalSettings.clientconnectionbuffer);
    };

    const saveSettingsWithBackup = () => {
        saveGeneralSettings(generalSettings, true);
    }
    const saveSettingsWithoutBackup = () => {
        saveGeneralSettings(generalSettings, false);
    }

    const updateSettingValues = () => {
        generalSettings.workingdir = workingDir;
        generalSettings.datadir = dataDir;
        generalSettings.databasefilename = databaseFileName;
        generalSettings.authendpoint = authEndpoint;
        generalSettings.userapikey = userApiKey;
        generalSettings.useharmonycloud = useHarmonyCloud;
        generalSettings.confirmevents = confirmEvents;
        generalSettings.logfile = logFile;
        generalSettings.port = port;
        generalSettings.clientconnectionbuffer = clientConnectionBuffer;
        generalSettings.currenttheme = currentTheme;
        // Configure Modal Dialog whether a backup should be made
        setConfirmModalYes(() => saveSettingsWithBackup);
        setConfirmModalNo(() => saveSettingsWithoutBackup);
        showConfirmModal("Saving will overwrite the existing config.json file. Do you want to backup the existing file?");
    };

    useEffect(() => {
        LogDebug(JSON.stringify(generalSettings));
        setInitialValues();

        // Fetch themes
        listThemes().then(setThemes).catch(err => {
            console.error("Failed to load themes:", err);
        });
    }, []);

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <span className="text-gradient-primary">General</span> Settings
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    Global application configuration and appearance settings
                </p>
            </div>

            <div className="flex-1 p-6 space-y-8 max-w-7xl">
                {/* Connection Settings Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h2 className="text-lg font-bold text-text-primary border-b border-white/10 pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">Application & Cloud</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        {/* Left Column: Input Fields */}
                        <div className="space-y-4">
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    Working Directory
                                    <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Specify the directory used for storing entity specific working data and temporary files.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="workingDir"
                                        className="input-field w-full"
                                        placeholder="Path to working directory" value={workingDir}
                                        onChange={(e) => setWorkingDir(e.target.value)}
                                        onBlur={(e) => validateWorkingDir(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    Data Directory
                                    <SettingsTooltip tooltipIndex={101} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        The primary directory for persistent data, including themes and application state.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="dataDir"
                                        className="input-field w-full"
                                        placeholder="Path to data directory" value={dataDir}
                                        onChange={(e) => setDataDir(e.target.value)}
                                        onBlur={(e) => validateDataDir(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    Database File
                                    <SettingsTooltip tooltipIndex={102} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        The filename of the SQLite database within the data directory.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="databaseFileName"
                                        className="input-field w-full"
                                        placeholder="e.g. data.sqlite" value={databaseFileName}
                                        onChange={(e) => setDatabaseFileName(e.target.value)}
                                        onBlur={(e) => validateDatabaseFileName(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    Auth Endpoint
                                    <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Web URL for Harmony.AI's authentication service. Required for using our cloud services.
                                        <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">Changing this field is disabled if the cloud features are turned off.</span>
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="authEndpoint"
                                        className="input-field w-full transition-all duration-200"
                                        placeholder="Authentication endpoint URL" value={authEndpoint} disabled={!useHarmonyCloud}
                                        onChange={(e) => setAuthEndpoint(e.target.value)}
                                        onBlur={(e) => validateAuthEndpoint(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    User API Key
                                    <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Personal API Key of your user Account. Also stored in file 'harmony-user.key'.
                                        <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">Changing this field is disabled if the cloud features are turned off.</span>
                                        <br />
                                        <span className="text-accent-primary font-bold mt-2 block">CAUTION:</span>
                                        <span className="text-text-secondary italic text-[11px]">Changing this value to a wrong one and saving can result in losing access to online features provided by Harmony.AI.</span>
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="password" name="userApiKey"
                                        className="input-field w-full transition-all duration-200"
                                        placeholder="API Key" value={userApiKey} disabled={!useHarmonyCloud}
                                        onChange={(e) => setUserApiKey(e.target.value)}
                                        onBlur={(e) => validateUserApiKey(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Checkboxes */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="useHarmonyCloud"
                                    className="rounded text-accent-primary focus:ring-accent-primary"
                                    checked={useHarmonyCloud} onChange={(e) => setUseHarmonyCloud(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">Use Harmony Cloud</span>
                                        <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                            setTooltipVisible={setTooltipVisible}>
                                            Whether Harmony Link should authenticate with the Harmony.AI cloud upon startup.
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">Cloud Services like Speech Engine can only be used when authenticated. (Requires restart to apply)</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">Authenticate with Harmony.AI cloud services</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="confirmEvents"
                                    className="rounded text-accent-primary focus:ring-accent-primary"
                                    checked={confirmEvents} onChange={(e) => setConfirmEvents(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">Confirm Events</span>
                                        <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                            setTooltipVisible={setTooltipVisible}>
                                            Whether Harmony Link should send confirmation events for each event it receives.
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">(Useful for Debugging or in stateful contexts)</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">Send confirmation events for each received event</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="logFile"
                                    className="rounded text-accent-primary focus:ring-accent-primary"
                                    checked={logFile} onChange={(e) => setLogFile(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">Create Log File</span>
                                        <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                            setTooltipVisible={setTooltipVisible}>
                                            Whether Harmony Link should write a log file while running.
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">(Changing requires restart)</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">Write detailed log file to disk (requires restart)</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Network & Infrastructure Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75">
                    <h2 className="text-lg font-bold text-text-primary border-b border-white/10 pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">Network & Infrastructure</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                Connection Port
                                <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    Port on this machine which Harmony Plugins can to connect to.
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="number" name="port"
                                    className="input-field w-full"
                                    placeholder="Enter port number" value={port}
                                    onChange={(e) => setPort(parseInt(e.target.value) || -1)}
                                    onBlur={(e) => validatePort(parseInt(e.target.value) || -1)} />
                            </div>
                        </div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                WebSocket Buffer (Bytes)
                                <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    If using WebSocket, this defines the message buffer size in Bytes. Connecting WebSocket Clients need to match this value.
                                    <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">If you're running into issues with broken WebSocket Messages, increasing this value might fix it.</span>
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="number" name="clientConnectionBuffer"
                                    className="input-field w-full"
                                    placeholder="Buffer size" value={clientConnectionBuffer}
                                    onChange={(e) => setClientConnectionBuffer(parseInt(e.target.value) || -1)}
                                    onBlur={(e) => validateClientConnectionBuffer(parseInt(e.target.value) || -1)} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Theme Selector Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                    <h2 className="text-lg font-bold text-text-primary border-b border-white/10 pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">Appearance & Personalization</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {themes.map((theme) => (
                            <div
                                key={theme.id}
                                onClick={() => switchTheme(theme.id)}
                                className={`card p-3 min-h-[4.5rem] cursor-pointer transition-all duration-200 group relative ${currentTheme === theme.id
                                    ? 'border-accent-primary ring-1 ring-accent-primary bg-background-elevated shadow-lg shadow-accent-primary/10'
                                    : 'hover:border-white/10 hover:bg-background-hover'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Theme preview dot */}
                                    <div
                                        className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0"
                                        style={{ background: theme.colors.background.base }}
                                    >
                                        <div
                                            className="w-full h-1/2 mt-auto"
                                            style={{ background: theme.colors.accent.primary }}
                                        />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className={`font-bold text-sm truncate ${currentTheme === theme.id ? 'text-accent-primary' : 'text-text-primary group-hover:text-accent-primary transition-colors'}`}>
                                            {theme.name}
                                        </h4>
                                        <p className="text-[11px] font-medium text-text-muted truncate">{theme.description}</p>
                                    </div>
                                    {currentTheme === theme.id && (
                                        <div className="text-accent-primary flex-shrink-0">
                                            <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                    <button
                        onClick={setInitialValues}
                        className="btn-secondary">
                        Reset Changes
                    </button>
                    <button
                        onClick={updateSettingValues}
                        className="btn-primary">
                        Save Settings
                    </button>
                </div>
            </div>

            <ErrorDialog
                isOpen={isModalVisible}
                title="Invalid Input"
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
            />

            <ConfirmDialog
                isOpen={confirmModalVisible}
                title="Confirmation Required"
                message={confirmModalMessage}
                onConfirm={() => {
                    setConfirmModalVisible(false);
                    confirmModalYes();
                }}
                onCancel={() => {
                    setConfirmModalVisible(false);
                    confirmModalNo();
                }}
            />
        </div>
    );
}

export default GeneralSettingsView;