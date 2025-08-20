import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig, listProviderModels} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";


const MovementOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Model dropdown state - initialize with error message like TTS component
    const [availableModels, setAvailableModels] = useState([
        {name: "Error: no models available", value: null}
    ]);
    const [modelsLoading, setModelsLoading] = useState(false);

    // Fields
    const [openAIAPIKey, setOpenAIAPIKey] = useState(initialSettings.openaiapikey);
    const [model, setModel] = useState(initialSettings.model);
    const [maxTokens, setMaxTokens] = useState(initialSettings.maxtokens);
    const [temperature, setTemperature] = useState(initialSettings.temperature);
    const [topP, setTopP] = useState(initialSettings.topp);
    const [n, setN] = useState(initialSettings.n);
    const [stopTokens, setStopTokens] = useState(initialSettings.stoptokens);

    // Auto-refresh models when API key changes or component loads
    const refreshAvailableModels = async () => {
        // Smart refresh: avoid unnecessary calls if we already have valid models
        if (availableModels.length > 0 && !availableModels[0].name.startsWith("Error") && !availableModels[0].name.startsWith("Updating models")) {
            return;
        }
        
        if (!moduleSettings.openaiapikey) {
            setAvailableModels([{name: "Error: API Key not set", value: null}]);
            return;
        }

        setModelsLoading(true);
        setAvailableModels([{name: 'Updating models...', value: null }]);
        
        const currentConfig = {
            openaiapikey: moduleSettings.openaiapikey,
            model: moduleSettings.model,
            maxtokens: moduleSettings.maxtokens,
            temperature: moduleSettings.temperature,
            topp: moduleSettings.topp,
            n: moduleSettings.n,
            stoptokens: moduleSettings.stoptokens
        };
        
        try {
            const result = await listProviderModels(MODULES.MOVEMENT, PROVIDERS.OPENAI, currentConfig);
            if (result.error) {
                setAvailableModels([{name: "Error: please check API Key", value: null}]);
            } else if (result.error || !result.models || result.models.length === 0) {
                setAvailableModels([{name: "Error: no models available", value: null}]);
            } else {
                const newModels = result.models || [];
                setAvailableModels(newModels);

                // Ensure current model selection is valid
                if (!newModels.some((modelInfo) => (modelInfo.id || modelInfo.value) === model)) {
                    // If current model is not in the list, select the first available model
                    if (newModels.length > 0 && newModels[0].id) {
                        setModelAndUpdate(newModels[0].id);
                    }
                }
            }
        } catch (error) {
            setAvailableModels([{name: "Error: internal error - please check console logs", value: null}]);
        } finally {
            setModelsLoading(false);
        }
    };

    // Validation Functions
    const validateApikeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("API Key cannot be empty.");
            setOpenAIAPIKey(moduleSettings.openaiapikey);
            return false;
        } else if (value === moduleSettings.openaiapikey) {
            return true; // Skip if no change
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, openaiapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);

        // Auto-refresh models after API key update (like TTS does with endpoint)
        setAvailableModels([{name: "Updating models...", value: null}]);
        refreshAvailableModels();
        return true;
    };
    const setModelAndUpdate = (value) => {
        setModel(value);
        const updatedSettings = { ...moduleSettings, model: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    }
    const validateMaxTokensAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 20) {
            showModal("Max tokens must be a positive number greater than 19.");
            setMaxTokens(moduleSettings.maxtokens);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, maxtokens: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateTemperatureAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 2.00) && numValue !== -1.00) {
            showModal("Temperature must be a positive number between 0.01 and 2.00, or set to -1 to disable.");
            setTemperature(moduleSettings.temperature);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, temperature: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateTopPAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 1.00) && numValue !== -1.00) {
            showModal("Top P must be a positive number between 0.01 and 1.00, or set to -1 to disable.");
            setTopP(moduleSettings.topp);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, topp: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateNAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < -1 || numValue === 0) {
            showModal("N must be a positive number, or -1 to disable.");
            setN(moduleSettings.n);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, n: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateStopTokensAndUpdate = (value) => {
        value = value.split(",").filter(item => item !== "");
        if (value.length === 0) {
            showModal("Stop Token List cannot be empty.");
            setStopTokens(moduleSettings.stoptokens);
            return false;
        }
        // Update if validation successful
        // Split by comma
        setStopTokens(value);
        const updatedSettings = { ...moduleSettings, stoptokens: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            openaiapikey: moduleSettings.openaiapikey,
            model: moduleSettings.model,
            maxtokens: moduleSettings.maxtokens,
            temperature: moduleSettings.temperature,
            topp: moduleSettings.topp,
            n: moduleSettings.n,
            stoptokens: moduleSettings.stoptokens
        };
        
        try {
            const result = await validateProviderConfig(MODULES.MOVEMENT, PROVIDERS.OPENAI, currentConfig);
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
        // Auto-fetch models if API key is available (like TTS does with endpoint)
        if (initialSettings.openaiapikey) {
            refreshAvailableModels();
        }
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return(
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            API Key
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your OpenAI API Key
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="apikey"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="OpenAI API Key" value={openAIAPIKey}
                                   onChange={(e) => setOpenAIAPIKey(e.target.value)}
                                   onBlur={(e) => validateApikeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Model
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                OpenAI Model you want to use. Models are automatically loaded when you provide a valid API key.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <div className="relative">
                                <select name="model"
                                        className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100 custom-scrollbar"
                                        value={model}
                                        onChange={(e) => setModelAndUpdate(e.target.value)}>
                                    {availableModels.map((modelInfo) => (
                                        <option key={modelInfo.id} value={modelInfo.id}>
                                            {modelInfo.name || modelInfo.id}
                                        </option>
                                    ))}
                                </select>
                                {modelsLoading && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <svg className="animate-spin h-4 w-4 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Max Tokens
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Maximum new tokens to generate per request.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="number" name="maxtokens"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Max New Tokens" value={maxTokens}
                                   onChange={(e) => setMaxTokens(e.target.value)}
                                   onBlur={(e) => validateMaxTokensAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Temperature
                            <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Temperature defines the likelihood of the model choosing tokens that are outside the
                                context.
                                <br/>The higher the temperature, the more likely the model will produce creative or
                                unexpected results.
                                <br/>Set to -1 to disable.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="number" name="temperature" step=".01"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Model Temperature" value={temperature}
                                   onChange={(e) => setTemperature(e.target.value)}
                                   onBlur={(e) => validateTemperatureAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Top P
                            <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Top P defines the probability of the model choosing the most likely next word.
                                <br/>A higher value means the model is more deterministic, but it also can lead to
                                repetition.
                                <br/>Set to -1 to disable.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="number" name="topp" step=".01"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Model Top P Value" value={topP}
                                   onChange={(e) => setTopP(e.target.value)}
                                   onBlur={(e) => validateTopPAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Number of Results
                            <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                How many chat completion choices / results to generate per request.
                                <br/>Set to -1 to disable.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="number" name="n" step="1"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Number of Results" value={n}
                                   onChange={(e) => setN(e.target.value)}
                                   onBlur={(e) => validateNAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Stop Tokens
                            <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                List of Stop tokens, comma separated.
                                <br/>If the model encounters a stop token during generation, it will end the current
                                generation.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="stoptokens"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Stop Token List" value={stopTokens}
                                   onChange={(e) => setStopTokens(e.target.value)}
                                   onBlur={(e) => validateStopTokensAndUpdate(e.target.value)}/>
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

export default MovementOpenAISettingsView;
