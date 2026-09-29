import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LogViewer from './dev/LogViewer.jsx';
import ActionGraphTester from './dev/ActionGraphTester.jsx';
import InspectorView from './dev/InspectorView.jsx';
import RAGDebugView from './dev/RAGDebugView.jsx';
import DevToolsView from './dev/DevToolsView.jsx';

/**
 * Development Tools shell (Phase 3-1).
 *
 * The Dev tab is grouped by task rather than presented as a flat list:
 *   - Logs        — LogViewer (with LogLevelSettings + FilterToolbar)
 *   - ActionGraph — the existing ActionGraphTester (kept reachable)
 *   - Inspector   — D1 (entity overview) / D2 (prompt inspector) / D5 (event trace)
 *   - RAG         — D3 (similarity test + document browser)
 *   - Tools       — D6 (schema/parity) + D4 (raw JSON toggle)
 *
 * The Simulator is deliberately NOT duplicated here: it already has its own
 * navigation tab (SettingsTabSimulator), and embedding it again would mount a
 * second simulator state machine and confuse the user.
 *
 * A persistent "Developer Mode" badge makes it obvious the user is in a power
 * screen (plan acceptance criterion). Every panel is read-only.
 */
function DevelopmentView() {
    const { t } = useTranslation();
    const [activeSubTab, setActiveSubTab] = useState('logs');

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    const subTabs = [
        { id: 'logs', label: t('development:tabs.logViewer') },
        { id: 'actiongraph', label: t('development:tabs.actionGraphTester') },
        { id: 'inspector', label: t('development:tabs.inspector') },
        { id: 'rag', label: t('development:tabs.rag') },
        { id: 'tools', label: t('development:tabs.tools') },
    ];

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                        {colorFirstWord(t('development:header.title'))}
                    </h1>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">
                        {t('development:header.subtitle')}
                    </p>
                </div>
                {/* Persistent Developer Mode badge (safety: always visible). */}
                <span className="dev-mode-badge">{t('development:header.devBadge')}</span>
            </div>

            <div className="character-editor-tab-bar">
                {subTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`character-editor-tab ${activeSubTab === tab.id ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                        onClick={() => setActiveSubTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                {activeSubTab === 'logs' && <LogViewer />}
                {activeSubTab === 'actiongraph' && <ActionGraphTester />}
                {activeSubTab === 'inspector' && <InspectorView />}
                {activeSubTab === 'rag' && <RAGDebugView />}
                {activeSubTab === 'tools' && <DevToolsView />}
            </div>
        </div>
    );
}

export default DevelopmentView;
