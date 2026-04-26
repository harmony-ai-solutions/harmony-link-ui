import React, { useState, useEffect } from 'react';
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import { getAvailableIntegrationsForProvider } from "../../services/management/integrationsService.js";
import { openSystemUrl } from "../../services/management/systemService.js";

const IntegrationDisplay = ({ moduleName, providerName, useIntegration }) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);
    const [availableIntegrations, setAvailableIntegrations] = useState([]);
    const [appliedStates, setAppliedStates] = useState({});

    useEffect(() => {
        let interval;

        const fetchIntegrations = async () => {
            try {
                const integrations = await getAvailableIntegrationsForProvider(moduleName, providerName);
                setAvailableIntegrations(integrations);
            } catch (error) {
                console.error(`Failed to fetch available integrations for ${moduleName}/${providerName}:`, error);
                setAvailableIntegrations([]);
            }
        };

        fetchIntegrations(); // Initial fetch
        interval = setInterval(fetchIntegrations, 5000); // Poll every 5 seconds

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [moduleName, providerName]);

    if (!availableIntegrations || availableIntegrations.length === 0) {
        return null;
    }

    const handleUseIntegration = (integrationOption, urlIndex) => {
        useIntegration(integrationOption, urlIndex);

        // Set "Applied" state for visual feedback
        const key = `${integrationOption.instanceName}-${urlIndex}`;
        setAppliedStates(prev => ({ ...prev, [key]: true }));

        // Revert after 1.5 seconds
        setTimeout(() => {
            setAppliedStates(prev => ({ ...prev, [key]: false }));
        }, 1500);
    };

    const handleOpenWebInterface = async (integrationOption, urlIndex) => {
        const webURL = integrationOption.webURLs[urlIndex]; // Use WebURLs from IntegrationOption
        if (webURL) {
            try {
                // Try to open in system browser first (works in standalone mode)
                await openSystemUrl(webURL);
            } catch (error) {
                // Fallback to opening in new tab (container mode or error)
                console.log('System browser opening failed, falling back to window.open:', error.message);
                window.open(webURL, '_blank'); // Open in new tab
            }
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'nvidia': return '🟢'; // Green circle for NVIDIA
            case 'amd': return '🔴'; // Red circle for AMD
            case 'amd-wsl': return '🔴'; // Red circle for AMD
            case 'intel': return '🔵'; // Blue circle for Intel
            case 'cpu': return '💻'; // Laptop for CPU
            default: return '⚙️'; // Gear for unknown
        }
    };

    return (
        <div className="flex flex-wrap w-full mb-3">
            <div className="flex items-center mb-2 w-full">
                <label className="text-sm font-medium text-text-secondary px-3">
                    Available Integrations
                    <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                     setTooltipVisible={setTooltipVisible}>
                        These are integrations that Harmony Link has detected as running and compatible with the
                        current module. You can use them to automatically configure the settings for this module.
                    </SettingsTooltip>
                </label>
            </div>
            <div className="w-full px-3">
                <div className="integration-display-container">
                    {availableIntegrations.map(integrationOption => (
                        <div
                            key={`${integrationOption.name}-${integrationOption.instanceName}`}
                            className="integration-display-row"
                        >
                            {/* Left side: status + name + device badge */}
                            <div className="flex items-center flex-1 min-w-0">
                                <span className={`integration-display-status ${
                                    integrationOption.available
                                        ? 'integration-display-status-available'
                                        : 'integration-display-status-unavailable'
                                }`} />
                                <span className="integration-display-name">
                                    {integrationOption.instanceName}
                                </span>
                                {integrationOption.deviceType && (
                                    <span className="integration-display-badge">
                                        {getDeviceIcon(integrationOption.deviceType)} {integrationOption.deviceType.toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Right side: action buttons */}
                            <div className="integration-display-actions">
                                {integrationOption.apiURLs && integrationOption.apiURLs.length > 0 && (
                                    integrationOption.apiURLs.map((url, index) => {
                                        const key = `${integrationOption.instanceName}-${index}`;
                                        const isApplied = appliedStates[key];
                                        return (
                                            <button
                                                key={`api-${index}`}
                                                onClick={() => handleUseIntegration(integrationOption, index)}
                                                className={isApplied ? 'module-action-btn-save' : 'module-action-btn'}
                                                disabled={isApplied}
                                            >
                                                {isApplied ? 'Applied ✓' : 'Apply Config'}
                                            </button>
                                        );
                                    })
                                )}
                                {integrationOption.webURLs && integrationOption.webURLs.length > 0 && (
                                    integrationOption.webURLs.map((url, index) => (
                                        <button
                                            key={`web-${index}`}
                                            onClick={() => handleOpenWebInterface(integrationOption, index)}
                                            className="module-action-btn"
                                        >
                                            Open Web UI
                                        </button>
                                    ))
                                )}
                                {!integrationOption.available && (!integrationOption.apiURLs || integrationOption.apiURLs.length === 0) && (!integrationOption.webURLs || integrationOption.webURLs.length === 0) && (
                                    <span className="integration-display-empty">No endpoints</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default IntegrationDisplay;