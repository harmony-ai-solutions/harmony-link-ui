import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useCategoryStore from '../../store/categoryStore.js';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { EditIcon, PlusIcon, TrashIcon } from '../../constants/icons.jsx';
import { toast } from '../../store/toastStore.js';
import { countCategoryMembers } from '../../utils/characterFilterUtils.js';

/**
 * "Manage categories" modal (plan 03-2 step 4).
 *
 * Add, rename, drag-reorder, and delete. The delete confirmation spells out the
 * one thing a user needs to know: **the characters are not deleted** — only the
 * grouping goes away.
 *
 * Reorder uses HTML5 drag-and-drop with a keyboard fallback (the up/down arrow
 * buttons on each row). Both call the same `reorderCategories(from, to)` store
 * action, so there is exactly one ordering rule to trust
 * ([`moveListItem`](../../utils/characterFilterUtils.js)).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object[]} props.profiles - visible profiles, for the member counts
 * @param {Object<string, Set<string>>} props.categoryIndex - membership index
 */
export default function ManageCategoriesModal({ isOpen, onClose, profiles, categoryIndex }) {
    const { t } = useTranslation('characters');
    const categories = useCategoryStore((state) => state.categories);
    const isLoading = useCategoryStore((state) => state.isLoading);
    const createCategory = useCategoryStore((state) => state.createCategory);
    const renameCategory = useCategoryStore((state) => state.renameCategory);
    const deleteCategory = useCategoryStore((state) => state.deleteCategory);
    const reorderCategories = useCategoryStore((state) => state.reorderCategories);

    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    /** Id of the row currently in inline-rename mode. */
    const [editingId, setEditingId] = useState(null);
    const [draftName, setDraftName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    /** Index being dragged (null when no drag is in flight). */
    const [dragIndex, setDragIndex] = useState(null);
    /** Index the pointer is currently over — drives the drop indicator. */
    const [overIndex, setOverIndex] = useState(null);

    // Reset transient UI state whenever the modal closes so a cancelled rename
    // never leaks into the next open.
    useEffect(() => {
        if (isOpen) return;
        setNewName('');
        setEditingId(null);
        setDraftName('');
        setDeleteTarget(null);
        setDragIndex(null);
        setOverIndex(null);
    }, [isOpen]);

    const counts = useMemo(() => {
        const map = {};
        (categories || []).forEach((category) => {
            map[category.id] = countCategoryMembers(profiles, category.id, categoryIndex);
        });
        return map;
    }, [categories, profiles, categoryIndex]);

    if (!isOpen) return null;

    const handleCreate = async (event) => {
        event.preventDefault();
        const name = newName.trim();
        if (!name || creating) return;
        setCreating(true);
        try {
            await createCategory(name);
            setNewName('');
            toast.success(t('category.toast.created', { name }));
        } catch (error) {
            // A 409 is a name clash the user can fix inline; anything else is
            // also shown next to the field rather than thrown at the console.
            toast.error(t('category.toast.createFailed', { message: error.message }));
        } finally {
            setCreating(false);
        }
    };

    const beginRename = (category) => {
        setEditingId(category.id);
        setDraftName(category.name);
    };

    const cancelRename = () => {
        setEditingId(null);
        setDraftName('');
    };

    const commitRename = async (category) => {
        const name = draftName.trim();
        if (!name) {
            cancelRename();
            return;
        }
        if (name === category.name) {
            cancelRename();
            return;
        }
        try {
            await renameCategory(category.id, name);
            cancelRename();
        } catch (error) {
            toast.error(t('category.toast.renameFailed', { message: error.message }));
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        setDeleteTarget(null);
        try {
            await deleteCategory(target.id);
            toast.success(t('category.toast.deleted', { name: target.name }));
        } catch (error) {
            toast.error(t('category.toast.deleteFailed', { message: error.message }));
        }
    };

    const moveBy = async (index, delta) => {
        const next = index + delta;
        if (next < 0 || next >= categories.length) return;
        try {
            await reorderCategories(index, next);
        } catch (error) {
            toast.error(t('category.toast.reorderFailed', { message: error.message }));
        }
    };

    const handleDrop = async () => {
        const from = dragIndex;
        const to = overIndex;
        setDragIndex(null);
        setOverIndex(null);
        if (from === null || to === null || from === to) return;
        try {
            await reorderCategories(from, to);
        } catch (error) {
            toast.error(t('category.toast.reorderFailed', { message: error.message }));
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className="modal-content w-full max-w-lg overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('category.manageTitle')}
                    data-tutorial-id="char-category-modal"
                >
                    <div className="px-6 py-4 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-accent-primary">{t('category.manageTitle')}</h2>
                            <p className="text-xs text-text-muted mt-1">{t('category.manageSubtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-text-muted hover:text-text-primary transition-colors"
                            aria-label={t('buttons.close')}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Add row */}
                    <form onSubmit={handleCreate} className="px-6 pb-4 flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={t('category.newPlaceholder')}
                            aria-label={t('category.newPlaceholder')}
                            maxLength={64}
                            className="search-bar-input flex-1"
                            data-tutorial-id="char-category-new"
                        />
                        <button
                            type="submit"
                            disabled={creating || newName.trim() === ''}
                            className="btn-primary px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-4 h-4" />
                            {t('category.add')}
                        </button>
                    </form>

                    <div className="px-6 pb-2">
                        {isLoading && categories.length === 0 ? (
                            <p className="text-sm text-text-muted py-6 text-center">{t('category.loading')}</p>
                        ) : categories.length === 0 ? (
                            <EmptyState
                                icon={PlusIcon}
                                size="compact"
                                title={t('category.empty.title')}
                                description={t('category.empty.description')}
                            />
                        ) : (
                            <ul className="char-category-manage-list" data-tutorial-id="char-category-list">
                                {categories.map((category, index) => {
                                    const isEditing = editingId === category.id;
                                    const isDragging = dragIndex === index;
                                    const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
                                    return (
                                        <li
                                            key={category.id}
                                            className={`char-category-manage-row${isDragging ? ' char-category-manage-row-dragging' : ''}${isOver ? ' char-category-manage-row-over' : ''}`}
                                            draggable={!isEditing}
                                            onDragStart={() => setDragIndex(index)}
                                            onDragOver={(e) => { e.preventDefault(); setOverIndex(index); }}
                                            onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
                                            onDrop={(e) => { e.preventDefault(); handleDrop(); }}
                                            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                                        >
                                            <span className="char-category-drag-handle" aria-hidden="true">
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <circle cx="9" cy="6" r="1.5" />
                                                    <circle cx="15" cy="6" r="1.5" />
                                                    <circle cx="9" cy="12" r="1.5" />
                                                    <circle cx="15" cy="12" r="1.5" />
                                                    <circle cx="9" cy="18" r="1.5" />
                                                    <circle cx="15" cy="18" r="1.5" />
                                                </svg>
                                            </span>

                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={draftName}
                                                    autoFocus
                                                    maxLength={64}
                                                    onChange={(e) => setDraftName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') { e.preventDefault(); commitRename(category); }
                                                        if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                                                    }}
                                                    onBlur={() => commitRename(category)}
                                                    className="char-category-rename-input"
                                                    aria-label={t('category.renameLabel', { name: category.name })}
                                                />
                                            ) : (
                                                <span className="char-category-manage-name" title={category.name}>
                                                    {category.name}
                                                </span>
                                            )}

                                            <span className="char-filter-count">{counts[category.id] || 0}</span>

                                            <span className="char-category-manage-actions">
                                                {/* Keyboard-accessible reorder — the drag handle alone
                                                    would make ordering impossible without a mouse. */}
                                                <button
                                                    type="button"
                                                    onClick={() => moveBy(index, -1)}
                                                    disabled={index === 0}
                                                    className="char-category-icon-btn"
                                                    aria-label={t('category.moveUp', { name: category.name })}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveBy(index, 1)}
                                                    disabled={index === categories.length - 1}
                                                    className="char-category-icon-btn"
                                                    aria-label={t('category.moveDown', { name: category.name })}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => beginRename(category)}
                                                    className="char-category-icon-btn"
                                                    aria-label={t('category.rename', { name: category.name })}
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(category)}
                                                    className="char-category-icon-btn char-category-icon-btn-danger"
                                                    aria-label={t('category.delete', { name: category.name })}
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <p className="char-category-manage-hint">{t('category.reorderHint')}</p>
                    </div>

                    <div className="px-6 py-4 flex justify-end">
                        <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 rounded-md text-sm font-medium">
                            {t('buttons.close')}
                        </button>
                    </div>
                </div>
            </div>

            {/* The delete warning is the plan's explicit requirement: a category
                delete must never read as a character delete. */}
            <ConfirmDialog
                isOpen={deleteTarget !== null}
                title={t('category.deleteDialog.title', { name: deleteTarget?.name || '' })}
                message={t('category.deleteDialog.message', { name: deleteTarget?.name || '', count: deleteTarget ? (counts[deleteTarget.id] || 0) : 0 })}
                confirmText={t('category.deleteDialog.confirm')}
                cancelText={t('category.deleteDialog.cancel')}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
}
