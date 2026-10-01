import React, { useState } from 'react';
import JsonViewer from './JsonViewer';
import ThemedSelect from './ThemedSelect';
import useDevToolsStore from '../../store/devtoolsStore.js';

/**
 * JSON viewer with a user-selectable depth.
 *
 * When the Developer-mode "Raw JSON" toggle (Phase 3, D4) is on, this viewer
 * forces full depth ("All Levels") everywhere it is used — so the toggle
 * affects all config screens consistently without each screen needing its own
 * switch. The local depth selector is disabled while raw mode is active so the
 * override is obvious.
 */
function ConfigurableJsonViewer({ data, defaultDepth = 2, className = '' }) {
    const [selectedDepth, setSelectedDepth] = useState(defaultDepth);
    const rawJson = useDevToolsStore((s) => s.rawJson);

    const depthOptions = [
        { value: 1, label: 'Depth 1 (Minimal)' },
        { value: 2, label: 'Depth 2 (Default)' },
        { value: 3, label: 'Depth 3 (Detailed)' },
        { value: 4, label: 'Depth 4 (Deep)' },
        { value: 999, label: 'All Levels (Full)' }
    ];

    const effectiveDepth = rawJson ? 999 : selectedDepth;

    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">JSON Payload</span>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Depth:</label>
                    <ThemedSelect
                        value={effectiveDepth}
                        onChange={(val) => setSelectedDepth(parseInt(val))}
                        options={depthOptions}
                        disabled={rawJson}
                    />
                </div>
            </div>
            <JsonViewer data={data} maxDepth={effectiveDepth} />
        </div>
    );
}

export default ConfigurableJsonViewer;
