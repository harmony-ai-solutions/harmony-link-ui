import React, { useState, useEffect } from 'react';

// Inline constants for resolution defaults
const VISION_RESOLUTION_DEFAULTS = {
    RESOLUTIONS: [
        { id: '640x480', name: '640x480' },
        { id: '1280x720', name: '1280x720' },
        { id: '1920x1080', name: '1920x1080' },
    ],
    DEFAULT_WIDTH: 640,
    DEFAULT_HEIGHT: 480
};

export default function VisionGeneralSettingsView({ initialSettings, saveSettingsFunc }) {
    const [resolutionWidth, setResolutionWidth] = useState(VISION_RESOLUTION_DEFAULTS.DEFAULT_WIDTH);
    const [resolutionHeight, setResolutionHeight] = useState(VISION_RESOLUTION_DEFAULTS.DEFAULT_HEIGHT);

    // Store settings in ref to avoid stale closure issues
    const settingsRef = React.useRef(initialSettings);
    settingsRef.current = initialSettings;

    useEffect(() => {
        if (initialSettings) {
            const width = initialSettings.resolutionwidth || VISION_RESOLUTION_DEFAULTS.DEFAULT_WIDTH;
            const height = initialSettings.resolutionheight || VISION_RESOLUTION_DEFAULTS.DEFAULT_HEIGHT;
            setResolutionWidth(width);
            setResolutionHeight(height);
        }
    }, [initialSettings]);

    const handleResolutionChange = (newWidth, newHeight) => {
        setResolutionWidth(newWidth);
        setResolutionHeight(newHeight);
        saveSettingsFunc({ 
            ...settingsRef.current, 
            resolutionwidth: newWidth,
            resolutionheight: newHeight
        });
    };

    const handleWidthChange = (value) => {
        handleResolutionChange(value, resolutionHeight);
    };

    const handleHeightChange = (value) => {
        handleResolutionChange(resolutionWidth, value);
    };

    return (
        <div className="flex flex-wrap w-full pt-2">
            {/* Resolution Inputs */}
            <div className="flex items-center mb-4 w-full">
                <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
                    Resolution
                </label>
                <div className="flex items-center w-5/6 px-3">
                    <input 
                        type="number"
                        className="input-field w-20 mr-2"
                        value={resolutionWidth}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                        min={1}
                        max={3840}
                    />
                    <span className="mx-2">x</span>
                    <input 
                        type="number"
                        className="input-field w-20"
                        value={resolutionHeight}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                        min={1}
                        max={2160}
                    />
                    
                    {/* Preset Buttons */}
                    <div className="flex items-center ml-4">
                        {VISION_RESOLUTION_DEFAULTS.RESOLUTIONS.map((res) => (
                            <button
                                key={res.id}
                                className="btn-secondary text-xs mr-2"
                                onClick={() => {
                                    const [w, h] = res.id.split('x').map(Number);
                                    handleResolutionChange(w, h);
                                }}
                            >
                                {res.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <p className="text-xs text-text-secondary mt-2">
                Resolution settings define the internal image processing dimensions.
                The actual capture interval and mode are controlled by the Plugin.
            </p>
        </div>
    );
}
