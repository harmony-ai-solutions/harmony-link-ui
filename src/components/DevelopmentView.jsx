import { useState } from 'react';
import LogViewer from './dev/LogViewer.jsx';
import ActionGraphTester from './dev/ActionGraphTester.jsx';

/**
 * Development Tools view — modern shell with sub-tabs for Log Viewer
 * and ActionGraph Tester.
 */
function DevelopmentView() {
    const [activeSubTab, setActiveSubTab] = useState('logs');

    return (
        <div
            className="flex flex-col bg-background-base"
            style={{ height: 'calc(100vh - 6rem)' }}
        >            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <span className="text-gradient-primary">Development</span> Tools
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    Real-time log viewer, prompt inspector, and ActionGraph testing
                </p>
            </div>

            {/* Sub-Tab Bar */}
            <div className="character-editor-tab-bar">
                <button
                    className={`character-editor-tab ${activeSubTab === 'logs' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setActiveSubTab('logs')}
                >
                    Log Viewer
                </button>
                <button
                    className={`character-editor-tab ${activeSubTab === 'actiongraph' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setActiveSubTab('actiongraph')}
                >
                    ActionGraph Tester
                </button>
            </div>

            {/* Sub-Tab Content */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'logs' && <LogViewer />}
                {activeSubTab === 'actiongraph' && <ActionGraphTester />}
            </div>
        </div>
    );
}

export default DevelopmentView;