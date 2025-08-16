import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug} from "../../utils/logger.js";
import {cloneDeep} from "lodash";


const TTSGeneralSettingsView = ({initialSettings, saveSettingsFunc}) => {
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

    const ttsOutputTypes = [
        { name: 'File', value: 'file' },
        { name: 'Binary', value: 'binary' },
    ];

    // Fields
    const [ttsOutputType, setTtsOutputType] = useState(initialSettings.outputtype);
    const [vocalizeNonverbal, setVocalizeNonverbal] = useState(initialSettings.vocalizenonverbal);
    const [wordsToReplace, setWordsToReplace] = useState(initialSettings.wordstoreplace ? Object.entries(initialSettings.wordstoreplace).map(([key, value]) => `${key}: ${value}`).join('\n') : "");

    // Validation Functions
    const setTTSOutputTypeAndUpdate = (value) => {
        setTtsOutputType(value);
        moduleSettings.outputtype = value;
        saveSettingsFunc(moduleSettings);
    }
    const setVocalizeNonverbalAndUpdate = (value) => {
        setVocalizeNonverbal(value);
        moduleSettings.vocalizenonverbal = value;
        saveSettingsFunc(moduleSettings);
    }
    const validateWordsToReplaceAndUpdate = (value) => {
        if (value.trim() === "") {
            setWordsToReplace("");
            return false;
        }
        // Update if validation successful
        // Split by dot, but add the dot back in at the end.
        const newWordsToReplace = {};
        const lines = value.split('\n');
        lines.forEach((line, index) => {
            const [key, value] = line.split(':').map(part => part.trim());
            if(key.length !== 0 && value.length !== 0) {
                newWordsToReplace[key] = value;
            }
        });
        setWordsToReplace(Object.entries(newWordsToReplace).map(([key, value]) => `${key}: ${value}`).join('\n'));
        moduleSettings.wordstoreplace = newWordsToReplace;
        saveSettingsFunc(moduleSettings);
        return true;
    };

    const setInitialValues = () => {
        // Reset Entity map - create a mutable copy to avoid Immer immutability issues
        setModuleSettings(JSON.parse(JSON.stringify(initialSettings)));
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, []);

    return(
      <>
          <div className="flex flex-wrap w-full pt-2">
              <div className="flex flex-wrap items-center -px-10 mb-3 w-full">
                  <div className="flex items-center mb-6 w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/3 px-3">
                          Output Type
                          <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              The Type of Speech Data which is returned to the Plugin
                              <br/>
                              <br/>File: Saves a File with random unique name in the Entity's temporary
                              folder on disk, which can be loaded and played by the Plugin asynchronously.
                              <br/>
                              <br/>Binary: Returns the Speech Data as raw bytes.
                              <br/>
                              <br/>The containing data type is always provided as part of the result event.
                          </SettingsTooltip>
                      </label>
                      <div className="w-2/3 px-3">
                          <select
                              value={ttsOutputType}
                              onChange={(e) => setTTSOutputTypeAndUpdate(e.target.value)}
                              className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100">
                              {ttsOutputTypes.map((option) => (
                                  <option key={option.value} value={option.value}>
                                      {option.name}
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>
                  <div className="flex items-center mb-6 w-1/2">
                      <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
                          Vocalize Nonverbal Interaction
                          <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                           setTooltipVisible={setTooltipVisible}>
                              If this option is enabled, Harmony Link will also use TTS to vocalize nonverbal
                              interaction,
                              which means the AI will for example say "smiles" (nonverbal part) and "Hello my Friend"
                              (verbal part)
                              instead of just "Hello my Friend".
                              <br/>Recommended to disable unless you're debugging countenance or movement issues.
                          </SettingsTooltip>
                      </label>
                      <div className="w-1/2 px-3">
                          <input type="checkbox" name="vocalizenonverbal" className="rounded text-indigo-600 mt-1"
                                 checked={vocalizeNonverbal}
                                 onChange={(e) => setVocalizeNonverbalAndUpdate(e.target.checked)}/>
                      </div>
                  </div>
                  <div className="flex items-center w-full">
                      <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
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
                            <textarea name="systemprompts"
                                      className="mt-1 block w-full bg-neutral-800 min-h-24 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                      placeholder="List of Words to Replace in format word:replacement" value={wordsToReplace}
                                      onChange={(e) => setWordsToReplace(e.target.value)}
                                      onBlur={(e) => validateWordsToReplaceAndUpdate(e.target.value)}/>
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

export default TTSGeneralSettingsView;
