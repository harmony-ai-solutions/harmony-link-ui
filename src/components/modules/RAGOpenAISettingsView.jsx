import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";


const RAGOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.RAG][PROVIDERS.OPENAI];
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
    const [apiKey, setApiKey] = useState(mergedSettings.openaiapikey);
    const [embeddingModel, setEmbeddingModel] = useState(mergedSettings.embeddingmodel);

    // Validation Functions
    const validateApiKeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("OpenAI API Key cannot be empty.");
            setApiKey(moduleSettings.openaiapikey);
            return false;
        } else if (value === moduleSettings.openaiapikey) {
            return true; // Skip if no change
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, openaiapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const validateEmbeddingModelAndUpdate = (value) => {
        if (value.trim() === "") {
            showModal("Embedding Model cannot be empty.");
            setEmbeddingModel(moduleSettings.embeddingmodel);
            return false;
        } else if (value === moduleSettings.embeddingmodel) {
            return true; // Skip if no change
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, embeddingmodel: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setApiKey(currentMergedSettings.openaiapikey);
        setEmbeddingModel(currentMergedSettings.embeddingmodel);
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' }); // Update validation state

        const currentConfig = {
            provider: 'openai',
            provideropenai: {
                openaiapikey: moduleSettings.openaiapikey,
                embeddingmodel: moduleSettings.embeddingmodel,
            },            
        };

        try {
            const result = await validateProviderConfig(MODULES.RAG, PROVIDERS.OPENAI, currentConfig); // Changed to lowercase 'v'
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

    return(
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                            OpenAI API Key
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your OpenAI API Key for accessing embedding services.
                                <br/>You can obtain this from your OpenAI account dashboard.
                                <br/>Make sure your account has sufficient credits for embedding operations.
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="password" name="openaiapikey"
                                   className="input-field mt-1 block w-full"
                                   placeholder="OpenAI API Key" value={apiKey}
                                   onChange={(e) => setApiKey(e.target.value)}
                                   onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                            Embedding Model
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The OpenAI embedding model to use for generating vector embeddings.
                                <br/>Popular options include:
                                <br/>• text-embedding-3-small (1536 dimensions, cost-effective)
                                <br/>• text-embedding-3-large (3072 dimensions, higher performance)
                                <br/>• text-embedding-ada-002 (1536 dimensions, legacy model)
                            </SettingsTooltip>
                        </label>
                        <div className="w-2/3 px-3">
                            <input type="text" name="embeddingmodel"
                                   className="input-field mt-1 block w-full"
                                   placeholder="text-embedding-3-small" value={embeddingModel}
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
                            <h3 className="text-lg leading-6 font-medium text-error mt-4">Invalid Input</h3>
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

export default RAGOpenAISettingsView;
