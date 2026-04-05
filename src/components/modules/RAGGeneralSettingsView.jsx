import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import RAGCollectionManager from "./RAGCollectionManager.jsx";
import ErrorDialog from "../modals/ErrorDialog.jsx";
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
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
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
                                 className="input-field mt-1 block w-full"
                                 placeholder="Embedding Concurrency (0 = unlimited)" value={embeddingConcurrency}
                                 onChange={(e) => setEmbeddingConcurrency(e.target.value)}
                                 onBlur={(e) => validateEmbeddingConcurrencyAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <div className="w-1/3 px-3"></div>
                      <div className="w-2/3 px-3">
                          <button
                              onClick={openCollectionsModal}
                              disabled={!entityId}
                              className="btn-accent-gradient text-sm py-1.5 px-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Manage Collections
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          <RAGCollectionManager
              entityId={entityId}
              isOpen={showCollectionsModal}
              onClose={closeCollectionsModal}
              onError={(msg) => showModal(msg)}
          />

          <ErrorDialog
              isOpen={isModalVisible}
              title="Invalid Input"
              message={modalMessage}
              type="error"
              onClose={() => setIsModalVisible(false)}
          />
      </>
    );
}

export default RAGGeneralSettingsView;
