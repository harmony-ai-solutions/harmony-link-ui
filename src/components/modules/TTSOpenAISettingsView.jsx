import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const TTSOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.TTS][PROVIDERS.OPENAI];
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

    const modelOptions = [
        {name: 'TTS-1', value: 'tts-1'},
        {name: 'TTS-1 HD', value: 'tts-1-hd'}
    ];

    // Fields
    const [openAIAPIKey, setOpenAIAPIKey] = useState(mergedSettings.openaiapikey);
    const [model, setModel] = useState(mergedSettings.model);
    const [voice, setVoice] = useState(mergedSettings.voice);
    const [speed, setSpeed] = useState(mergedSettings.speed);
    const [format, setFormat] = useState(mergedSettings.format);

    // Validation Functions
    const validateApikeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("API Key cannot be empty.");
            setOpenAIAPIKey(moduleSettings.openaiapikey);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, openaiapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const setModelAndUpdate = (value) => {
        setModel(value);
        const updatedSettings = { ...moduleSettings, model: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    }
    const validateVoiceIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.voice.length > 0) {
            showModal("Voice cannot be empty.");
            setVoice(moduleSettings.voice);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, voice: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateSpeedAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue < 0.25 || numValue > 4.00)) {
            showModal("Speed must be a positive number between 0.25 and 4.00.");
            setSpeed(moduleSettings.speed);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, speed: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateFormatAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.format.length > 0) {
            showModal("Output Format cannot be empty.");
            setFormat(moduleSettings.format);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, format: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({status: 'loading', message: 'Validating configuration...'});

        const currentConfig = {
            openaiapikey: moduleSettings.openaiapikey,
            model: moduleSettings.model,
            voice: moduleSettings.voice,
            speed: moduleSettings.speed,
            format: moduleSettings.format
        };

        try {
            const result = await validateProviderConfig(MODULES.TTS, PROVIDERS.OPENAI, currentConfig);
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
        setOpenAIAPIKey(currentMergedSettings.openaiapikey);
        setModel(currentMergedSettings.model);
        setVoice(currentMergedSettings.voice);
        setSpeed(currentMergedSettings.speed);
        setFormat(currentMergedSettings.format);
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
                            API Key
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your OpenAI API Key
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="password" name="apikey"
                                   className="input-field mt-1 block w-full"
                                   placeholder="OpenAI API Key" value={openAIAPIKey}
                                   onChange={(e) => setOpenAIAPIKey(e.target.value)}
                                   onBlur={(e) => validateApikeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-1/2">
                    <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                        Model
                        <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                         setTooltipVisible={setTooltipVisible}>
                            OpenAI TTS Model you want to use.
                        </SettingsTooltip>
                    </label>
                    <div className="w-2/3 px-3">
                        <select
                            value={model}
                            onChange={(e) => setModelAndUpdate(e.target.value)}
                            className="input-field mt-1 block w-full">
                            {modelOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-1/2">
                    <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                        Voice
                        <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                         setTooltipVisible={setTooltipVisible}>
                            Name / ID of the OpenAI Voice. Please check the <span className="text-warning"><a
                            href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-voice"
                            target="_blank">OpenAI
                          documentation</a></span> for possible
                            values.
                        </SettingsTooltip>
                    </label>
                    <div className="w-2/3 px-3">
                        <input type="text" name="voice"
                               className="input-field mt-1 block w-full"
                               placeholder="OpenAI Voice Name" value={voice}
                               onChange={(e) => setVoice(e.target.value)}
                               onBlur={(e) => validateVoiceIdAndUpdate(e.target.value)}/>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-1/2">
                    <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                        Speed
                        <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                         setTooltipVisible={setTooltipVisible}>
                            Modifier for Voice Speed. Please check the <span className="text-warning"><a
                            href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-speed"
                            target="_blank">OpenAI
                          documentation</a></span> for possible
                            values.
                        </SettingsTooltip>
                    </label>
                    <div className="w-2/3 px-3">
                        <input type="number" name="speed" step=".01"
                               className="input-field mt-1 block w-full"
                               placeholder="Speed" value={speed}
                               onChange={(e) => setSpeed(e.target.value)}
                               onBlur={(e) => validateSpeedAndUpdate(e.target.value)}/>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-1/2">
                    <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                        Output Format
                        <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                         setTooltipVisible={setTooltipVisible}>
                            Output File Format of the OpenAI Voice. Please check the <span
                            className="text-warning"><a
                            href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-response_format"
                            target="_blank">OpenAI
                          documentation</a></span> for possible
                            values.
                        </SettingsTooltip>
                    </label>
                    <div className="w-2/3 px-3">
                        <input type="text" name="voiceid"
                               className="input-field mt-1 block w-full"
                               placeholder="Output Format" value={format}
                               onChange={(e) => setFormat(e.target.value)}
                               onBlur={(e) => validateFormatAndUpdate(e.target.value)}/>
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

export default TTSOpenAISettingsView;
