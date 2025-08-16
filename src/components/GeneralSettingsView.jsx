import {useEffect, useState} from 'react';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import {LogDebug, LogPrint} from "../utils/logger.js";

const GeneralSettingsView = ({generalSettings, saveGeneralSettings}) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState(()=>{});
    const [confirmModalNo, setConfirmModalNo] = useState(()=>{});

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
        generalSettings.authendpoint = authEndpoint;
        generalSettings.userapikey = userApiKey;
        generalSettings.useharmonycloud = useHarmonyCloud;
        generalSettings.confirmevents = confirmEvents;
        generalSettings.logfile = logFile;
        generalSettings.port = port;
        generalSettings.clientconnectionbuffer = clientConnectionBuffer;
        // Configure Modal Dialog whether a backup should be made
        setConfirmModalYes(() => saveSettingsWithBackup);
        setConfirmModalNo(() => saveSettingsWithoutBackup);
        showConfirmModal("Saving will overwrite the existing config.json file. Do you want to backup the existing file?");
    };

    useEffect(() => {
        LogDebug(JSON.stringify(generalSettings));
        setInitialValues();
    }, []);

    return (
        <>
            <div className="p-4">
                <div className="flex flex-wrap">
                    <div className="flex flex-wrap -px-10 w-2/3">
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                                Working Directory
                                <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Specify the directory used for storing entity specific working data and temporary
                                    files.
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="text" name="workingDir"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="Path to working directory" value={workingDir}
                                       onChange={(e) => setWorkingDir(e.target.value)}
                                       onBlur={(e) => validateWorkingDir(e.target.value)}/>
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                                Auth Endpoint
                                <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Web URL for Harmony.AI's authentication service. Required for using our cloud
                                    services.
                                    <br/>Changing this field is disabled if the cloud features are turned off.
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="text" name="authEndpoint"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="Authentication endpoint URL" value={authEndpoint} disabled={!useHarmonyCloud}
                                       onChange={(e) => setAuthEndpoint(e.target.value)}
                                       onBlur={(e) => validateAuthEndpoint(e.target.value)}/>
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                                User API Key
                                <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Personal API Key of your user Account. Also stored in file 'harmony-user.key'.
                                    <br/>Changing this field is disabled if the cloud features are turned off.
                                    <br/>
                                    <br/><span className="text-orange-400">CAUTION: Changing this value to a wrong one and saving can result in losing access to online features provided by Harmony.AI.</span>
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="password" name="userApiKey"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="API Key" value={userApiKey} disabled={!useHarmonyCloud}
                                       onChange={(e) => setUserApiKey(e.target.value)}
                                       onBlur={(e) => validateUserApiKey(e.target.value)}/>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap -px-10 w-1/3">
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                                Use Harmony Cloud
                                <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Whether Harmony Link should authenticate with the Harmony.AI cloud upon startup.
                                    <br/>Cloud Services like Speech Engine can only be used when authenticated.
                                    <br/>(save settings and restart Harmony Link to apply)
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2 px-3">
                                <input type="checkbox" name="useHarmonyCloud" className="rounded text-indigo-600 mt-1"
                                       checked={useHarmonyCloud} onChange={(e) => setUseHarmonyCloud(e.target.checked)}/>

                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                                Confirm Events
                                <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Whether Harmony Link should send confirmation events for each event it receives.
                                    <br/>(Useful for Debugging or in stateful contexts)
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2 px-3">
                                <input type="checkbox" name="confirmEvents" className="rounded text-indigo-600 mt-1"
                                       checked={confirmEvents} onChange={(e) => setConfirmEvents(e.target.checked)}/>

                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                                Create Log File
                                <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Whether Harmony Link should write a log file while running.
                                    <br/>(Changing requires restart)
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2 px-3">
                                <input type="checkbox" name="logFile" className="rounded text-indigo-600 mt-1"
                                       checked={logFile} onChange={(e) => setLogFile(e.target.checked)}/>
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                                Client Connection Port
                                <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Port on this machine which Harmony Plugins can to connect to.
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2 px-3">
                                <input type="number" name="port"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="Enter port number" value={port}
                                       onChange={(e) => setPort(parseInt(e.target.value) || -1)}
                                       onBlur={(e) => validatePort(parseInt(e.target.value) || -1)}/>
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                                Client WebSocket Buffer
                                <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    If using WebSocket, this defines the message buffer size in Bytes. Connecting
                                    WebSocket Clients need to match this value.
                                    <br/>If you're running into issues with broken WebSocket Messages from- or to
                                    Harmony Link, increasing this value might fix it.
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2 px-3">
                                <input type="number" name="clientConnectionBuffer"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="Buffer size" value={clientConnectionBuffer}
                                       onChange={(e) => setClientConnectionBuffer(parseInt(e.target.value) || -1)}
                                       onBlur={(e) => validateClientConnectionBuffer(parseInt(e.target.value) || -1)}/>

                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-start pl-2 pb-2">
                    <button
                        onClick={updateSettingValues}
                        className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Save
                    </button>
                    <button
                        onClick={setInitialValues}
                        className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Reset
                    </button>
                </div>
            </div>
            {isModalVisible && (
                <div className="fixed inset-0 bg-gray-600/50">
                    <div
                        className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-200">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-orange-500 mt-4">Invalid Input</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{modalMessage}</p>
                            </div>
                            <div className="items-center px-4 py-3">
                                <button onClick={() => setIsModalVisible(false)}
                                        className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {confirmModalVisible && (
                <div className="fixed inset-0 bg-gray-600/50">
                    <div className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg leading-6 font-medium text-orange-500">Confirmation Required</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{confirmModalMessage}</p>
                            </div>
                            <div className="flex justify-center gap-4 pt-3">
                                <button onClick={() => { setConfirmModalVisible(false); confirmModalYes();}}
                                        className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">
                                    Yes
                                </button>
                                <button onClick={() => { setConfirmModalVisible(false); confirmModalNo(); }}
                                        className="bg-red-700 hover:bg-red-500 font-bold py-1 px-2 mx-1 text-white">
                                    No
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default GeneralSettingsView;