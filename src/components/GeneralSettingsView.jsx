import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import { LogDebug, LogPrint } from "../utils/logger.js";
import { useTheme } from '../contexts/ThemeContext';
import { useI18nContext } from '../contexts/I18nContext.jsx';
import { listThemes } from '../services/management/themeService';
import { getConfig, updateConfig } from '../services/management/configService';
import { openSystemUrl } from '../services/management/systemService';
import ConfirmDialog from './modals/ConfirmDialog.jsx';
import ErrorDialog from './modals/ErrorDialog.jsx';
import DeviceManagementModal from './modals/DeviceManagementModal.jsx';

const FONT_SCALE_OPTIONS = [
    { value: 'compact', labelKey: 'generalSettings:fields.fontScale.options.compact' },
    { value: 'default', labelKey: 'generalSettings:fields.fontScale.options.default' },
    { value: 'large', labelKey: 'generalSettings:fields.fontScale.options.large' },
];

const NUMBER_FORMAT_OPTIONS = [
    { value: 'en', labelKey: 'generalSettings:fields.numberFormat.options.en' },
    { value: 'de', labelKey: 'generalSettings:fields.numberFormat.options.de' },
    { value: 'fr', labelKey: 'generalSettings:fields.numberFormat.options.fr' },
];

const AUTO_UPDATE_OPTIONS = [
    { value: 'auto', labelKey: 'generalSettings:fields.autoUpdate.options.auto' },
    { value: 'notify', labelKey: 'generalSettings:fields.autoUpdate.options.notify' },
    { value: 'disabled', labelKey: 'generalSettings:fields.autoUpdate.options.disabled' },
];

const OFFICIAL_THEME_IDS = ['soulbits-dark', 'soulbits-light'];

const GeneralSettingsView = ({ generalSettings, saveGeneralSettings }) => {
    const { t } = useTranslation();
    const { currentTheme, switchTheme } = useTheme();
    const { changeLanguage } = useI18nContext();
    const [themes, setThemes] = useState([]);
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState(() => { });
    const [confirmModalNo, setConfirmModalNo] = useState(() => { });

    // Device Management modal state
    const [showDeviceManagementModal, setShowDeviceManagementModal] = useState(false);

    // Success/error feedback for export/import
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackType, setFeedbackType] = useState(''); // 'success' or 'error'

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };
    const showConfirmModal = (message) => {
        setConfirmModalMessage(message);
        setConfirmModalVisible(true);
    };

    // Feedback toast
    const showFeedback = (message, type) => {
        setFeedbackMessage(message);
        setFeedbackType(type);
        setTimeout(() => {
            setFeedbackMessage('');
            setFeedbackType('');
        }, 4000);
    };

    // Hidden file input ref for import
    const importFileRef = useRef(null);

    // Fields — existing
    const [workingDir, setWorkingDir] = useState("");
    const [dataDir, setDataDir] = useState("");
    const [databaseFileName, setDatabaseFileName] = useState("");
    const [authEndpoint, setAuthEndpoint] = useState("");
    const [userApiKey, setUserApiKey] = useState("");
    const [useHarmonyCloud, setUseHarmonyCloud] = useState(false);
    const [confirmEvents, setConfirmEvents] = useState(false);
    const [logFile, setLogFile] = useState(false);
    const [port, setPort] = useState(28080);
    const [clientConnectionBuffer, setClientConnectionBuffer] = useState(8192);
    const [singlePort, setSinglePort] = useState(false);
    const [wssPort, setWssPort] = useState(28443);

    // Fields — new UI
    const [fontScale, setFontScale] = useState("default");
    const [appLanguage, setAppLanguage] = useState("en");
    const [numberFormat, setNumberFormat] = useState("en");
    const [animatedBackground, setAnimatedBackground] = useState(true);
    const [autoUpdate, setAutoUpdate] = useState("notify");
    const [desktopNotifications, setDesktopNotifications] = useState(true);
    const [notificationBadges, setNotificationBadges] = useState(true);
    const [notificationSounds, setNotificationSounds] = useState(true);
    const [notifySystemUpdates, setNotifySystemUpdates] = useState(true);
    const [notifyConnectionAlerts, setNotifyConnectionAlerts] = useState(true);
    const [notifyTaskCompletion, setNotifyTaskCompletion] = useState(true);
    const [soundEffects, setSoundEffects] = useState(true);
    const [soundVolume, setSoundVolume] = useState(0.7);

    // Validation Functions
    const validateWorkingDir = (value) => {
        if (value.trim() === "") {
            showModal(t('common:validation.required', { field: 'Working Directory' }));
            setWorkingDir(generalSettings.workingdir);
            return false;
        }
        return true;
    };
    const validateDataDir = (value) => {
        if (value.trim() === "") {
            showModal(t('common:validation.required', { field: 'Data Directory' }));
            setDataDir(generalSettings.datadir);
            return false;
        }
        return true;
    };
    const validateDatabaseFileName = (value) => {
        if (value.trim() === "") {
            showModal(t('common:validation.required', { field: 'Database File Name' }));
            setDatabaseFileName(generalSettings.databasefilename);
            return false;
        }
        return true;
    };
    const validateAuthEndpoint = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if (urlRegex.test(value) === false) {
            showModal(t('common:validation.invalidUrl', { field: 'Auth Endpoint' }));
            setAuthEndpoint(generalSettings.authendpoint);
            return false;
        }
        return true;
    };
    const validateUserApiKey = (value) => {
        if (value.trim() === "") {
            showModal(t('common:validation.required', { field: 'User API Key' }));
            setUserApiKey(generalSettings.userapikey);
            return false;
        }
        return true;
    };
    const validatePort = (value) => {
        if (isNaN(value) || value < 1024 || value > 65535) {
            showModal(t('common:validation.portRange', { min: 1024, max: 65535 }));
            setPort(generalSettings.port);
            return false;
        }
        return true;
    };
    const validateWssPort = (value) => {
        if (isNaN(value) || value < 1 || value > 65535) {
            showModal(t('common:validation.portRange', { min: 1, max: 65535 }));
            setWssPort(generalSettings.wssport);
            return false;
        }
        return true;
    };
    const validateClientConnectionBuffer = (value) => {
        if (isNaN(value) || value <= 0) {
            showModal(t('common:validation.mustBePositive', { field: 'Client Connection Buffer' }));
            setClientConnectionBuffer(generalSettings.clientconnectionbuffer);
            return false;
        }
        return true;
    };

    const setInitialValues = () => {
        setWorkingDir(generalSettings.workingdir);
        setDataDir(generalSettings.datadir);
        setDatabaseFileName(generalSettings.databasefilename);
        setAuthEndpoint(generalSettings.authendpoint);
        setUserApiKey(generalSettings.userapikey);
        setUseHarmonyCloud(generalSettings.useharmonycloud)
        setConfirmEvents(generalSettings.confirmevents);
        setLogFile(generalSettings.logfile);
        setPort(generalSettings.port);
        setClientConnectionBuffer(generalSettings.clientconnectionbuffer);
        setSinglePort(generalSettings.singleport || false);
        setWssPort(generalSettings.wssport || 28443);
        // New fields
        setFontScale(generalSettings.fontscale || "default");
        setAppLanguage(generalSettings.applanguage || "en");
        setNumberFormat(generalSettings.numberformat || "en");
        setAnimatedBackground(generalSettings.animatedbackground !== false);
        setAutoUpdate(generalSettings.autoupdate || "notify");
        setDesktopNotifications(generalSettings.desktopnotifications !== false);
        setNotificationBadges(generalSettings.notificationbadges !== false);
        setNotificationSounds(generalSettings.notificationsounds !== false);
        setNotifySystemUpdates(generalSettings.notifysystemupdates !== false);
        setNotifyConnectionAlerts(generalSettings.notifyconnectionalerts !== false);
        setNotifyTaskCompletion(generalSettings.notifytaskcompletion !== false);
        setSoundEffects(generalSettings.soundeffects !== false);
        setSoundVolume(generalSettings.soundvolume ?? 0.7);
    };

    const saveSettingsWithBackup = () => {
        saveGeneralSettings(generalSettings, true);
    }
    const saveSettingsWithoutBackup = () => {
        saveGeneralSettings(generalSettings, false);
    }

    const updateSettingValues = () => {
        generalSettings.workingdir = workingDir;
        generalSettings.datadir = dataDir;
        generalSettings.databasefilename = databaseFileName;
        generalSettings.authendpoint = authEndpoint;
        generalSettings.userapikey = userApiKey;
        generalSettings.useharmonycloud = useHarmonyCloud;
        generalSettings.confirmevents = confirmEvents;
        generalSettings.logfile = logFile;
        generalSettings.port = port;
        generalSettings.clientconnectionbuffer = clientConnectionBuffer;
        generalSettings.singleport = singlePort;
        generalSettings.wssport = wssPort;
        generalSettings.currenttheme = currentTheme;
        // New fields
        generalSettings.fontscale = fontScale;
        generalSettings.applanguage = appLanguage;
        generalSettings.numberformat = numberFormat;
        generalSettings.animatedbackground = animatedBackground;
        generalSettings.autoupdate = autoUpdate;
        generalSettings.desktopnotifications = desktopNotifications;
        generalSettings.notificationbadges = notificationBadges;
        generalSettings.notificationsounds = notificationSounds;
        generalSettings.notifysystemupdates = notifySystemUpdates;
        generalSettings.notifyconnectionalerts = notifyConnectionAlerts;
        generalSettings.notifytaskcompletion = notifyTaskCompletion;
        generalSettings.soundeffects = soundEffects;
        generalSettings.soundvolume = soundVolume;
        // Configure Modal Dialog whether a backup should be made
        setConfirmModalYes(() => saveSettingsWithBackup);
        setConfirmModalNo(() => saveSettingsWithoutBackup);
        showConfirmModal("Saving will overwrite the existing config.json file. Do you want to backup the existing file?");
    };

    // Handle language change — switch i18n immediately
    const handleAppLanguageChange = (lang) => {
        setAppLanguage(lang);
        changeLanguage(lang);
    };

    // Export settings to JSON file
    const handleExportSettings = async () => {
        try {
            const config = await getConfig();
            const jsonStr = JSON.stringify(config, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'harmony-link-settings-backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showFeedback(t('common:notifications.exportSuccess'), 'success');
        } catch (err) {
            LogPrint('Export failed: ' + err.message);
            showFeedback(t('common:notifications.exportFailed', { message: err.message }), 'error');
        }
    };

    // Import settings from JSON file
    const handleImportClick = () => {
        importFileRef.current?.click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedConfig = JSON.parse(text);

            if (!importedConfig.general) {
                showFeedback(t('common:notifications.invalidSettingsFile'), 'error');
                return;
            }

            // Merge imported general settings on top of current ones to preserve any missing keys
            const mergedGeneral = {
                ...generalSettings,
                ...importedConfig.general,
            };

            setConfirmModalYes(() => async () => {
                await updateConfig({ ...importedConfig, general: mergedGeneral }, true);
                showFeedback(t('common:notifications.importSuccess'), 'success');
                // Refresh from server
                setTimeout(async () => {
                    try {
                        const fresh = await getConfig();
                        saveGeneralSettings(fresh.general, false);
                    } catch (err) {
                        LogPrint('Reload after import failed: ' + err.message);
                    }
                }, 500);
            });
            setConfirmModalNo(() => () => {});
            showConfirmModal("Importing will overwrite current settings. A backup of the current config will be created. Continue?");
        } catch (err) {
            LogPrint('Import failed: ' + err.message);
            showFeedback(t('common:notifications.importFailed', { message: err.message }), 'error');
        }

        e.target.value = '';
    };

    // Report a bug
    const handleReportBug = async () => {
        try {
            await openSystemUrl('https://project-harmony.youtrack.cloud/issues');
        } catch (err) {
            LogPrint('Failed to open bug tracker: ' + err.message);
            showFeedback(t('common:notifications.bugTrackerFailed'), 'error');
        }
    };

    // Split themes
    const officialThemes = useMemo(() => themes.filter(t => OFFICIAL_THEME_IDS.includes(t.id)), [themes]);
    const otherThemes = useMemo(() => themes.filter(t => !OFFICIAL_THEME_IDS.includes(t.id)), [themes]);

    useEffect(() => {
        LogDebug(JSON.stringify(generalSettings));
        setInitialValues();
        listThemes().then(setThemes).catch(err => {
            console.error("Failed to load themes:", err);
        });
    }, []);

    // Apply font scale to document
    useEffect(() => {
        const scaleMap = {
            compact: '0.85rem',
            default: '0.9rem',
            large: '1.0rem',
        };
        document.documentElement.style.fontSize = scaleMap[fontScale] || '0.9rem';
        localStorage.setItem('harmony-font-scale', fontScale);
    }, [fontScale]);

    // Apply font scale on initial mount from stored value
    useEffect(() => {
        const stored = localStorage.getItem('harmony-font-scale');
        if (stored && ['compact', 'default', 'large'].includes(stored)) {
            setFontScale(stored);
        } else if (generalSettings.fontscale) {
            setFontScale(generalSettings.fontscale);
        }
    }, []);

    // --- Helpers for t() keys using namespace ---
    const tgs = (key, opts) => t(`generalSettings:${key}`, opts);
    const tc = (key, opts) => t(`common:${key}`, opts);

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                        {colorFirstWord(tgs('header.title'))}
                    </h1>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">
                        {tgs('header.subtitle')}
                    </p>
                </div>
                <button
                    onClick={() => setShowDeviceManagementModal(true)}
                    className="btn-primary flex items-center gap-2 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {tgs('buttons.manageDevices')}
                </button>
            </div>

            {/* Feedback Toast */}
            {feedbackMessage && (
                <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                    feedbackType === 'success'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                    {feedbackType === 'success' ? (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                    {feedbackMessage}
                </div>
            )}

            <div className="flex-1 p-6 space-y-8 max-w-7xl">
                {/* Application & Cloud Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.appAndCloud')}</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        {/* Left Column: Input Fields */}
                        <div className="space-y-4">
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    {tgs('fields.workingDir.label')}
                                    <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.workingDir.tooltip')}
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="workingDir" className="input-field w-full"
                                        placeholder="Path to working directory" value={workingDir}
                                        onChange={(e) => setWorkingDir(e.target.value)}
                                        onBlur={(e) => validateWorkingDir(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    {tgs('fields.dataDir.label')}
                                    <SettingsTooltip tooltipIndex={101} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.dataDir.tooltip')}
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="dataDir" className="input-field w-full"
                                        placeholder="Path to data directory" value={dataDir}
                                        onChange={(e) => setDataDir(e.target.value)}
                                        onBlur={(e) => validateDataDir(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    {tgs('fields.databaseFile.label')}
                                    <SettingsTooltip tooltipIndex={102} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.databaseFile.tooltip')}
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="databaseFileName" className="input-field w-full"
                                        placeholder="e.g. data.sqlite" value={databaseFileName}
                                        onChange={(e) => setDatabaseFileName(e.target.value)}
                                        onBlur={(e) => validateDatabaseFileName(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    {tgs('fields.authEndpoint.label')}
                                    <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.authEndpoint.tooltip')}
                                        <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.authEndpoint.tooltipDisabled')}</span>
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="text" name="authEndpoint" className="input-field w-full transition-all duration-200"
                                        placeholder="Authentication endpoint URL" value={authEndpoint} disabled={!useHarmonyCloud}
                                        onChange={(e) => setAuthEndpoint(e.target.value)}
                                        onBlur={(e) => validateAuthEndpoint(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    {tgs('fields.userApiKey.label')}
                                    <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.userApiKey.tooltip')}
                                        <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.userApiKey.tooltipDisabled')}</span>
                                        <br />
                                        <span className="text-accent-primary font-bold mt-2 block">{tgs('fields.userApiKey.tooltipCaution')}</span>
                                        <span className="text-text-secondary italic text-[11px]">{tgs('fields.userApiKey.tooltipCautionText')}</span>
                                    </SettingsTooltip>
                                </label>
                                <div className="w-2/3 px-3">
                                    <input type="password" name="userApiKey" className="input-field w-full transition-all duration-200"
                                        placeholder="API Key" value={userApiKey} disabled={!useHarmonyCloud}
                                        onChange={(e) => setUserApiKey(e.target.value)}
                                        onBlur={(e) => validateUserApiKey(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Checkboxes */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="useHarmonyCloud"
                                    checked={useHarmonyCloud} onChange={(e) => setUseHarmonyCloud(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.useHarmonyCloud.label')}</span>
                                        <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tgs('fields.useHarmonyCloud.tooltip')}
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.useHarmonyCloud.tooltipRestart')}</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">{tgs('fields.useHarmonyCloud.description')}</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="confirmEvents"
                                    checked={confirmEvents} onChange={(e) => setConfirmEvents(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.confirmEvents.label')}</span>
                                        <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tgs('fields.confirmEvents.tooltip')}
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.confirmEvents.tooltipDebug')}</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">{tgs('fields.confirmEvents.description')}</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 px-3 cursor-pointer group">
                                <input type="checkbox" name="logFile"
                                    checked={logFile} onChange={(e) => setLogFile(e.target.checked)} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.logFile.label')}</span>
                                        <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tgs('fields.logFile.tooltip')}
                                            <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.logFile.tooltipRestart')}</span>
                                        </SettingsTooltip>
                                    </div>
                                    <span className="text-xs text-text-muted">{tgs('fields.logFile.description')}</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Network & Infrastructure Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.network')}</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.connectionPort.label')}
                                <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.connectionPort.tooltip')}
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="number" name="port" className="input-field w-full"
                                    placeholder="Enter port number" value={port}
                                    onChange={(e) => setPort(parseInt(e.target.value) || -1)}
                                    onBlur={(e) => validatePort(parseInt(e.target.value) || -1)} />
                            </div>
                        </div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.websocketBuffer.label')}
                                <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.websocketBuffer.tooltip')}
                                    <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.websocketBuffer.tooltipFix')}</span>
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="number" name="clientConnectionBuffer" className="input-field w-full"
                                    placeholder="Buffer size" value={clientConnectionBuffer}
                                    onChange={(e) => setClientConnectionBuffer(parseInt(e.target.value) || -1)}
                                    onBlur={(e) => validateClientConnectionBuffer(parseInt(e.target.value) || -1)} />
                            </div>
                        </div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.wssPort.label')}
                                <SettingsTooltip tooltipIndex={9} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.wssPort.tooltip')}
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <input type="number" name="wssPort" className="input-field w-full"
                                    placeholder="Enter WSS port number" value={wssPort}
                                    disabled={singlePort}
                                    onChange={(e) => setWssPort(parseInt(e.target.value) || -1)}
                                    onBlur={(e) => validateWssPort(parseInt(e.target.value) || -1)} />
                            </div>
                        </div>
                        <label className="flex items-center gap-3 px-3 cursor-pointer group">
                            <input type="checkbox" name="singlePort"
                                checked={singlePort} onChange={(e) => setSinglePort(e.target.checked)} />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.singlePort.label')}</span>
                                    <SettingsTooltip tooltipIndex={10} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                        {tgs('fields.singlePort.tooltip')}
                                        <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.singlePort.tooltipTunnel')}</span>
                                    </SettingsTooltip>
                                </div>
                                <span className="text-xs text-text-muted">{tgs('fields.singlePort.description')}</span>
                            </div>
                        </label>
                    </div>
                </section>

                {/* Theme Selector Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.appearance')}</span>
                    </h2>
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {tgs('themes.official')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {officialThemes.map((theme) => (
                                <div key={theme.id} onClick={() => switchTheme(theme.id)}
                                    className={`card p-3 min-h-[4.5rem] cursor-pointer transition-all duration-200 group relative ${currentTheme === theme.id
                                        ? 'border-accent-primary ring-1 ring-accent-primary bg-background-elevated shadow-lg shadow-accent-primary/10'
                                        : 'hover:border-white/10 hover:bg-background-hover'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0"
                                            style={{ background: theme.colors.background.base }}>
                                            <div className="w-full h-1/2 mt-auto" style={{ background: theme.colors.accent.primary }} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <h4 className={`font-bold text-sm truncate ${currentTheme === theme.id ? 'text-accent-primary' : 'text-text-primary group-hover:text-accent-primary transition-colors'}`}>
                                                {theme.name}
                                            </h4>
                                            <p className="text-[11px] font-medium text-text-muted truncate">{theme.description}</p>
                                        </div>
                                        {currentTheme === theme.id && (
                                            <div className="text-accent-primary flex-shrink-0">
                                                <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {otherThemes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                </svg>
                                {tgs('themes.more')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {otherThemes.map((theme) => (
                                    <div key={theme.id} onClick={() => switchTheme(theme.id)}
                                        className={`card p-3 min-h-[4.5rem] cursor-pointer transition-all duration-200 group relative ${currentTheme === theme.id
                                            ? 'border-accent-primary ring-1 ring-accent-primary bg-background-elevated shadow-lg shadow-accent-primary/10'
                                            : 'hover:border-white/10 hover:bg-background-hover'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0"
                                                style={{ background: theme.colors.background.base }}>
                                                <div className="w-full h-1/2 mt-auto" style={{ background: theme.colors.accent.primary }} />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <h4 className={`font-bold text-sm truncate ${currentTheme === theme.id ? 'text-accent-primary' : 'text-text-primary group-hover:text-accent-primary transition-colors'}`}>
                                                    {theme.name}
                                                </h4>
                                                <p className="text-[11px] font-medium text-text-muted truncate">{theme.description}</p>
                                            </div>
                                            {currentTheme === theme.id && (
                                                <div className="text-accent-primary flex-shrink-0">
                                                    <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* UI Personalization Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-175">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.uiPersonalization')}</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.fontScale.label')}
                                <SettingsTooltip tooltipIndex={20} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.fontScale.tooltip')}
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <select name="fontScale" className="input-field w-full" value={fontScale} onChange={(e) => setFontScale(e.target.value)}>
                                    {FONT_SCALE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.appLanguage.label')}
                                <SettingsTooltip tooltipIndex={21} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.appLanguage.tooltip')}
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <select name="appLanguage" className="input-field w-full" value={appLanguage} onChange={(e) => handleAppLanguageChange(e.target.value)}>
                                    {[{ value: 'en', labelKey: 'generalSettings:fields.appLanguage.options.en' }].map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.numberFormat.label')}
                                <SettingsTooltip tooltipIndex={22} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.numberFormat.tooltip')}
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <select name="numberFormat" className="input-field w-full" value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)}>
                                    {NUMBER_FORMAT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="card p-4 cursor-pointer group" onClick={() => setAnimatedBackground(!animatedBackground)}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input type="checkbox" checked={animatedBackground} onChange={(e) => { e.stopPropagation(); setAnimatedBackground(e.target.checked); }} className="mt-0.5" />
                            </div>
                            <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.animatedBackground.label')}</h3>
                            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{tgs('fields.animatedBackground.description')} <span className="opacity-60">{tgs('fields.animatedBackground.performance')}</span></p>
                        </div>
                    </div>
                </section>

                {/* Updates Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.updates')}</span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                {tgs('fields.autoUpdate.label')}
                                <SettingsTooltip tooltipIndex={24} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    {tgs('fields.autoUpdate.tooltip')}
                                    <br /><span className="opacity-70 mt-1 block italic font-normal text-[11px]">{tgs('fields.autoUpdate.tooltipNotify')}</span>
                                </SettingsTooltip>
                            </label>
                            <div className="w-2/3 px-3">
                                <select name="autoUpdate" className="input-field w-full" value={autoUpdate} onChange={(e) => setAutoUpdate(e.target.value)}>
                                    {AUTO_UPDATE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Notifications Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-225">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.notifications')}</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="card p-4 cursor-pointer group" onClick={() => setDesktopNotifications(!desktopNotifications)}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input type="checkbox" checked={desktopNotifications} onChange={(e) => { e.stopPropagation(); setDesktopNotifications(e.target.checked); }} className="mt-0.5" />
                            </div>
                            <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.desktopNotifications.label')}</h3>
                            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{tgs('fields.desktopNotifications.description')}</p>
                        </div>
                        <div className="card p-4 cursor-pointer group" onClick={() => setNotificationBadges(!notificationBadges)}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                                <input type="checkbox" checked={notificationBadges} onChange={(e) => { e.stopPropagation(); setNotificationBadges(e.target.checked); }} className="mt-0.5" />
                            </div>
                            <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.notificationBadges.label')}</h3>
                            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{tgs('fields.notificationBadges.description')}</p>
                        </div>
                        <div className="card p-4 cursor-pointer group" onClick={() => setNotificationSounds(!notificationSounds)}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                </div>
                                <input type="checkbox" checked={notificationSounds} onChange={(e) => { e.stopPropagation(); setNotificationSounds(e.target.checked); }} className="mt-0.5" />
                            </div>
                            <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.notificationSounds.label')}</h3>
                            <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{tgs('fields.notificationSounds.description')}</p>
                        </div>
                    </div>
                    <div className="card p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">{tgs('notify.about')}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { key: 'notifySystemUpdates', state: notifySystemUpdates, setter: setNotifySystemUpdates },
                                { key: 'notifyConnectionAlerts', state: notifyConnectionAlerts, setter: setNotifyConnectionAlerts },
                                { key: 'notifyTaskCompletion', state: notifyTaskCompletion, setter: setNotifyTaskCompletion },
                            ].map(({ key, state, setter }) => (
                                <div key={key} className="card p-4 cursor-pointer group" onClick={() => setter(!state)}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="w-9 h-9 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17v4h10v-4M7 17V7a4 4 0 018 0v4M5 17h14a2 2 0 002-2v-1a2 2 0 00-2-2H5a2 2 0 00-2 2v1a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <input type="checkbox" checked={state} onChange={(e) => { e.stopPropagation(); setter(e.target.checked); }} className="mt-0.5" />
                                    </div>
                                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs(`fields.${key}.label`)}</h3>
                                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{tgs(`fields.${key}.description`)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Sound & Audio Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-250">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.soundAudio')}</span>
                    </h2>
                    <div className="card p-4 cursor-pointer group mb-4" onClick={() => setSoundEffects(!soundEffects)}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{tgs('fields.soundEffects.label')}</h3>
                                    <p className="text-[11px] text-text-muted">{tgs('fields.soundEffects.description')}</p>
                                </div>
                            </div>
                            <input type="checkbox" checked={soundEffects} onChange={(e) => { e.stopPropagation(); setSoundEffects(e.target.checked); }} />
                        </div>
                    </div>
                    <div className="card p-5">
                        <div className="flex items-center gap-4 mb-3">
                            <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{tgs('fields.volume.label')}</span>
                            <span className="ml-auto text-sm font-bold text-accent-primary tabular-nums">{tgs('fields.volume.value', { value: Math.round(soundVolume * 100) })}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <svg className="w-3.5 h-3.5 text-text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5z" />
                            </svg>
                            <div className="relative flex-1 h-6 flex items-center group/slider">
                                <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 rounded-full bg-background-surface-translucent border border-border-glass" />
                                <div className="absolute inset-y-0 left-0 h-1.5 top-1/2 -translate-y-1/2 rounded-full bg-gradient-primary transition-all duration-150"
                                    style={{ width: `${soundVolume * 100}%` }} />
                                <input type="range" name="soundVolume" min="0" max="1" step="0.01" value={soundVolume}
                                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))} className="volume-slider" />
                            </div>
                            <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zm-2 2.27v13l-5-4H3V9h4l5-3.5z" />
                            </svg>
                        </div>
                    </div>
                </section>

                {/* Data & Support Section */}
                <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                    <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                        <span className="text-gradient-primary">{tgs('sections.dataSupport')}</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <button onClick={handleExportSettings} className="btn-secondary flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {tc('buttons.export')}
                        </button>
                        <button onClick={handleImportClick} className="btn-secondary flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {tc('buttons.import')}
                        </button>
                        <input ref={importFileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
                        <button onClick={handleReportBug} className="btn-secondary flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            {tc('buttons.reportBug')}
                        </button>
                    </div>
                </section>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6">
                    <button onClick={setInitialValues} className="btn-secondary">
                        {tc('buttons.resetChanges')}
                    </button>
                    <button onClick={updateSettingValues} className="btn-primary">
                        {tc('buttons.saveSettings')}
                    </button>
                </div>
            </div>

            <ErrorDialog isOpen={isModalVisible} title="Invalid Input" message={modalMessage} onClose={() => setIsModalVisible(false)} />
            <ConfirmDialog isOpen={confirmModalVisible} title="Confirmation Required" message={confirmModalMessage}
                onConfirm={() => { setConfirmModalVisible(false); confirmModalYes(); }}
                onCancel={() => { setConfirmModalVisible(false); confirmModalNo(); }} />
            <DeviceManagementModal show={showDeviceManagementModal} onClose={() => setShowDeviceManagementModal(false)} />
        </div>
    );
}

export default GeneralSettingsView;
