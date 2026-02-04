import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import { MODULES } from "../../constants/modules.js";


const CognitionGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.COGNITION].general;
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Base Settings reference
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Fields
    const [generateExpressions, setGenerateExpressions] = useState(mergedSettings.generateexpressions);
    const [maxCognitionEvents, setMaxCognitionEvents] = useState(mergedSettings.maxcognitionevents);

    const toggleGenerateExpressions = (value) => {
        setGenerateExpressions(value);
        const updatedSettings = { ...moduleSettings, generateexpressions: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    };

    const handleMaxCognitionEventsChange = (value) => {
        const numValue = parseInt(value) || 0;
        setMaxCognitionEvents(numValue);
        const updatedSettings = { ...moduleSettings, maxcognitionevents: numValue };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setGenerateExpressions(currentMergedSettings.generateexpressions);
        setMaxCognitionEvents(currentMergedSettings.maxcognitionevents);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return(
      <div className="space-y-4">
          <div className="flex items-center w-full">
              <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                  Max Cognition Events
                  <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                   setTooltipVisible={setTooltipVisible}>
                      Maximum number of cognition events to include when building the system prompt.
                      <br/>Higher values provide more context but increase token usage.
                  </SettingsTooltip>
              </label>
              <div className="w-2/3 px-3">
                  <input type="number"
                         name="maxcognitionevents"
                         className="input-field w-full p-2 rounded"
                         value={maxCognitionEvents}
                         onChange={(e) => handleMaxCognitionEventsChange(e.target.value)}
                         min="1"
                         placeholder="20"/>
              </div>
          </div>

          <div className="flex items-center w-full">
              <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                  Generate Expressions
                  <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                   setTooltipVisible={setTooltipVisible}>
                      When enabled, the Cognition module will automatically determine the character's emotional state and facial expression based on the conversation history.
                      <br/>These updates will be sent as events to the Harmony Plugin.
                  </SettingsTooltip>
              </label>
              <div className="w-2/3 px-3">
                  <input type="checkbox" name="generateexpressions"
                         className="h-4 w-4 rounded text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                         checked={generateExpressions}
                         onChange={(e) => toggleGenerateExpressions(e.target.checked)}/>
              </div>
          </div>
      </div>
    );
}

export default CognitionGeneralSettingsView;
