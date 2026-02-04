import useCharacterProfileStore from '../../store/characterProfileStore';

function CharacterProfilePreview({ profileId }) {
    const { getProfile, getImagesForProfile } = useCharacterProfileStore();
    const profile = getProfile(profileId);

    if (!profile) return null;

    const images = getImagesForProfile(profileId);
    const primaryImage = images?.find(img => img.is_primary) || images?.[0];

    return (
        <div className="mb-4 p-4 bg-surface rounded border border-white/10 flex items-start space-x-4">
            {primaryImage ? (
                <img
                    src={primaryImage.data_url}
                    alt={profile.name}
                    className="w-20 h-20 rounded object-cover border border-white/10"
                />
            ) : (
                <div className="w-20 h-20 rounded bg-surface border border-white/10 flex items-center justify-center text-text-muted text-xs">
                    No Image
                </div>
            )}
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-accent-primary">
                    {profile.name}
                </h3>
                <p className="text-sm text-text-muted mt-1 line-clamp-2 italic">
                    {profile.description || profile.personality || "No description provided."}
                </p>
            </div>
        </div>
    );
}

export default CharacterProfilePreview;
