import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * CompactSelect — a small pill button that opens a dropdown menu.
 * Replaces ThemedSelect in the toolbar so every control is a tiny
 * button that fits on a single non-scrolling line.
 */
function CompactSelect({ value, options, onChange, placeholder, title }) {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 150 });
    const btnRef = useRef(null);

    const selected = options.find(o => String(o.value) === String(value));

    const measure = useCallback(() => {
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 150) });
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        return () => {
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [isOpen, measure]);

    // Position is measured synchronously before opening so the dropdown
    // renders at the correct spot on its very first frame — no flash from
    // the top-left corner of the screen.
    const handleOpen = () => {
        if (isOpen) return;
        measure();
        setIsOpen(true);
    };

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                className="log-toolbar-btn shrink-0"
                onClick={handleOpen}
                title={title || (selected ? selected.label : placeholder)}
            >
                <span className="truncate max-w-[96px]">
                    {selected ? selected.label : placeholder}
                </span>
                <svg className="w-3 h-3 ml-0.5 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    <div
                        className="fixed z-[70] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top"
                        style={{
                            backgroundColor: 'var(--color-background-surface)',
                            border: '1px solid var(--color-border-default)',
                            top: `${pos.top}px`,
                            left: `${pos.left}px`,
                            width: `${pos.width}px`,
                        }}
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-0.5">
                            {options.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all duration-150 mb-0.5 last:mb-0 ${
                                        String(opt.value) === String(value)
                                            ? 'bg-accent-primary/25 text-accent-primary font-bold'
                                            : 'text-text-primary hover:bg-white/5 hover:text-accent-primary'
                                    }`}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

/**
 * Filter toolbar for the log viewer.
 * Every control is a small pill button on one non-scrollable line.
 */
export default function FilterToolbar({
    filters,
    onFilterChange,
    components,
    entities,
    promptTypes,
    sortOrder,
    onSortOrderChange,
    pageSize,
    onPageSizeChange,
    pageSizeOptions,
    onRefresh,
    onOpenSettings,
}) {
    return (
        <div className="log-filter-toolbar">
            <div className="flex items-center gap-1.5 flex-nowrap">
                {/* Component Dropdown */}
                <CompactSelect
                    value={filters.component}
                    onChange={(val) => onFilterChange({ ...filters, component: val })}
                    options={[
                        { value: '', label: 'All Components' },
                        ...(components || []).map(c => ({ value: c, label: c }))
                    ]}
                    placeholder="Components"
                    title="Filter by component"
                />

                {/* Entity Dropdown */}
                <CompactSelect
                    value={filters.entityId}
                    onChange={(val) => onFilterChange({ ...filters, entityId: val })}
                    options={[
                        { value: '', label: 'All Entities' },
                        ...(entities || []).map(e => ({ value: e, label: e }))
                    ]}
                    placeholder="Entities"
                    title="Filter by entity"
                />

                {/* Divider */}
                <div className="w-px h-4 bg-white/10 shrink-0" />

                {/* Minimum Level Dropdown */}
                <CompactSelect
                    value={filters.minLevel}
                    onChange={(level) => onFilterChange({ ...filters, minLevel: level })}
                    options={[
                        { value: 'trace', label: 'Level: TRACE' },
                        { value: 'debug', label: 'Level: DEBUG' },
                        { value: 'info', label: 'Level: INFO' },
                        { value: 'warn', label: 'Level: WARN' },
                        { value: 'error', label: 'Level: ERROR' },
                    ]}
                    placeholder="Level"
                    title="Minimum log level"
                />

                {/* Prompt Toggle — binary: null (all) ↔ true (prompts only) */}
                <button
                    className={`log-toolbar-btn text-[9px] font-bold shrink-0 ${
                        filters.isPrompt === true
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-background-surface text-text-muted border-white/10'
                    }`}
                    onClick={() => {
                        const next = filters.isPrompt === true ? null : true;
                        onFilterChange({ ...filters, isPrompt: next, promptType: next !== true ? '' : filters.promptType });
                    }}
                    title={filters.isPrompt === true ? 'Showing prompts only — click to show all' : 'Showing all entries — click to show prompts only'}
                >
                    PROMPT
                </button>

                {/* Prompt Type Dropdown — only visible when isPrompt is toggled active (true) */}
                {filters.isPrompt === true && (
                    <CompactSelect
                        value={filters.promptType}
                        onChange={(val) => onFilterChange({ ...filters, promptType: val })}
                        options={[
                            { value: '', label: 'All Types' },
                            ...(promptTypes || []).map(t => ({ value: t, label: t }))
                        ]}
                        placeholder="Type"
                        title="Prompt type"
                    />
                )}

                {/* Divider */}
                <div className="w-px h-4 bg-white/10 shrink-0" />

                {/* Sort Order Toggle */}
                <button
                    className="log-toolbar-btn text-[9px] shrink-0"
                    onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                    title={sortOrder === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
                >
                    {sortOrder === 'desc' ? '▼ New' : '▲ Old'}
                </button>

                {/* Page Size Dropdown */}
                <CompactSelect
                    value={pageSize}
                    onChange={(val) => onPageSizeChange(Number(val))}
                    options={pageSizeOptions.map(n => ({ value: n, label: String(n) }))}
                    placeholder="Page"
                    title="Entries per page"
                />

                {/* Search Bar — reuses the app's standard glassmorphism search design */}
                <div className="search-bar-wrapper shrink-0" style={{ maxWidth: '18rem' }}>
                    <svg className="search-bar-icon w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        className="search-bar-input"
                        placeholder="Search logs..."
                        value={filters.search}
                        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                        aria-label="Search logs"
                    />
                    {filters.search && (
                        <button
                            className="search-bar-clear"
                            onClick={() => onFilterChange({ ...filters, search: '' })}
                            title="Clear search"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Spacer */}
                <div className="flex-1 shrink-0" />

                {/* Settings & Refresh */}
                <button className="log-toolbar-btn shrink-0" onClick={onOpenSettings} title="Log Level Settings">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                <button className="log-toolbar-btn shrink-0" onClick={onRefresh} title="Refresh">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
