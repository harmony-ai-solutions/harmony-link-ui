import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon, SearchIcon } from '../../constants/icons.jsx';
import CharacterImage from '../common/CharacterImage.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import {
    buildSnippet,
    highlightParts,
    searchHitPartner,
} from '../../store/searchUtils.js';
import { messageDirection } from '../../store/chatStoreUtils.js';
import { formatRowTime } from './ConversationRow.jsx';

/**
 * The result list for message search (Task 02-9).
 *
 * Presentation only: the query, the request and the jump all live in
 * `chatStore` / `MessageSearch`, so this component can render any hit list — the
 * global search and the in-conversation search share it and therefore cannot
 * look or behave differently.
 *
 * Each row answers the three questions a search result has to answer without
 * opening the thread:
 *
 *   1. **Who** — the partner's name and avatar, taken from the hit's OWNING
 *      entity (`message.entity_id`), which the server already sent.
 *   2. **What matched** — a snippet with the match highlighted. The geometry
 *      comes from `buildSnippet` (pure, unit-tested); this file only turns the
 *      offsets into `<mark>` elements.
 *   3. **When, and who said it** — a row sent by you is marked as such, because
 *      a hit from your own message reads very differently from one of the
 *      character's.
 *
 * @param {{
 *   results: Array<object>,
 *   term: string,
 *   entityById?: Record<string, object>,
 *   ownEntityId?: string,
 *   onJump: (hit: object) => void,
 *   searching?: boolean,
 *   error?: string|null,
 *   limit?: number,
 * }} props
 */
const SearchResults = ({
    results,
    term,
    entityById,
    ownEntityId,
    onJump,
    searching = false,
    error = null,
    limit = 0,
}) => {
    const { t } = useTranslation();
    const hits = results || [];

    if (error) {
        return (
            <div className="chat-search-message chat-search-message-error" role="alert">
                {error}
            </div>
        );
    }

    // A request in flight with nothing to show yet: placeholders in the shape of
    // a row, so the panel does not jump when the hits land.
    if (searching && hits.length === 0) {
        return (
            <div className="chat-search-results" aria-busy="true">
                {[0, 1, 2].map((index) => (
                    <div key={index} className="ui-skeleton-row">
                        <Skeleton className="ui-skeleton-circle" width="34px" height="34px" />
                        <div className="ui-skeleton-row-body">
                            <Skeleton className="ui-skeleton-line" width="35%" />
                            <Skeleton className="ui-skeleton-line" width="80%" height="0.6rem" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (hits.length === 0) {
        return (
            <EmptyState
                size="compact"
                icon={term ? SearchIcon : MessageIcon}
                title={term
                    ? t('chat:search.noResultsTitle', { term })
                    : t('chat:search.promptTitle')}
                description={term
                    ? t('chat:search.noResultsHint')
                    : t('chat:search.promptHint')}
            />
        );
    }

    return (
        <div className="chat-search-results">
            <div className="chat-search-count">
                {limit > 0 && hits.length >= limit
                    ? t('chat:search.countCapped', { count: hits.length, limit })
                    : t('chat:search.count', { count: hits.length })}
            </div>
            <ul className="chat-search-list">
                {hits.map((hit) => {
                    const partner = searchHitPartner(hit, entityById);
                    const snippet = buildSnippet(hit.content, term);
                    const parts = highlightParts(snippet);
                    const outgoing = ownEntityId
                        ? messageDirection(hit.message, ownEntityId) === 'out'
                        : false;
                    return (
                        <li key={hit.id}>
                            <button
                                type="button"
                                className="chat-search-hit"
                                onClick={() => onJump?.(hit)}
                            >
                                <span className="chat-search-hit-avatar">
                                    <CharacterImage
                                        profileId={partner.profileId}
                                        alt={partner.name}
                                        className="chat-search-hit-avatar-img"
                                        fallback={(
                                            <span className="chat-search-hit-avatar-fallback">
                                                <RobotIcon className="w-4 h-4" />
                                            </span>
                                        )}
                                    />
                                </span>
                                <span className="chat-search-hit-body">
                                    <span className="chat-search-hit-top">
                                        <span className="chat-search-hit-name">{partner.name}</span>
                                        <span className="chat-search-hit-time">
                                            {formatRowTime(hit.created_at)}
                                        </span>
                                    </span>
                                    <span className="chat-search-hit-snippet">
                                        {outgoing && (
                                            <span className="chat-search-hit-you">
                                                {t('chat:list.you')}:
                                            </span>
                                        )}
                                        {snippet.leadingEllipsis && '…'}
                                        {parts.map((part, index) => (
                                            part.match
                                                ? <mark key={index} className="chat-search-mark">{part.text}</mark>
                                                : <span key={index}>{part.text}</span>
                                        ))}
                                        {snippet.trailingEllipsis && '…'}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default SearchResults;
