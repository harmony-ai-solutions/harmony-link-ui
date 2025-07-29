import React, { useState } from 'react';
import JsonViewer from './JsonViewer';

function ConfigurableJsonViewer({ data, defaultDepth = 2, className = '' }) {
    const [selectedDepth, setSelectedDepth] = useState(defaultDepth);

    const depthOptions = [
        { value: 1, label: 'Depth 1 (Minimal)' },
        { value: 2, label: 'Depth 2 (Default)' },
        { value: 3, label: 'Depth 3 (Detailed)' },
        { value: 4, label: 'Depth 4 (Deep)' },
        { value: 999, label: 'All Levels (Full)' }
    ];

    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">JSON Payload</span>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Depth:</label>
                    <select
                        value={selectedDepth}
                        onChange={(e) => setSelectedDepth(parseInt(e.target.value))}
                        className="text-xs p-1 bg-neutral-700 border border-neutral-600 rounded text-neutral-100"
                    >
                        {depthOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <JsonViewer data={data} maxDepth={selectedDepth} />
        </div>
    );
}

export default ConfigurableJsonViewer;
