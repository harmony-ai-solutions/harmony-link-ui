// Backend providers that have built-in character identity and don't use Harmony Link character profiles
export const BACKEND_PROVIDERS_WITH_BUILTIN_IDENTITY = [
    'kindroid',
    'characterai',
    'kajiwoto'
];

// Backend providers that support using Harmony Link character profiles
export const BACKEND_PROVIDERS_WITH_PROFILE_SUPPORT = [
    'openai',
    'openaicompatible',
    'openrouter'
];

// Check if a backend provider supports character profiles
export function supportsCharacterProfile(provider) {
    return BACKEND_PROVIDERS_WITH_PROFILE_SUPPORT.includes(provider?.toLowerCase());
}

// Check if a backend provider has built-in identity
export function hasBuiltInIdentity(provider) {
    return BACKEND_PROVIDERS_WITH_BUILTIN_IDENTITY.includes(provider?.toLowerCase());
}
