import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/integrationsService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";


const BackendOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    const modelOptions = [
        { name: 'GPT-4 32k 0613', value: 'gpt-4-32k-0613' },
        { name: 'GPT-4 32k 0314', value: 'gpt-4-32k-0314' },
        { name: 'GPT-4 32k', value: 'gpt-4-32k' },
        { name: 'GPT-4 0613', value: 'gpt-4-0613' },
        { name: 'GPT-4 0314', value: 'gpt-4-0314' },
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o 2024-05-13', value: 'gpt-4o-2024-05-13' },
        { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
        { name: 'GPT-4 Turbo 2024-04-09', value: 'gpt-4-turbo-2024-04-09' },
        { name: 'GPT-4', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo 0125', value: 'gpt-3.5-turbo-0125' },
        { name: 'GPT-3.5 Turbo 1106', value: 'gpt-3.5-turbo-1106' },
        { name: 'GPT-3.5 Turbo 0613', value: 'gpt-3.5-turbo-0613' },
        { name: 'GPT-3.5 Turbo 0301', value: 'gpt-3.5-turbo-0301' },
        { name: 'GPT-3.5 Turbo 16k', value: 'gpt-3.5-turbo-16k' },
        { name: 'GPT-3.5 Turbo 16k 0613', value: 'gpt-3.5-turbo-16k-0613' },
        { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
    ];

    // Fields
    const [openAIAPIKey, setOpenAIAPIKey] = useState(initialSettings.openaiapikey);
    const [model, setModel] = useState(initialSettings.model);
    const [maxTokens, setMaxTokens] = useState(initialSettings.maxtokens);
    const [temperature, setTemperature] = useState(initialSettings.temperature);
    const [topP, setTopP] = useState(initialSettings.topp);
    const [n, setN] = useState(initialSettings.n);
    const [stopTokens, setStopTokens] = useState(initialSettings.stoptokens);
    const [systemPrompts, setSystemPrompts] = useState(initialSettings.systemprompts ? initialSettings.systemprompts.join(" ") : "");
    const [userPrompts, setUserPrompts] = useState(initialSettings.userprompts ? initialSettings.userprompts.join(" ") : "");

    // Validation Functions
    const validateApikeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("API Key cannot be empty.");
            setOpenAIAPIKey(moduleSettings.openaiapikey);
            return false;
        }
        // Update if validation successful
        moduleSettings.openaiapikey = value;
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
        // Update if validation successful
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
        // Update if validation successful
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
        // Update if validation successful
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
        // Update if validation successful
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
    const validateSystemPromptsAndUpdate = (value) => {
        if (value.trim() === "") {
            setSystemPrompts("");
            return false;
        }
        // Update if validation successful
        // Split by dot, but add the dot back in at the end.
        const values = value.split(".");
        values.forEach((value, index) => {
            const trimmed = value.trim();
            if(trimmed.length !== 0) {
                values[index] = value.trim() + ".";
            }
        });
        setSystemPrompts(values.filter(item => item !== "").join(" "));
        moduleSettings.systemprompts = values;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateUserPromptsAndUpdate = (value) => {
        if (value.trim() === "") {
            setUserPrompts("");
            return false;
        }
        // Update if validation successful
        // Split by dot, but add the dot back in at the end.
        const values = value.split(".");
        values.forEach((value, index) => {
            const trimmed = value.trim();
            if(trimmed.length !== 0) {
                values[index] = value.trim() + ".";
            }
        });
        setUserPrompts(values.filter(item => item !== "").join(" "));
        moduleSettings.userprompts = values;
        saveSettingsFunc(moduleSettings);
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
            stoptokens: moduleSettings.stoptokens,
            systemprompts: moduleSettings.systemprompts,
            userprompts: moduleSettings.userprompts
        };
        
        try {
            const result = await validateProviderConfig(MODULES.BACKEND, PROVIDERS.OPENAI, currentConfig);
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
                                OpenAI Model you want to use.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <select
                                value={model}
                                onChange={(e) => setModelAndUpdate(e.target.value)}
                                className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100">
                                {modelOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
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
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            System prompt
                            <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                System prompt used to control the behaviour of the model.
                                <br/>Free form input
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <textarea name="systemprompts"
                                      className="mt-1 block w-full bg-neutral-800 min-h-24 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                      placeholder="System prompt" value={systemPrompts}
                                      onChange={(e) => setSystemPrompts(e.target.value)}
                                      onBlur={(e) => validateSystemPromptsAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            User prompt
                            <SettingsTooltip tooltipIndex={9} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                User prompt used to provide additional context
                                <br/>Free form input
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <textarea name="userprompts"
                                      className="mt-1 block w-full bg-neutral-800 min-h-24 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                      placeholder="User prompt" value={userPrompts}
                                      onChange={(e) => setUserPrompts(e.target.value)}
                                      onBlur={(e) => validateUserPromptsAndUpdate(e.target.value)}/>
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

export default BackendOpenAISettingsView;
