import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import { listModuleConfigs } from '../../services/management/moduleService.js';
import ImageGallery from './ImageGallery';
import CharacterCardExport from './CharacterCardExport';
import LorebookEditor from './LorebookEditor';
import ErrorDialog from '../modals/ErrorDialog.jsx';
import LifecycleConfigEditor from '../settings/LifecycleConfigEditor.jsx';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import NumberStepper from '../ui/NumberStepper.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import useUIModeStore, { isModeAllowed } from '../../store/uiModeStore';

// ---------------------------------------------------------------------------
// Inline helpers (Character Card V3 data editing)
// ---------------------------------------------------------------------------

/** Defensively parse a JSON []string column into a plain string[] (engine may sync ''/'null'). */
function parseStringArray(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

/** Pretty-print a JSON column string for the Monaco editors; keep raw on parse failure. */
function formatJson(raw) {
    if (!raw) return '';
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        return raw;
    }
}

/**
 * Minimal repeatable list editor for JSON []string columns
 * (alternate_greetings, tags, group_only_greetings).
 */
function StringListEditor({ values, onChange, placeholder, addLabel }) {
    const { t } = useTranslation('characters');
    const [draft, setDraft] = useState('');

    const addItem = () => {
        const trimmed = draft.trim();
        if (trimmed && !values.includes(trimmed)) {
            onChange([...values, trimmed]);
        }
        setDraft('');
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                    placeholder={placeholder}
                    className="input-field flex-1"
                />
                <button
                    type="button"
                    onClick={addItem}
                    className="btn-secondary px-3 py-2 text-sm font-semibold"
                >
                    {addLabel}
                </button>
            </div>
            {values.length > 0 && (
                <ul className="space-y-1">
                    {values.map((value, index) => (
                        <li key={`${index}-${value}`} className="flex items-center gap-2 bg-white/5 rounded px-3 py-1.5">
                            <span className="flex-1 text-sm break-all">{value}</span>
                            <Tooltip content={t('editor.remove')}>
                                <button
                                    type="button"
                                    onClick={() => onChange(values.filter((_, i) => i !== index))}
                                    className="text-text-muted hover:text-red-400 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </Tooltip>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Small circular "?" that reveals a field's help text as a themed tooltip. */
function InfoDot({ hint }) {
    if (!hint) return null;
    return (
        <Tooltip content={hint}>
            <span className="char-editor-info" tabIndex={0} aria-label={hint}>?</span>
        </Tooltip>
    );
}

/**
 * Field label with an optional info dot. Replaces the old always-visible hint
 * paragraph so the form reads cleanly and help text is one hover away.
 */
function FieldLabel({ children, hint, unit, required }) {
    return (
        <label className="character-editor-label">
            {children}
            {required && <span className="character-editor-label-required">*</span>}
            {unit && <span className="character-editor-label-unit">{unit}</span>}
            <InfoDot hint={hint} />
        </label>
    );
}

/** Collapsible section wrapper — the whole header row toggles the body. */
function Section({ id, title, icon, open, onToggle, children }) {
    return (
        <div className="character-editor-section">
            <button
                type="button"
                className="char-editor-section-head"
                aria-expanded={open}
                onClick={() => onToggle(id)}
            >
                {icon}
                {title}
                <svg className="char-editor-section-chevron w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="p-4">{children}</div>}
        </div>
    );
}

/**
 * Modal editor for character profiles
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} [props.profile] - Existing profile to edit
 * @param {Function} props.onClose - Callback to close the editor
 * @param {Object[]} [props.referencedEntities] - 3-2: entities that link this
 *   profile live. When non-empty the header shows a muted live-link hint.
 * @param {boolean} [props.personaMode] - 2-3: persona editing mode. Hides the
 *   lifecycle + advanced tabs (decision 2) and, when combined with
 *   `nameReadOnly`, locks the name field. Greeting TEST affordances are never
 *   rendered in this mode (decision 13).
 * @param {boolean} [props.nameReadOnly] - 2-3: make the name field read-only
 *   (built-in 'user' persona — the engine rejects renames anyway).
 * @param {Function} [props.onSave] - 2-3: optional save override. When provided,
 *   the editor calls `onSave(payload)` instead of its own store save and only
 *   closes on success; thrown errors surface in the editor's error UI.
 */
export default function CharacterProfileEditor({ profile, onClose, referencedEntities = [], personaMode = false, nameReadOnly = false, onSave = null, variant = 'modal' }) {
    const { t } = useTranslation('characters');
    const [activeTab, setActiveTab] = useState('basic');
    const isReferenced = Array.isArray(referencedEntities) && referencedEntities.length > 0;
    const mode = useUIModeStore((state) => state.mode);
    const isPage = variant === 'page';

    // Collapsible sections. Core sections start open so nothing is hidden on
    // first sight; technical/rarely-edited sections start closed to keep the
    // form calm. The user can toggle any of them freely.
    const [openSections, setOpenSections] = useState({
        identity: true,
        cardInfo: true,
        aiPrompt: true,
        chatBehavior: true,
        aiLifecycle: true,
        rawCardData: false,
    });
    const toggleSection = (id) =>
        setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

    const createProfile = useCharacterProfileStore(state => state.createProfile);
    const updateProfile = useCharacterProfileStore(state => state.updateProfile);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Modal dialog for field validation errors (consistent with module settings pattern)
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Individual field states (per-field pattern, consistent with module settings views)
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personality, setPersonality] = useState('');
    const [voiceCharacteristics, setVoiceCharacteristics] = useState('');
    const [basePrompt, setBasePrompt] = useState('');
    const [scenario, setScenario] = useState('');
    const [typingSpeedWPM, setTypingSpeedWPM] = useState('60');
    const [audioResponseChance, setAudioResponseChance] = useState('50');
    // Character Card V3 fields
    const [firstMes, setFirstMes] = useState('');
    const [mesExample, setMesExample] = useState('');
    const [alternateGreetings, setAlternateGreetings] = useState([]);
    const [postHistoryInstructions, setPostHistoryInstructions] = useState('');
    const [creatorNotes, setCreatorNotes] = useState('');
    const [creator, setCreator] = useState('');
    const [characterVersion, setCharacterVersion] = useState('');
    const [nickname, setNickname] = useState('');
    const [tags, setTags] = useState([]);
    const [groupOnlyGreetings, setGroupOnlyGreetings] = useState([]);
    const [extensions, setExtensions] = useState('');
    const [assets, setAssets] = useState('');
    const [characterBook, setCharacterBook] = useState('');
    const [cardProvenance, setCardProvenance] = useState('');
    const [visionConfigs, setVisionConfigs] = useState([]);
    const [selectedVisionConfigId, setSelectedVisionConfigId] = useState(null);
    const [lifecycleConfig, setLifecycleConfig] = useState({
        autonomy_level: 1,
        beat_interval: 1800,
        beat_type_weights: { self_reflection: 0.35, curiosity: 0.30, relationship: 0.25, outreach: 0.10 },
        sleep_threshold: 0.80,
        wake_threshold: 0.20,
        exhaustion_accumulation_per_beat: 0.10,
        exhaustion_decay_per_tick: 0.02,
        emotion_decay_tau: 3600.0,
        emotion_high_threshold: 6.0,
        emotion_low_threshold: 1.0,
        emotion_crystallize_intensity: 7.0,
        emotion_crystallize_min_hours: 2.0,
        core_memories_k: 10,
    });

    const setInitialValues = () => {
        if (profile) {
            setName(profile.name || '');
            setDescription(profile.description || '');
            setPersonality(profile.personality || '');
            setVoiceCharacteristics(profile.voice_characteristics || '');
            setBasePrompt(profile.base_prompt || '');
            setScenario(profile.scenario || '');
            setTypingSpeedWPM(String(profile.typing_speed_wpm ?? 60));
            setAudioResponseChance(String(profile.audio_response_chance_percent ?? 50));
            setSelectedVisionConfigId(profile.vision_config_id || null);
            // Character Card V3 fields
            setFirstMes(profile.first_mes ?? '');
            setMesExample(profile.mes_example ?? '');
            setAlternateGreetings(parseStringArray(profile.alternate_greetings));
            setPostHistoryInstructions(profile.post_history_instructions ?? '');
            setCreatorNotes(profile.creator_notes ?? '');
            setCreator(profile.creator ?? '');
            setCharacterVersion(profile.character_version ?? '');
            setNickname(profile.nickname ?? '');
            setTags(parseStringArray(profile.tags));
            setGroupOnlyGreetings(parseStringArray(profile.group_only_greetings));
            setExtensions(formatJson(profile.extensions));
            setAssets(formatJson(profile.assets));
            setCharacterBook(formatJson(profile.character_book) || '{\n  "entries": []\n}');
            setCardProvenance(formatJson(profile.card_provenance));
            // Parse lifecycle_config from profile
            if (profile.lifecycle_config) {
                try {
                    const parsed = typeof profile.lifecycle_config === 'string'
                        ? JSON.parse(profile.lifecycle_config)
                        : profile.lifecycle_config;
                    setLifecycleConfig(parsed);
                } catch (e) {
                    // Use defaults on parse error
                }
            }
        } else {
            setName('');
            setDescription('');
            setPersonality('');
            setVoiceCharacteristics('');
            setBasePrompt('');
            setScenario('');
            setTypingSpeedWPM('60');
            setAudioResponseChance('50');
            setSelectedVisionConfigId(null);
            // Character Card V3 fields
            setFirstMes('');
            setMesExample('');
            setAlternateGreetings([]);
            setPostHistoryInstructions('');
            setCreatorNotes('');
            setCreator('');
            setCharacterVersion('');
            setNickname('');
            setTags([]);
            setGroupOnlyGreetings([]);
            setExtensions('');
            setAssets('');
            setCharacterBook('{\n  "entries": []\n}');
            setCardProvenance('');
            // Reset to defaults
            setLifecycleConfig({
                autonomy_level: 1,
                beat_interval: 1800,
                beat_type_weights: { self_reflection: 0.35, curiosity: 0.30, relationship: 0.25, outreach: 0.10 },
                sleep_threshold: 0.80,
                wake_threshold: 0.20,
                exhaustion_accumulation_per_beat: 0.10,
                exhaustion_decay_per_tick: 0.02,
                emotion_decay_tau: 3600.0,
                emotion_high_threshold: 6.0,
                emotion_low_threshold: 1.0,
                emotion_crystallize_intensity: 7.0,
                emotion_crystallize_min_hours: 2.0,
                core_memories_k: 10,
            });
        }
    };

    useEffect(() => {
        setInitialValues();
    }, [profile]);

    useEffect(() => {
        if (activeTab === 'images') {
            listModuleConfigs('vision').then(setVisionConfigs).catch(console.error);
        }
    }, [activeTab]);

    // onBlur validation functions (consistent with module settings pattern)
    const validateNameAndUpdate = (value) => {
        if (value.trim() === '' && name.length > 0) {
            showModal(t('editor.nameCannotBeEmpty'));
            setName(profile?.name || ''); // reset to original profile name
            return;
        }
        setName(value);
    };

    const validateTypingSpeedAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 1 || numValue > 200) {
            showModal(t('editor.typingSpeedValidation'));
            setTypingSpeedWPM(String(profile?.typing_speed_wpm ?? 60)); // reset to original/default
            return;
        }
        setTypingSpeedWPM(String(numValue));
    };

    const validateAudioChanceAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
            showModal(t('editor.audioChanceValidation'));
            setAudioResponseChance(String(profile?.audio_response_chance_percent ?? 50)); // reset to original/default
            return;
        }
        setAudioResponseChance(String(numValue));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError(t('editor.nameRequired'));
            return;
        }

        const typingSpeedNum = parseInt(typingSpeedWPM, 10);
        const audioChanceNum = parseInt(audioResponseChance, 10);

        if (isNaN(typingSpeedNum) || typingSpeedNum < 1 || typingSpeedNum > 200) {
            setError(t('editor.typingSpeedError'));
            return;
        }
        if (isNaN(audioChanceNum) || audioChanceNum < 0 || audioChanceNum > 100) {
            setError(t('editor.audioChanceError'));
            return;
        }

        // Validate raw JSON-object columns before submitting (block save on invalid JSON).
        const jsonFields = [
            ['character_book', characterBook],
            ['extensions', extensions],
            ['assets', assets],
        ];
        for (const [fieldName, value] of jsonFields) {
            if (value && value.trim()) {
                try {
                    JSON.parse(value);
                } catch {
                    setError(t('editor.invalidJsonIn', { field: fieldName }));
                    return;
                }
            }
        }

        setSaving(true);
        setError(null);

        const payload = {
            name: name.trim(),
            description,
            personality,
            voice_characteristics: voiceCharacteristics,
            base_prompt: basePrompt,
            scenario,
            typing_speed_wpm: typingSpeedNum,
            audio_response_chance_percent: audioChanceNum,
            vision_config_id: selectedVisionConfigId || null,
            lifecycle_config: JSON.stringify(lifecycleConfig),
            // Character Card V3 fields (snake_case to match the API)
            first_mes: firstMes,
            mes_example: mesExample,
            alternate_greetings: JSON.stringify(alternateGreetings),
            post_history_instructions: postHistoryInstructions,
            creator_notes: creatorNotes,
            creator,
            character_version: characterVersion,
            nickname,
            tags: JSON.stringify(tags),
            group_only_greetings: JSON.stringify(groupOnlyGreetings),
            extensions,
            assets,
            character_book: characterBook,
            // 2-3: card_provenance must round-trip. The engine's UPDATE
            // overwrites every column, so omitting it would WIPE the
            // import-managed provenance on save. We load it fresh when opening
            // the editor and send the same value back unchanged (append-only
            // semantics preserved).
            card_provenance: cardProvenance,
        };

        try {
            if (onSave) {
                // 2-3 persona flow: the caller owns the save (reserved-name
                // check, rename-first, profile update, alias sync / entity
                // create). Engine 400s propagate here and surface in the
                // editor's error UI.
                await onSave(payload);
            } else if (profile) {
                await updateProfile(profile.id, payload);
            } else {
                await createProfile(payload);
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Each tab declares the lowest UI mode that can see it (`minMode`), so the
    // Simple/Pro/Developer setting hides advanced sections for normal users.
    // Nothing is deleted — Pro/Dev users still reach every field.
    const tabs = [
        {
            id: 'basic', label: t('tabs.profile'), minMode: 'simple',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        },
        {
            id: 'greeting', label: t('tabs.greeting'), minMode: 'simple',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        },
        {
            id: 'lorebook', label: t('tabs.lorebook'), minMode: 'pro',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        },
        {
            // 2-3: the behaviour + raw-card tabs are hidden for personas
            // (decision 2) — personas never run autonomous lifecycle beats and
            // the raw card fields stay card-only. The values still round-trip
            // on save via the editor's full-field state.
            id: 'behavior', label: t('tabs.behavior'), minMode: 'pro', personaHidden: true,
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        },
        {
            id: 'advanced', label: t('tabs.advanced'), minMode: 'dev', personaHidden: true,
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        },
        {
            id: 'images', label: t('tabs.images'), minMode: 'simple', hidden: !profile,
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        },
    ];

    // Tabs actually shown: not hidden for the profile type, and permitted by
    // the active UI mode. Memoised so the downgrade guard below only runs when
    // the mode / profile actually change.
    const visibleTabs = useMemo(
        () => tabs.filter((tab) =>
            !tab.hidden && !(personaMode && tab.personaHidden) && isModeAllowed(mode, tab.minMode),
        ),
        // `tabs` is rebuilt each render; its content only depends on `t`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mode, personaMode, profile, t],
    );

    // Downgrade safety — if the active tab became hidden (mode switched down,
    // or persona mode), fall back to the Profile tab.
    useEffect(() => {
        if (!visibleTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab('basic');
        }
    }, [visibleTabs, activeTab]);

    // Live preview avatar — the profile's primary image, when one exists.
    const previewImage = useMemo(() => {
        const images = profile?.images;
        if (!Array.isArray(images) || images.length === 0) return null;
        const primary = images.find((img) => img.is_primary) || images[0];
        return primary?.url || primary?.image_url || null;
    }, [profile]);

    // Read-only provenance display helper. card_provenance is import-managed
    // (append-only) so it is never edited or sent back on save.
    const renderProvenanceField = (key) => {
        if (!cardProvenance) return '—';
        try {
            const parsed = JSON.parse(cardProvenance);
            const value = parsed?.[key];
            if (value === undefined || value === null || value === '') return '—';
            if (Array.isArray(value)) return value.join(', ') || '—';
            if (typeof value === 'number') {
                // Unix epoch seconds (card spec dates are *int64 epochs).
                try {
                    return new Date(value * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
                } catch {
                    return String(value);
                }
            }
            return String(value);
        } catch {
            return '—';
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    <div className="space-y-4">
                        <Section
                            id="identity"
                            title={t('sections.identity')}
                            open={openSections.identity}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                        >
                            <div className="space-y-4">
                                <div className="character-editor-field-group">
                                    <FieldLabel required>{t('fields.name')}</FieldLabel>
                                    <Tooltip content={nameReadOnly ? t('personas:editor.nameLocked') : ''}>
                                        <input
                                            type="text"
                                            name="name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onBlur={(e) => validateNameAndUpdate(e.target.value)}
                                            required
                                            disabled={nameReadOnly}
                                            placeholder={t('fields.namePlaceholder')}
                                            className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </Tooltip>
                                    {nameReadOnly && (
                                        <p className="character-editor-hint mt-1">{t('personas:editor.nameLocked')}</p>
                                    )}
                                </div>
                                <div className="char-editor-grid-2">
                                    <div className="character-editor-field-group">
                                        <FieldLabel hint={t('fields.nicknameHint')}>{t('fields.nickname')}</FieldLabel>
                                        <input
                                            type="text"
                                            name="nickname"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            placeholder={t('fields.nicknamePlaceholder')}
                                            className="input-field w-full"
                                        />
                                    </div>
                                    <div className="character-editor-field-group">
                                        <FieldLabel hint={t('fields.voiceCharacteristicsHint')}>{t('fields.voiceCharacteristics')}</FieldLabel>
                                        <textarea
                                            name="voice_characteristics"
                                            value={voiceCharacteristics}
                                            onChange={(e) => setVoiceCharacteristics(e.target.value)}
                                            rows={2}
                                            placeholder={t('fields.voiceCharacteristicsPlaceholder')}
                                            className="input-field w-full resize-none"
                                        />
                                    </div>
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('fields.descriptionHint')}>{t('fields.description')}</FieldLabel>
                                    <textarea
                                        name="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        placeholder={t('fields.descriptionPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('fields.personalityHint')}>{t('fields.personality')}</FieldLabel>
                                    <textarea
                                        name="personality"
                                        value={personality}
                                        onChange={(e) => setPersonality(e.target.value)}
                                        rows={4}
                                        placeholder={t('fields.personalityPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="cardInfo"
                            title={t('sections.cardInfo')}
                            open={openSections.cardInfo}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" /></svg>}
                        >
                            <div className="space-y-4">
                                <div className="char-editor-grid-2">
                                    <div className="character-editor-field-group">
                                        <FieldLabel hint={t('fields.creatorHint')}>{t('fields.creator')}</FieldLabel>
                                        <input
                                            type="text"
                                            name="creator"
                                            value={creator}
                                            onChange={(e) => setCreator(e.target.value)}
                                            placeholder={t('fields.creatorPlaceholder')}
                                            className="input-field w-full"
                                        />
                                    </div>
                                    <div className="character-editor-field-group">
                                        <FieldLabel hint={t('fields.characterVersionHint')}>{t('fields.characterVersion')}</FieldLabel>
                                        <input
                                            type="text"
                                            name="character_version"
                                            value={characterVersion}
                                            onChange={(e) => setCharacterVersion(e.target.value)}
                                            placeholder={t('fields.characterVersionPlaceholder')}
                                            className="input-field w-full"
                                        />
                                    </div>
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('fields.creatorNotesHint')}>{t('fields.creatorNotes')}</FieldLabel>
                                    <textarea
                                        name="creator_notes"
                                        value={creatorNotes}
                                        onChange={(e) => setCreatorNotes(e.target.value)}
                                        rows={3}
                                        placeholder={t('fields.creatorNotesPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('fields.tagsHint')}>{t('fields.tags')}</FieldLabel>
                                    <StringListEditor
                                        values={tags}
                                        onChange={setTags}
                                        placeholder={t('fields.tagsPlaceholder')}
                                        addLabel={t('fields.addTag')}
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('provenance.hint')}>{t('sections.provenance')}</FieldLabel>
                                    <div className="char-editor-grid-2">
                                        <div>
                                            <span className="text-xs text-text-muted">{t('provenance.source')}</span>
                                            <p className="text-sm break-all">{renderProvenanceField('source')}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-text-muted">{t('provenance.creationDate')}</span>
                                            <p className="text-sm">{renderProvenanceField('creation_date')}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-text-muted">{t('provenance.modificationDate')}</span>
                                            <p className="text-sm">{renderProvenanceField('modification_date')}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-text-muted">{t('provenance.specVersion')}</span>
                                            <p className="text-sm">{renderProvenanceField('spec_version')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>
                    </div>
                );
            case 'greeting':
                return (
                    <div className="space-y-4">
                        <div className="character-editor-field-group">
                            <FieldLabel hint={t('fields.firstMessageHint')}>{t('fields.firstMessage')}</FieldLabel>
                            <textarea
                                name="first_mes"
                                value={firstMes}
                                onChange={(e) => setFirstMes(e.target.value)}
                                rows={6}
                                placeholder={t('fields.firstMessagePlaceholder')}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <FieldLabel hint={t('fields.exampleMessageHint')}>{t('fields.exampleMessage')}</FieldLabel>
                            <textarea
                                name="mes_example"
                                value={mesExample}
                                onChange={(e) => setMesExample(e.target.value)}
                                rows={5}
                                placeholder={t('fields.exampleMessagePlaceholder')}
                                className="input-field w-full resize-none font-mono text-sm"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <FieldLabel hint={t('fields.alternateGreetingsHint')}>{t('fields.alternateGreetings')}</FieldLabel>
                            <StringListEditor
                                values={alternateGreetings}
                                onChange={setAlternateGreetings}
                                placeholder={t('fields.alternateGreetingsPlaceholder')}
                                addLabel={t('fields.addGreeting')}
                            />
                        </div>
                    </div>
                );
            case 'lorebook':
                return (
                    <div className="space-y-4">
                        <LorebookEditor value={characterBook} onChange={setCharacterBook} />
                    </div>
                );
            case 'behavior':
                return (
                    <div className="space-y-4">
                        <Section
                            id="aiPrompt"
                            title={t('sections.aiPrompt')}
                            open={openSections.aiPrompt}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                        >
                            <div className="space-y-4">
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.baseSystemPromptHint')}>{t('advanced.baseSystemPrompt')}</FieldLabel>
                                    <textarea
                                        name="base_prompt"
                                        value={basePrompt}
                                        onChange={(e) => setBasePrompt(e.target.value)}
                                        rows={4}
                                        placeholder={t('advanced.baseSystemPromptPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.postHistoryInstructionsHint')}>{t('advanced.postHistoryInstructions')}</FieldLabel>
                                    <textarea
                                        name="post_history_instructions"
                                        value={postHistoryInstructions}
                                        onChange={(e) => setPostHistoryInstructions(e.target.value)}
                                        rows={3}
                                        placeholder={t('advanced.postHistoryInstructionsPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.scenarioHint')}>{t('advanced.scenario')}</FieldLabel>
                                    <textarea
                                        name="scenario"
                                        value={scenario}
                                        onChange={(e) => setScenario(e.target.value)}
                                        rows={2}
                                        placeholder={t('advanced.scenarioPlaceholder')}
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="chatBehavior"
                            title={t('sections.chatBehavior')}
                            open={openSections.chatBehavior}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                        >
                            <div className="char-editor-grid-2">
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.typingSpeedHint')} unit={t('advanced.wordsPerMinute')}>{t('advanced.typingSpeed')}</FieldLabel>
                                    <NumberStepper
                                        name="typing_speed_wpm"
                                        value={typingSpeedWPM}
                                        onChange={(e) => setTypingSpeedWPM(e.target.value)}
                                        onBlur={(e) => validateTypingSpeedAndUpdate(e.target.value)}
                                        min={1}
                                        max={200}
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.audioChanceHint')} unit="%">{t('advanced.audioResponseChance')}</FieldLabel>
                                    <NumberStepper
                                        name="audio_response_chance_percent"
                                        value={audioResponseChance}
                                        onChange={(e) => setAudioResponseChance(e.target.value)}
                                        onBlur={(e) => validateAudioChanceAndUpdate(e.target.value)}
                                        min={0}
                                        max={100}
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section
                            id="aiLifecycle"
                            title={t('sections.aiLifecycle')}
                            open={openSections.aiLifecycle}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                        >
                            <div className="space-y-4">
                                <p className="character-editor-hint">{t('lifecycle.defaultsNote')}</p>
                                <LifecycleConfigEditor
                                    config={lifecycleConfig}
                                    onChange={setLifecycleConfig}
                                />
                            </div>
                        </Section>
                    </div>
                );
            case 'advanced':
                return (
                    <div className="space-y-4">
                        <Section
                            id="rawCardData"
                            title={t('sections.rawCardData')}
                            open={openSections.rawCardData}
                            onToggle={toggleSection}
                            icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
                        >
                            <div className="space-y-4">
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('fields.groupOnlyGreetingsHint')}>{t('fields.groupOnlyGreetings')}</FieldLabel>
                                    <StringListEditor
                                        values={groupOnlyGreetings}
                                        onChange={setGroupOnlyGreetings}
                                        placeholder={t('fields.groupOnlyGreetingsPlaceholder')}
                                        addLabel={t('fields.addGreeting')}
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.extensionsHint')}>{t('advanced.extensions')}</FieldLabel>
                                    <textarea
                                        name="extensions"
                                        value={extensions}
                                        onChange={(e) => setExtensions(e.target.value)}
                                        rows={3}
                                        placeholder="{ }"
                                        className="input-field w-full resize-none font-mono text-sm"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <FieldLabel hint={t('advanced.assetsHint')}>{t('advanced.assets')}</FieldLabel>
                                    <textarea
                                        name="assets"
                                        value={assets}
                                        onChange={(e) => setAssets(e.target.value)}
                                        rows={3}
                                        placeholder="[ ]"
                                        className="input-field w-full resize-none font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </Section>
                    </div>
                );
            case 'images':
                return profile ? (
                    <div className="space-y-4">
                        {/* Vision Config selector */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                {t('vision.title')}
                            </div>
                            <div className="flex items-center gap-4 p-4">
                                <ThemedSelect
                                    value={selectedVisionConfigId ?? ''}
                                    onChange={(val) => setSelectedVisionConfigId(val || null)}
                                    options={[
                                        { value: '', label: t('vision.none') },
                                        ...visionConfigs.map(cfg => ({ value: cfg.id, label: cfg.name }))
                                    ]}
                                    className="flex-1 max-w-xs"
                                />
                                <p className="character-editor-hint flex-1 italic">
                                    {t('vision.hint')}
                                </p>
                            </div>
                        </div>

                        <ImageGallery
                            profileId={profile.id}
                            visionConfigId={selectedVisionConfigId}
                        />
                    </div>
                ) : null;
            default:
                return null;
        }
    };

    const headingTitle = personaMode
        ? (profile ? t('personas:dialogs.editTitle') : t('personas:dialogs.createTitle'))
        : (profile ? t('editor.editTitle') : t('editor.createTitle'));

    // Content is wrapped in a <form> on every tab except Images (which owns its
    // own actions), so pressing Enter in a field saves.
    const renderContent = () => (
        activeTab !== 'images' ? (
            <form id="character-profile-form" onSubmit={handleSubmit}>
                {renderTabContent()}
            </form>
        ) : (
            renderTabContent()
        )
    );

    // Primary Save action. `tutorialId` is only set on ONE instance per variant
    // so the tutorial anchor stays unique.
    const renderSaveButton = (tutorialId = null) => (
        activeTab !== 'images' ? (
            <button
                type="submit"
                form="character-profile-form"
                data-tutorial-id={tutorialId || undefined}
                disabled={saving}
                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? t('buttons.saving') : t('buttons.saveProfile')}
            </button>
        ) : (
            <button
                type="button"
                onClick={(e) => handleSubmit(e)}
                data-tutorial-id={tutorialId || undefined}
                disabled={saving}
                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? t('buttons.saving') : t('buttons.saveProfile')}
            </button>
        )
    );

    // Distinct title + one-line description for the active tab, so each section
    // is instantly recognisable instead of looking like the same wall of fields.
    const activeTabInfo = tabs.find((tab) => tab.id === activeTab);

    const renderError = () => error && (
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-error)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
        </div>
    );

    const errorDialog = (
        <ErrorDialog
            isOpen={isModalVisible}
            title={t('editor.invalidInputTitle')}
            message={modalMessage}
            onClose={() => setIsModalVisible(false)}
            type="error"
        />
    );

    // ── Dedicated-page variant ──────────────────────────────────────────
    // Full-page form: sticky top bar (back · avatar/name · Save), a horizontal
    // tab strip beneath it, and a centred scrolling pane with a sticky footer.
    if (isPage) {
        return (
            <div className="char-editor-page">
                <div className="char-editor-page-topbar">
                    <Tooltip content={t('page.back')}>
                        <button
                            type="button"
                            onClick={onClose}
                            data-tutorial-id="char-editor-close-btn"
                            className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-white/5 flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </Tooltip>
                    <div className="char-editor-page-avatar">
                        {previewImage ? (
                            <img src={previewImage} alt={name || profile?.name || ''} />
                        ) : (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="char-editor-page-title text-gradient-primary truncate">{headingTitle}</div>
                        <div className="char-editor-page-sub truncate">
                            {name || profile?.name || t('fields.namePlaceholder')}
                            {profile && isReferenced && (
                                <span className="italic"> · {t('liveLinkHint')}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {profile && <CharacterCardExport profile={profile} variant="editor" />}
                        {renderSaveButton('char-editor-save-btn')}
                    </div>
                </div>

                <div className="char-editor-page-tabs">
                    <div className="char-editor-tabbar">
                        {visibleTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                data-tutorial-id={`char-editor-tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id)}
                                className={`char-editor-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="char-editor-page-scroll">
                    <div className="char-editor-page-pane">
                        {activeTabInfo && (
                            <div className="char-editor-page-tabhead">
                                <h2 className="char-editor-page-tabtitle">
                                    {t(`tabInfo.${activeTabInfo.id}.title`)}
                                </h2>
                                <p className="char-editor-page-tabdesc">
                                    {t(`tabInfo.${activeTabInfo.id}.desc`)}
                                </p>
                            </div>
                        )}
                        {mode === 'simple' && (
                            <p className="char-editor-page-hint mb-4">{t('page.modeHint')}</p>
                        )}
                        {renderContent()}
                    </div>
                </div>

                <div className="char-editor-page-footer">
                    <div className="flex-1">{renderError()}</div>
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary px-5 py-2 text-sm font-semibold"
                        >
                            {t('buttons.cancel')}
                        </button>
                        {renderSaveButton()}
                    </div>
                </div>

                {errorDialog}
            </div>
        );
    }

    // ── Modal variant (fallback — Personas tab + cross-view handoffs) ────
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="character-editor-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* ── Modal Header ───────────────────────────────────────────── */}
                <div className="character-editor-modal-header">
                    <div className="character-editor-modal-tint" />
                    <div className="character-editor-modal-stripe" />
                    <div className="relative flex justify-between items-center px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="character-editor-icon-badge">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gradient-primary leading-tight">
                                    {headingTitle}
                                </h2>
                                {profile && (
                                    <p className="text-xs text-text-muted mt-0.5">{profile.name}</p>
                                )}
                                {profile && isReferenced && (
                                    <p className="text-[11px] text-text-muted italic mt-0.5">
                                        {t('liveLinkHint')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {profile && <CharacterCardExport profile={profile} variant="editor" />}
                            <Tooltip content={t('buttons.close')}>
                                <button
                                    onClick={onClose}
                                    data-tutorial-id="char-editor-close-btn"
                                    className="relative text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-white/5"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* ── Tab Bar ────────────────────────────────────────────────── */}
                <div className="char-editor-tabbar">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            data-tutorial-id={`char-editor-tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`char-editor-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 bg-background-base">
                    {renderContent()}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div className="character-editor-footer">
                    <div className="flex-1">{renderError()}</div>
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary px-5 py-2 text-sm font-semibold"
                        >
                            {t('buttons.cancel')}
                        </button>
                        {renderSaveButton('char-editor-save-btn')}
                    </div>
                </div>
            </div>
            {errorDialog}
        </div>
    );
}
