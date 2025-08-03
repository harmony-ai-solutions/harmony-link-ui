import React from 'react';
import JsonView from '@uiw/react-json-view';

function JsonViewer({ data, maxDepth = 3, className = '' }) {
    // Handle the case where data might be a string that needs parsing
    let parsedData = data;
    if (typeof data === 'string') {
        try {
            parsedData = JSON.parse(data);
        } catch (error) {
            // If it's not valid JSON, treat it as a string
            return (
                <div className={`font-mono text-sm ${className}`}>
                    <div className="bg-neutral-800 p-3 rounded border border-gray-600">
                        <span className="text-green-400">"{data}"</span>
                    </div>
                </div>
            );
        }
    }

    // Handle null/undefined data
    if (parsedData === null || parsedData === undefined) {
        return (
            <div className={`font-mono text-sm ${className}`}>
                <div className="bg-neutral-800 p-3 rounded border border-gray-600">
                    <span className="text-gray-500">{String(parsedData)}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`font-mono text-sm ${className}`}>
            <div className="bg-neutral-800 rounded border border-gray-600 overflow-auto max-h-96 custom-scrollbar">
                <JsonView
                    value={parsedData}
                    collapsed={maxDepth}
                    style={{
                        backgroundColor: 'transparent',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        padding: '12px',
                        '--w-rjv-font-family': 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        '--w-rjv-color': '#d1d5db', // text-gray-300
                        '--w-rjv-key-string': '#93c5fd', // text-blue-300
                        '--w-rjv-background-color': 'transparent',
                        '--w-rjv-line-color': '#4b5563', // border-gray-600
                        '--w-rjv-arrow-color': '#fb923c', // text-orange-400
                        '--w-rjv-edit-color': '#fb923c',
                        '--w-rjv-info-color': '#6b7280',
                        '--w-rjv-error-color': '#ef4444',
                        '--w-rjv-type-string-color': '#4ade80', // text-green-400
                        '--w-rjv-type-int-color': '#60a5fa', // text-blue-400
                        '--w-rjv-type-float-color': '#60a5fa',
                        '--w-rjv-type-bigint-color': '#60a5fa',
                        '--w-rjv-type-boolean-color': '#a78bfa', // text-purple-400
                        '--w-rjv-type-date-color': '#fbbf24',
                        '--w-rjv-type-url-color': '#06b6d4',
                        '--w-rjv-type-null-color': '#6b7280', // text-gray-500
                        '--w-rjv-type-nan-color': '#6b7280',
                        '--w-rjv-type-undefined-color': '#6b7280',
                        '--w-rjv-brackets-color': '#9ca3af', // text-gray-400
                        '--w-rjv-curly-color': '#9ca3af',
                    }}
                    displayDataTypes={false}
                    displayObjectSize={true}
                    enableClipboard={true}
                    indentWidth={15}
                    collapseStringsAfterLength={50}
                    groupArraysAfterLength={100}
                />
            </div>
        </div>
    );
}

export default JsonViewer;
