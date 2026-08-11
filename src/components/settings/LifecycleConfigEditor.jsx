import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import NumberStepper from '../ui/NumberStepper.jsx';
import SettingsTooltip from './SettingsTooltip.jsx';

/**
 * Shared Lifecycle Configuration Editor Component
 * Used by both CharacterProfileEditor and EntitySettingsView
 *
 * All strings are sourced from the `characters` namespace under `lifecycle.*`
 * so the same labels/hints render identically in both contexts.
 *
 * @param {Object} props
 * @param {Object} props.config - Current lifecycle config object
 * @param {Function} props.onChange - Callback when config changes
 * @param {boolean} props.readOnly - If true, display values read-only
 */
export default function LifecycleConfigEditor({ config, onChange, readOnly = false }) {
    const { t } = useTranslation('characters');
    const [tooltipVisible, setTooltipVisible] = useState(0);

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

    const beatTypes = ['self_reflection', 'curiosity', 'relationship', 'outreach'];

    return (
        <div className="space-y-4">
            {/* Beat Schedule Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('lifecycle.beatSchedule.title')}
                    <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                        {t('lifecycle.beatSchedule.tooltip')}
                    </SettingsTooltip>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.beatSchedule.autonomyLevel.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.beatSchedule.autonomyLevel.unit')}</span>
                        </label>
                        <ThemedSelect
                            value={config.autonomy_level ?? 1}
                            onChange={(val) => handleChange('autonomy_level', parseInt(val))}
                            options={[
                                { value: 0, label: t('lifecycle.beatSchedule.autonomyLevels.observe') },
                                { value: 1, label: t('lifecycle.beatSchedule.autonomyLevels.reflect') },
                                { value: 2, label: t('lifecycle.beatSchedule.autonomyLevels.reachOut') },
                                { value: 3, label: t('lifecycle.beatSchedule.autonomyLevels.act') },
                            ]}
                            disabled={readOnly}
                        />
                        <p className="character-editor-hint">{t('lifecycle.beatSchedule.autonomyLevel.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.beatSchedule.beatInterval.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.beatSchedule.beatInterval.unit')}</span>
                        </label>
                        <NumberStepper
                            value={config.beat_interval ?? 1800}
                            onChange={(e) => handleChange('beat_interval', e.target.value)}
                            disabled={readOnly}
                            min={60}
                            max={86400}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.beatSchedule.beatInterval.hint')}</p>
                    </div>
                    <div className="character-editor-field-group col-span-2">
                        <label className="character-editor-label">{t('lifecycle.beatSchedule.beatTypeWeights.label')}</label>
                        <div className="grid grid-cols-4 gap-3 mt-2">
                            {beatTypes.map(type => (
                                <div key={type} className="bg-background-base/50 rounded-lg p-3">
                                    <p className="text-xs text-text-muted mb-1">{t(`lifecycle.beatSchedule.beatTypes.${type}`)}</p>
                                    <NumberStepper
                                        step={0.05}
                                        min={0}
                                        max={1}
                                        value={config.beat_type_weights?.[type] ?? getDefaultWeight(type)}
                                        onChange={(e) => handleBeatTypeWeightChange(type, e.target.value)}
                                        disabled={readOnly}
                                        className="w-full text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="character-editor-hint">{t('lifecycle.beatSchedule.beatTypeWeights.hint')}</p>
                    </div>
                </div>
            </div>

            {/* Sleep & Exhaustion Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    {t('lifecycle.sleepExhaustion.title')}
                    <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                        {t('lifecycle.sleepExhaustion.tooltip')}
                    </SettingsTooltip>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.sleepExhaustion.sleepThreshold.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.sleepExhaustion.sleepThreshold.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.05}
                            min={0}
                            max={1}
                            value={config.sleep_threshold ?? 0.80}
                            onChange={(e) => handleChange('sleep_threshold', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.sleepExhaustion.sleepThreshold.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.sleepExhaustion.wakeThreshold.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.sleepExhaustion.wakeThreshold.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.05}
                            min={0}
                            max={1}
                            value={config.wake_threshold ?? 0.20}
                            onChange={(e) => handleChange('wake_threshold', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.sleepExhaustion.wakeThreshold.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.sleepExhaustion.exhaustionAccumulation.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.sleepExhaustion.exhaustionAccumulation.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.01}
                            min={0}
                            max={1}
                            value={config.exhaustion_accumulation_per_beat ?? 0.10}
                            onChange={(e) => handleChange('exhaustion_accumulation_per_beat', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.sleepExhaustion.exhaustionAccumulation.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.sleepExhaustion.exhaustionDecay.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.sleepExhaustion.exhaustionDecay.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.01}
                            min={0}
                            max={1}
                            value={config.exhaustion_decay_per_tick ?? 0.02}
                            onChange={(e) => handleChange('exhaustion_decay_per_tick', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.sleepExhaustion.exhaustionDecay.hint')}</p>
                    </div>
                </div>
            </div>

            {/* Emotion Decay Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('lifecycle.emotionDecay.title')}
                    <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                        {t('lifecycle.emotionDecay.tooltip')}
                    </SettingsTooltip>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.emotionDecay.decayTau.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.emotionDecay.decayTau.unit')}</span>
                        </label>
                        <NumberStepper
                            min={1}
                            value={config.emotion_decay_tau ?? 3600.0}
                            onChange={(e) => handleChange('emotion_decay_tau', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.emotionDecay.decayTau.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.emotionDecay.highThreshold.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.emotionDecay.highThreshold.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.1}
                            min={0}
                            max={10}
                            value={config.emotion_high_threshold ?? 6.0}
                            onChange={(e) => handleChange('emotion_high_threshold', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.emotionDecay.highThreshold.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.emotionDecay.lowThreshold.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.emotionDecay.lowThreshold.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.1}
                            min={0}
                            max={10}
                            value={config.emotion_low_threshold ?? 1.0}
                            onChange={(e) => handleChange('emotion_low_threshold', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.emotionDecay.lowThreshold.hint')}</p>
                    </div>
                </div>
            </div>

            {/* Crystallization Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    {t('lifecycle.crystallization.title')}
                    <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                        {t('lifecycle.crystallization.tooltip')}
                    </SettingsTooltip>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.crystallization.intensity.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.crystallization.intensity.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.1}
                            min={0}
                            max={10}
                            value={config.emotion_crystallize_intensity ?? 7.0}
                            onChange={(e) => handleChange('emotion_crystallize_intensity', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.crystallization.intensity.hint')}</p>
                    </div>
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.crystallization.minHours.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.crystallization.minHours.unit')}</span>
                        </label>
                        <NumberStepper
                            step={0.1}
                            min={0}
                            value={config.emotion_crystallize_min_hours ?? 2.0}
                            onChange={(e) => handleChange('emotion_crystallize_min_hours', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.crystallization.minHours.hint')}</p>
                    </div>
                </div>
            </div>

            {/* Memory Section */}
            <div className="character-editor-section">
                <div className="character-editor-section-header">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {t('lifecycle.memory.title')}
                    <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                        {t('lifecycle.memory.tooltip')}
                    </SettingsTooltip>
                </div>
                <div className="p-4">
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            {t('lifecycle.memory.coreMemoriesK.label')}
                            <span className="character-editor-label-unit">{t('lifecycle.memory.coreMemoriesK.unit')}</span>
                        </label>
                        <NumberStepper
                            min={1}
                            max={100}
                            value={config.core_memories_k ?? 10}
                            onChange={(e) => handleChange('core_memories_k', e.target.value)}
                            disabled={readOnly}
                            className="w-full"
                        />
                        <p className="character-editor-hint">{t('lifecycle.memory.coreMemoriesK.hint')}</p>
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
