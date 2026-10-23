import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Day separator for the message timeline (Task 02-7 step 1).
 *
 * The DECISION of where a divider goes is not made here — it is made by the pure
 * `buildDayDividers` helper in `chatStoreUtils.js`, which the timeline calls once
 * per messages change. This component only renders one descriptor:
 *
 *   { kind: 'today',     date }  → "Today"
 *   { kind: 'yesterday', date }  → "Yesterday"
 *   { kind: 'date',      date }  → "12 September 2026"
 *
 * Today/yesterday come from i18n so every locale gets its own wording; an older
 * day is formatted with `Intl` in the ACTIVE LANGUAGE (from react-i18next, not
 * from `navigator`), so a user reading the UI in German does not get English
 * dates.
 *
 * `role="separator"` + `aria-label` makes the divider announce itself to a
 * screen reader as a boundary rather than as a message.
 *
 * @param {{ info: {kind: 'today'|'yesterday'|'date', date: Date} }} props
 */
const DayDivider = ({ info }) => {
    const { t, i18n } = useTranslation();

    const label = useMemo(() => {
        if (!info?.date) return '';
        if (info.kind === 'today') return t('chat:conversation.day.today');
        if (info.kind === 'yesterday') return t('chat:conversation.day.yesterday');
        try {
            return new Intl.DateTimeFormat(i18n?.language || undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }).format(info.date);
        } catch {
            // A locale the runtime does not know must not blank the divider.
            return info.date.toLocaleDateString();
        }
    }, [info, t, i18n?.language]);

    if (!label) return null;

    return (
        <div className="chat-day-divider" role="separator" aria-label={label}>
            <span className="chat-day-divider-line" />
            <span className="chat-day-divider-label">{label}</span>
            <span className="chat-day-divider-line" />
        </div>
    );
};

export default DayDivider;
