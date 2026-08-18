import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LogViewer from './dev/LogViewer.jsx';
import ActionGraphTester from './dev/ActionGraphTester.jsx';

/**
 * Development Tools view — modern shell with sub-tabs for Log Viewer
 * and ActionGraph Tester.
 */
function DevelopmentView() {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState('logs');

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    {colorFirstWord(t('development:header.title'))}
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    {t('development:header.subtitle')}
                </p>
            </div>

            <div className="character-editor-tab-bar">
                <button
                    className={`character-editor-tab ${activeSubTab === 'logs' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setActiveSubTab('logs')}
                >
                    {t('development:tabs.logViewer')}
                </button>
                <button
                    className={`character-editor-tab ${activeSubTab === 'actiongraph' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setActiveSubTab('actiongraph')}
                >
                    {t('development:tabs.actionGraphTester')}
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'logs' && <LogViewer />}
                {activeSubTab === 'actiongraph' && <ActionGraphTester />}
            </div>
        </div>
    );
}

export default DevelopmentView;
