import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const BackendKajiwotoSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.BACKEND][PROVIDERS.KAJIWOTO];
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

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
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Validation State
    const [validationState, setValidationState] = useState({status: 'idle', message: ''});

    // Fields
    const [username, setUsername] = useState(mergedSettings.username);
    const [password, setPassword] = useState(mergedSettings.password);
    const [kajiRoomURL, setKajiRoomURL] = useState(mergedSettings.kajiroomurl);


    // Validation Functions
    const validateUserNameAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.username.length > 0) {
            showModal("Username cannot be empty.");
            setUsername(moduleSettings.username);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, username: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const validatePasswordAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.password.length > 0) {
            showModal("Password cannot be empty.");
            setPassword(moduleSettings.password);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, password: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
        const updatedSettings = { ...moduleSettings, kajiroomurl: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
            const result = await validateProviderConfig(MODULES.BACKEND, PROVIDERS.KAJIWOTO, currentConfig);
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
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setUsername(currentMergedSettings.username);
        setPassword(currentMergedSettings.password);
        setKajiRoomURL(currentMergedSettings.kajiroomurl);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return (
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-4 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                            Username
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your Kajiwoto Username
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="text" name="username"
                                   className="input-field w-full p-2 rounded"
                                   placeholder="Kajiwoto Username" value={username}
                                   onChange={(e) => setUsername(e.target.value)}
                                   onBlur={(e) => validateUserNameAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-4 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                            Password
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your Kajiwoto Password
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="password"
                                   className="input-field w-full p-2 rounded"
                                   placeholder="Kajiwoto Password" value={password}
                                   onChange={(e) => setPassword(e.target.value)}
                                   onBlur={(e) => validatePasswordAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-4 w-full">
                        <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
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
                                   className="input-field w-full p-2 rounded"
                                   placeholder="Kajiwoto Chatroom URL" value={kajiRoomURL}
                                   onChange={(e) => setKajiRoomURL(e.target.value)}
                                   onBlur={(e) => validateKajiRoomAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                </div>
            </div>
            <ErrorDialog
                isOpen={isModalVisible}
                title="Invalid Input"
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
                type="error"
            />
        </>
    );
}

export default BackendKajiwotoSettingsView;
