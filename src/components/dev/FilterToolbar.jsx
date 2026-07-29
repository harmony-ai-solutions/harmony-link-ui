/**
 * Level toggle buttons — clicking a level sets it as the minimum visible level.
 */
function LevelToggles({ minLevel, onChange }) {
    const levels = [
        { key: 'trace',  label: 'TRACE', activeClass: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
        { key: 'debug',  label: 'DEBUG', activeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        { key: 'info',   label: 'INFO',  activeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
        { key: 'warn',   label: 'WARN',  activeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
        { key: 'error',  label: 'ERROR', activeClass: 'bg-red-500/20 text-red-400 border-red-500/30' },
    ];

    const levelOrder = ['trace', 'debug', 'info', 'warn', 'error'];
    const minIndex = levelOrder.indexOf(minLevel);

    return (
        <div className="flex gap-1">
            {levels.map(level => {
                const isActive = levelOrder.indexOf(level.key) >= minIndex;
                return (
                    <button
                        key={level.key}
                        onClick={() => onChange(level.key)}
                        className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${
                            isActive
                                ? level.activeClass
                                : 'bg-background-surface text-text-muted border-white/10 opacity-40'
                        }`}
                    >
                        {level.label}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Filter toolbar for the log viewer.
 * Provides component, entity, level, search, sort order, and page size controls.
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
        <div className="log-filter-toolbar space-y-3">
            {/* Row 1: Dropdowns + Level Toggles + Sort + Page Size */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Component Dropdown */}
                <select
                    value={filters.component}
                    onChange={(e) => onFilterChange({ ...filters, component: e.target.value })}
                    className="input-field text-sm py-1.5 w-36"
                >
                    <option value="">All Components</option>
                    {components && components.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                {/* Entity Dropdown */}
                <select
                    value={filters.entityId}
                    onChange={(e) => onFilterChange({ ...filters, entityId: e.target.value })}
                    className="input-field text-sm py-1.5 w-36"
                >
                    <option value="">All Entities</option>
                    {entities && entities.map(e => (
                        <option key={e} value={e}>{e}</option>
                    ))}
                </select>

                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />

                {/* Prompt Toggle — binary: null (all) ↔ true (prompts only) */}
                <button
                    className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${
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
                    PROMPT{filters.isPrompt === true ? ' (active)' : ''}
                </button>

                {/* Prompt Type Dropdown — only visible when isPrompt is toggled active (true) */}
                {filters.isPrompt === true && (
                    <select
                        value={filters.promptType}
                        onChange={(e) => onFilterChange({ ...filters, promptType: e.target.value })}
                        className="input-field text-sm py-1.5 w-28"
                    >
                        <option value="">All Types</option>
                        {promptTypes && promptTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                )}

                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />

                {/* Level Toggle Buttons */}
                <LevelToggles
                    minLevel={filters.minLevel}
                    onChange={(level) => onFilterChange({ ...filters, minLevel: level })}
                />

                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />

                {/* Sort Order Toggle */}
                <button
                    className="module-action-btn text-xs flex items-center gap-1"
                    onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                    title={sortOrder === 'desc' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
                >
                    {sortOrder === 'desc' ? '▼ Newest' : '▲ Oldest'}
                </button>

                {/* Page Size Dropdown */}
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="input-field text-sm py-1.5 w-20"
                    title="Logs per page"
                >
                    {pageSizeOptions.map(n => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Settings & Refresh */}
                <button className="module-action-btn text-sm" onClick={onOpenSettings} title="Log Level Settings">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                <button className="module-action-btn text-sm" onClick={onRefresh} title="Refresh">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Row 2: Search */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                    placeholder="Search logs..."
                    className="input-field text-sm py-1.5 flex-1"
                />
                {filters.search && (
                    <button 
                        className="module-action-btn text-xs" 
                        onClick={() => onFilterChange({ ...filters, search: '' })}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
