import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {validateProviderConfig} from "../../services/managementApiService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";


const TTSOpenAISettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    const modelOptions = [
        { name: 'TTS-1', value: 'tts-1' },
        { name: 'TTS-1 HD', value: 'tts-1-hd' }
    ];

    // Fields
    const [openAIAPIKey, setOpenAIAPIKey] = useState(initialSettings.openaiapikey);
    const [model, setModel] = useState(initialSettings.model);
    const [voice, setVoice] = useState(initialSettings.voice);
    const [speed, setSpeed] = useState(initialSettings.speed);
    const [format, setFormat] = useState(initialSettings.format);

    // Validation Functions
    const validateApikeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.openaiapikey.length > 0) {
            showModal("API Key cannot be empty.");
            setOpenAIAPIKey(moduleSettings.openaiapikey);
            return false;
        }
        // Update if validation successful
        moduleSettings.openaiapikey = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const setModelAndUpdate = (value) => {
        setModel(value);
        moduleSettings.model = value;
        saveSettingsFunc(moduleSettings);
        return true;
    }
    const validateVoiceIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.voice.length > 0) {
            showModal("Voice cannot be empty.");
            setVoice(moduleSettings.voice);
            return false;
        }
        // Update if validation successful
        moduleSettings.voice = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateSpeedAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue < 0.25 || numValue > 4.00)) {
            showModal("Stability must be a positive number between 0.25 and 4.00, or set to 0 to disable.");
            setSpeed(moduleSettings.speed);
            return false;
        }
        // Update if validation successful
        moduleSettings.speed = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateFormatAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.format.length > 0) {
            showModal("Output Format cannot be empty.");
            setFormat(moduleSettings.format);
            return false;
        }
        // Update if validation successful
        moduleSettings.format = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            openaiapikey: openAIAPIKey,
            model: model,
            voice: voice,
            speed: speed,
            format: format
        };
        
        try {
            const result = await validateProviderConfig('tts', 'openai', currentConfig);
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
                      <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                          API Key
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Your OpenAI API Key
                          </SettingsTooltip>
                      </label>
                      <div className="w-5/6 px-3">
                          <input type="password" name="apikey"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="OpenAI API Key" value={openAIAPIKey}
                                 onChange={(e) => setOpenAIAPIKey(e.target.value)}
                                 onBlur={(e) => validateApikeyAndUpdate(e.target.value)}/>
                      </div>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Model
                      <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          OpenAI TTS Model you want to use.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <select
                          value={model}
                          onChange={(e) => setModelAndUpdate(e.target.value)}
                          className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100">
                          {modelOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                  {option.name}
                              </option>
                          ))}
                      </select>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Voice
                      <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Name / ID of the OpenAI Voice. Please check the <span className="text-orange-400"><a
                          href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-voice"
                          target="_blank">OpenAI
                          documentation</a></span> for possible
                          values.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="voice"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="OpenAI Voice Name" value={voice}
                             onChange={(e) => setVoice(e.target.value)}
                             onBlur={(e) => validateVoiceIdAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Speed
                      <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Speed. Please check the <span className="text-orange-400"><a
                          href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-speed"
                          target="_blank">OpenAI
                          documentation</a></span> for possible
                          values.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="speed" step=".01"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Speed" value={speed}
                             onChange={(e) => setSpeed(e.target.value)}
                             onBlur={(e) => validateSpeedAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Output Format
                      <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Output File Format of the OpenAI Voice. Please check the <span className="text-orange-400"><a
                          href="https://platform.openai.com/docs/api-reference/audio/createSpeech#audio-createspeech-response_format"
                          target="_blank">OpenAI
                          documentation</a></span> for possible
                          values.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="voiceid"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Output Format" value={format}
                             onChange={(e) => setFormat(e.target.value)}
                             onBlur={(e) => validateFormatAndUpdate(e.target.value)}/>
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

export default TTSOpenAISettingsView;
