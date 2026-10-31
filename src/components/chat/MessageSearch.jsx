import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon, XIcon } from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import {
    createDebouncer,
    isSearchable,
    normalizeSearchTerm,
    searchQueryState,
    SEARCH_DEBOUNCE_MS,
    SEARCH_RESULT_LIMIT,
    jumpTargetFromHit,
} from '../../store/searchUtils.js';
import SearchResults from './SearchResults.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * Message search (Task 02-9) — ONE implementation, two placements.
 *
 *  - `variant="global"` renders a **search icon** for the chat-list header that
 *    opens a panel over the inbox. It searches every partner.
 *  - `variant="inline"` renders a **field** inside the conversation header. It
 *    narrows to the open thread.
 *
 * Two variants rather than two components because the acceptance rule is "a
 * word finds messages across partners and jumps to the right place" — the
 * debounce floor, the 2-character minimum, the cap and the jump must behave
 * identically in both, and a second implementation would drift the moment one of
 * them is touched.
 *
 * ── Where each concern lives ─────────────────────────────────────────────
 *
 *  - **Debounce (250 ms): here.** The input owns the timing, so typing stays
 *    instant and the request count stays one per pause. `createDebouncer` is
 *    pure and unit-tested with an injectable clock.
 *  - **Minimum length / cap / snippet geometry:** the pure helpers.
 *  - **Request + results + jump request:** `chatStore.searchMessages` and
 *    `chatStore.jumpToSearchHit`.
 *
 * The field keeps its OWN local text. The store's `searchTerm` is the term the
 * results belong to, so a result list can never claim to match a half-typed
 * word — the two diverge for exactly the debounce window.
 *
 * @param {{
 *   variant?: 'global'|'inline',
 *   scope?: {participantKey: string}|null,
 *   entityById?: Record<string, object>,
 *   ownEntityId?: string,
 *   onJump?: (hit: object) => void,
 *   autoFocus?: boolean,
 * }} props
 */
const MessageSearch = ({
    variant = 'global',
    scope = null,
    entityById,
    ownEntityId,
    onJump,
    autoFocus = false,
}) => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [open, setOpen] = useState(variant === 'inline');
    const inputRef = useRef(null);

    const searchMessages = useChatStore((s) => s.searchMessages);
    const clearSearch = useChatStore((s) => s.clearSearch);
    const jumpToSearchHit = useChatStore((s) => s.jumpToSearchHit);
    const searchResults = useChatStore((s) => s.searchResults);
    const searchTerm = useChatStore((s) => s.searchTerm);
    const searching = useChatStore((s) => s.searching);
    const searchError = useChatStore((s) => s.searchError);

    const queryState = useMemo(() => searchQueryState(text), [text]);
    const scopeKey = scope?.participantKey || '';

    /**
     * The debounced commit. Rebuilt when the SCOPE changes (not on every
     * keystroke): the scope is a plain string, so this is stable.
     */
    const runSearch = useMemo(
        () => createDebouncer(
            (term) => searchMessages(term, { scope: scopeKey ? { participantKey: scopeKey } : null }),
            SEARCH_DEBOUNCE_MS
        ),
        [searchMessages, scopeKey]
    );

    // Cancel a pending request on unmount / scope change, so a debounced call
    // cannot land against a thread the user has already left.
    useEffect(() => () => runSearch.cancel(), [runSearch]);

    /**
     * Close everything and drop the results. Called by Escape, the clear button,
     * and after a jump — a result list that survives the thread it jumped into
     * would reappear over an unrelated conversation.
     */
    const reset = useCallback(() => {
        runSearch.cancel();
        setText('');
        clearSearch();
    }, [runSearch, clearSearch]);

    const handleChange = (event) => {
        const value = event.target.value;
        setText(value);
        if (!isSearchable(value)) {
            // Below the floor: cancel any pending request AND clear the published
            // results, so the panel shows the "type more" hint rather than hits
            // for the previous query.
            runSearch.cancel();
            clearSearch();
            return;
        }
        runSearch(normalizeSearchTerm(value));
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            reset();
            if (variant === 'global') setOpen(false);
            return;
        }
        // Enter commits immediately instead of waiting out the debounce. It does
        // NOT jump: with several hits there is no single obvious target.
        if (event.key === 'Enter' && queryState.canSearch) {
            event.preventDefault();
            runSearch.cancel();
            searchMessages(text, { scope: scopeKey ? { participantKey: scopeKey } : null });
        }
    };

    /**
     * Choose a hit.
     *
     * The term is captured BEFORE the panel tears itself down: `reset()` clears
     * the store's `searchTerm`, and the jump request records the query so the
     * destination can explain what it was searching for. Reading it afterwards
     * would always be `''`.
     */
    const handleJump = (hit) => {
        const term = searchTerm;
        if (variant === 'global') setOpen(false);
        reset();
        if (onJump) {
            onJump(hit, { query: term });
            return;
        }
        // No host-provided handler: the store's jump request is what ChatView
        // watches, so the global panel works without extra wiring.
        jumpToSearchHit(hit, { query: term });
    };

    // Focus the field when a global panel opens; the inline field is always live.
    useEffect(() => {
        if (!open) return;
        const node = inputRef.current;
        if (!node) return;
        node.focus();
    }, [open]);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    /**
     * Dismiss the GLOBAL overlay from anywhere.
     *
     * The field's own `onKeyDown` covers Escape while the caret is inside it, but
     * the sheet covers the whole window: Escape after clicking a result, or after
     * the field loses focus, must close it too. The inline panel is excluded — it
     * is not modal, and swallowing Escape there would break the thread's own
     * handlers (the composer's reply cancel, for one).
     */
    useEffect(() => {
        if (variant !== 'global' || !open) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            reset();
            setOpen(false);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [variant, open, reset]);

    const showPanel = variant === 'global' ? open : true;

    const field = (
        <div className={`chat-search-field ${variant === 'global' ? 'chat-search-field-panel' : ''}`}>
            <SearchIcon className="w-4 h-4 text-text-muted" />
            <input
                ref={inputRef}
                type="text"
                value={text}
                className="chat-search-input"
                placeholder={variant === 'inline'
                    ? t('chat:search.placeholderInThread')
                    : t('chat:search.placeholderGlobal')}
                aria-label={variant === 'inline'
                    ? t('chat:search.placeholderInThread')
                    : t('chat:search.placeholderGlobal')}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
            {text && (
                <button
                    type="button"
                    className="chat-search-clear"
                    aria-label={t('chat:search.clear')}
                    onClick={reset}
                >
                    <XIcon className="w-4 h-4" />
                </button>
            )}
        </div>
    );

    /** The hint shown under the field while the query is too short. */
    const hint = queryState.tooShort ? (
        <div className="chat-search-hint">{t('chat:search.minLength', { count: 2 })}</div>
    ) : null;

    if (variant === 'inline') {
        return (
            <div className="chat-search chat-search-inline">
                {field}
                {showPanel && (queryState.canSearch || searching || searchResults.length > 0) && (
                    <div className="chat-search-panel chat-search-panel-inline" role="region" aria-live="polite">
                        <SearchResults
                            results={searchResults}
                            term={searchTerm}
                            entityById={entityById}
                            ownEntityId={ownEntityId}
                            onJump={handleJump}
                            searching={searching}
                            error={searchError}
                            limit={SEARCH_RESULT_LIMIT}
                        />
                    </div>
                )}
                {hint}
            </div>
        );
    }

    return (
        <div className="chat-search chat-search-global">
            <Tooltip content={t('chat:search.open')}>
                <button
                    type="button"
                    className={`chat-detail-icon-btn chat-list-search-toggle ${open ? 'text-accent-primary' : ''}`}
                    aria-label={t('chat:search.open')}
                    aria-expanded={open}
                    onClick={() => {
                        setOpen((isOpen) => {
                            // Closing drops the query and the hits: leaving them
                            // would make the next open look pre-populated.
                            if (isOpen) reset();
                            return !isOpen;
                        });
                    }}
                >
                    <SearchIcon className="w-5 h-5" />
                </button>
            </Tooltip>

            {open && (
                <div
                    className="chat-search-overlay"
                    role="dialog"
                    aria-label={t('chat:search.title')}
                    onMouseDown={(event) => {
                        // Backdrop only: the sheet itself stops the event so a
                        // click on a result (or the scrollbar) does not close it.
                        if (event.target === event.currentTarget) {
                            reset();
                            setOpen(false);
                        }
                    }}
                >
                    <div
                        className="chat-search-overlay-inner"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="chat-search-overlay-head">
                            <span className="chat-search-overlay-title">{t('chat:search.title')}</span>
                            <Tooltip content={t('chat:search.close')}>
                                <button
                                    type="button"
                                    className="chat-detail-icon-btn"
                                    aria-label={t('chat:search.close')}
                                    onClick={() => { reset(); setOpen(false); }}
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </Tooltip>
                        </div>
                        {field}
                        {hint}
                        <div className="chat-search-overlay-body">
                            {queryState.canSearch || searching || searchResults.length > 0 ? (
                                <SearchResults
                                    results={searchResults}
                                    term={searchTerm}
                                    entityById={entityById}
                                    ownEntityId={ownEntityId}
                                    onJump={handleJump}
                                    searching={searching}
                                    error={searchError}
                                    limit={SEARCH_RESULT_LIMIT}
                                />
                            ) : (
                                <SearchResults
                                    results={[]}
                                    term=""
                                    entityById={entityById}
                                    ownEntityId={ownEntityId}
                                    onJump={handleJump}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Resolve the conversation a hit jumps to — re-exported so a host that wants to
 * open the thread itself does not need a second import path.
 */
export { jumpTargetFromHit };

export default MessageSearch;
