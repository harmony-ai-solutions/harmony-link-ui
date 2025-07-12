import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {getAvailableIntegrationsForProvider, validateProviderConfig} from "../../services/managementApiService.js";
import IntegrationDisplay from "../integrations/IntegrationDisplay.jsx";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";


const RAGOpenAICompatibleSettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [embeddingModel, setEmbeddingModel] = useState(initialSettings.embeddingmodel);

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

    const validateApiKeyAndUpdate = (value) => {
        moduleSettings.apikey = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const validateEmbeddingModelAndUpdate = (value) => {
        if (value.trim() === "") {
            showModal("Embedding Model cannot be empty.");
            setEmbeddingModel(moduleSettings.embeddingmodel);
            return false;
        }
        moduleSettings.embeddingmodel = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const setInitialValues = () => {
        setModuleSettings(initialSettings);
    };

    const fetchIntegrations = async () => {
        try {
            const integrations = await getAvailableIntegrationsForProvider('rag', 'openaicompatible');
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

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });

        const currentConfig = {
            provider: 'openaicompatible',
            provideropenaicompatible: {
                baseurl: baseURL,
                apikey: apiKey,
                embeddingmodel: embeddingModel,
            },
        };

        try {
            const result = await validateProviderConfig('rag', 'openaicompatibe', currentConfig);
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
                                The base URL for the OpenAI compatible API endpoint that provides embedding services.
                                <br/>This should be the root URL of your embedding service (e.g., http://localhost:11434 for Ollama).
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
                                Your API Key for the OpenAI compatible embedding service (if required).
                                <br/>Leave empty if the service doesn't require authentication.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="apikey"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="API Key" value={apiKey}
                                   onChange={(e) => setApiKey(e.target.value)}
                                   onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                            Embedding Model
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The name of the embedding model to use.
                                <br/>This should match the model name available on your embedding service.
                                <br/>Examples: nomic-embed-text, all-MiniLM-L6-v2, text-embedding-ada-002, etc.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="text" name="embeddingmodel"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Embedding Model Name" value={embeddingModel}
                                   onChange={(e) => setEmbeddingModel(e.target.value)}
                                   onBlur={(e) => validateEmbeddingModelAndUpdate(e.target.value)}/>
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

export default RAGOpenAICompatibleSettingsView;
