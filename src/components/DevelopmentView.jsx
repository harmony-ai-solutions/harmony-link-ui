import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LogViewer from './dev/LogViewer.jsx';
import ActionGraphTester from './dev/ActionGraphTester.jsx';
import InspectorView from './dev/InspectorView.jsx';
import RAGDebugView from './dev/RAGDebugView.jsx';
import DevToolsView from './dev/DevToolsView.jsx';
import PageHeader from './ui/PageHeader.jsx';

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

    const subTabs = [
        { id: 'logs', label: t('development:tabs.logViewer') },
        { id: 'actiongraph', label: t('development:tabs.actionGraphTester') },
        { id: 'inspector', label: t('development:tabs.inspector') },
        { id: 'rag', label: t('development:tabs.rag') },
        { id: 'tools', label: t('development:tabs.tools') },
    ];

    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
            <PageHeader
                title={t('development:header.title')}
                subtitle={t('development:header.subtitle')}
                actions={(
                    /* Persistent Developer Mode badge (safety: always visible). */
                    <span className="dev-mode-badge">{t('development:header.devBadge')}</span>
                )}
            />

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
