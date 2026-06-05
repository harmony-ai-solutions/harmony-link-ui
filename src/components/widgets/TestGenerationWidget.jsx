import React, { useState } from 'react';
import { testImaginationGeneration } from '../../services/management/configService.js';

/**
 * Test generation widget for non-ComfyUI imagination providers.
 * Provides a simple prompt -> generate -> view result flow.
 *
 * @param {string} provider   - Provider ID (e.g. 'xai', 'google', 'openai', 'openrouter')
 * @param {object} config     - The current provider config object (flat key-value pairs)
 * @param {string} apiKey     - Current API key value (to enable/disable generate button)
 */
export default function TestGenerationWidget({
    provider,
    config,
    apiKey,
}) {
    // Test generation state
    const [testPositivePrompt, setTestPositivePrompt] = useState('');
    const [testNegativePrompt, setTestNegativePrompt] = useState('');
    const [testSeed, setTestSeed] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [testError, setTestError] = useState('');

    const handleTestGeneration = async () => {
        setIsGenerating(true);
        setTestResult(null);
        setTestError('');
        try {
            const result = await testImaginationGeneration(
                provider,
                config,
                '',
                testPositivePrompt || 'a beautiful, detailed digital artwork',
                testNegativePrompt,
                testSeed
            );
            setTestResult(result);
        } catch (err) {
            setTestError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="border-t border-border-default pt-4 mt-2">
            <h5 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Test Generation
            </h5>
            <p className="text-xs text-text-muted mb-3">
                Tests the current configuration directly against the {getProviderLabel(provider)} API.
                No entity or simulator required — a temporary connection is created for this test only.
            </p>

            {/* Positive Prompt */}
            <div className="flex items-start mb-1 w-full">
                <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                    Positive Prompt
                </label>
                <textarea className="input-field w-3/4" rows={2}
                    value={testPositivePrompt}
                    onChange={e => setTestPositivePrompt(e.target.value)}
                    placeholder="e.g. a beautiful sunset over mountains, highly detailed..." />
            </div>

            {/* Negative Prompt */}
            <div className="flex items-start mb-1 w-full">
                <label className="text-sm font-medium text-text-secondary w-1/4 px-2 pt-1">
                    Negative Prompt
                </label>
                <textarea className="input-field w-3/4" rows={2}
                    value={testNegativePrompt}
                    onChange={e => setTestNegativePrompt(e.target.value)}
                    placeholder="(optional) e.g. blurry, low quality, watermark..." />
            </div>
            <p className="text-xs text-text-muted mt-1 mb-3 ml-[25%] pl-2">
                Negative prompts are appended as text instructions — these APIs do not have a dedicated negative prompt parameter.
            </p>

            {/* Seed */}
            <div className="flex items-center mb-4 w-full">
                <label className="text-sm font-medium text-text-secondary w-1/4 px-2">
                    Seed
                </label>
                <input type="number" className="input-field w-48"
                    value={testSeed}
                    onChange={e => setTestSeed(parseInt(e.target.value) || 0)}
                    min={0} step={1}
                    placeholder="0 = random" />
                <span className="text-xs text-text-muted ml-2">
                    (not all providers support seed — value is ignored if unsupported)
                </span>
            </div>

            {/* Generate Button */}
            <div className="flex items-center gap-3 mb-4">
                <button className="btn-primary px-4 py-1 text-sm"
                    onClick={handleTestGeneration}
                    disabled={isGenerating || !apiKey}>
                    {isGenerating ? 'Generating...' : 'Generate Test Image'}
                </button>
                {!apiKey && (
                    <span className="text-xs text-text-muted">Configure an API Key first.</span>
                )}
            </div>

            {/* Error Display */}
            {testError && (
                <div className="rounded p-2 bg-red-900/30 border border-red-700 text-xs text-red-400 mb-3">
                    {testError}
                </div>
            )}

            {/* Result Display */}
            {testResult && (
                <div>
                    <p className="text-xs text-text-muted mb-2">
                        Generation successful{testResult.seed_used > 0 &&
                            <> — Seed used: <span className="text-text-primary font-medium">{testResult.seed_used}</span></>
                        }
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {testResult.images && testResult.images.map((img, idx) => (
                            <img key={idx} src={img} alt={`Generated ${idx + 1}`}
                                className="rounded border border-border-default max-w-xs max-h-64 object-contain" />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function getProviderLabel(provider) {
    switch (provider) {
        case 'xai': return 'xAI';
        case 'google': return 'Google Gemini';
        case 'openai': return 'OpenAI';
        case 'openrouter': return 'OpenRouter';
        default: return provider;
    }
}
