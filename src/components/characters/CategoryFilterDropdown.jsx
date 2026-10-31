import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeartIcon } from '../../constants/icons.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import {
    FILTER_ALL,
    FILTER_FAVORITES,
    categoryFilterId,
    countCategoryMembers,
    shouldShowCategoryChip,
} from '../../utils/characterFilterUtils.js';

/**
 * The Characters toolbar's filter chips (plan 03-1 favourites + 03-2 categories):
 *
 *   All · Favorites (n) · <category> (n) … · Manage
 *
 * Design rules that matter:
 *
 *  - The row is NEVER hidden by the favourites rule any more. Once categories
 *    exist there is always something useful to show, and "Manage" must be
 *    reachable before the first category is created — otherwise the feature has
 *    no entry point. "All" is therefore also always present.
 *  - "Favorites" still hides itself when nothing is favourited (a chip that can
 *    only produce an empty grid is noise — the 03-1 rule).
 *  - A category chip hides itself when it has ZERO visible members, UNLESS it is
 *    the active chip: yanking the active chip away mid-interaction is worse than
 *    an empty grid with a clear message (see `shouldShowCategoryChip`).
 *  - Counts come from the VISIBLE profile list, not the engine's `member_count`:
 *    the grid excludes persona-owned profiles, so the engine count would
 *    overstate what the chip can actually show.
 *
 * @param {Object} props
 * @param {Object[]} props.categories - engine categories (id, name, profile_ids)
 * @param {Object<string, Set<string>>} props.categoryIndex - buildCategoryMemberIndex output
 * @param {Object[]} props.profiles - the VISIBLE profiles (persona-owned excluded)
 * @param {string} props.activeFilter - current filter id
 * @param {number} props.favoriteCount - how many visible profiles are favourited
 * @param {Function} props.onSelect - (filterId) => void
 * @param {Function} props.onManage - opens the Manage categories modal
 */
export default function CategoryFilterDropdown({
    categories,
    categoryIndex,
    profiles,
    activeFilter,
    favoriteCount,
    onSelect,
    onManage,
}) {
    const { t } = useTranslation('characters');

    const visibleCategories = (Array.isArray(categories) ? categories : [])
        .map((category) => ({
            id: category.id,
            name: category.name,
            count: countCategoryMembers(profiles, category.id, categoryIndex),
        }))
        .filter((chip) => shouldShowCategoryChip(chip, activeFilter));

    const chipClass = (isActive) => `chat-inbox-chip${isActive ? ' chat-inbox-chip-active' : ''}`;

    return (
        <div
            className="char-category-chips"
            role="group"
            aria-label={t('category.chipGroupLabel')}
            data-tutorial-id="char-category-chips"
        >
            {/* All — always present. It is also the fallback a stale filter
                resolves to, so it must never be the chip that vanished. */}
            <button
                type="button"
                onClick={() => onSelect(FILTER_ALL)}
                className={chipClass(activeFilter === FILTER_ALL)}
                aria-pressed={activeFilter === FILTER_ALL}
            >
                {t('filter.all')}
            </button>

            {/* Favorites — hidden while nothing is favourited (03-1 rule). */}
            {favoriteCount > 0 && (
                <button
                    type="button"
                    data-tutorial-id="char-filter-favorites"
                    onClick={() => onSelect(FILTER_FAVORITES)}
                    className={`${chipClass(activeFilter === FILTER_FAVORITES)} char-filter-favorites`}
                    aria-pressed={activeFilter === FILTER_FAVORITES}
                >
                    <HeartIcon className="w-3.5 h-3.5" filled={activeFilter === FILTER_FAVORITES} />
                    {t('filter.favorites')}
                    <span className="char-filter-count">{favoriteCount}</span>
                </button>
            )}

            {visibleCategories.map((chip) => {
                const filterId = categoryFilterId(chip.id);
                const isActive = activeFilter === filterId;
                return (
                    <Tooltip key={chip.id} content={t('category.filterHint', { name: chip.name, count: chip.count })}>
                        <button
                            type="button"
                            data-tutorial-id={`char-filter-category-${chip.id}`}
                            onClick={() => onSelect(filterId)}
                            className={`${chipClass(isActive)} char-filter-category`}
                            aria-pressed={isActive}
                        >
                            <span className="char-filter-category-name">{chip.name}</span>
                            <span className="char-filter-count">{chip.count}</span>
                        </button>
                    </Tooltip>
                );
            })}

            {/* Manage — the feature's only entry point, so it is always here. */}
            <Tooltip content={t('category.manageHint')}>
                <button
                    type="button"
                    data-tutorial-id="char-category-manage"
                    onClick={onManage}
                    className="chat-inbox-chip char-category-manage"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('category.manage')}
                </button>
            </Tooltip>
        </div>
    );
}
