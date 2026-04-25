/**
 * Level toggle buttons — clicking a level sets it as the minimum visible level.
 */
function LevelToggles({ minLevel, onChange }) {
    const levels = [
        { key: 'debug',  label: 'DEBUG', activeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        { key: 'info',   label: 'INFO',  activeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
        { key: 'warn',   label: 'WARN',  activeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
        { key: 'error',  label: 'ERROR', activeClass: 'bg-red-500/20 text-red-400 border-red-500/30' },
    ];

    const levelOrder = ['debug', 'info', 'warn', 'error'];
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
                    ⚙
                </button>
                <button className="module-action-btn text-sm" onClick={onRefresh} title="Refresh">
                    ⟳
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
