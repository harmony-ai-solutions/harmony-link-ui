import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {validateProviderConfig} from "../../services/managementApiService.js";
import {MODULES, PROVIDERS} from "../../constants/modules.js";


const RAGMistralSettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    // Fields
    const [apiKey, setApiKey] = useState(initialSettings.mistralapikey);

    // Validation Functions
    const validateApiKeyAndUpdate = (value) => {
        if (value.trim() === "") {
            showModal("Mistral API Key cannot be empty.");
            setApiKey(moduleSettings.mistralapikey);
            return false;
        }
        moduleSettings.mistralapikey = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const setInitialValues = () => {
        // Reset Entity map
        setModuleSettings(initialSettings);
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });

        const currentConfig = {
            mistralapikey: moduleSettings.mistralapikey,
        };

        try {
            const result = await validateProviderConfig(MODULES.RAG, PROVIDERS.MISTRAL, currentConfig);
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
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Mistral API Key
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Your Mistral API Key for accessing embedding services.
                                <br/>You can obtain this from your Mistral AI account dashboard.
                                <br/>Mistral provides high-quality embedding models for various use cases.
                                <br/>Make sure your account has sufficient credits for embedding operations.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="password" name="mistralapikey"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Mistral API Key" value={apiKey}
                                   onChange={(e) => setApiKey(e.target.value)}
                                   onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
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

export default RAGMistralSettingsView;
