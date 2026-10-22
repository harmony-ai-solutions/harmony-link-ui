import React from 'react';

/**
 * Shared empty state for every list/grid/timeline in the app.
 *
 * Before this component each view invented its own: a bare sentence in the
 * Entity list, a dashed card with two buttons in AI Characters, a centred
 * column with a gradient block in Chat, three different variants inside the
 * Dev Inspector — and several of them were dead ends with no way forward.
 * One component now owns the shape so an empty view always answers "what do I
 * do next?".
 *
 * Design contract:
 * - `title` is the one-line statement of *what* is missing.
 * - `description` explains the next step (muted, wrapped, centred).
 * - `actionLabel` + `onAction` is the primary next action (gradient button).
 * - `secondaryLabel` + `onSecondary` is the alternative (quiet button).
 * - `size="compact"` is the inline variant for panels (module config lists,
 *   the dev inspector sections, the chat picker) where the full 4rem-padded
 *   block would waste space.
 * - `icon` accepts either a ready element or a component type, matching
 *   [`PageHeader`](./PageHeader.jsx) so callers do not have to remember which
 *   icon set returns what.
 * - Styling lives in `.ui-empty*` in
 *   [`styles/components.css`](../../styles/components.css) and is token-driven,
 *   so every theme (including the light variants) inherits it.
 *
 * @param {React.ReactNode} title            One-line statement of what is missing.
 * @param {React.ReactNode} [description]    How to proceed.
 * @param {React.ReactNode|React.ComponentType} [icon] Leading glyph.
 * @param {string} [actionLabel]             Primary button label.
 * @param {Function} [onAction]              Primary button handler.
 * @param {string} [secondaryLabel]          Secondary button label.
 * @param {Function} [onSecondary]           Secondary button handler.
 * @param {'default'|'compact'} [size='default']
 * @param {string} [className]               Extra classes for the wrapper.
 */
export default function EmptyState({
    title,
    description,
    icon,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
    size = 'default',
    className = '',
    ...rest
}) {
    // Accept a component type or a ready element, like PageHeader does.
    const iconNode = typeof icon === 'function'
        ? React.createElement(icon, { className: 'ui-empty-icon-svg' })
        : icon;

    const hasActions = Boolean(actionLabel || secondaryLabel);

    return (
        <div
            className={`ui-empty ui-empty-${size}${className ? ` ${className}` : ''}`}
            {...rest}
        >
            {iconNode ? (
                <span className="ui-empty-icon" aria-hidden="true">{iconNode}</span>
            ) : null}

            {title ? <p className="ui-empty-title">{title}</p> : null}
            {description ? <p className="ui-empty-description">{description}</p> : null}

            {hasActions ? (
                <div className="ui-empty-actions">
                    {actionLabel ? (
                        <button type="button" className="btn-primary ui-empty-action" onClick={onAction}>
                            {actionLabel}
                        </button>
                    ) : null}
                    {secondaryLabel ? (
                        <button type="button" className="btn-secondary ui-empty-action" onClick={onSecondary}>
                            {secondaryLabel}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
