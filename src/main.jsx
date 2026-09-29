import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import './i18n/i18n.js'
import { isHarmonySpeechEngineMode } from './config/appMode.js'
import HarmonyLinkApp from './HarmonyLinkApp.jsx'
import HarmonySpeechEngineApp from './HarmonySpeechEngineApp.jsx'
import SplashScreen from './components/SplashScreen.jsx'

import { ThemeProvider } from './contexts/ThemeContext.jsx'

const container = document.getElementById('root')

const root = createRoot(container)

// Conditionally render based on application mode
const AppComponent = isHarmonySpeechEngineMode() ? HarmonySpeechEngineApp : HarmonyLinkApp

/**
 * Root shell: renders the launch splash ABOVE the app, then cross-fades the
 * splash away to reveal the already-loading UI underneath. Mounting the app
 * immediately means its data fetches (config, entities, …) run *behind* the
 * splash, so the first visible frame is already populated.
 */
function Root() {
    const [splashDone, setSplashDone] = useState(false)

    return (
        <>
            <ThemeProvider>
                <AppComponent />
            </ThemeProvider>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        </>
    )
}

root.render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
)
