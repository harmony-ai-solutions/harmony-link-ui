import React from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import CharacterCardExport from './CharacterCardExport';

/**
 * Card component for displaying a character profile summary
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} props.profile - The character profile to display
 * @param {Function} props.onClick - Callback when the card is clicked
 * @param {Function} [props.onDelete] - Callback when the delete button is clicked
 * @param {Object[]} [props.referencingEntities] - 3-2: entities (AI or persona)
 *   that link this profile live. Drives the "used by" badges.
 * @param {Function} [props.onCreatePersona] - 2-4: "Create persona from this
 *   card" — receives the FULL profile so the app can duplicate it as a rich
 *   full-card copy (all spec + Soulbits fields, images preserved).
 */
export default function CharacterProfileCard({ profile, onClick, onDelete, referencingEntities, onCreatePersona }) {
    const { t } = useTranslation('characters');
    const primaryImage = useCharacterProfileStore(state => state.getPrimaryImage(profile.id));
    const referenced = Array.isArray(referencingEntities) ? referencingEntities : [];
    
    return (
        <div 
            onClick={onClick}
            className="character-profile-card overflow-hidden cursor-pointer group hover:scale-[1.02]"
        >
            <div className="aspect-[3/4] relative bg-elevated">
                {primaryImage ? (
                    <img 
                        src={primaryImage.data_url} 
                        alt={profile.name} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-disabled">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                )}
                
                <div className="absolute inset-0 bg-accent-primary opacity-0 group-hover:opacity-10 transition-opacity" />

                <CharacterCardExport profile={profile} variant="card" />

                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(profile.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 module-action-btn-danger rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        title={t('deleteProfile')}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}

                {onCreatePersona && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // 2-4: FULL-copy semantics — the app duplicates this
                            // card (all spec + Soulbits fields, images copied with
                            // the primary flag preserved) and opens the copy in
                            // the persona editor. Source card untouched.
                            onCreatePersona(profile);
                        }}
                        className="absolute bottom-2 left-2 p-1.5 module-action-btn rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                        title={t('buttons.createPersona')}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="p-4">
                <h3 className="font-semibold text-accent-primary truncate">{profile.name}</h3>
                <p className="text-sm text-text-muted line-clamp-2 mt-1 min-h-[2.5rem]">
                    {profile.description || t('noDescription')}
                </p>
                {referenced.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {referenced.map(entity => (
                            <span
                                key={entity.id}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    entity.entity_type === 'user'
                                        ? 'bg-accent-primary/15 text-accent-primary'
                                        : 'bg-accent-secondary/15 text-accent-secondary'
                                }`}
                            >
                                {entity.entity_type === 'user'
                                    ? t('usedBy.personaPrefix', { name: entity.alias || entity.id })
                                    : t('usedBy.aiPrefix', { name: entity.alias || entity.id })}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
