import { useState, useEffect } from 'react';
import logo from './assets/images/harmony-link-icon-256.png';
import ModularConfigEditor from "./components/modules/ModularConfigEditor.jsx";
import { LogDebug, LogError } from "./utils/logger.js";

const TABS = {
  TTS: 'tts',
  STT: 'stt',
  VAD: 'vad'
};

function HarmonySpeechEngineApp() {
  const [appName, setAppName] = useState('Harmony Speech Engine');
  const [appVersion, setAppVersion] = useState('v0.1.0-dev');
  const [activeTab, setActiveTab] = useState(TABS.TTS);

  // Settings for each module (stored in localStorage in Speech Engine mode)
  const [ttsSettings, setTtsSettings] = useState({
    endpoint: "http://localhost:12080",
    voiceconfigfile: ""
  });

  const [sttSettings, setSttSettings] = useState({
    endpoint: "http://localhost:12080",
    model: ""
  });

  const [vadSettings, setVadSettings] = useState({
    endpoint: "http://localhost:12080",
    model: ""
  });

  useEffect(() => {
    LogDebug("Initializing Speech Engine App");
    setAppName('Harmony Speech Engine');
    setAppVersion('');
  }, []);

  return (
    <div id="App">
      <div className="border-b-2 border-neutral-500">
        <ul className="flex cursor-pointer">
          <li className="mr-1 h-10">
            <img className="h-10 w-10" src={logo} id="logo" alt={appName} />
          </li>
          <li className="mr-1 h-10 bg-neutral-900">
            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
               href="#tts" onClick={() => setActiveTab(TABS.TTS)}>Text-to-Speech</a>
          </li>
          <li className="mr-1 h-10 bg-neutral-900">
            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
               href="#stt" onClick={() => setActiveTab(TABS.STT)}>Speech-to-Text</a>
          </li>
          <li className="mr-1 h-10 bg-neutral-900">
            <a className="inline-block py-2 px-4 text-orange-400 hover:text-orange-300 font-semibold"
               href="#vad" onClick={() => setActiveTab(TABS.VAD)}>Voice Activity Detection</a>
          </li>
        </ul>
        <div className="bg-neutral-900 border-t-2 border-b border-neutral-500 p-4">
          {activeTab === TABS.TTS && (
            <ModularConfigEditor
              schemaId="harmonyspeech_tts"
              moduleType="tts"
              providerId="harmonyspeech"
              initialSettings={ttsSettings}
              saveSettingsFunc={setTtsSettings}
            />
          )}
          {activeTab === TABS.STT && (
            <ModularConfigEditor
              schemaId="harmonyspeech_stt"
              moduleType="stt"
              providerId="harmonyspeech"
              initialSettings={sttSettings}
              saveSettingsFunc={setSttSettings}
            />
          )}
          {activeTab === TABS.VAD && (
            <ModularConfigEditor
              schemaId="harmonyspeech_vad"
              moduleType="stt"
              providerId="harmonyspeech"
              initialSettings={vadSettings}
              saveSettingsFunc={setVadSettings}
            />
          )}
        </div>
        <div className="flex items-center justify-center bg-neutral-900">
          <p className="py-1 px-2 text-orange-400"><a href="https://project-harmony.ai/technology/" target="_blank" rel="noreferrer">{appName} {appVersion} - ©2023-2025 Project Harmony.AI</a></p>
        </div>
      </div>
    </div>
  );
}

export default HarmonySpeechEngineApp;
