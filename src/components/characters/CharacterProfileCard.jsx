import React from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';

/**
 * Card component for displaying a character profile summary
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} props.profile - The character profile to display
 * @param {Function} props.onClick - Callback when the card is clicked
 * @param {Function} [props.onDelete] - Callback when the delete button is clicked
 */
export default function CharacterProfileCard({ profile, onClick, onDelete }) {
    const primaryImage = useCharacterProfileStore(state => state.getPrimaryImage(profile.id));
    
    return (
        <div 
            onClick={onClick}
            className="bg-neutral-700 rounded-lg border border-neutral-600 shadow-sm hover:shadow-lg hover:border-orange-500/50 transition-all cursor-pointer overflow-hidden group"
        >
            <div className="aspect-[3/4] relative bg-neutral-800">
                {primaryImage ? (
                    <img 
                        src={primaryImage.data_url} 
                        alt={profile.name} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                )}
                
                <div className="absolute inset-0 bg-orange-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(profile.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Delete profile"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
            
            <div className="p-4">
                <h3 className="font-semibold text-orange-400 truncate">{profile.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2 mt-1 min-h-[2.5rem]">
                    {profile.description || "No description provided."}
                </p>
            </div>
        </div>
    );
}
