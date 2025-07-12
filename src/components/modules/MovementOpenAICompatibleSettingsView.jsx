import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {getAvailableIntegrationsForProvider, validateProviderConfig} from "../../services/managementApiService.js";
import IntegrationDisplay from "../integrations/IntegrationDisplay.jsx";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";


const MovementOpenAICompatibleSettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    // Integration State
    const [availableIntegrations, setAvailableIntegrations] = useState([]);

    // Validation State
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Fields
    const [baseURL, setBaseURL] = useState(initialSettings.baseurl);
    const [apiKey, setApiKey] = useState(initialSettings.apikey);
    const [model, setModel] = useState(initialSettings.model);
    const [maxTokens, setMaxTokens] = useState(initialSettings.maxtokens);
    const [temperature, setTemperature] = useState(initialSettings.temperature);
    const [topP, setTopP] = useState(initialSettings.topp);
    const [n, setN] = useState(initialSettings.n);
    const [stopTokens, setStopTokens] = useState(initialSettings.stoptokens);

    // Validation Functions
    const validateBaseURLAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if ((moduleSettings.baseurl.length > 0 && value.length === 0) || (value.length > 0 && urlRegex.test(value) === false)) {
            showModal("Base URL must be a valid URL.");
            setBaseURL(moduleSettings.baseurl);
            return false;
        }
        moduleSettings.baseurl = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateApikeyAndUpdate = (value) => {
        moduleSettings.apikey = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const setModelAndUpdate = (value) => {
        setModel(value);
        moduleSettings.model = value;
        saveSettingsFunc(moduleSettings);
        return true;
    }
    const validateMaxTokensAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 20) {
            showModal("Max tokens must be a positive number greater than 19.");
            setMaxTokens(moduleSettings.maxtokens);
            return false;
        }
        moduleSettings.maxtokens = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateTemperatureAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 2.00) && numValue !== -1.00) {
            showModal("Temperature must be a positive number between 0.01 and 2.00, or set to -1 to disable.");
            setTemperature(moduleSettings.temperature);
            return false;
        }
        moduleSettings.temperature = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateTopPAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 1.00) && numValue !== -1.00) {
            showModal("Top P must be a positive number between 0.01 and 1.00, or set to -1 to disable.");
            setTopP(moduleSettings.topp);
            return false;
        }
        moduleSettings.topp = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateNAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < -1 || numValue === 0) {
            showModal("N must be a positive number, or -1 to disable.");
            setN(moduleSettings.n);
            return false;
        }
        moduleSettings.n = numValue;
        saveSettingsFunc(moduleSettings);
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
        moduleSettings.stoptokens = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            baseurl: baseURL,
            apikey: apiKey,
            model: model,
            maxtokens: maxTokens,
            temperature: temperature,
            topp: topP,
            n: n,
            stoptokens: stopTokens
        };
        
        try {
            const result = await validateProviderConfig('movement', 'openaicompatible', currentConfig);
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
        setModuleSettings(initialSettings);
    };

    const fetchIntegrations = async () => {
        try {
            const integrations = await getAvailableIntegrationsForProvider('movement', 'openaicompatible');
            setAvailableIntegrations(integrations);
        } catch (error) {
            console.error("Failed to fetch available integrations:", error);
        }
    };

    const useIntegration = (integration, urlIndex = 0) => {
        const selectedURL = integration.apiURLs[urlIndex];
        setBaseURL(selectedURL);
        moduleSettings.baseurl = selectedURL;
        saveSettingsFunc(moduleSettings);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
        fetchIntegrations();
    }, [initialSettings]);

    return(
        <>
            <div className="flex flex-wrap w-full pt-2">                
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <IntegrationDisplay availableIntegrations={availableIntegrations} useIntegration={useIntegration} />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Base URL
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The base URL for the OpenAI compatible API endpoint.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="baseurl"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Base URL" value={baseURL}
                                   onChange={(e) => setBaseURL(e.target.value)}
                                   onBlur={(e) => validateBaseURLAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            API Key
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your API Key for the OpenAI compatible service (if required).
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="apikey"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="API Key" value={apiKey}
                                   onChange={(e) => setApiKey(e.target.value)}
                                   onBlur={(e) => validateApikeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Model
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The model name to use.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="text" name="model"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Model Name" value={model}
                                   onChange={(e) => setModel(e.target.value)}
                                   onBlur={(e) => setModelAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Max Tokens
                            <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
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
                            <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
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
                            <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
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
                            <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
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
                            <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
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

export default MovementOpenAICompatibleSettingsView;
