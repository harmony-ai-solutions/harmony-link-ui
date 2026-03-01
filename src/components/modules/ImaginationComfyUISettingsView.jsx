import React, { useState, useEffect, useRef, useCallback } from 'react';
import { mergeConfigWithDefaults } from '../../utils/configUtils.js';
import { MODULE_DEFAULTS } from '../../constants/moduleDefaults.js';
import { MODULES, PROVIDERS } from '../../constants/modules.js';
import { parseImaginationWorkflow, validateProviderConfig, testImaginationGeneration } from '../../services/management/configService.js';
import IntegrationDisplay from '../integrations/IntegrationDisplay.jsx';
import ConfigVerificationSection from '../widgets/ConfigVerificationSection.jsx';
import SettingsTooltip from '../settings/SettingsTooltip.jsx';

const EMPTY_PROFILE = {
    workflowjson: '',
    promptnodeid: '',
    promptfieldname: 'text',
    negativenodeid: '',
    negativefieldname: 'text',
    negativeprompt: '',
    seednodeid: '',
    seedfieldname: 'seed',
    width: 512,
    height: 512,
    trigger: '',
    baseprompt: '',
    systempromphint: '',
};

export default function ImaginationComfyUISettingsView({ initialSettings, saveSettingsFunc }) {
    const defaults = MODULE_DEFAULTS[MODULES.IMAGINATION][PROVIDERS.COMFYUI];
    const merged = mergeConfigWithDefaults(initialSettings, defaults);

    // Tooltip visibility (shared index pattern used by SettingsTooltip)
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Ref to suppress useEffect re-initialisation when the save came from us
    const isSelfSave = useRef(false);

    // Connection settings
    const [baseURL, setBaseURL] = useState(merged.baseurl || '');
    const [apiKey, setAPIKey] = useState(merged.apikey || '');
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Workflow profiles
    const [profiles, setProfiles] = useState(merged.workflowprofiles || { default: { ...EMPTY_PROFILE } });
    const [selectedProfile, setSelectedProfile] = useState(
        Object.keys(merged.workflowprofiles || { default: EMPTY_PROFILE })[0] || 'default'
    );
    const [newProfileName, setNewProfileName] = useState('');

    // Parse workflow state
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState('');
    const [parsedNodes, setParsedNodes] = useState([]);

    // Test generation state
    const [testPositivePrompt, setTestPositivePrompt] = useState('');
    const [testNegativePrompt, setTestNegativePrompt] = useState('');
    const [testSeed, setTestSeed] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [testResult, setTestResult] = useState(null);   // { images: [], seed_used: number }
    const [testError, setTestError] = useState('');

    // Profile removal confirmation
    const [confirmRemove, setConfirmRemove] = useState(false);

    // Current profile shortcut
    const currentProfile = profiles[selectedProfile] || { ...EMPTY_PROFILE };

    // Persist all settings upward.
    // Sets isSelfSave so the useEffect skips re-initialisation for our own saves.
    const save = (updatedBaseURL, updatedAPIKey, updatedProfiles) => {
        isSelfSave.current = true;
        saveSettingsFunc({
            ...merged,
            baseurl: updatedBaseURL,
            apikey: updatedAPIKey,
            workflowprofiles: updatedProfiles,
        });
    };

    // Test connection to the ComfyUI API
    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Testing connection...' });
        try {
            const result = await validateProviderConfig(MODULES.IMAGINATION, PROVIDERS.COMFYUI, {
                baseurl: baseURL,
                apikey: apiKey,
            });
            setValidationState({
                status: result.valid ? 'success' : 'error',
                message: result.valid
                    ? 'Connection successful! ComfyUI API is reachable.'
                    : result.error || 'Connection test failed.',
            });
        } catch (err) {
            setValidationState({ status: 'error', message: 'Connection test failed: ' + err.message });
        }
    };

    // Called when user clicks "Use" on an integration instance in IntegrationDisplay
    const handleUseIntegration = (integration, urlIndex = 0) => {
        const selectedURL = integration.apiURLs[urlIndex];
        setBaseURL(selectedURL);
        save(selectedURL, apiKey, profiles);
        // Reset validation state after changing URL
        setValidationState({ status: 'idle', message: '' });
    };

    // Update a single field in the current profile
    const updateProfileField = (field, value) => {
        const updatedProfiles = {
            ...profiles,
            [selectedProfile]: { ...currentProfile, [field]: value },
        };
        setProfiles(updatedProfiles);
        save(baseURL, apiKey, updatedProfiles);
    };

    // Add a new profile
    const handleAddProfile = () => {
        const name = newProfileName.trim();
        if (!name || profiles[name]) return;
        const updatedProfiles = { ...profiles, [name]: { ...EMPTY_PROFILE } };
        setProfiles(updatedProfiles);
        setSelectedProfile(name);
        setNewProfileName('');
        setConfirmRemove(false);
        setParsedNodes([]);
        save(baseURL, apiKey, updatedProfiles);
    };

    // Remove the selected profile (must keep at least one)
    const handleRemoveProfile = () => {
        const keys = Object.keys(profiles);
        if (keys.length <= 1) return;
        const updatedProfiles = { ...profiles };
        delete updatedProfiles[selectedProfile];
        const nextProfile = Object.keys(updatedProfiles)[0];
        setProfiles(updatedProfiles);
        setSelectedProfile(nextProfile);
        setParsedNodes([]);
        setConfirmRemove(false);
        save(baseURL, apiKey, updatedProfiles);
    };

    // Parse the workflow JSON via the management API
    const handleParseWorkflow = async () => {
        if (!currentProfile.workflowjson) {
            setParseError('Please paste a workflow JSON first.');
            return;
        }
        setIsParsing(true);
        setParseError('');
        setParsedNodes([]);
        try {
            const result = await parseImaginationWorkflow(currentProfile.workflowjson);
            if (result && result.nodes && result.nodes.length > 0) {
                setParsedNodes(result.nodes);
            } else {
                setParseError('No nodes found in workflow JSON.');
            }
        } catch (err) {
            setParseError('Parse failed: ' + err.message);
        } finally {
            setIsParsing(false);
        }
    };

    // Silently parse the workflow JSON for a given profile and update parsedNodes.
    // Used on profile load and profile switch to restore node dropdown state automatically.
    // Does NOT update parseError — use the explicit "Parse" button for user-facing errors.
    const parseWorkflowForProfile = useCallback(async (workflowJson) => {
        if (!workflowJson) return;
        try {
            const result = await parseImaginationWorkflow(workflowJson);
            if (result && result.nodes && result.nodes.length > 0) {
                setParsedNodes(result.nodes);
            } else {
                setParsedNodes([]);
            }
        } catch {
            setParsedNodes([]);
        }
    }, []);

    // Node dropdown options
    const nodeOptions = parsedNodes.map(n => ({
        value: n.id,
        label: n.title ? `${n.id} — ${n.title} (${n.class_type})` : `${n.id} — ${n.class_type}`,
        inputs: n.inputs || [],
    }));

    // Field options for a given node ID
    const fieldsForNode = (nodeId) => {
        const node = parsedNodes.find(n => n.id === nodeId);
        return node ? node.inputs : [];
    };

    // Test generation handler — calls the stateless management API endpoint directly
    const handleTestGeneration = async () => {
        setIsGenerating(true);
        setTestResult(null);
        setTestError('');
        try {
            // Assemble effective positive prompt: trigger + baseprompt + user test input
            const parts = [
                currentProfile.trigger,
                currentProfile.baseprompt,
                testPositivePrompt,
            ].filter(Boolean);
            const effectivePositive = parts.join(', ');

            // Assemble effective negative prompt: profile negativeprompt + user test input
            const negParts = [
                currentProfile.negativeprompt,
                testNegativePrompt,
            ].filter(Boolean);
            const effectiveNegative = negParts.join(', ');

            const comfyConfig = {
                baseurl: baseURL,
                apikey: apiKey,
                workflowprofiles: profiles,
            };
            const result = await testImaginationGeneration(
                comfyConfig, selectedProfile,
                effectivePositive, effectiveNegative,
                testSeed
            );
            setTestResult(result);
        } catch (err) {
            setTestError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        // Skip re-initialisation when we triggered the update ourselves via save()
        if (isSelfSave.current) {
            isSelfSave.current = false;
            return;
        }
        // External update (e.g. switching config in parent) — full re-init
        const remerged = mergeConfigWithDefaults(initialSettings, defaults);
        setBaseURL(remerged.baseurl || '');
        setAPIKey(remerged.apikey || '');
        setProfiles(remerged.workflowprofiles || { default: { ...EMPTY_PROFILE } });
        const firstProfile = Object.keys(remerged.workflowprofiles || { default: EMPTY_PROFILE })[0] || 'default';
        setSelectedProfile(firstProfile);
        setParsedNodes([]);
        // Auto-parse so node dropdowns are immediately available for saved configs
        const firstWorkflowJson = remerged.workflowprofiles?.[firstProfile]?.workflowjson;
        if (firstWorkflowJson) {
            parseWorkflowForProfile(firstWorkflowJson);
        }
    }, [initialSettings, parseWorkflowForProfile]);

    return (
        <div className="flex flex-col w-full gap-4 pt-2">

            {/* ── Connection Settings ── */}
            <div className="border border-border-default rounded p-3 mb-1">
                <h4 className="text-sm font-semibold text-accent-primary mb-3">Connection</h4>

                {/* Config verification and integration auto-discovery */}
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                <IntegrationDisplay
                    moduleName={MODULES.IMAGINATION}
                    providerName={PROVIDERS.COMFYUI}
                    useIntegration={handleUseIntegration}
                />

                <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2">Base URL</label>
                        <input type="text" className="input-field w-3/4"
                            value={baseURL}
                            onChange={e => setBaseURL(e.target.value)}
                            onBlur={e => { save(e.target.value, apiKey, profiles); setValidationState({ status: 'idle', message: '' }); }}
                            placeholder="http://localhost:3000" />
                    </div>
                    <div className="flex items-center w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2">API Key</label>
                        <input type="password" className="input-field w-3/4"
                            value={apiKey}
                            onChange={e => setAPIKey(e.target.value)}
                            onBlur={e => { save(baseURL, e.target.value, profiles); setValidationState({ status: 'idle', message: '' }); }}
                            placeholder="(optional)" />
                    </div>
                </div>
            </div>

            {/* ── Workflow Profile Selector ── */}
            <div className="border border-border-default rounded p-3 mb-1">
                <h4 className="text-sm font-semibold text-accent-primary mb-3">Workflow Profiles</h4>

                {/* Profile tabs — active non-default tab shows an × to initiate removal */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {Object.keys(profiles).map(name => (
                        <button key={name}
                            className={`px-3 py-1 rounded text-sm flex items-center gap-1.5 ${selectedProfile === name ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                                setSelectedProfile(name);
                                setParsedNodes([]);
                                setConfirmRemove(false);
                                const json = profiles[name]?.workflowjson;
                                if (json) {
                                    parseWorkflowForProfile(json);
                                }
                            }}>
                            {name}
                            {selectedProfile === name && name !== 'default' && Object.keys(profiles).length > 1 && (
                                <span
                                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none transition-all hover:brightness-125"
                                    style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                                    title={`Remove "${name}"`}
                                    onClick={e => { e.stopPropagation(); setConfirmRemove(true); }}>
                                    ✕
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Confirmation banner — appears after clicking × on a tab */}
                {confirmRemove && (
                    <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded bg-red-900/20 border border-red-700/40">
                        <span className="text-xs text-text-muted flex-1">
                            Remove profile <span className="text-text-primary font-medium">"{selectedProfile}"</span>? This cannot be undone.
                        </span>
                        <button className="px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white"
                            onClick={() => { setConfirmRemove(false); handleRemoveProfile(); }}>
                            Yes, Remove
                        </button>
                        <button className="btn-secondary px-3 py-1 text-xs"
                            onClick={() => setConfirmRemove(false)}>
                            Cancel
                        </button>
                    </div>
                )}

                {/* Add profile */}
                <div className="flex items-center gap-2">
                    <input type="text" className="input-field flex-1"
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        placeholder="New profile name..." />
                    <button className="btn-primary px-3 py-1 text-sm" onClick={handleAddProfile}>Add</button>
                </div>
            </div>

            {/* ── Profile Editor ── */}
            <div className="border border-border-default rounded p-3 mb-1">
                <h4 className="text-sm font-semibold text-accent-primary mb-3">
                    Edit Profile: <span className="text-text-primary">{selectedProfile}</span>
                </h4>

                {/* Workflow JSON + Parse */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                        Workflow JSON
                        <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                            Paste the ComfyUI API-format workflow here ("Save (API Format)" from the ComfyUI web UI, not the UI format).
                            This JSON is used as the base execution graph for every image generation. The fields below define
                            where Harmony Link injects prompts and the random seed into this graph at runtime.
                        </SettingsTooltip>
                    </label>
                    <textarea
                        className="input-field w-full font-mono text-xs"
                        rows={6}
                        value={currentProfile.workflowjson}
                        onChange={e => updateProfileField('workflowjson', e.target.value)}
                        placeholder="Paste your ComfyUI workflow JSON here (API format, not UI format)..." />
                    <div className="flex items-center gap-3 mt-2">
                        <button className="btn-secondary px-4 py-1 text-sm"
                            onClick={handleParseWorkflow}
                            disabled={isParsing}>
                            {isParsing ? 'Parsing...' : '⚙ Parse Workflow Nodes'}
                        </button>
                        {parsedNodes.length > 0 && (
                            <span className="text-xs text-green-400">✓ {parsedNodes.length} nodes loaded</span>
                        )}
                        {parseError && (
                            <span className="text-xs text-red-400">{parseError}</span>
                        )}
                    </div>
                    {parsedNodes.length === 0 && (
                        <p className="text-xs text-text-muted mt-1">
                            Click "Parse Workflow Nodes" after pasting the JSON to enable node dropdowns below.
                            You can still type node IDs and field names manually.
                        </p>
                    )}
                </div>

                {/* Node / Field Mappings */}
                <div className="mb-4">
                    <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                        Node Mappings
                    </h5>
                    <p className="text-xs text-text-muted mb-3">
                        Select which ComfyUI nodes receive the positive prompt, negative prompt, and random seed.
                        Parse the workflow JSON above to enable dropdown selection.
                    </p>

                    {/* Prompt pair */}
                    <div className="flex items-center gap-2 mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 shrink-0">
                            Positive Prompt
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                Node ID and field name that receive the AI-generated positive image description.
                                Typically a CLIPTextEncode node labelled "Positive". The field is usually "text".
                            </SettingsTooltip>
                        </label>
                        <div className="flex-1">
                            {parsedNodes.length > 0 ? (
                                <select className="input-field w-full"
                                    value={currentProfile.promptnodeid}
                                    onChange={e => updateProfileField('promptnodeid', e.target.value)}>
                                    <option value="">— node —</option>
                                    {nodeOptions.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.promptnodeid}
                                    onChange={e => updateProfileField('promptnodeid', e.target.value)}
                                    placeholder="Node ID, e.g. 6" />
                            )}
                        </div>
                        <span className="text-text-muted text-xs shrink-0">→</span>
                        <div className="flex-1">
                            {parsedNodes.length > 0 && currentProfile.promptnodeid ? (
                                <select className="input-field w-full"
                                    value={currentProfile.promptfieldname}
                                    onChange={e => updateProfileField('promptfieldname', e.target.value)}>
                                    <option value="">— field —</option>
                                    {fieldsForNode(currentProfile.promptnodeid).map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.promptfieldname}
                                    onChange={e => updateProfileField('promptfieldname', e.target.value)}
                                    placeholder="Field name, e.g. text" />
                            )}
                        </div>
                    </div>
                    {/* Negative pair */}
                    <div className="flex items-center gap-2 mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 shrink-0">
                            Negative Prompt
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                Node ID and field name that receive the negative prompt (things to avoid).
                                Typically a CLIPTextEncode node labelled "Negative". The field is usually "text".
                            </SettingsTooltip>
                        </label>
                        <div className="flex-1">
                            {parsedNodes.length > 0 ? (
                                <select className="input-field w-full"
                                    value={currentProfile.negativenodeid}
                                    onChange={e => updateProfileField('negativenodeid', e.target.value)}>
                                    <option value="">— node —</option>
                                    {nodeOptions.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.negativenodeid}
                                    onChange={e => updateProfileField('negativenodeid', e.target.value)}
                                    placeholder="Node ID, e.g. 7" />
                            )}
                        </div>
                        <span className="text-text-muted text-xs shrink-0">→</span>
                        <div className="flex-1">
                            {parsedNodes.length > 0 && currentProfile.negativenodeid ? (
                                <select className="input-field w-full"
                                    value={currentProfile.negativefieldname}
                                    onChange={e => updateProfileField('negativefieldname', e.target.value)}>
                                    <option value="">— field —</option>
                                    {fieldsForNode(currentProfile.negativenodeid).map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.negativefieldname}
                                    onChange={e => updateProfileField('negativefieldname', e.target.value)}
                                    placeholder="Field name, e.g. text" />
                            )}
                        </div>
                    </div>

                    {/* Seed pair */}
                    <div className="flex items-center gap-2 mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 shrink-0">
                            Seed
                            <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                Node ID and field name that hold the random seed for generation.
                                Typically a KSampler node. Field is usually "seed" or "noise_seed".
                            </SettingsTooltip>
                        </label>
                        <div className="flex-1">
                            {parsedNodes.length > 0 ? (
                                <select className="input-field w-full"
                                    value={currentProfile.seednodeid}
                                    onChange={e => updateProfileField('seednodeid', e.target.value)}>
                                    <option value="">— node —</option>
                                    {nodeOptions.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.seednodeid}
                                    onChange={e => updateProfileField('seednodeid', e.target.value)}
                                    placeholder="Node ID, e.g. 3" />
                            )}
                        </div>
                        <span className="text-text-muted text-xs shrink-0">→</span>
                        <div className="flex-1">
                            {parsedNodes.length > 0 && currentProfile.seednodeid ? (
                                <select className="input-field w-full"
                                    value={currentProfile.seedfieldname}
                                    onChange={e => updateProfileField('seedfieldname', e.target.value)}>
                                    <option value="">— field —</option>
                                    {fieldsForNode(currentProfile.seednodeid).map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            ) : (
                                <input type="text" className="input-field w-full"
                                    value={currentProfile.seedfieldname}
                                    onChange={e => updateProfileField('seedfieldname', e.target.value)}
                                    placeholder="Field name, e.g. seed" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Dimensions */}
                <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm font-medium text-text-secondary w-1/4">
                        Image Size
                        <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                            The width × height (in pixels) of the generated image. Harmony Link injects these values into the
                            first EmptyLatentImage node found in the workflow. Leave at your desired output resolution —
                            use multiples of 64 (e.g. 512×512, 768×1024) for best compatibility with most SD models.
                        </SettingsTooltip>
                    </label>
                    <div className="flex items-center gap-2">
                        <input type="number" className="input-field w-24"
                            value={currentProfile.width}
                            onChange={e => updateProfileField('width', parseInt(e.target.value) || 512)}
                            min={64} max={4096} step={64} />
                        <span className="text-text-muted">×</span>
                        <input type="number" className="input-field w-24"
                            value={currentProfile.height}
                            onChange={e => updateProfileField('height', parseInt(e.target.value) || 512)}
                            min={64} max={4096} step={64} />
                        <span className="text-xs text-text-muted">px</span>
                    </div>
                </div>

                {/* Generation Settings */}
                <div className="border-t border-border-default pt-4">
                    <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                        Generation Settings
                        <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                            These settings define the fixed prompt components used for every generation in this profile.
                            Trigger words activate LoRA models, Base Prompt provides a fixed positive baseline,
                            Negative Prompt specifies what to avoid, and System Hint guides the AI's scene description.
                        </SettingsTooltip>
                    </h5>
                    <p className="text-xs text-text-muted mb-3">
                        These values are prepended to every AI-generated prompt for this profile at runtime.
                        Leave empty if you do not need a fixed baseline for this profile.
                    </p>

                    <div className="flex items-center mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2">
                            Trigger Word(s)
                            <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                LoRA trigger words prepended to the start of every positive prompt for this profile.
                                Example: "ohwx woman". These activate a LoRA model trained on a specific subject or style.
                                Leave empty if you are not using a LoRA for this profile.
                            </SettingsTooltip>
                        </label>
                        <input type="text" className="input-field w-3/4"
                            value={currentProfile.trigger || ''}
                            onChange={e => updateProfileField('trigger', e.target.value)}
                            placeholder="LoRA trigger word(s), e.g. ohwx woman" />
                    </div>

                    <div className="flex items-start mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                            Base Prompt
                            <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                A fixed positive prompt baseline always prepended to every generation for this profile.
                                Describe fixed visual properties such as appearance, style, or quality modifiers.
                                Example: "portrait of ohwx woman, short red hair, blue eyes, highly detailed, 8k".
                                Combined with the AI-generated activity description and Trigger words at runtime.
                            </SettingsTooltip>
                        </label>
                        <textarea className="input-field w-3/4" rows={3}
                            value={currentProfile.baseprompt || ''}
                            onChange={e => updateProfileField('baseprompt', e.target.value)}
                            placeholder="Fixed positive baseline for every generation, e.g. 'portrait of ohwx woman, highly detailed'" />
                    </div>

                    <div className="flex items-start mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                            Negative Prompt
                            <SettingsTooltip tooltipIndex={9} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                A fixed negative prompt applied to every generation for this profile — things to avoid
                                in every image (e.g. "blurry, low quality, watermark, deformed, ugly").
                                At runtime this is prepended to any dynamic negative prompt from the caller.
                                Leave empty if your workflow does not use a negative conditioning node.
                            </SettingsTooltip>
                        </label>
                        <textarea className="input-field w-3/4" rows={3}
                            value={currentProfile.negativeprompt || ''}
                            onChange={e => updateProfileField('negativeprompt', e.target.value)}
                            placeholder="e.g. blurry, low quality, watermark, deformed, ugly" />
                    </div>

                    <div className="flex items-start mb-3 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                            System Hint
                            <SettingsTooltip tooltipIndex={10} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                An optional instruction injected into the LLM system prompt when generating the activity
                                description for this profile. Use this to guide the AI on what kind of scene to describe.
                                Example: "Describe only the setting and current activity. Be vivid but concise (max 20 words)."
                                Without this hint the AI may produce descriptions that overlap with the Base Prompt content.
                            </SettingsTooltip>
                        </label>
                        <textarea className="input-field w-3/4" rows={3}
                            value={currentProfile.systempromphint}
                            onChange={e => updateProfileField('systempromphint', e.target.value)}
                            placeholder="Hint injected into the LLM system prompt when generating descriptions" />
                    </div>
                </div>

                {/* ── Test Generation ── */}
                <div className="border-t border-border-default pt-4 mt-2">
                    <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                        Test Generation
                        <SettingsTooltip tooltipIndex={11} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                            Tests the current saved configuration directly against the ComfyUI API using the selected profile.
                            No entity or simulator required — a temporary connection is created for this test only.
                            The generated image(s) will be displayed below. Use Seed 0 for a random seed each time,
                            or set a specific seed to get reproducible results.
                        </SettingsTooltip>
                    </h5>

                    <div className="flex items-start mb-1 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                            Positive Prompt
                        </label>
                        <textarea className="input-field w-3/4" rows={2}
                            value={testPositivePrompt}
                            onChange={e => setTestPositivePrompt(e.target.value)}
                            placeholder="e.g. a beautiful sunset over mountains, highly detailed..." />
                    </div>
                    {(currentProfile.trigger || currentProfile.baseprompt) && (
                        <p className="text-xs text-text-muted mt-1 mb-3 ml-[25%] pl-2">
                            ↳ Profile prefix will be prepended: <span className="text-text-primary italic">
                                {[currentProfile.trigger, currentProfile.baseprompt].filter(Boolean).join(', ')}
                            </span>
                        </p>
                    )}

                    <div className="flex items-start mb-1 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                            Negative Prompt
                        </label>
                        <textarea className="input-field w-3/4" rows={2}
                            value={testNegativePrompt}
                            onChange={e => setTestNegativePrompt(e.target.value)}
                            placeholder="(optional) e.g. blurry, low quality, watermark..." />
                    </div>
                    {currentProfile.negativeprompt && (
                        <p className="text-xs text-text-muted mt-1 mb-3 ml-[25%] pl-2">
                            ↳ Profile negative will be prepended: <span className="text-text-primary italic">
                                {currentProfile.negativeprompt}
                            </span>
                        </p>
                    )}

                    <div className="flex items-center mb-4 w-full">
                        <label className="text-sm font-medium text-text-secondary w-1/4 px-2">
                            Seed
                            <SettingsTooltip tooltipIndex={12} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                Set a specific seed value to get reproducible results from the same prompt.
                                Leave at 0 to use a random seed on each generation.
                                The seed actually used is reported after a successful generation.
                            </SettingsTooltip>
                        </label>
                        <input type="number" className="input-field w-48"
                            value={testSeed}
                            onChange={e => setTestSeed(parseInt(e.target.value) || 0)}
                            min={0} step={1}
                            placeholder="0 = random" />
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <button className="btn-primary px-4 py-1 text-sm"
                            onClick={handleTestGeneration}
                            disabled={isGenerating || !baseURL}>
                            {isGenerating ? '⏳ Generating...' : '🎨 Generate Test Image'}
                        </button>
                        {!baseURL && (
                            <span className="text-xs text-text-muted">Configure a Base URL first.</span>
                        )}
                    </div>

                    {testError && (
                        <div className="rounded p-2 bg-red-900/30 border border-red-700 text-xs text-red-400 mb-3">
                            {testError}
                        </div>
                    )}

                    {testResult && (
                        <div>
                            <p className="text-xs text-text-muted mb-2">
                                ✓ Generation successful — Seed used: <span className="text-text-primary font-medium">{testResult.seed_used}</span>
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {testResult.images && testResult.images.map((img, idx) => (
                                    <img key={idx} src={img} alt={`Generated ${idx + 1}`}
                                        className="rounded border border-border-default max-w-xs max-h-64 object-contain" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
