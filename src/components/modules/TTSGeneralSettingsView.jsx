import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import { MODULES } from "../../constants/modules.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const TTSGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.TTS].general;
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
    const [vocalizeNonverbal, setVocalizeNonverbal] = useState(mergedSettings.vocalizenonverbal);
    const [wordsToReplace, setWordsToReplace] = useState(mergedSettings.wordstoreplace ? Object.entries(mergedSettings.wordstoreplace).map(([key, value]) => `${key}: ${value}`).join('\n') : "");

    // Validation Functions
    const setVocalizeNonverbalAndUpdate = (value) => {
        setVocalizeNonverbal(value);
        const updatedSettings = { ...moduleSettings, vocalizenonverbal: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    }
    const validateWordsToReplaceAndUpdate = (value) => {
        if (value.trim() === "") {
            setWordsToReplace("");
            const updatedSettings = { ...moduleSettings, wordstoreplace: {} };
            setModuleSettings(updatedSettings);
            saveSettingsFunc(updatedSettings);
            return false;
        }
        // Update if validation successful
        // Split by dot, but add the dot back in at the end.
        const newWordsToReplace = {};
        const lines = value.split('\n');
        lines.forEach((line, index) => {
            const [key, val] = line.split(':').map(part => part.trim());
                if(key.length !== 0 && val.length !== 0) {
                    newWordsToReplace[key] = val;
            }
        });
        setWordsToReplace(Object.entries(newWordsToReplace).map(([key, val]) => `${key}: ${val}`).join('\n'));
        const updatedSettings = { ...moduleSettings, wordstoreplace: newWordsToReplace };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    };

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setVocalizeNonverbal(currentMergedSettings.vocalizenonverbal);
        setWordsToReplace(currentMergedSettings.wordstoreplace ? Object.entries(currentMergedSettings.wordstoreplace).map(([key, value]) => `${key}: ${value}`).join('\n') : "");
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return(
      <>
          <div className="flex flex-wrap w-full pt-2">
              <div className="flex flex-wrap items-center -px-10 mb-3 w-full">
                  <div className="flex items-center mb-6 w-1/2">
                      <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                          Vocalize Nonverbal Interaction
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              If this option is enabled, Harmony Link will also use TTS to vocalize nonverbal
                              interaction,
                              which means the AI will for example say "smiles" (nonverbal part) and "Hello my Friend"
                              (verbal part)
                              instead of just "Hello my Friend".
                              <br/>Recommended to disable unless you're debugging cognition or movement issues.
                          </SettingsTooltip>
                      </label>
                      <div className="w-1/2 px-3">
                          <input type="checkbox" name="vocalizenonverbal" className="rounded text-indigo-600 mt-1"
                                 checked={vocalizeNonverbal}
                                 onChange={(e) => setVocalizeNonverbalAndUpdate(e.target.checked)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-full">
                      <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
                          Words to Replace
                          <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              Enter a list of words which you want to be replaced in the vocalized output before processing for TTS.
                              <br/>For example, if the AI uses a wrong name for you, or spells it wrongly, you can replace it with a different name or typing variant.
                              E.g.: RRacer2021: Simon will make it say "Simon" instead of "RRacer2021".
                              <br/>Use one line per word to replace.
                          </SettingsTooltip>
                      </label>
                      <div className="w-5/6 px-3">
                            <textarea name="wordstoreplace"
                                      className="input-field mt-1 block w-full min-h-24"
                                      placeholder="List of Words to Replace in format word:replacement" value={wordsToReplace}
                                      onChange={(e) => setWordsToReplace(e.target.value)}
                                      onBlur={(e) => validateWordsToReplaceAndUpdate(e.target.value)}/>
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

export default TTSGeneralSettingsView;
