import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const BackendCharacterAISettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.BACKEND][PROVIDERS.CHARACTERAI];
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
    const [apiToken, setApiToken] = useState(mergedSettings.apitoken);
    const [chatRoomURL, setChatRoomURL] = useState(mergedSettings.chatroomurl);


    // Validation Functions
    const validateApiTokenAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.apitoken.length > 0) {
            showModal("API Token cannot be empty.");
            setApiToken(moduleSettings.apitoken);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, apitoken: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateChatRoomAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if ((moduleSettings.chatroomurl.length > 0 && value.length === 0) || (value.length > 0 && urlRegex.test(value) === false)) {
            showModal("Chat room URL must be a valid URL.");
            setChatRoomURL(moduleSettings.chatroomurl);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, chatroomurl: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            apitoken: moduleSettings.apitoken,
            chatroomurl: moduleSettings.chatroomurl
        };
        
        try {
            const result = await validateProviderConfig(MODULES.BACKEND, PROVIDERS.CHARACTERAI, currentConfig);
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
        setApiToken(currentMergedSettings.apitoken);
        setChatRoomURL(currentMergedSettings.chatroomurl);
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
                  <div className="flex items-center mb-4 w-full">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          API Token
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Your Character AI API Token
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="password" name="apitoken"
                                 className="input-field w-full p-2 rounded"
                                 placeholder="Character AI API Token" value={apiToken}
                                 onChange={(e) => setApiToken(e.target.value)}
                                 onBlur={(e) => validateApiTokenAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center mb-4 w-full">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          Chatroom URL
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Web URL of the C.AI Chatroom you want to link this entity with.
                              <br/>You can copy it directly from your browser's address bar.
                              <br/>This currently only supports Chatrooms with a single AI.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="text" name="chatroomurl"
                                 className="input-field w-full p-2 rounded"
                                 placeholder="CharacterAI Chatroom URL" value={chatRoomURL}
                                 onChange={(e) => setChatRoomURL(e.target.value)}
                                 onBlur={(e) => validateChatRoomAndUpdate(e.target.value)}/>
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

export default BackendCharacterAISettingsView;
