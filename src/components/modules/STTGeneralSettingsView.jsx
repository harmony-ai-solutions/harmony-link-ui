import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";


const STTGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    // Fields
    const [mainStreamTimeMillis, setMainStreamTimeMillis] = useState(initialSettings.streamrecording.mainstreamtimemillis);
    const [transitionStreamTimeMillis, setTransitionStreamTimeMillis] = useState(initialSettings.streamrecording.transitionstreamtimemillis);
    const [maxBufferCount, setMaxBufferCount] = useState(initialSettings.streamrecording.maxbuffercount);

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
        // Reset Entity map
        setModuleSettings(initialSettings);
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
                          Main Stream Time (ms)
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Duration of the Primary Recording Stream Chunks in Milliseconds.
                              <br/>
                              <br/><span className="text-orange-400">CAUTION: It's recommended to not change this value unless you know what you're doing.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="mainstreamtimemillis"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Main Stream Milliseconds" value={mainStreamTimeMillis}
                                 onChange={(e) => setMainStreamTimeMillis(e.target.value)}
                                 onBlur={(e) => validateTranscriptionMainStreamTimeMillisAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Transition Stream Time (ms)
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Duration of a chunk buffer transition frame in milliseconds. Needs to be a multiple of Main Stream Time.
                              As soon as the buffer size (see below) has been reached, a transcription event will be triggered
                              for the current buffer, to reduce latency for the AI to reply. For the duration of this frame,
                              audio chunks will be kept, to help Harmony Link matching multiple parts of long utterances.
                              <br/>
                              <br/><span className="text-orange-400">CAUTION: Setting this value too low may result in bad speech transcriptions.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="transitionstreamtimemillis"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Transition Stream Milliseconds"
                                 value={transitionStreamTimeMillis}
                                 onChange={(e) => setTransitionStreamTimeMillis(e.target.value)}
                                 onBlur={(e) => validateTranscriptionTransitionStreamTimeMillisAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Transcription Max Buffer Count
                          <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Buffer for intermediate transcription processing. If the user is talking for a long period of time,
                              this buffer will get filled with audio segments until it's full, before an intermediate transcription
                              will be executed, reducing the amount of time until the full transcription has been performed,
                              and thus, resulting in a faster response by the AI.
                              <br/>
                              <br/><span className="text-orange-400">CAUTION: Setting this value too low may result in bad speech transcriptions.</span>
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="maxbuffercount"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Max Buffer Count"
                                 value={maxBufferCount}
                                 onChange={(e) => setMaxBufferCount(e.target.value)}
                                 onBlur={(e) => validateTranscriptionMaxBufferCountAndUpdate(e.target.value)}/>
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

export default STTGeneralSettingsView;
