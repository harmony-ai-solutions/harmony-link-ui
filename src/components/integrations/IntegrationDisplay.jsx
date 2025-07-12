import React, { useState } from 'react';
import SettingsTooltip from "../settings/SettingsTooltip.jsx";

const IntegrationDisplay = ({ availableIntegrations, useIntegration }) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);

    if (!availableIntegrations || availableIntegrations.length === 0) {
        return null;
    }

    const handleUseIntegration = (integrationOption, urlIndex) => {
        useIntegration(integrationOption, urlIndex);
    };

    const handleOpenWebInterface = (integrationOption, urlIndex) => {
        const webURL = integrationOption.webURLs[urlIndex]; // Use WebURLs from IntegrationOption
        if (webURL) {
            window.open(webURL, '_blank'); // Open in new tab
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'nvidia': return '🟢'; // Green circle for NVIDIA
            case 'amd': return '🔴'; // Red circle for AMD
            case 'intel': return '🔵'; // Blue circle for Intel
            case 'cpu': return '💻'; // Laptop for CPU
            default: return '⚙️'; // Gear for unknown
        }
    };

    return (
        <div className="flex flex-wrap w-full">
            <div className="flex items-center mb-2 w-full">
                <label className="text-sm font-medium text-gray-300 px-3">
                    Available Integrations
                    <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                     setTooltipVisible={setTooltipVisible}>
                        These are integrations that Harmony Link has detected as running and compatible with the
                        current module. You can use them to automatically configure the settings for this module.
                    </SettingsTooltip>
                </label>
            </div>
            <div className="w-full px-3">
                {availableIntegrations.map(integrationOption => ( // Renamed 'integration' to 'integrationOption'
                    <div key={`${integrationOption.name}-${integrationOption.instanceName}`} className="flex flex-col p-2 mb-4 rounded-lg shadow-md border border-neutral-500 bg-gradient-to-br from-neutral-700 to-neutral-900">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className={`px-2 py-1 text-xs rounded-full mr-2 font-semibold ${
                                    integrationOption.available ? 'bg-green-600 text-white' : 'bg-red-600 text-white' // Use Available from IntegrationOption
                                }`}>
                                    {integrationOption.status.toUpperCase()}
                                </span>
                                <span className="text-lg font-semibold text-neutral-100">
                                    {integrationOption.displayName}
                                    {integrationOption.deviceType && (
                                        <span className="ml-2 text-sm text-neutral-300">
                                            ({getDeviceIcon(integrationOption.deviceType)} {integrationOption.deviceType.toUpperCase()})
                                        </span>
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {integrationOption.apiURLs && integrationOption.apiURLs.length > 0 && ( // Use ApiURLs
                                    integrationOption.apiURLs.map((url, index) => (
                                        <button
                                            key={`api-${index}`}
                                            onClick={() => handleUseIntegration(integrationOption, index)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-md text-sm font-medium transition duration-200 ease-in-out">
                                            Apply API config
                                        </button>
                                    ))
                                )}
                                {integrationOption.webURLs && integrationOption.webURLs.length > 0 && !integrationOption.isContainerMode && ( // Use WebURLs and IsContainerMode
                                    integrationOption.webURLs.map((url, index) => (
                                        <button
                                            key={`web-${index}`}
                                            onClick={() => handleOpenWebInterface(integrationOption, index)}
                                            className="bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded-md text-sm font-medium transition duration-200 ease-in-out">
                                            Open Web UI
                                        </button>
                                    ))
                                )}
                                {!integrationOption.available && (!integrationOption.apiURLs || integrationOption.apiURLs.length === 0) && (!integrationOption.webURLs || integrationOption.webURLs.length === 0) && (
                                    <span className="text-sm text-neutral-400">No available endpoints or not running.</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IntegrationDisplay;
