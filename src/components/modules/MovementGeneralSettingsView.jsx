import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import { MODULES } from "../../constants/modules.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const MovementGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.MOVEMENT].general;
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
    const [startupSyncTimeout, setStartupSyncTimeout] = useState(mergedSettings.startupsynctimeout);
    const [executionThreshold, setExecutionThreshold] = useState(mergedSettings.executionthreshold);

    // Validation Functions
    const validateStartupSyncTimeoutAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue <= 2) {
            showModal("Action Sync Timeout should be at least 2 seconds.");
            setStartupSyncTimeout(moduleSettings.startupsynctimeout);
            return false;
        } else if (numValue === moduleSettings.startupsynctimeout) {
            return true;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, startupsynctimeout: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };
    const validateExecutionThresholdAndUpdate = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || (numValue <= 0.01 || numValue > 1.00)) {
            showModal("Execution Threshold must be a positive number between 0.01 and 1.00.");
            setExecutionThreshold(moduleSettings.executionthreshold);
            return false;
        } else if (numValue === moduleSettings.executionthreshold) {
            return true;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, executionthreshold: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setStartupSyncTimeout(currentMergedSettings.startupsynctimeout);
        setExecutionThreshold(currentMergedSettings.executionthreshold);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return(
      <>
          <div className="flex flex-wrap w-full pt-2">
              <div className="flex flex-wrap items-center -px-10 mb-4 w-full">
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
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
                                 className="input-field w-full p-2 rounded"
                                 placeholder="Startup Sync Timeout" value={startupSyncTimeout}
                                 onChange={(e) => setStartupSyncTimeout(e.target.value)}
                                 onBlur={(e) => validateStartupSyncTimeoutAndUpdate(e.target.value)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-1/2">
                      <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
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
                                 className="input-field w-full p-2 rounded"
                                 placeholder="Execution Threshold" value={executionThreshold}
                                 onChange={(e) => setExecutionThreshold(e.target.value)}
                                 onBlur={(e) => validateExecutionThresholdAndUpdate(e.target.value)}/>
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

export default MovementGeneralSettingsView;
