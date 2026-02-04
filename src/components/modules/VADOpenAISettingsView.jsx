import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import { MODULES, PROVIDERS } from '../../constants/modules.js';
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";

const VADOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.VAD][PROVIDERS.OPENAI];
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
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Fields
    const [openAIApiKey, setOpenAIApiKey] = useState(mergedSettings.openaiapikey);

    // Validation Functions
    const validateOpenAIApiKeyAndUpdate = (value) => {
        if (value.length > 0 && !value.startsWith("sk-")) {
            showModal("OpenAI API Key must start with 'sk-'.");
            setOpenAIApiKey(moduleSettings.openaiapikey);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, openaiapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            openaiapikey: moduleSettings.openaiapikey
        };
        
        try {
            const result = await validateProviderConfig(MODULES.VAD, PROVIDERS.OPENAI, currentConfig);
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
        setOpenAIApiKey(currentMergedSettings.openaiapikey);
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
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
                            OpenAI API Key
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your OpenAI API Key for Voice Activity Detection using OpenAI's Whisper model.
                                <br/>
                                <br/>Note: Using OpenAI for VAD will use Whisper transcription to detect speech,
                                which may be more expensive than dedicated VAD services but provides high accuracy.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="password" name="openaiapikey"
                                   className="input-field mt-1 block w-full"
                                   placeholder="sk-..." value={openAIApiKey}
                                   onChange={(e) => setOpenAIApiKey(e.target.value)}
                                   onBlur={(e) => validateOpenAIApiKeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-full">
                    <div className="w-full px-3">
                        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-md p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-400">
                                        OpenAI VAD Usage Notice
                                    </h3>
                                    <div className="mt-2 text-sm text-yellow-300">
                                        <p>
                                            OpenAI VAD uses Whisper transcription to detect speech activity. This approach:
                                        </p>
                                        <ul className="list-disc list-inside mt-2 space-y-1">
                                            <li>May be more expensive than dedicated VAD services</li>
                                            <li>Provides high accuracy speech detection</li>
                                            <li>Uses the same API as OpenAI transcription</li>
                                            <li>Is suitable for high-quality VAD requirements</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
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

export default VADOpenAISettingsView;
