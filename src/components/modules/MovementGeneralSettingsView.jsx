import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../../utils/logger.js";
import {cloneDeep} from "lodash";


const MovementGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
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
    const [startupSyncTimeout, setStartupSyncTimeout] = useState(initialSettings.startupsynctimeout);
    const [executionThreshold, setExecutionThreshold] = useState(initialSettings.executionthreshold);

    // Validation Functions
    const validateStartupSyncTimeoutAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 2) {
            showModal("Action Sync Timeout should be at least 2 seconds.");
            setStartupSyncTimeout(moduleSettings.startupsynctimeout);
            return false;
        }
        // Update if validation successful
        moduleSettings.startupsynctimeout = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
    };
    const validateExecutionThresholdAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 1.00)) {
            showModal("Execution Threshold must be a positive number between 0.01 and 1.00.");
            setExecutionThreshold(moduleSettings.executionthreshold);
            return false;
        }
        // Update if validation successful
        moduleSettings.executionthreshold = numValue;
        saveSettingsFunc(moduleSettings);
        return true;
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
              <div className="flex flex-wrap items-center -px-10 mb-3 w-full">
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Startup Sync Timeout
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              This value defines how long the Movement module waits for the Calibration of the
                              Plugin's Action Definitions against the Movement backend.
                              <br/>It is recommended to set this to a reasonably high value, since calibration may
                              take a couple of seconds.
                              <br/>If the timeout is reached before the calibration Threshold is reached, the movement module
                              will be disabled for this entity.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="maxtokens"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Startup Sync Timeout" value={startupSyncTimeout}
                                 onChange={(e) => setStartupSyncTimeout(e.target.value)}
                                 onBlur={(e) => validateStartupSyncTimeoutAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Execution Threshold
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Execution Threshold determines the amount of percentage that a nonverbal AI Interaction needs
                              to match with the calibrated actions to trigger a movement event that gets sent to the Harmony Plugin.
                              <br/>0.9 means 90%; 0.4 means 40%.
                              <br/>The ideal value varies highly with the amount of detail put into creating action
                              descriptions by the plugin developer.
                              <br/>If no or very few movement actions are being triggered,
                              try lowering this value.
                              <br/>If you're experiencing random interaction happening, or noticeably different actions from
                              what is described by the Backend Engine, try increasing this value.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <input type="number" name="temperature" step=".01"
                                 className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                 placeholder="Execution Threshold" value={executionThreshold}
                                 onChange={(e) => setExecutionThreshold(e.target.value)}
                                 onBlur={(e) => validateExecutionThresholdAndUpdate(e.target.value)}/>
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

export default MovementGeneralSettingsView;