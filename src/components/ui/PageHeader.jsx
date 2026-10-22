import React from 'react';

/**
 * Shared page header for every top-level view.
 *
 * Before this component every view invented its own heading row: some carried a
 * subtitle, some did not; some right-aligned an action cluster, some left the
 * buttons inside the scrolling body; and each one re-declared the solid
 * `bg-background-surface` surface that replaced the old frosted heading (the
 * blurred version caused scroll jank inside `.app-main` — see the scroll-shake
 * note in [`styles/components.css`](../../styles/components.css)). One component
 * now owns that markup so the nine views cannot drift apart again.
 *
 * Design contract:
 * - title is 2xl / extrabold with the theme's primary gradient.
 * - subtitle is a single muted line, truncated rather than wrapped.
 * - actions are right-aligned and never shrink.
 * - the surface is **solid** (`--color-background-surface`) with no
 *   `backdrop-filter`. `.app-main *` already forces blur off inside the scroll
 *   column, so a blur here would be dead CSS on the scrolling views and would
 *   actively reintroduce jank anywhere the header is painted above it.
 * - `sticky` pins the header to the top of the scrolling column. It is
 *   implemented with `position: sticky` **only** — no `transform`, `filter`,
 *   `backdrop-filter`, `perspective`, `contain` or `will-change`, because each
 *   of those turns the header into a containing block for `position: fixed`
 *   descendants. The chat lightbox (`.chat-lightbox`) and the chat pickers
 *   (`.chat-picker-backdrop`) are `position: fixed` and render inside the
 *   scroll column, so any of those properties would re-anchor them to the
 *   header instead of the viewport. `.app-main` deliberately uses
 *   `isolation: isolate` (a stacking context but *not* a containing block) for
 *   the same reason.
 *
 * @param {React.ReactNode} title     Page title. A string is rendered with the
 *                                    gradient treatment; a node is rendered
 *                                    verbatim (caller owns its styling).
 * @param {React.ReactNode} [subtitle] One-line muted description.
 * @param {React.ReactNode|React.ComponentType} [icon] Leading glyph, either an
 *                                    element or a component type.
 * @param {React.ReactNode} [actions] Right-aligned controls (buttons, badges).
 * @param {boolean} [sticky=false]     Pin the header while the view scrolls.
 * @param {string} [className]         Extra classes for the header element.
 */
export default function PageHeader({
    title,
    subtitle,
    icon,
    actions,
    sticky = false,
    className = '',
    ...rest
}) {
    // `icon` accepts either a ready element or a component type, so callers do
    // not have to remember which icon set returns what.
    const iconNode = typeof icon === 'function'
        ? React.createElement(icon, { className: 'ui-page-header-icon-svg' })
        : icon;

    const titleNode = typeof title === 'string'
        ? <span className="text-gradient-primary">{title}</span>
        : title;

    return (
        <header
            className={`ui-page-header${sticky ? ' ui-page-header-sticky' : ''}${className ? ` ${className}` : ''}`}
            {...rest}
        >
            <div className="ui-page-header-main">
                {iconNode && (
                    <span className="ui-page-header-icon" aria-hidden="true">{iconNode}</span>
                )}
                <div className="ui-page-header-text">
                    <h1 className="ui-page-header-title">{titleNode}</h1>
                    {subtitle ? (
                        <p className="ui-page-header-subtitle">{subtitle}</p>
                    ) : null}
                </div>
            </div>

            {actions ? (
                <div className="ui-page-header-actions">{actions}</div>
            ) : null}
        </header>
    );
}
