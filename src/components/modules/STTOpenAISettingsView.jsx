import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const STTOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.STT][PROVIDERS.OPENAI];
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
    const [openAIAPIKey, setOpenAIAPIKey] = useState(mergedSettings.openaiapikey);

    // Validation Functions
    const validateApikeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("API Key cannot be empty.");
            setOpenAIAPIKey(moduleSettings.openaiapikey);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, openaiapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            openaiapikey: moduleSettings.openaiapikey
        };
        
        try {
            const result = await validateProviderConfig(MODULES.STT, PROVIDERS.OPENAI, currentConfig);
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
        setOpenAIAPIKey(currentMergedSettings.openaiapikey);
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
                      <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
                          API Key
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Your OpenAI API Key
                          </SettingsTooltip>
                      </label>
                      <div className="w-5/6 px-3">
                          <input type="password" name="apikey"
                                 className="input-field mt-1 block w-full"
                                 placeholder="OpenAI API Key" value={openAIAPIKey}
                                 onChange={(e) => setOpenAIAPIKey(e.target.value)}
                                 onBlur={(e) => validateApikeyAndUpdate(e.target.value)}/>
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

export default STTOpenAISettingsView;
