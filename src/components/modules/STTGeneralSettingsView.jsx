import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import { MODULES } from "../../constants/modules.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const STTGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.STT].general;
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

    // Fields
    const [mainStreamTimeMillis, setMainStreamTimeMillis] = useState(mergedSettings.streamrecording.mainstreamtimemillis);
    const [transitionStreamTimeMillis, setTransitionStreamTimeMillis] = useState(mergedSettings.streamrecording.transitionstreamtimemillis);
    const [maxBufferCount, setMaxBufferCount] = useState(mergedSettings.streamrecording.maxbuffercount);

    // Validation Functions
    const validateTranscriptionMainStreamTimeMillisAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 500) {
            showModal("Duration of main transcription stream chunks must be at least 500 milliseconds.");
            setMainStreamTimeMillis(moduleSettings.streamrecording.mainstreamtimemillis);
            return false;
        }
        // Update if validation successful
        const updatedStreamRecording = { ...moduleSettings.streamrecording, mainstreamtimemillis: numValue };
        const updatedSettings = { ...moduleSettings, streamrecording: updatedStreamRecording };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateTranscriptionTransitionStreamTimeMillisAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        const mainStreamTime = moduleSettings.streamrecording.mainstreamtimemillis;
        if (isNaN(numValue) || numValue < 500 || numValue < mainStreamTime || numValue % mainStreamTime !== 0) {
            showModal("Duration of the transition stream chunks must be a multiple of the main stream chunks.");
            setTransitionStreamTimeMillis(moduleSettings.streamrecording.transitionstreamtimemillis);
            return false;
        }
        // Update if validation successful
        const updatedStreamRecording = { ...moduleSettings.streamrecording, transitionstreamtimemillis: numValue };
        const updatedSettings = { ...moduleSettings, streamrecording: updatedStreamRecording };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateTranscriptionMaxBufferCountAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 1) {
            showModal("Transcription chunk buffer must be at least 1");
            setMaxBufferCount(moduleSettings.streamrecording.maxbuffercount);
            return false;
        }
        // Update if validation successful
        const updatedStreamRecording = { ...moduleSettings.streamrecording, maxbuffercount: numValue };
        const updatedSettings = { ...moduleSettings, streamrecording: updatedStreamRecording };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setMainStreamTimeMillis(currentMergedSettings.streamrecording.mainstreamtimemillis);
        setTransitionStreamTimeMillis(currentMergedSettings.streamrecording.transitionstreamtimemillis);
        setMaxBufferCount(currentMergedSettings.streamrecording.maxbuffercount);
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
                          Main Stream Time (ms)
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Duration of the Primary Recording Stream Chunks in Milliseconds.
                              <br/>
                              <br/><span className="text-warning">CAUTION: It's recommended to not change this value unless you know what you're doing.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="mainstreamtimemillis"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Main Stream Milliseconds" value={mainStreamTimeMillis}
                                 onChange={(e) => setMainStreamTimeMillis(e.target.value)}
                                 onBlur={(e) => validateTranscriptionMainStreamTimeMillisAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          Transition Stream Time (ms)
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Duration of a chunk buffer transition frame in milliseconds. Needs to be a multiple of Main Stream Time.
                              As soon as the buffer size (see below) has been reached, a transcription event will be triggered
                              for the current buffer, to reduce latency for the AI to reply. For the duration of this frame,
                              audio chunks will be kept, to help Harmony Link matching multiple parts of long utterances.
                              <br/>
                              <br/><span className="text-warning">CAUTION: Setting this value too low may result in bad speech transcriptions.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="transitionstreamtimemillis"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Transition Stream Milliseconds"
                                 value={transitionStreamTimeMillis}
                                 onChange={(e) => setTransitionStreamTimeMillis(e.target.value)}
                                 onBlur={(e) => validateTranscriptionTransitionStreamTimeMillisAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                          Transcription Max Buffer Count
                          <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Buffer for intermediate transcription processing. If the user is talking for a long period of time,
                              this buffer will get filled with audio segments until it's full, before an intermediate transcription
                              will be executed, reducing the amount of time until the full transcription has been performed,
                              and thus, resulting in a faster response by the AI.
                              <br/>
                              <br/><span className="text-warning">CAUTION: Setting this value too low may result in bad speech transcriptions.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="maxbuffercount"
                                 className="input-field mt-1 block w-full"
                                 placeholder="Max Buffer Count"
                                 value={maxBufferCount}
                                 onChange={(e) => setMaxBufferCount(e.target.value)}
                                 onBlur={(e) => validateTranscriptionMaxBufferCountAndUpdate(e.target.value)}/>
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

export default STTGeneralSettingsView;
