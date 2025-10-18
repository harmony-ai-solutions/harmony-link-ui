import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import { isHarmonySpeechEngineMode } from './config/appMode.js'
import HarmonyLinkApp from './HarmonyLinkApp.jsx'
import HarmonySpeechEngineApp from './HarmonySpeechEngineApp.jsx'

const container = document.getElementById('root')

const root = createRoot(container)

// Conditionally render based on application mode
const AppComponent = isHarmonySpeechEngineMode() ? HarmonySpeechEngineApp : HarmonyLinkApp

root.render(
    <React.StrictMode>
        <AppComponent/>
    </React.StrictMode>
)
