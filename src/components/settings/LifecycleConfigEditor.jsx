import React from 'react';

/**
 * Shared Lifecycle Configuration Editor Component
 * Used by both CharacterProfileEditor and EntitySettingsView
 * 
 * @param {Object} props
 * @param {Object} props.config - Current lifecycle config object
 * @param {Function} props.onChange - Callback when config changes
 * @param {boolean} props.readOnly - If true, display values read-only
 */
export default function LifecycleConfigEditor({ config, onChange, readOnly = false }) {
    const handleChange = (field, value) => {
        const numValue = parseFloat(value);
        onChange({
            ...config,
            [field]: isNaN(numValue) ? value : numValue
        });
    };

    const handleBeatTypeWeightChange = (type, value) => {
        const numValue = parseFloat(value);
        onChange({
            ...config,
            beat_type_weights: {
                ...config.beat_type_weights,
                [type]: isNaN(numValue) ? value : numValue
            }
        });
    };

    return (
        <div className="space-y-4">
            {/* Beat Schedule Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Beat Schedule
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Autonomy Level
                            <span className="character-editor-label-unit">0-3</span>
                        </label>
                        <select
                            value={config.autonomy_level ?? 1}
                            onChange={(e) => handleChange('autonomy_level', parseInt(e.target.value))}
                            disabled={readOnly}
                            className="input-field w-full"
                        >
                            <option value={0}>0 - Observe</option>
                            <option value={1}>1 - Reflect</option>
                            <option value={2}>2 - Reach Out</option>
                            <option value={3}>3 - Act (reserved)</option>
                        </select>
                        <p className="character-editor-hint">Controls autonomous behavior level</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Beat Interval
                            <span className="character-editor-label-unit">seconds</span>
                        </label>
                        <input
                            type="number"
                            value={config.beat_interval ?? 1800}
                            onChange={(e) => handleChange('beat_interval', e.target.value)}
                            disabled={readOnly}
                            min="60"
                            max="86400"
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Time between beats (default: 1800 = 30min)</p>
                    </div>
                    <div className="character-editor-field-group col-span-2">
                        <label className="character-editor-label">Beat Type Weights</label>
                        <div className="grid grid-cols-4 gap-3 mt-2">
                            {['self_reflection', 'curiosity', 'relationship', 'outreach'].map(type => (
                                <div key={type} className="bg-background-base/50 rounded-lg p-3">
                                    <p className="text-xs text-text-muted capitalize mb-1">{type.replace('_', ' ')}</p>
                                    <input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                        value={config.beat_type_weights?.[type] ?? getDefaultWeight(type)}
                                        onChange={(e) => handleBeatTypeWeightChange(type, e.target.value)}
                                        disabled={readOnly}
                                        className="input-field w-full text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="character-editor-hint">Probability weights for beat types (must sum to ~1)</p>
                    </div>
                </div>
            </div>

            {/* Sleep & Exhaustion Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Sleep & Exhaustion
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Sleep Threshold
                            <span className="character-editor-label-unit">0-1</span>
                        </label>
                        <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={config.sleep_threshold ?? 0.80}
                            onChange={(e) => handleChange('sleep_threshold', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Exhaustion level to trigger sleep (default: 0.80)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Wake Threshold
                            <span className="character-editor-label-unit">0-1</span>
                        </label>
                        <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={config.wake_threshold ?? 0.20}
                            onChange={(e) => handleChange('wake_threshold', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Exhaustion level to wake up (default: 0.20)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Exhaustion Accumulation
                            <span className="character-editor-label-unit">per beat</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={config.exhaustion_accumulation_per_beat ?? 0.10}
                            onChange={(e) => handleChange('exhaustion_accumulation_per_beat', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Exhaustion gained per beat (default: 0.10)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Exhaustion Decay
                            <span className="character-editor-label-unit">per tick</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={config.exhaustion_decay_per_tick ?? 0.02}
                            onChange={(e) => handleChange('exhaustion_decay_per_tick', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Exhaustion recovered per tick (default: 0.02)</p>
                    </div>
                </div>
            </div>

            {/* Emotion Decay Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Emotion Decay
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Decay Tau
                            <span className="character-editor-label-unit">seconds</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={config.emotion_decay_tau ?? 3600.0}
                            onChange={(e) => handleChange('emotion_decay_tau', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Emotion decay time constant (default: 3600 = 1hr)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Emotion High Threshold
                            <span className="character-editor-label-unit">0-10</span>
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={config.emotion_high_threshold ?? 6.0}
                            onChange={(e) => handleChange('emotion_high_threshold', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">High emotion intensity for crystallization (default: 6.0)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Emotion Low Threshold
                            <span className="character-editor-label-unit">0-10</span>
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={config.emotion_low_threshold ?? 1.0}
                            onChange={(e) => handleChange('emotion_low_threshold', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Low emotion intensity threshold (default: 1.0)</p>
                    </div>
                </div>
            </div>

            {/* Crystallization Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Crystallization
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Crystallize Intensity
                            <span className="character-editor-label-unit">0-10</span>
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={config.emotion_crystallize_intensity ?? 7.0}
                            onChange={(e) => handleChange('emotion_crystallize_intensity', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Emotion intensity for memory crystallization (default: 7.0)</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Crystallize Min Hours
                            <span className="character-editor-label-unit">hours</span>
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={config.emotion_crystallize_min_hours ?? 2.0}
                            onChange={(e) => handleChange('emotion_crystallize_min_hours', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Minimum hours for crystallization (default: 2.0)</p>
                    </div>
                </div>
            </div>

            {/* Memory Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Memory
                </div>
                <div className="p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Core Memories K
                            <span className="character-editor-label-unit">count</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.core_memories_k ?? 10}
                            onChange={(e) => handleChange('core_memories_k', e.target.value)}
                            disabled={readOnly}
                            className="input-field w-full"
                        />
                        <p className="character-editor-hint">Number of core memories to retain (default: 10)</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getDefaultWeight(type) {
    const defaults = {
        self_reflection: 0.35,
        curiosity: 0.30,
        relationship: 0.25,
        outreach: 0.10
    };
    return defaults[type] ?? 0;
}