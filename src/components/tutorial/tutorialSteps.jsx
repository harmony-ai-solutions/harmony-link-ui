import React from 'react';
import useEntityStore from '../../store/entityStore';
import useModuleConfigStore from '../../store/moduleConfigStore';
import useTutorialStore from '../../store/tutorialStore';
import { SettingsTabGeneral, SettingsTabEntities, SettingsTabCharacters, SettingsTabModules, SettingsTabIntegrations } from '../../constants.jsx';

// ─── Helper: tag all steps in a section ──────────────────────────────────

function section(label, steps) {
    if (Array.isArray(steps)) {
        return steps.map(s => ({ ...s, sectionLabel: label }));
    }
    // Single step object (like integrationBranchStep)
    return { ...steps, sectionLabel: label };
}

// ─── Step 1: Character Creation ─────────────────────────────────────────

const characterCreationSteps = section('Characters', [
    {
        id: 'char-welcome',
        targetSelector: '[data-tutorial-id="nav-tab-characters"]',
        title: 'Welcome to Harmony Link!',
        content: (
            <div className="space-y-2">
                <p>This quick tutorial will guide you through setting up your first AI character.</p>
                <p>Let's start by creating a character profile. We'll take you to the Characters tab now.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabCharacters,
    },
    {
        id: 'char-view-overview',
        targetSelector: '[data-tutorial-id="char-create-btn"]',
        title: 'Character Profiles',
        content: (
            <div className="space-y-2">
                <p>Here you manage all your character identities. Each character has a name, personality, appearance, backstory, and more.</p>
                <p>You can <strong>Create</strong> a new profile from scratch or <strong>Import</strong> an existing character card (more on that next).</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabCharacters,
    },
    {
        id: 'char-import-feature',
        targetSelector: '[data-tutorial-id="char-import-btn"]',
        title: 'Import Character Card (PNG)',
        content: (
            <div className="space-y-2">
                <p>The <strong>Import Card</strong> button lets you import character cards from other AI platforms.</p>
                <p>These are special PNG image files with embedded character metadata (name, personality, scenario, etc.). Simply drag & drop a PNG file and the character is created automatically.</p>
                <p>This is the fastest way to get started if you already have a character card!</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabCharacters,
    },
    {
        id: 'char-create-walkthrough',
        targetSelector: '[data-tutorial-id="char-create-btn"]',
        title: 'Creating a Profile from Scratch',
        content: (
            <div className="space-y-2">
                <p>If you'd rather build a character from scratch, click <strong>Create Profile</strong> to open the editor.</p>
                <p>The editor has several tabs for different aspects of your character:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Basic Info</strong> — Name, description, personality</li>
                    <li><strong>Extended Info</strong> — Appearance, backstory, voice</li>
                    <li><strong>Advanced</strong> — System prompt, scenario, example dialogues</li>
                    <li><strong>Lifecycle</strong> — Autonomy, sleep/wake cycles, emotion settings</li>
                </ul>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabCharacters,
    },
    {
        id: 'char-explore',
        targetSelector: '[data-tutorial-id="char-profile-grid"]',
        title: 'Your Turn!',
        content: (
            <div className="space-y-2">
                <p>Take your time to create a character profile or import a card. The tutorial will pause so you can explore freely.</p>
                <p><strong>Need a character card?</strong> Browse community cards from:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><a href="https://character-tavern.com/search/cards" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline hover:text-accent-primary/80">Character Tavern</a></li>
                    <li><a href="https://chub.ai" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline hover:text-accent-primary/80">Chub.ai</a></li>
                </ul>
                <p className="text-text-muted mt-2 italic">When you're ready, click the <strong>Entities</strong> tab to continue the tutorial.</p>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={() => {
                            const store = useTutorialStore.getState();
                            store.markStepCompleted('char-explore');
                            store.nextStep();
                            store.pauseTutorial();
                        }}
                        className="btn-primary text-sm py-1.5 px-4"
                    >
                        Got it, I'll explore!
                    </button>
                </div>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabCharacters,
    },
]);

// ─── Step 2: Entity Creation ────────────────────────────────────────────

const entityCreationSteps = section('Entities', [
    {
        id: 'entity-nav',
        targetSelector: '[data-tutorial-id="nav-tab-entities"]',
        title: 'Entities — Your AI Companions',
        content: (
            <div className="space-y-2">
                <p>An <strong>Entity</strong> is the "body" of your AI character. It connects a character profile (identity) with modules (capabilities like speech, cognition, etc.).</p>
                <p>Let's head to the Entities tab.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-create',
        targetSelector: '[data-tutorial-id="entity-add-btn"]',
        title: 'Create an Entity',
        content: (
            <div className="space-y-2">
                <p>Click <strong>Add</strong> to create a new entity. You'll give it a unique ID (like a username for the AI).</p>
                <p>If you already see entities listed, those are your existing ones — you can create a new one or configure an existing one.</p>
            </div>
        ),
        placement: 'right',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-identity',
        targetSelector: '[data-tutorial-id="entity-identity-section"]',
        title: 'Identity Settings',
        content: (
            <div className="space-y-2">
                <p>Each entity has <strong>Identity Settings</strong>:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Alias</strong> — A human-friendly display name</li>
                    <li><strong>Character Profile</strong> — The personality/identity to use (we'll assign this later)</li>
                </ul>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
        prerequisite: {
            stepId: 'entity-create',
            message: 'Please create an entity first before configuring its settings.',
            validate: () => {
                const { entities } = useEntityStore.getState();
                return entities && entities.length > 0;
            },
        },
    },
    {
        id: 'entity-modules-overview',
        targetSelector: '[data-tutorial-id="entity-module-section"]',
        title: 'Module Configurations',
        content: (
            <div className="space-y-2">
                <p>Modules give your entity its <strong>capabilities</strong>. Think of them as plugins — each one adds a different skill.</p>
                <p>You assign pre-configured module configs here. We'll walk through what each one does.</p>
                <p className="text-text-muted italic">The <strong>Backend</strong> module is the minimum requirement — everything else is optional.</p>
                <p className="text-text-muted italic">Including the <strong>Cognition</strong> module however is highly recommended for the best experience.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
        prerequisite: {
            stepId: 'entity-create',
            message: 'Please create an entity first.',
            validate: () => {
                const { entities } = useEntityStore.getState();
                return entities && entities.length > 0;
            },
        },
    },
    {
        id: 'entity-module-backend-explain',
        targetSelector: '[data-tutorial-id="entity-module-backend"]',
        title: 'Backend / LLM',
        content: (
            <div className="space-y-2">
                <p>This is the <strong>core AI engine</strong> — the only required module.</p>
                <p>It handles all conversation and text generation. Without a Backend config assigned, your entity can't think or respond.</p>
                <p>You'll create the actual config in the <strong>Modules</strong> tab later, then assign it here.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-tts-explain',
        targetSelector: '[data-tutorial-id="entity-module-tts"]',
        title: 'Text-to-Speech',
        content: (
            <div className="space-y-2">
                <p>Gives your entity a <strong>voice</strong>. Converts text responses into spoken audio.</p>
                <p>Supports providers like <strong>ElevenLabs</strong>, <strong>OpenAI</strong>, or the self-hosted or cloud-based <strong>Harmony Speech Engine</strong>.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-stt-explain',
        targetSelector: '[data-tutorial-id="entity-module-stt"]',
        title: 'Speech-to-Text',
        content: (
            <div className="space-y-2">
                <p>Lets your entity <strong>understand spoken input</strong>. Transcribes your voice into text for processing.</p>
                <p>Also includes <strong>Voice Activity Detection (VAD)</strong> to know when you're speaking vs. silence.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-rag-explain',
        targetSelector: '[data-tutorial-id="entity-module-rag"]',
        title: 'RAG — Memory & Recall',
        content: (
            <div className="space-y-2">
                <p><strong>Retrieval-Augmented Generation</strong> is the key to long-term memory.</p>
                <p>It builds a searchable knowledge base from your conversations, allowing your entity to <strong>recall details from past chats</strong> — people, events, preferences, and context that would otherwise be lost.</p>
                <p>The more you chat, the better it gets at remembering what matters.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-movement-explain',
        targetSelector: '[data-tutorial-id="entity-module-movement"]',
        title: 'Movement',
        content: (
            <div className="space-y-2">
                <p>Controls your entity's <strong>animations, gestures, and physical expressions</strong>.</p>
                <p>Useful for VTuber or 3D avatar integrations — your entity can wave, nod, or react physically to conversations or ingame interactions.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-cognition-explain',
        targetSelector: '[data-tutorial-id="entity-module-cognition"]',
        title: 'Cognition',
        content: (
            <div className="space-y-2">
                <p>Enables <strong>advanced consciousness features</strong>: emotional processing, autonomous thoughts, and deeper reasoning.</p>
                <p>With Cognition enabled, your entity can reflect on conversations, develop emotional responses, and act more autonomously — not just react to messages, but <em>think</em> between them.</p>
                <p className="text-text-muted italic">Highly recommended for the best experience.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-imagination-explain',
        targetSelector: '[data-tutorial-id="entity-module-imagination"]',
        title: 'Imagination',
        content: (
            <div className="space-y-2">
                <p>Lets your entity <strong>generate images</strong>. It can create visual art, scene illustrations, or character portraits on demand.</p>
                <p>Supports providers like <strong>OpenAI (DALL·E)</strong>, <strong>ComfyUI</strong> (self-hosted), <strong>Google Gemini</strong>, and <strong>xAI (Grok)</strong>.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-module-vision-explain',
        targetSelector: '[data-tutorial-id="entity-module-vision"]',
        title: 'Vision',
        content: (
            <div className="space-y-2">
                <p>Gives your entity the ability to <strong>see and understand images</strong> you share in chat or understand visual input provided from game worlds via plugins.</p>
                <p>It can describe photos, analyze screenshots, read text from images, and respond to visual content intelligently.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-lifecycle-explain',
        targetSelector: '[data-tutorial-id="entity-lifecycle-header"]',
        title: 'Lifecycle Settings',
        content: (
            <div className="space-y-2">
                <p>Lifecycle settings control your entity's <strong>autonomous behavior and emotional systems</strong>:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Beat Schedule</strong> — How often your entity "thinks" on its own (autonomy level, interval between thoughts, and what types: self-reflection, curiosity, relationship-building, outreach)</li>
                    <li><strong>Sleep & Exhaustion</strong> — Your entity gets tired from activity and needs to rest. Controls when it falls asleep and wakes up based on exhaustion levels</li>
                    <li><strong>Emotion Decay</strong> — How quickly emotions fade over time. High-intensity moments get "crystallized" into long-term memories</li>
                    <li><strong>Memory</strong> — How many core memories your entity retains as its most important knowledge</li>
                </ul>
                <p className="text-text-muted italic">These are inherited from your character profile by default. You can override them per-entity here.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-explore',
        targetSelector: '[data-tutorial-id="entity-save-btn"]',
        title: 'Your Turn!',
        content: (
            <div className="space-y-2">
                <p>Take your time to explore the Entities tab and create an entity. The tutorial will pause so you can look around freely.</p>
                <p>Remember: only the <strong>Backend module</strong> is required. Everything else can be added later.</p>
                <p className="text-text-muted italic mt-2">When you're ready to continue, click the <strong>Integrations</strong> tab (for local LLM setup) or skip ahead to <strong>Modules</strong> (for cloud providers).</p>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={() => {
                            const store = useTutorialStore.getState();
                            store.markStepCompleted('entity-explore');
                            store.nextStep();
                            store.pauseTutorial();
                        }}
                        className="btn-primary text-sm py-1.5 px-4"
                    >
                        Got it, I'll explore!
                    </button>
                </div>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabEntities,
    },
]);

// ─── Step 3: Branch Decision ────────────────────────────────────────────

const integrationBranchStep = section('Integration', {
    id: 'integration-branch-decision',
    targetSelector: '[data-tutorial-id="nav-tab-integrations"]',
    title: 'How Do You Want to Connect Your AI?',
    content: (
        <div className="space-y-3">
            <p>Choose how you want to provide AI capabilities:</p>
            <div className="space-y-2">
                <button
                    onClick={() => {
                        useTutorialStore.getState().setBranch('local');
                        useTutorialStore.getState().nextStep();
                    }}
                    className="btn-primary w-full text-sm py-2.5"
                >
                    <span className="flex items-center justify-center gap-2">
                        <span>🐳</span>
                        <span>Local LLM (Docker)</span>
                    </span>
                    <span className="text-xs opacity-70 block mt-0.5">Free, private, runs on your machine</span>
                </button>
                <button
                    onClick={() => {
                        useTutorialStore.getState().setBranch('cloud');
                        useTutorialStore.getState().nextStep();
                    }}
                    className="btn-secondary w-full text-sm py-2.5"
                >
                    <span className="flex items-center justify-center gap-2">
                        <span>☁️</span>
                        <span>Cloud Provider (API Key)</span>
                    </span>
                    <span className="text-xs opacity-70 block mt-0.5">OpenAI, Anthropic, Google, OpenRouter, etc.</span>
                </button>
            </div>
        </div>
    ),
    placement: 'bottom',
    tab: SettingsTabIntegrations,
    branch: null,
    hideNextButton: true,
});

// ─── Step 3a: Integration — Local LLM Path ─────────────────────────────

const integrationLocalSteps = section('Integration', [
    {
        id: 'integration-nav',
        targetSelector: '[data-tutorial-id="integration-quickstart"]',
        title: 'Integrations — Running AI Locally',
        content: (
            <div className="space-y-2">
                <p>The <strong>Integrations</strong> tab manages containerized AI services running on your machine via Docker.</p>
                <p>We'll guide you through setting up a local LLM using the Harmony AI Quickstart repository.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-docker-check',
        targetSelector: '[data-tutorial-id="integration-docker-status"]',
        title: 'Docker Status',
        content: (
            <div className="space-y-2">
                <p>First, let's check if <strong>Docker</strong> is running. You'll see the status here.</p>
                <p>If Docker is not installed or not running:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Install Docker Desktop</strong> — <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline hover:text-accent-primary/80">docker.com/products/docker-desktop</a></li>
                    <li>Start Docker Desktop and wait for it to fully initialize</li>
                    <li>The status indicator will turn green once Docker is ready</li>
                </ul>
                <p className="mt-2"><strong>Alternative:</strong> <a href="https://podman.io/" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline hover:text-accent-primary/80">Podman Desktop</a> can be used as a drop-in Docker replacement — it's free, open-source, and daemonless.</p>
                <p className="text-text-muted mt-2 italic">You'll also need <strong>Git</strong> installed to clone the quickstart repository.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-quickstart-repo',
        targetSelector: '[data-tutorial-id="quickstart-settings-row"]',
        title: 'Quickstart Repository',
        content: (
            <div className="space-y-2">
                <p>The <strong>Quickstart Repository</strong> is a pre-configured Docker Compose setup that bundles everything you need for a local LLM.</p>
                <p><strong>Steps to set it up:</strong></p>
                <ol className="list-decimal list-inside space-y-1.5 mt-1">
                    <li>
                        Make sure you have <strong>Git</strong> installed — <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" className="text-accent-primary underline hover:text-accent-primary/80">git-scm.com/downloads</a>
                    </li>
                    <li>
                        Clone the repository:
                        <div
                            className="mt-1.5 px-3 py-1.5 rounded-md bg-black/30 font-mono text-xs flex items-center justify-between gap-2 cursor-pointer group"
                            onClick={(e) => {
                                navigator.clipboard.writeText('git clone https://github.com/harmony-ai-solutions/quickstart');
                                const el = e.currentTarget.querySelector('.copy-hint');
                                if (el) el.textContent = 'Copied!';
                                setTimeout(() => { if (el) el.textContent = 'Copy'; }, 2000);
                            }}
                            title="Click to copy"
                        >
                            <code className="break-all">git clone https://github.com/harmony-ai-solutions/quickstart</code>
                            <span className="copy-hint text-text-muted text-[10px] flex-shrink-0 group-hover:text-accent-primary transition-colors">Copy</span>
                        </div>
                    </li>
                    <li>Set the path below to where you cloned it</li>
                </ol>
                <p className="mt-2">You can click the <strong>GitHub</strong> button to open the repository page, or <strong>Browse</strong> to select the folder.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-set-path',
        targetSelector: '[data-tutorial-id="quickstart-settings-row"]',
        title: 'Set the Quickstart Path',
        content: (
            <div className="space-y-2">
                <p>Enter or browse to the folder where you cloned the quickstart repository, then click <strong>Save</strong>.</p>
                <p>Once the path is set, Harmony Link will automatically detect available integrations from the Docker Compose files.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-cards-overview',
        targetSelector: '[data-tutorial-id="integration-cards"]',
        title: 'Available Integrations',
        content: (
            <div className="space-y-2">
                <p>Once the quickstart repo is configured and Docker is running, integration cards will appear here automatically.</p>
                <p>Each card represents an AI service (e.g., Ollama for LLM, LocalAI). You can:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li><strong>Create instances</strong> — spin up new containers</li>
                    <li><strong>Start/Stop</strong> — control running containers</li>
                    <li><strong>Configure</strong> — edit YAML settings</li>
                </ul>
                <p className="text-text-muted mt-2 italic">Don't worry if nothing appears yet — this is a gradual setup process.</p>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-explore-local',
        targetSelector: '[data-tutorial-id="integration-cards"]',
        title: 'Your Turn!',
        content: (
            <div className="space-y-2">
                <p>Take your time to set up Docker and the quickstart repository. The tutorial will pause so you can work freely.</p>
                <p>This can take a while — installing Docker, cloning the repo, starting containers. No rush!</p>
                <p className="text-text-muted italic mt-2">When you're ready to continue, click the <strong>Modules</strong> tab to set up your module configs.</p>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={() => {
                            const store = useTutorialStore.getState();
                            store.markStepCompleted('integration-explore-local');
                            store.nextStep();
                            store.pauseTutorial();
                        }}
                        className="btn-primary text-sm py-1.5 px-4"
                    >
                        Got it, I'll explore!
                    </button>
                </div>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabIntegrations,
        branch: 'local',
    },
    {
        id: 'integration-summary-local',
        targetSelector: '[data-tutorial-id="nav-tab-modules"]',
        title: 'Moving to Modules',
        content: (
            <div className="space-y-2">
                <p>Now let's set up the <strong>Module Configs</strong> that will connect to your integrations.</p>
                <p>Even if your integrations aren't fully ready yet, you can still create module configs — they'll connect once Docker is running.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabModules,
        branch: 'local',
    },
]);

// ─── Step 3b: Integration — Cloud Provider Path ─────────────────────────

const integrationCloudSteps = section('Integration', [
    {
        id: 'integration-cloud-note',
        targetSelector: '[data-tutorial-id="nav-tab-modules"]',
        title: 'Using a Cloud Provider',
        content: (
            <div className="space-y-2">
                <p>Great choice! With a cloud provider (like OpenAI, Anthropic, Google, OpenRouter, etc.), you don't need Docker or local infrastructure.</p>
                <p>You'll just need an <strong>API key</strong> from your provider. We'll set that up in the <strong>Module Configs</strong> tab next.</p>
                <p className="text-xs text-text-muted mt-2 italic">Tip: You can always come back to the Integrations tab later if you want to add local capabilities.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabModules,
        branch: 'cloud',
    },
]);

// ─── Step 4: Module Config Creation ─────────────────────────────────────

const moduleConfigSteps = section('Modules', [
    {
        id: 'module-nav',
        targetSelector: '[data-tutorial-id="nav-tab-modules"]',
        title: 'Module Configurations',
        content: (
            <div className="space-y-2">
                <p>The <strong>Modules</strong> tab is where you configure the AI capabilities for your entities.</p>
                <p>Each module type (Backend, Cognition, TTS, etc.) can have multiple named configurations. You then assign these configs to your entities.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabModules,
    },
    {
        id: 'module-cards-overview',
        targetSelector: '[data-tutorial-id="module-cards-container"]',
        title: 'Module Types',
        content: (
            <div className="space-y-2">
                <p>Each card represents a module type. Click the chevron to expand and see existing configs or create new ones.</p>
                <p>We'll set up the two most important ones:</p>
                <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                    <li><strong>Backend</strong> — Your LLM connection (required)</li>
                    <li><strong>Cognition</strong> — Advanced AI consciousness (recommended)</li>
                </ul>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabModules,
    },
    {
        id: 'module-backend-expand',
        targetSelector: '[data-tutorial-id="module-card-expand-backend"]',
        title: 'Backend Module',
        content: (
            <div className="space-y-2">
                <p>Expand the <strong>Backend / LLM</strong> card by clicking the chevron arrow.</p>
                <p>The Backend is the core conversation engine — it's what makes your entity able to think and respond.</p>
            </div>
        ),
        placement: 'right',
        tab: SettingsTabModules,
    },
    {
        id: 'module-backend-add',
        targetSelector: '[data-tutorial-id="module-card-add-btn-backend"]',
        title: 'Create a Backend Config',
        content: (
            <div className="space-y-2">
                <p>Click <strong>Add Config</strong> to create a new Backend configuration.</p>
                <p>You'll choose a provider and enter your connection details (API key, model, etc.).</p>
                <p className="text-xs text-text-muted mt-1 italic">
                    If you set up local integrations earlier, they'll appear as provider options automatically!
                </p>
                <p className="text-xs text-accent-primary mt-2">Click <strong>Add Config</strong> to continue.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabModules,
        beforeStep: async () => {
            // Ensure the backend card is expanded
            const expandBtn = document.querySelector('[data-tutorial-id="module-card-expand-backend"]');
            if (expandBtn) {
                const card = expandBtn.closest('[data-tutorial-id="module-card-backend"]');
                const configRows = card?.querySelector('.module-config-rows-container');
                if (!configRows || configRows.offsetHeight === 0) {
                    expandBtn.click();
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        },
        nextDisabledCheck: () => {
            return !!document.querySelector('[data-tutorial-id="module-editor-backend"]');
        },
    },
    {
        id: 'module-backend-editor',
        targetSelector: '[data-tutorial-id="module-editor-backend"]',
        title: 'Configure Your Backend',
        content: (
            <div className="space-y-2">
                <p>Here you configure your Backend:</p>
                <ol className="list-decimal list-inside text-xs space-y-1 mt-1">
                    <li><strong>Name</strong> — Give this config a descriptive name</li>
                    <li><strong>Provider</strong> — Select your AI provider (OpenAI, OpenRouter, Ollama, etc.)</li>
                    <li><strong>Settings</strong> — Enter the API key, choose a model, adjust temperature, etc.</li>
                </ol>
                <p>Each provider has different settings. The form adapts automatically.</p>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabModules,
    },
    {
        id: 'module-backend-save',
        targetSelector: '[data-tutorial-id="module-editor-save-btn"]',
        title: 'Save the Backend Config',
        content: (
            <div className="space-y-2">
                <p>Fill in your provider details and click <strong>Save</strong>.</p>
                <p>Your config will appear in the Backend card's list and will be available to assign to entities.</p>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabModules,
    },
    {
        id: 'module-cognition-setup',
        targetSelector: '[data-tutorial-id="module-card-expand-cognition"]',
        title: 'Cognition Module (Optional but Recommended)',
        content: (
            <div className="space-y-2">
                <p>The <strong>Cognition</strong> module adds advanced AI consciousness features:</p>
                <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                    <li>Emotional processing and awareness</li>
                    <li>Memory consolidation between conversations</li>
                    <li>Autonomous behaviors (self-reflection, curiosity)</li>
                    <li>Sleep/wake cycle simulation</li>
                </ul>
                <p>It uses the same provider as your Backend (or a different one if you prefer). Set it up the same way.</p>
                <p className="text-xs text-text-muted mt-1 italic">Cognition is not required, but it's what makes entities feel truly alive.</p>
            </div>
        ),
        placement: 'right',
        tab: SettingsTabModules,
    },
    {
        id: 'module-summary',
        targetSelector: '[data-tutorial-id="nav-tab-entities"]',
        title: 'Modules Covered!',
        content: (
            <div className="space-y-2">
                <p>You now know how to create module configs. You don't have to set them all up right now — you can always come back to the <strong>Modules</strong> tab later.</p>
                <p>Next, let's see how to <strong>assign</strong> your module configs and character profile to an entity!</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabModules,
    },
]);

// ─── Step 5: Entity Module Assignment ───────────────────────────────────

const entityAssignmentSteps = section('Assignment', [
    {
        id: 'entity-assign-nav',
        targetSelector: '[data-tutorial-id="nav-tab-entities"]',
        title: 'Assigning Modules to Your Entity',
        content: (
            <div className="space-y-2">
                <p>Now let's see how to connect everything together — assigning module configs and a character profile to your entity.</p>
                <p>If you haven't created a module config yet, that's okay — this will show you where to assign it when you're ready.</p>
            </div>
        ),
        placement: 'bottom',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-select',
        targetSelector: '[data-tutorial-id="entity-list"]',
        title: 'Select Your Entity',
        content: (
            <div className="space-y-2">
                <p>Click on your entity in the list to select it.</p>
                <p>The right panel will show its configuration options.</p>
            </div>
        ),
        placement: 'right',
        tab: SettingsTabEntities,
        prerequisite: {
            stepId: 'entity-create',
            message: 'You need an entity to continue. Click below and create one first.',
            validate: () => {
                const { entities } = useEntityStore.getState();
                return entities && entities.length > 0;
            },
        },
    },
    {
        id: 'entity-assign-backend',
        targetSelector: '[data-tutorial-id="entity-module-backend"]',
        title: 'Assign the Backend Module',
        content: (
            <div className="space-y-2">
                <p>Use the <strong>AI Backend / LLM</strong> dropdown to select a Backend config.</p>
                <p>This is the minimum required module — your entity needs a Backend to function. If you haven't created one yet, you can do so in the <strong>Modules</strong> tab.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
        prerequisite: {
            stepId: 'module-backend-save',
            message: 'You need a Backend module config to assign. Create one in the Modules tab first, or click below to go back.',
            validate: () => {
                const configs = useModuleConfigStore.getState().getConfigs('backend');
                return configs && configs.length > 0;
            },
        },
    },
    {
        id: 'entity-assign-cognition',
        targetSelector: '[data-tutorial-id="entity-module-cognition"]',
        title: 'Assign the Cognition Module (Optional)',
        content: (
            <div className="space-y-2">
                <p>If you created a Cognition config, select it here to enable advanced consciousness features.</p>
                <p>This is optional but highly recommended for the best experience.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-assign-character',
        targetSelector: '[data-tutorial-id="entity-char-profile-select"]',
        title: 'Apply a Character Profile',
        content: (
            <div className="space-y-2">
                <p>Use the <strong>Character Profile</strong> dropdown to assign a character identity to this entity.</p>
                <p>This gives your entity a personality, backstory, appearance, and voice characteristics.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabEntities,
    },
    {
        id: 'entity-save-final',
        targetSelector: '[data-tutorial-id="entity-save-btn"]',
        title: 'Save Your Entity',
        content: (
            <div className="space-y-2">
                <p>Once you've assigned your modules and character profile, click <strong>Save</strong> to apply everything.</p>
                <p>Don't worry if you haven't set up all modules yet — you can always come back and assign more later.</p>
            </div>
        ),
        placement: 'top',
        tab: SettingsTabEntities,
    },
    {
        id: 'tutorial-complete',
        targetSelector: '[data-tutorial-id="tutorial-restart-btn"]',
        title: "You're All Set!",
        content: (
            <div className="space-y-2">
                <p className="text-base font-bold">Congratulations!</p>
                <p>You've completed the tutorial! Here's a quick recap of everything you learned about:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Character Profiles — your AI's identity</li>
                    <li>Entities — the "body" connecting identity to capabilities</li>
                    <li>Modules — the AI engines powering your entity</li>
                    <li>Lifecycle Settings — autonomous behavior and emotions</li>
                </ul>
                <p className="mt-2">Take your time to explore and configure things at your own pace. You can always come back to any tab.</p>
                <p className="text-xs text-text-muted">You can restart this tutorial anytime using the <strong>?</strong> button in the top right.</p>
            </div>
        ),
        placement: 'left',
        tab: SettingsTabGeneral,
    },
]);

// ─── Combined Step List ─────────────────────────────────────────────────

/**
 * Returns all tutorial step definitions in order.
 * The TutorialController filters by branchPath.
 */
export function getStepDefinitions(setSettingsTab) {
    return [
        ...characterCreationSteps,
        ...entityCreationSteps,
        integrationBranchStep,
        ...integrationLocalSteps,
        ...integrationCloudSteps,
        ...moduleConfigSteps,
        ...entityAssignmentSteps,
    ];
}
