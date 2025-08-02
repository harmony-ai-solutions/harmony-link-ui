import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {validateProviderConfig} from "../../services/managementApiService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";


const BackendKajiwotoSettingsView = ({initialSettings, saveSettingsFunc}) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Base Settings reference
    const [moduleSettings, setModuleSettings] = useState(initialSettings);

    // Validation State
    const [validationState, setValidationState] = useState({status: 'idle', message: ''});

    // Fields
    const [username, setUsername] = useState(initialSettings.username);
    const [password, setPassword] = useState(initialSettings.password);
    const [kajiRoomURL, setKajiRoomURL] = useState(initialSettings.kajiroomurl);


    // Validation Functions
    const validateUserNameAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.username.length > 0) {
            showModal("Username cannot be empty.");
            setUsername(moduleSettings.username);
            return false;
        }
        // Update if validation successful
        moduleSettings.username = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const validatePasswordAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.password.length > 0) {
            showModal("Password cannot be empty.");
            setPassword(moduleSettings.password);
            return false;
        }
        // Update if validation successful
        moduleSettings.password = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const validateKajiRoomAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if ((moduleSettings.kajiroomurl.length > 0 && value.length === 0) || (value.length > 0 && urlRegex.test(value) === false)) {
            showModal("Kaji room URL must be a valid URL.");
            setKajiRoomURL(moduleSettings.kajiroomurl);
            return false;
        }
        // Update if validation successful
        moduleSettings.kajiroomurl = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({status: 'loading', message: 'Validating configuration...'});

        const currentConfig = {
            username: moduleSettings.username,
            password: moduleSettings.password,
            kajiroomurl: moduleSettings.kajiroomurl
        };

        try {
            const result = await validateProviderConfig('backend', 'kajiwoto', currentConfig);
            setValidationState({
                status: result.valid ? 'success' : 'error',
                message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
            });
        } catch (error) {
            setValidationState({
                status: 'error',
                message: 'Validation failed: ' + error.message
            });
        }
    };

    const setInitialValues = () => {
        // Reset Entity map
        setModuleSettings(initialSettings);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, []);

    return (
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Username
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your Kajiwoto Username
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="text" name="username"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Kajiwoto Username" value={username}
                                   onChange={(e) => setUsername(e.target.value)}
                                   onBlur={(e) => validateUserNameAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Password
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your Kajiwoto Password
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="password"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Kajiwoto Password" value={password}
                                   onChange={(e) => setPassword(e.target.value)}
                                   onBlur={(e) => validatePasswordAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Chatroom URL
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Web URL of the Kajiwoto Chatroom you want to link this entity with.
                                <br/>You can copy it directly from your browser's address bar.
                                <br/>This currently only supports Chatrooms with a single AI.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="kajiroomurl"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Kajiwoto Chatroom URL" value={kajiRoomURL}
                                   onChange={(e) => setKajiRoomURL(e.target.value)}
                                   onBlur={(e) => validateKajiRoomAndUpdate(e.target.value)}/>
                        </div>
                    </div>
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
        </>
    );
}

export default BackendKajiwotoSettingsView;
