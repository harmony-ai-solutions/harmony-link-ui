import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";


const TTSElevenlabsSettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [elevenlabsApiKey, setElevenlabsApiKey] = useState(initialSettings.elevenlabsapikey);
    const [modelId, setModelId] = useState(initialSettings.modelid);
    const [voiceId, setVoiceId] = useState(initialSettings.voiceid);
    const [stability, setStability] = useState(initialSettings.stability);
    const [similarityBoost, setSimilarityBoost] = useState(initialSettings.similarityboost);
    const [style, setStyle] = useState(initialSettings.style);
    const [speakerBoost, setSpeakerBoost] = useState(initialSettings.speakerboost);

    // Validation Functions
    const validateApiKeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.elevenlabsapikey.length > 0) {
            showModal("Api Key cannot be empty.");
            setElevenlabsApiKey(moduleSettings.elevenlabsapikey);
            return false;
        }
        // Update if validation successful
        moduleSettings.elevenlabsapikey = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateModelIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.modelid.length > 0) {
            showModal("Model ID cannot be empty.");
            setModelId(moduleSettings.modelid);
            return false;
        }
        // Update if validation successful
        moduleSettings.modelid = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateVoiceIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.voiceid.length > 0) {
            showModal("Voice ID cannot be empty.");
            setVoiceId(moduleSettings.voiceid);
            return false;
        }
        // Update if validation successful
        moduleSettings.voiceid = value;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateStabilityAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue < 0.00 || numValue > 1.00)) {
            showModal("Stability must be a positive number between 0.01 and 1.00, or set to 0 to disable.");
            setStability(moduleSettings.stability);
            return false;
        }
        // Update if validation successful
        moduleSettings.stability = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateSimilarityBoostAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue < 0.00 || numValue > 1.00)) {
            showModal("Similarity Boost must be a positive number between 0.01 and 1.00, or set to 0 to disable.");
            setSimilarityBoost(moduleSettings.similarityboost);
            return false;
        }
        // Update if validation successful
        moduleSettings.similarityboost = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateStyleAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue < 0.00 || numValue > 1.00)) {
            showModal("Style must be a positive number between 0.01 and 1.00, or set to 0 to disable.");
            setStyle(moduleSettings.style);
            return false;
        }
        // Update if validation successful
        moduleSettings.style = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const setSpeakerBoostAndUpdate = (value) => {
        setSpeakerBoost(value);
        moduleSettings.speakerboost = value;
        saveSettingsFunc(moduleSettings);
    }

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        const currentConfig = {
            elevenlabsapikey: moduleSettings.elevenlabsapikey,
            modelid: moduleSettings.modelid,
            voiceid: moduleSettings.voiceid,
            stability: moduleSettings.stability,
            similarityboost: moduleSettings.similarityboost,
            style: moduleSettings.style,
            speakerboost: moduleSettings.speakerboost
        };
        
        try {
            const result = await validateProviderConfig(MODULES.TTS, PROVIDERS.ELEVENLABS, currentConfig);
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
                              Your Elevenlabs API Key
                          </SettingsTooltip>
                      </label>
                      <div className="w-5/6 px-3">
                          <input type="password" name="apikey"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Elevenlabs API Key" value={elevenlabsApiKey}
                                 onChange={(e) => setElevenlabsApiKey(e.target.value)}
                                 onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
                      </div>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Model ID
                      <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Name / API ID of the Elevenlabs Model. Please check the <span className="text-orange-400"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/models" target="_blank">Elevenlabs
                          documentation</a></span> for possible
                          values.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="modelid"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Elevenlabs Model ID" value={modelId}
                             onChange={(e) => setModelId(e.target.value)}
                             onBlur={(e) => validateModelIdAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Voice ID
                      <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Name / API ID of the Elevenlabs Voice. You can find it on the <span className="text-orange-400"><a
                          href="https://elevenlabs.io"
                          target="_blank">Elevenlabs
                          Website</a></span>.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="voiceid"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Elevenlabs Voice ID" value={voiceId}
                             onChange={(e) => setVoiceId(e.target.value)}
                             onBlur={(e) => validateVoiceIdAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Stability
                      <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Stability. Please check the <span className="text-orange-400"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicestability" step=".01"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Stability" value={stability}
                             onChange={(e) => setStability(e.target.value)}
                             onBlur={(e) => validateStabilityAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Similarity Boost
                      <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Similarity Boost. Please check the <span className="text-orange-400"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicesimilarityboost" step=".01"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Similarity Boost" value={similarityBoost}
                             onChange={(e) => setSimilarityBoost(e.target.value)}
                             onBlur={(e) => validateSimilarityBoostAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                      Style
                      <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Style. Please check the <span className="text-orange-400"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicestyle" step=".01"
                             className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                             placeholder="Style" value={style}
                             onChange={(e) => setStyle(e.target.value)}
                             onBlur={(e) => validateStyleAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                      Enable Speaker Boost
                      <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Enables / Disables Speaker Boost. Please check the <span className="text-orange-400"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-1/2 px-3">
                      <input type="checkbox" name="speakerboost" className="rounded text-indigo-600 mt-1"
                             checked={speakerBoost}
                             onChange={(e) => setSpeakerBoostAndUpdate(e.target.checked)}/>
                  </div>
              </div>
          </div>
          {
              isModalVisible && (
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

export default TTSElevenlabsSettingsView;
