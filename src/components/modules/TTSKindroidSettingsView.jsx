import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const TTSKindroidSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.TTS][PROVIDERS.KINDROID];
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
    const [apiKey, setApiKey] = useState(mergedSettings.apikey);
    const [kindroidID, setKindroidID] = useState(mergedSettings.kindroidid);


    // Validation Functions
    const validateApiKeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.apikey.length > 0) {
            showModal("API Key cannot be empty.");
            setApiKey(moduleSettings.apikey);
            return false;
        } else if (value === moduleSettings.apikey) {
            return true;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, apikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateKindroidIDAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.kindroidid.length > 0) {
            showModal("Kindroid ID cannot be empty.");
            setKindroidID(moduleSettings.kindroidid);
            return false;
        } else if (value === moduleSettings.kindroidid) {
            return true;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, kindroidid: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            apikey: moduleSettings.apikey,
            kindroidid: moduleSettings.kindroidid
        };
        
        try {
            const result = await validateProviderConfig(MODULES.TTS, PROVIDERS.KINDROID, currentConfig);
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
        setApiKey(currentMergedSettings.apikey);
        setKindroidID(currentMergedSettings.kindroidid);
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
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          Kindroid API Key
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Your Kindroid AI API Key
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="password" name="apikey"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Your Kindroid AI API Key" value={apiKey}
                                 onChange={(e) => setApiKey(e.target.value)}
                                 onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center mb-6 w-full">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          Kindroid ID
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              The ID of the Kindroid character you want to link this entity with.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="text" name="kindroidid"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Your Kindroid's ID" value={kindroidID}
                                 onChange={(e) => setKindroidID(e.target.value)}
                                 onBlur={(e) => validateKindroidIDAndUpdate(e.target.value)}/>
                      </div>
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

export default TTSKindroidSettingsView;
