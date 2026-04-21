import { useState, useMemo } from 'react';

/**
 * Displays and allows editing of extended sampling parameters.
 * These are params from the preset (or manual config) that don't have
 * dedicated DB columns — stored in the extraparams JSON field.
 *
 * @param {object} extraParams - Current extra params map
 * @param {function} onChange - Callback with updated extra params map
 * @param {object} presetParams - Params from selected preset (for reference)
 */
const AdvancedSamplingParams = ({ extraParams = {}, onChange, presetParams = {} }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [showAddParam, setShowAddParam] = useState(false);
    const [newParamKey, setNewParamKey] = useState('');

    // Merge preset params with explicit extra params (explicit > preset)
    const displayParams = useMemo(() => {
        const merged = { ...presetParams };
        // Remove standard params that have their own fields
        const standardParams = ['temperature', 'top_p', 'max_tokens', 'frequency_penalty',
            'presence_penalty', 'seed', 'top_k', 'min_p', 'repetition_penalty', 'top_a'];
        standardParams.forEach(k => delete merged[k]);

        // Overlay explicit extraParams
        for (const [k, v] of Object.entries(extraParams)) {
            merged[k] = v;
        }
        return merged;
    }, [presetParams, extraParams]);

    // Known extended param metadata for display
    const EXTENDED_PARAM_INFO = {
        typical_p: { label: 'Typical P', step: 0.01, min: 0, max: 1, tooltip: 'Locally typical sampling probability threshold.' },
        tfs: { label: 'TFS', step: 0.01, min: 0, max: 1, tooltip: 'Tail Free Sampling multiplier.' },
        dry_multiplier: { label: 'DRY Multiplier', step: 0.01, min: 0, max: 10, tooltip: 'DRY penalty multiplier for repetition avoidance.' },
        dry_base: { label: 'DRY Base', step: 0.01, min: 0, max: 10, tooltip: 'DRY penalty base.' },
        dry_allowed_length: { label: 'DRY Allowed Length', step: 1, min: 0, max: 100, tooltip: 'DRY allowed repetition length.' },
        xtc_probability: { label: 'XTC Probability', step: 0.01, min: 0, max: 1, tooltip: 'XTC sampling probability.' },
        xtc_threshold: { label: 'XTC Threshold', step: 0.01, min: 0, max: 1, tooltip: 'XTC sampling threshold.' },
        mirostat_mode: { label: 'Mirostat Mode', step: 1, min: 0, max: 2, tooltip: 'Mirostat mode (0=disabled, 1=Mirostat, 2=Mirostat 2.0).' },
        mirostat_tau: { label: 'Mirostat Tau', step: 0.01, min: 0, max: 10, tooltip: 'Mirostat target entropy.' },
        mirostat_eta: { label: 'Mirostat Eta', step: 0.01, min: 0, max: 1, tooltip: 'Mirostat learning rate.' },
        dynatemp_range: { label: 'Dynamic Temp Range', step: 0.01, min: 0, max: 2, tooltip: 'Dynamic temperature range.' },
        dynatemp_exponent: { label: 'Dynamic Temp Exponent', step: 0.01, min: 0, max: 5, tooltip: 'Dynamic temperature exponent.' },
        penalty_alpha: { label: 'Penalty Alpha', step: 0.01, min: 0, max: 1, tooltip: 'Penalty alpha for contrastive search.' },
        do_sample: { label: 'Do Sample', type: 'checkbox', tooltip: 'Enable sampling (TextGen only).' },
        epsilon_cutoff: { label: 'Epsilon Cutoff', step: 0.01, min: 0, max: 1, tooltip: 'Epsilon cutoff for sampling.' },
        eta_cutoff: { label: 'ETA Cutoff', step: 0.01, min: 0, max: 1, tooltip: 'ETA cutoff for sampling.' },
    };

    const handleParamChange = (key, rawValue) => {
        const updated = { ...extraParams };
        if (rawValue === null || rawValue === undefined) {
            delete updated[key];
        } else {
            // Preserve strings as-is; try to coerce to number only when it's clearly numeric
            const trimmed = String(rawValue).trim();
            if (trimmed === '') {
                // User cleared the field — keep the key with empty string so it stays visible
                updated[key] = '';
            } else if (!isNaN(Number(trimmed)) && trimmed !== '') {
                updated[key] = Number(trimmed);
            } else {
                updated[key] = trimmed;
            }
        }
        onChange(updated);
    };

    const handleRemoveParam = (key) => {
        const updated = { ...extraParams };
        delete updated[key];
        onChange(updated);
    };

    const handleAddParam = () => {
        const key = newParamKey.trim();
        if (!key) return;
        const updated = { ...extraParams };
        if (!(key in updated)) {
            updated[key] = '';
        }
        onChange(updated);
        setNewParamKey('');
        setShowAddParam(false);
    };

    // Decide input type for a param: known params use their defined type,
    // unknown params use text if the current value is a string, number otherwise.
    const getInputType = (key, value) => {
        const info = EXTENDED_PARAM_INFO[key];
        if (info?.type === 'checkbox') return 'checkbox';
        if (info) return 'number';
        // Unknown param: infer from value type
        if (typeof value === 'string' && value !== '' && isNaN(Number(value))) return 'text';
        return 'text'; // default to text so users can type anything
    };

    const paramKeys = Object.keys(displayParams);
    const paramCount = paramKeys.length;

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors mb-2"
            >
                <svg className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced Sampling Parameters{paramCount > 0 ? ` (${paramCount})` : ''}
            </button>
            {!isCollapsed && (
                <div className="space-y-2 pl-2 border-l-2 border-border">
                    {paramKeys.map(key => {
                        const info = EXTENDED_PARAM_INFO[key] || { label: key };
                        const currentValue = extraParams[key] ?? displayParams[key];
                        const isFromPreset = key in presetParams && !(key in extraParams);
                        const inputType = getInputType(key, currentValue);
                        return (
                            <div key={key} className="flex items-center gap-2">
                                <label className="text-xs min-w-[140px] text-text-secondary">
                                    {info.label}
                                    {isFromPreset && <span className="ml-1 text-accent-primary" title="From preset">*</span>}
                                </label>
                                {inputType === 'checkbox' ? (
                                    <input
                                        type="checkbox"
                                        checked={!!currentValue}
                                        onChange={(e) => handleParamChange(key, e.target.checked)}
                                        className="h-4 w-4 rounded text-accent-primary"
                                    />
                                ) : inputType === 'number' ? (
                                    <input
                                        type="number"
                                        step={info.step}
                                        min={info.min}
                                        max={info.max}
                                        value={currentValue ?? ''}
                                        onChange={(e) => handleParamChange(key, e.target.value)}
                                        className="input-field flex-1 p-1 rounded text-sm"
                                        placeholder={String(displayParams[key] ?? '')}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={currentValue ?? ''}
                                        onChange={(e) => handleParamChange(key, e.target.value)}
                                        className="input-field flex-1 p-1 rounded text-sm"
                                        placeholder={String(displayParams[key] ?? '')}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveParam(key)}
                                    className="text-xs text-text-muted hover:text-error transition-colors p-1"
                                    title="Remove"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        );
                    })}
                    {paramCount === 0 && !showAddParam && (
                        <p className="text-xs text-text-muted italic">No extended parameters configured.</p>
                    )}
                    {!showAddParam ? (
                        <button
                            type="button"
                            onClick={() => setShowAddParam(true)}
                            className="text-xs text-accent-primary hover:underline"
                        >
                            + Add Parameter
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newParamKey}
                                onChange={(e) => setNewParamKey(e.target.value)}
                                className="input-field flex-1 p-1 rounded text-sm"
                                placeholder="Parameter name (e.g. typical_p)"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddParam(); }}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={handleAddParam}
                                className="text-xs px-2 py-1 rounded bg-accent-primary text-white hover:bg-accent-primary-hover"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowAddParam(false); setNewParamKey(''); }}
                                className="text-xs px-2 py-1 rounded bg-background-tertiary text-text-secondary hover:bg-background-hover"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedSamplingParams;
