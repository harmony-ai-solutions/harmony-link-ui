import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {validateProviderConfig} from "../../services/management/configService.js";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import {MODULES, PROVIDERS} from "../../constants/modules.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const TTSElevenlabsSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.TTS][PROVIDERS.ELEVENLABS];
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
    const [elevenlabsApiKey, setElevenlabsApiKey] = useState(mergedSettings.elevenlabsapikey);
    const [modelId, setModelId] = useState(mergedSettings.modelid);
    const [voiceId, setVoiceId] = useState(mergedSettings.voiceid);
    const [stability, setStability] = useState(mergedSettings.stability);
    const [similarityBoost, setSimilarityBoost] = useState(mergedSettings.similarityboost);
    const [style, setStyle] = useState(mergedSettings.style);
    const [speakerBoost, setSpeakerBoost] = useState(mergedSettings.speakerboost);

    // Validation Functions
    const validateApiKeyAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.elevenlabsapikey.length > 0) {
            showModal("Api Key cannot be empty.");
            setElevenlabsApiKey(moduleSettings.elevenlabsapikey);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, elevenlabsapikey: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateModelIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.modelid.length > 0) {
            showModal("Model ID cannot be empty.");
            setModelId(moduleSettings.modelid);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, modelid: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateVoiceIdAndUpdate = (value) => {
        if (value.trim() === "" && moduleSettings.voiceid.length > 0) {
            showModal("Voice ID cannot be empty.");
            setVoiceId(moduleSettings.voiceid);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, voiceid: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
        const updatedSettings = { ...moduleSettings, stability: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
        const updatedSettings = { ...moduleSettings, similarityboost: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
        const updatedSettings = { ...moduleSettings, style: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const setSpeakerBoostAndUpdate = (value) => {
        setSpeakerBoost(value);
        const updatedSettings = { ...moduleSettings, speakerboost: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
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
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setElevenlabsApiKey(currentMergedSettings.elevenlabsapikey);
        setModelId(currentMergedSettings.modelid);
        setVoiceId(currentMergedSettings.voiceid);
        setStability(currentMergedSettings.stability);
        setSimilarityBoost(currentMergedSettings.similarityboost);
        setStyle(currentMergedSettings.style);
        setSpeakerBoost(currentMergedSettings.speakerboost);
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
                                Your Elevenlabs API Key
                          </SettingsTooltip>
                      </label>
                      <div className="w-5/6 px-3">
                          <input type="password" name="apikey"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Elevenlabs API Key" value={elevenlabsApiKey}
                                 onChange={(e) => setElevenlabsApiKey(e.target.value)}
                                 onBlur={(e) => validateApiKeyAndUpdate(e.target.value)}/>
                      </div>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                      Model ID
                      <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Name / API ID of the Elevenlabs Model. Please check the <span className="text-warning"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/models" target="_blank">Elevenlabs
                          documentation</a></span> for possible
                          values.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="modelid"
                             className="input-field mt-1 block w-full"
                             placeholder="Elevenlabs Model ID" value={modelId}
                             onChange={(e) => setModelId(e.target.value)}
                             onBlur={(e) => validateModelIdAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                      Voice ID
                      <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Name / API ID of the Elevenlabs Voice. You can find it on the <span className="text-warning"><a
                          href="https://elevenlabs.io"
                          target="_blank">Elevenlabs
                          Website</a></span>.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="text" name="voiceid"
                             className="input-field mt-1 block w-full"
                             placeholder="Elevenlabs Voice ID" value={voiceId}
                             onChange={(e) => setVoiceId(e.target.value)}
                             onBlur={(e) => validateVoiceIdAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                      Stability
                      <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Stability. Please check the <span className="text-warning"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicestability" step=".01"
                             className="input-field mt-1 block w-full"
                             placeholder="Stability" value={stability}
                             onChange={(e) => setStability(e.target.value)}
                             onBlur={(e) => validateStabilityAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                      Similarity Boost
                      <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Similarity Boost. Please check the <span className="text-warning"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicesimilarityboost" step=".01"
                             className="input-field mt-1 block w-full"
                                 placeholder="Similarity Boost" value={similarityBoost}
                             onChange={(e) => setSimilarityBoost(e.target.value)}
                             onBlur={(e) => validateSimilarityBoostAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                      Style
                      <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Modifier for Voice Style. Please check the <span className="text-warning"><a
                          href="https://elevenlabs.io/docs/speech-synthesis/voice-settings" target="_blank">Elevenlabs
                          Documentation</a></span> for details.
                      </SettingsTooltip>
                  </label>
                  <div className="w-2/3 px-3">
                      <input type="number" name="voicestyle" step=".01"
                             className="input-field mt-1 block w-full"
                             placeholder="Style" value={style}
                             onChange={(e) => setStyle(e.target.value)}
                             onBlur={(e) => validateStyleAndUpdate(e.target.value)}/>
                  </div>
              </div>
              <div className="flex items-center mb-6 w-1/2">
                  <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                      Enable Speaker Boost
                      <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                       setTooltipVisible={setTooltipVisible}>
                          Enables / Disables Speaker Boost. Please check the <span className="text-warning"><a
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

export default TTSElevenlabsSettingsView;
