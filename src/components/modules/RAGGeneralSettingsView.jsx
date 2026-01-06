import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import RAGCollectionManager from "./RAGCollectionManager.jsx";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import { MODULES } from "../../constants/modules.js";

const RAGGeneralSettingsView = ({initialSettings, saveSettingsFunc, entityId}) => {
    // Merge initial settings with defaults
    const defaults = {
        ...MODULE_DEFAULTS[MODULES.RAG].general,
        chromem: MODULE_DEFAULTS[MODULES.RAG].chromem
    };
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Collections management state
    const [showCollectionsModal, setShowCollectionsModal] = useState(false);

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Base Settings reference
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Fields
    const [embeddingConcurrency, setEmbeddingConcurrency] = useState(mergedSettings.chromem?.embeddingconcurrency || 0);

    // Validation Functions
    const validateEmbeddingConcurrencyAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 1 || numValue > 8) {
            showModal("Embedding Concurrency must be a non-negative number between 1 and 8.");
            setEmbeddingConcurrency(moduleSettings.chromem?.embeddingconcurrency || 0);
            return false;
        } else if (numValue === moduleSettings.chromem?.embeddingconcurrency) {
            return true;
        }
        // Update if validation successful
        const updatedSettings = {
            ...moduleSettings,
            chromem: {
                ...(moduleSettings.chromem || {}),
                embeddingconcurrency: numValue
            }
        };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);
        setEmbeddingConcurrency(currentMergedSettings.chromem?.embeddingconcurrency || 0);
    };

    const openCollectionsModal = () => {
        setShowCollectionsModal(true);
    };

    const closeCollectionsModal = () => {
        setShowCollectionsModal(false);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return(
      <>
          <div className="flex flex-wrap w-full pt-2">
              <div className="flex flex-wrap items-center -px-10 mb-3 w-full">
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Embedding Concurrency
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Controls how many embedding operations can run concurrently.
                              <br/>Set to 0 for unlimited concurrency (default).
                              <br/>Higher values may improve performance on systems with multiple CPU cores,
                              but may also increase memory usage.
                              <br/>Lower values can help prevent system overload on resource-constrained environments.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="embeddingconcurrency"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Embedding Concurrency (0 = unlimited)" value={embeddingConcurrency}
                                 onChange={(e) => setEmbeddingConcurrency(e.target.value)}
                                 onBlur={(e) => validateEmbeddingConcurrencyAndUpdate(e.target.value)}/>
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

export default RAGGeneralSettingsView;
