import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {validateProviderConfig} from "../../services/managementApiService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";


const BackendCharacterAISettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [apiToken, setApiToken] = useState(initialSettings.apitoken);
    const [chatRoomURL, setChatRoomURL] = useState(initialSettings.chatroomurl);


    // Validation Functions
    const validateApiTokenAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.apitoken.length > 0) {
            showModal("API Token cannot be empty.");
            setApiToken(moduleSettings.apitoken);
            return false;
        }
        // Update if validation successful
        moduleSettings.apitoken = value;
        saveSettingsFunc(moduleSettings);
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
        moduleSettings.chatroomurl = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            apitoken: moduleSettings.apitoken,
            chatroomurl: moduleSettings.chatroomurl
        };
        
        try {
            const result = await validateProviderConfig('backend', 'characterai', currentConfig);
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
    }, []);

    return(
      <>
          <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
              <div className="flex flex-wrap items-center -px-10 w-full">
                  <div className="flex items-center mb-6 w-full">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          API Token
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Your Character AI API Token
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="password" name="apitoken"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Character AI API Token" value={apiToken}
                                 onChange={(e) => setApiToken(e.target.value)}
                                 onBlur={(e) => validateApiTokenAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center mb-6 w-full">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
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
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="CharacterAI Chatroom URL" value={chatRoomURL}
                                 onChange={(e) => setChatRoomURL(e.target.value)}
                                 onBlur={(e) => validateChatRoomAndUpdate(e.target.value)}/>
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

export default BackendCharacterAISettingsView;
