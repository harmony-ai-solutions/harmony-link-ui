import React, { useState, useEffect } from 'react';
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
                            <button
                                type="button"
                                onClick={() => onChange(values.filter((_, i) => i !== index))}
                                className="text-text-muted hover:text-red-400 transition-colors"
                                title={t('editor.remove')}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * Modal editor for character profiles
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} [props.profile] - Existing profile to edit
 * @param {Function} props.onClose - Callback to close the editor
 */
export default function CharacterProfileEditor({ profile, onClose }) {
    const { t } = useTranslation('characters');
    const [activeTab, setActiveTab] = useState('basic');

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
            // NOTE: card_provenance is intentionally omitted — it is import-managed
            // and sending a stale copy could clobber the append-only provenance.
        };

        try {
            if (profile) {
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

    const tabs = [
        {
            id: 'basic', label: t('tabs.basic'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        },
        {
            id: 'images', label: t('tabs.images'), hidden: !profile,
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        },
        {
            id: 'greeting', label: t('tabs.greeting'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        },
        {
            id: 'lorebook', label: t('tabs.lorebook'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        },
        {
            id: 'lifecycle', label: t('tabs.lifecycle'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        },
        {
            id: 'advanced', label: t('tabs.advanced'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        },
        {
            id: 'attribution', label: t('tabs.attribution'),
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        },
    ];

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
                    <div className="space-y-5">
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">
                                {t('fields.name')}
                                <span className="character-editor-label-required">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={(e) => validateNameAndUpdate(e.target.value)}
                                required
                                placeholder={t('fields.namePlaceholder')}
                                className="input-field w-full"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">{t('fields.nickname')}</label>
                            <p className="character-editor-hint">{t('fields.nicknameHint')}</p>
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
                            <label className="character-editor-label">{t('fields.description')}</label>
                            <p className="character-editor-hint">{t('fields.descriptionHint')}</p>
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
                            <label className="character-editor-label">{t('fields.personality')}</label>
                            <p className="character-editor-hint">{t('fields.personalityHint')}</p>
                            <textarea
                                name="personality"
                                value={personality}
                                onChange={(e) => setPersonality(e.target.value)}
                                rows={4}
                                placeholder={t('fields.personalityPlaceholder')}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">{t('fields.voiceCharacteristics')}</label>
                            <p className="character-editor-hint">{t('fields.voiceCharacteristicsHint')}</p>
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
                );
            case 'greeting':
                return (
                    <div className="space-y-5">
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">{t('fields.firstMessage')}</label>
                            <p className="character-editor-hint">{t('fields.firstMessageHint')}</p>
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
                            <label className="character-editor-label">{t('fields.exampleMessage')}</label>
                            <p className="character-editor-hint">{t('fields.exampleMessageHint')}</p>
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
                            <label className="character-editor-label">{t('fields.alternateGreetings')}</label>
                            <p className="character-editor-hint">{t('fields.alternateGreetingsHint')}</p>
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
            case 'attribution':
                return (
                    <div className="space-y-5">
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">{t('fields.creator')}</label>
                            <p className="character-editor-hint">{t('fields.creatorHint')}</p>
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
                            <label className="character-editor-label">{t('fields.creatorNotes')}</label>
                            <p className="character-editor-hint">{t('fields.creatorNotesHint')}</p>
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
                            <label className="character-editor-label">{t('fields.characterVersion')}</label>
                            <p className="character-editor-hint">{t('fields.characterVersionHint')}</p>
                            <input
                                type="text"
                                name="character_version"
                                value={characterVersion}
                                onChange={(e) => setCharacterVersion(e.target.value)}
                                placeholder={t('fields.characterVersionPlaceholder')}
                                className="input-field w-full"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">{t('fields.tags')}</label>
                            <p className="character-editor-hint">{t('fields.tagsHint')}</p>
                            <StringListEditor
                                values={tags}
                                onChange={setTags}
                                placeholder={t('fields.tagsPlaceholder')}
                                addLabel={t('fields.addTag')}
                            />
                        </div>
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
                                </svg>
                                {t('provenance.title')}
                            </div>
                            <div className="space-y-2 p-4">
                                <p className="character-editor-hint">
                                    {t('provenance.hint')}{' '}
                                    <span className="font-medium">{t('provenance.sourceAppendOnly')}</span>
                                    {t('provenance.sourceAppendOnlyHint')}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
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
                    </div>
                );
            case 'advanced':
                return (
                    <div className="space-y-4">
                        {/* AI Prompt section */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {t('advanced.aiPromptSection')}
                            </div>
                            <div className="space-y-4 p-4">
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">{t('advanced.baseSystemPrompt')}</label>
                                    <p className="character-editor-hint">{t('advanced.baseSystemPromptHint')}</p>
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
                                    <label className="character-editor-label">{t('advanced.postHistoryInstructions')}</label>
                                    <p className="character-editor-hint">{t('advanced.postHistoryInstructionsHint')}</p>
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
                                    <label className="character-editor-label">{t('advanced.scenario')}</label>
                                    <p className="character-editor-hint">{t('advanced.scenarioHint')}</p>
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
                        </div>

                        {/* Chat Behavior section */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {t('advanced.chatBehaviorSection')}
                            </div>
                            <div className="grid grid-cols-2 gap-4 p-4">
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">
                                        {t('advanced.typingSpeed')}
                                        <span className="character-editor-label-unit">{t('advanced.wordsPerMinute')}</span>
                                    </label>
                                    <NumberStepper
                                        name="typing_speed_wpm"
                                        value={typingSpeedWPM}
                                        onChange={(e) => setTypingSpeedWPM(e.target.value)}
                                        onBlur={(e) => validateTypingSpeedAndUpdate(e.target.value)}
                                        min={1}
                                        max={200}
                                        className="w-full"
                                    />
                                    <p className="character-editor-hint">{t('advanced.typingSpeedHint')}</p>
                                </div>
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">
                                        {t('advanced.audioResponseChance')}
                                        <span className="character-editor-label-unit">0–100%</span>
                                    </label>
                                    <NumberStepper
                                        name="audio_response_chance_percent"
                                        value={audioResponseChance}
                                        onChange={(e) => setAudioResponseChance(e.target.value)}
                                        onBlur={(e) => validateAudioChanceAndUpdate(e.target.value)}
                                        min={0}
                                        max={100}
                                        className="w-full"
                                    />
                                    <p className="character-editor-hint">{t('advanced.audioChanceHint')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'lifecycle':
                return (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-4 py-3 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                            </svg>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                {t('lifecycle.defaultsNote')}
                            </p>
                        </div>
                        <LifecycleConfigEditor
                            config={lifecycleConfig}
                            onChange={setLifecycleConfig}
                        />
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
                                    {profile ? t('editor.editTitle') : t('editor.createTitle')}
                                </h2>
                                {profile && (
                                    <p className="text-xs text-text-muted mt-0.5">{profile.name}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {profile && <CharacterCardExport profile={profile} variant="editor" />}
                            <button
                                onClick={onClose}
                                data-tutorial-id="char-editor-close-btn"
                                className="relative text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-white/5"
                                title={t('buttons.close')}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Tab Bar ────────────────────────────────────────────────── */}
                <div className="character-editor-tab-bar">
                    {tabs.map(tab => !tab.hidden && (
                        <button
                            key={tab.id}
                            data-tutorial-id={`char-editor-tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`character-editor-tab ${activeTab === tab.id ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 bg-background-base">
                    {activeTab !== 'images' ? (
                        <form id="character-profile-form" onSubmit={handleSubmit}>
                            {renderTabContent()}
                        </form>
                    ) : (
                        renderTabContent()
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div className="character-editor-footer">
                    <div className="flex-1">
                        {error && (
                            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary px-5 py-2 text-sm font-semibold"
                        >
                            {t('buttons.cancel')}
                        </button>
                        {activeTab !== 'images' ? (
                            <button
                                type="submit"
                                form="character-profile-form"
                                data-tutorial-id="char-editor-save-btn"
                                disabled={saving}
                                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? t('buttons.saving') : t('buttons.saveProfile')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e)}
                                data-tutorial-id="char-editor-save-btn"
                                disabled={saving}
                                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? t('buttons.saving') : t('buttons.saveProfile')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <ErrorDialog
                isOpen={isModalVisible}
                title={t('editor.invalidInputTitle')}
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
                type="error"
            />
        </div>
    );
}
