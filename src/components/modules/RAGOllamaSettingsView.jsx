import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import {validateProviderConfig} from "../../services/management/integrationsService.js";


const RAGOllamaSettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [baseURL, setBaseURL] = useState(initialSettings.baseurl);
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
        // Reset Entity map
        setModuleSettings(initialSettings);
    };

    const handleValidateConfig = async () => {
        setValidationState({status: 'loading', message: 'Validating configuration...'});

        const currentConfig = {
            baseurl: moduleSettings.baseurl,
            embeddingmodel: moduleSettings.embeddingmodel,
        };

        try {
            const result = await validateProviderConfig(MODULES.RAG, PROVIDERS.OLLAMA, currentConfig);
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
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Base URL
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The base URL for your Ollama instance.
                                <br/>Default is usually http://localhost:11434 for local installations.
                                <br/>Make sure Ollama is running and accessible at this URL.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="baseurl"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="http://localhost:11434" value={baseURL}
                                   onChange={(e) => setBaseURL(e.target.value)}
                                   onBlur={(e) => validateBaseURLAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Embedding Model
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The name of the embedding model available in your Ollama instance.
                                <br/>Popular embedding models include:
                                <br/>• nomic-embed-text (762MB, high performance)
                                <br/>• all-minilm (23MB, lightweight and fast)
                                <br/>• snowflake-arctic-embed (669MB, latest Arctic model)
                                <br/>Make sure the model is pulled in Ollama first: "ollama pull model-name"
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="embeddingmodel"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="nomic-embed-text" value={embeddingModel}
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

export default RAGOllamaSettingsView;
