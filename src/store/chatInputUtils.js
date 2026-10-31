/**
 * Desktop Chat — composer logic (Task 02-8).
 *
 * Every function here is pure and free of external imports so it can be
 * unit-tested with `node --test` (the same constraint `chatStoreUtils.js`
 * follows: the store and its services touch `import.meta.env`, which does not
 * exist outside Vite). `ChatInput.jsx` is a thin view over these helpers.
 *
 * The five parity features live here:
 *   1. multi-image selection (cap + size limit) — {@link selectImages}
 *   2. `:shortcode:` autocomplete — {@link activeShortcodeToken} /
 *      {@link searchShortcodes} / {@link applyShortcode}
 *   3. the ✨ scenario insertion — {@link buildScenarioInsertion}
 *   4. per-conversation draft persistence — {@link draftStorageKey} /
 *      {@link loadDraft} / {@link saveDraft} / {@link clearDraft}
 *   5. the disabled-composer explanation — {@link composerState}
 */

/* ── Limits ──────────────────────────────────────────────────────────── */

/**
 * Files accepted per send.
 *
 * The socket sends ONE message per image (there is no multi-attachment
 * utterance in the engine), so five images are five utterances. Android caps the
 * same flow at five, and a higher cap would mean a burst of five WS frames plus
 * five persistence writes from a single click.
 */
export const MAX_IMAGES = 5;

/** Per-image size cap. Comfortably under the engine's WS frame budget. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Longest draft written to `localStorage` (defensive: quota is shared). */
export const MAX_DRAFT_LENGTH = 20000;

/** Greedy-cap for the scenario context line. */
export const MAX_SCENARIO_LENGTH = 600;

/** Suggestion rows rendered under the composer. */
export const MAX_SHORTCODE_SUGGESTIONS = 6;

/* ── 1. Multiple images ──────────────────────────────────────────────── */

/**
 * Filter a picked file list down to what can actually be sent.
 *
 * Returns the accepted files AND the rejected ones with a reason, because a
 * silently dropped file is the worst outcome: the user picked five pictures and
 * three went nowhere. `reasons` feeds the toast.
 *
 * The limit is applied against `existing.length`, not the fresh batch alone —
 * picking 3 and then 3 more must not produce six.
 *
 * @param {Array<{name?: string, size?: number, type?: string}>} files
 * @param {Array<object>} [existing] - already-staged attachments
 * @param {{ max?: number, maxBytes?: number }} [options]
 * @returns {{ accepted: Array<object>, rejected: Array<{name: string, reason: 'limit'|'tooLarge'|'notImage'}> }}
 */
export function selectImages(files, existing = [], options = {}) {
    const max = Number.isFinite(options.max) ? Math.trunc(options.max) : MAX_IMAGES;
    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : MAX_IMAGE_BYTES;
    const current = Array.isArray(existing) ? existing.length : 0;

    const accepted = [];
    const rejected = [];

    for (const file of Array.isArray(files) ? files : []) {
        if (!file) continue;
        const name = String(file.name || 'image');
        const type = String(file.type || '');
        const size = Number(file.size) || 0;

        // A non-image file cannot be rendered by the bubble and cannot be
        // described to the vision model, so it is refused rather than sent as
        // something the engine will drop.
        if (type && !type.startsWith('image/')) {
            rejected.push({ name, reason: 'notImage' });
            continue;
        }
        if (size > maxBytes) {
            rejected.push({ name, reason: 'tooLarge' });
            continue;
        }
        if (current + accepted.length >= max) {
            rejected.push({ name, reason: 'limit' });
            continue;
        }
        accepted.push(file);
    }

    return { accepted, rejected };
}

/**
 * Turn staged images into the ordered socket payloads for one send.
 *
 * One payload per image — the engine has no multi-attachment utterance. The
 * composer's typed text becomes the CAPTION OF THE FIRST image and is not
 * repeated: repeating it would put the same sentence in five consecutive
 * bubbles, and dropping it entirely would lose what the user wrote.
 *
 * @param {Array<object>} images - staged attachments
 * @param {string} [caption] - the composer text
 * @returns {Array<{image: object, caption: string}>}
 */
export function planImageMessages(images, caption = '') {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    const text = String(caption || '').trim();
    return list.map((image, index) => ({
        image,
        caption: index === 0 ? text : '',
    }));
}

/** Human-readable toast copy for a rejected file list (translated by caller). */
export function rejectionSummary(rejected) {
    const list = Array.isArray(rejected) ? rejected : [];
    const counts = { limit: 0, tooLarge: 0, notImage: 0 };
    for (const item of list) {
        if (counts[item.reason] !== undefined) counts[item.reason] += 1;
    }
    return {
        ...counts,
        total: list.length,
        /** Which single reason to lead with (the most actionable one). */
        dominant: counts.limit > 0 ? 'limit'
            : counts.tooLarge > 0 ? 'tooLarge'
                : counts.notImage > 0 ? 'notImage'
                    : null,
    };
}

/* ── 2. Emoji shortcode autocomplete ─────────────────────────────────── */

/**
 * Common emoji shortcodes (GitHub/Slack spellings).
 *
 * Deliberately a curated ~300 rather than a full Unicode name dump: the point is
 * to complete what a person actually types (`:smile:`, `:heart:`, `:thumbsup:`),
 * and a 3000-entry list turns a six-row suggestion box into a search engine.
 * The full picker is untouched — this is the keyboard path, not a replacement.
 */
export const EMOJI_SHORTCODES = Object.freeze({
    // Faces
    smile: '😄', grin: '😁', joy: '😂', rofl: '🤣', laughing: '😆',
    sweat_smile: '😅', wink: '😉', blush: '😊', innocent: '😇', relaxed: '☺️',
    heart_eyes: '😍', kissing_heart: '😘', kissing: '😗', yum: '😋',
    stuck_out_tongue: '😛', tongue: '😛', zany: '🤪', money_mouth: '🤩',
    hugging: '🤗', thinking: '🤔', neutral_face: '😐', expressionless: '😑',
    no_mouth: '😶', smirk: '😏', unamused: '😒', roll_eyes: '🙄',
    grimacing: '😬', lying_face: '🤥', relieved: '😌', pensive: '😔',
    sleepy: '😪', sleeping: '😴', mask: '😷', thermometer: '🤒',
    bandage: '🤕', nauseated: '🤢', vomiting: '🤮', sneezing: '🤧',
    hot_face: '🥵', cold_face: '🥶', woozy: '🥴', dizzy_face: '😵',
    exploded_head: '🤯', cowboy: '🤠', partying: '🥳', sunglasses: '😎',
    nerd: '🤓', monocle: '🧐', confused: '😕', worried: '😟',
    slightly_frowning: '🙁', frowning: '☹️', open_mouth: '😮', hushed: '😯',
    astonished: '😲', flushed: '😳', pleading: '🥺', fearful: '😨',
    cold_sweat: '😰', disappointed: '😞', cry: '😢', sob: '😭',
    scream: '😱', confounded: '😖', persevere: '😣', disappointed_relieved: '😥',
    sweat: '😓', weary: '😩', tired_face: '😫', yawning: '🥱',
    triumph: '😤', angry: '😠', rage: '😡', cursing: '🤬',
    smiling_imp: '😈', imp: '👿', skull: '💀', ghost: '👻',
    alien: '👽', robot: '🤖', poop: '💩', clown: '🤡',
    ogre: '👹', goblin: '👺', baby: '👶', child: '🧒',
    boy: '👦', girl: '👧', adult: '🧑', man: '👨',
    woman: '👩', older_man: '👴', older_woman: '👵', person: '🧑',
    santa: '🎅', superhero: '🦸', detective: '🕵️', guard: '💂',
    princess: '👸', prince: '🤴', angel: '👼', mermaid: '🧜',
    fairy: '🧚', vampire: '🧛', zombie: '🧟', genie: '🧞',
    shrug: '🤷', facepalm: '🤦', bow: '🙇', tipping_hand: '💁',
    // Hands & gestures
    thumbsup: '👍', plus1: '👍', thumbsdown: '👎', minus1: '👎',
    ok_hand: '👌', pinched: '🤌', v: '✌️', crossed_fingers: '🤞',
    metal: '🤘', call_me: '🤙', point_left: '👈', point_right: '👉',
    point_up: '👆', point_down: '👇', raised_hand: '✋', raised_back_of_hand: '🤚',
    wave: '👋', bye: '👋', clap: '👏', pray: '🙏',
    thanks: '🙏', muscle: '💪', flex: '💪', writing_hand: '✍️',
    nail_care: '💅', selfie: '🤳', handshake: '🤝', fist: '✊',
    punch: '👊', victory: '✌️', love_you: '🤟', hugging_hands: '🤗',
    // Hearts & symbols
    heart: '❤️', red_heart: '❤️', orange_heart: '🧡', yellow_heart: '💛',
    green_heart: '💚', blue_heart: '💙', purple_heart: '💜', black_heart: '🖤',
    white_heart: '🤍', brown_heart: '🤎', broken_heart: '💔', heartbeat: '💓',
    heartpulse: '💗', two_hearts: '💕', sparkling_heart: '💖', heart_decoration: '💟',
    kiss: '💋', love_letter: '💌', cupid: '💘', gift_heart: '💝',
    star: '⭐', star2: '🌟', sparkles: '✨', glitter: '✨',
    dizzy: '💫', boom: '💥', collision: '💥', fire: '🔥',
    hot: '🔥', hundred: '💯', check: '✅', white_check_mark: '✅',
    heavy_check_mark: '✔️', x: '❌', cross_mark: '❌', warning: '⚠️',
    question: '❓', exclamation: '❗', bangbang: '‼️', interrobang: '⁉️',
    zzz: '💤', speech_balloon: '💬', thought_balloon: '💭', anger: '💢',
    // Animals
    dog: '🐶', cat: '🐱', mouse: '🐭', hamster: '🐹',
    rabbit: '🐰', fox: '🦊', bear: '🐻', panda: '🐼',
    koala: '🐨', tiger: '🐯', lion: '🦁', cow: '🐮',
    pig: '🐷', frog: '🐸', monkey: '🐵', monkey_face: '🐵',
    chicken: '🐔', penguin: '🐧', bird: '🐦', baby_chick: '🐤',
    duck: '🦆', eagle: '🦅', owl: '🦉', bat: '🦇',
    wolf: '🐺', boar: '🐗', horse: '🐴', unicorn: '🦄',
    bee: '🐝', bug: '🐛', butterfly: '🦋', snail: '🐌',
    beetle: '🪲', ant: '🐜', spider: '🕷️', scorpion: '🦂',
    turtle: '🐢', snake: '🐍', lizard: '🦎', octopus: '🐙',
    squid: '🦑', shrimp: '🦐', lobster: '🦞', crab: '🦀',
    fish: '🐟', tropical_fish: '🐠', blowfish: '🐡', dolphin: '🐬',
    whale: '🐳', shark: '🦈', crocodile: '🐊', elephant: '🐘',
    mammoth: '🦣', giraffe: '🦒', zebra: '🦓', hedgehog: '🦔',
    camel: '🐫', llama: '🦙', kangaroo: '🦘', paw_prints: '🐾',
    // Nature & weather
    sun: '☀️', sunny: '☀️', moon: '🌙', crescent_moon: '🌙',
    cloud: '☁️', zap: '⚡', lightning: '⚡', snowflake: '❄️',
    umbrellas: '☔', rainbow: '🌈', ocean: '🌊', droplet: '💧',
    earth: '🌍', globe: '🌍', mountain: '⛰️', volcano: '🌋',
    tree: '🌳', evergreen_tree: '🌲', palm_tree: '🌴', cactus: '🌵',
    palm: '🌴', seedling: '🌱', herb: '🌿', four_leaf_clover: '🍀',
    shamrock: '☘️', maple_leaf: '🍁', fallen_leaf: '🍂', leaves: '🍃',
    mushroom: '🍄', rose: '🌹', tulip: '🌷', sunflower: '🌻',
    blossom: '🌼', cherry_blossom: '🌸', hibiscus: '🌺', bouquet: '💐',
    // Food & drink
    apple: '🍎', green_apple: '🍏', pear: '🍐', tangerine: '🍊',
    orange: '🍊', lemon: '🍋', banana: '🍌', watermelon: '🍉',
    grapes: '🍇', strawberry: '🍓', melon: '🍈', cherries: '🍒',
    peach: '🍑', mango: '🥭', pineapple: '🍍', coconut: '🥥',
    kiwi: '🥝', tomato: '🍅', eggplant: '🍆', avocado: '🥑',
    broccoli: '🥦', carrot: '🥕', corn: '🌽', pepper: '🌶️',
    cucumber: '🥒', lettuce: '🥬', garlic: '🧄', onion: '🧅',
    potato: '🥔', sweet_potato: '🍠', bread: '🍞', croissant: '🥐',
    cheese: '🧀', egg: '🥚', bacon: '🥓', hamburger: '🍔',
    fries: '🍟', pizza: '🍕', hotdog: '🌭', sandwich: '🥪',
    taco: '🌮', burrito: '🌯', salad: '🥗', popcorn: '🍿',
    rice: '🍚', noodles: '🍜', spaghetti: '🍝', sushi: '🍣',
    cake: '🍰', birthday: '🎂', cupcake: '🧁', pie: '🥧',
    chocolate_bar: '🍫', candy: '🍬', lollipop: '🍭', cookie: '🍪',
    doughnut: '🍩', icecream: '🍨', ice_cream: '🍦', honey: '🍯',
    coffee: '☕', tea: '🍵', beer: '🍺', beers: '🍻',
    wine_glass: '🍷', cocktail: '🍸', champagne: '🍾', milk_glass: '🥛',
    // Activity & objects
    soccer: '⚽', basketball: '🏀', football: '🏈', baseball: '⚾',
    tennis: '🎾', volleyball: '🏐', trophy: '🏆', medal: '🏅',
    dart: '🎯', video_game: '🎮', game_die: '🎲', chess_pawn: '♟️',
    art: '🎨', musical_note: '🎵', notes: '🎶', microphone: '🎤',
    headphones: '🎧', guitar: '🎸', violin: '🎻', drum: '🥁',
    movie_camera: '🎥', clapper: '🎬', ticket: '🎫', book: '📖',
    books: '📚', notebook: '📓', memo: '📝', pencil: '✏️',
    pen: '🖊️', paperclip: '📎', scissors: '✂️', lock: '🔒',
    unlock: '🔓', key: '🔑', bell: '🔔', no_bell: '🔕',
    hourglass: '⏳', alarm_clock: '⏰', stopwatch: '⏱️', calendar: '📅',
    phone: '☎️', iphone: '📱', computer: '💻', keyboard: '⌨️',
    deskto_computer: '🖥️', printer: '🖨️', battery: '🔋', bulb: '💡',
    flashlight: '🔦', candle: '🕯️', wrench: '🔧', hammer: '🔨',
    gear: '⚙️', toolbox: '🧰', magnet: '🧲', flask: '🧪',
    microscope: '🔬', telescope: '🔭', satellite: '📡', rocket: '🚀',
    airplane: '✈️', car: '🚗', taxi: '🚕', bus: '🚌',
    train: '🚆', bicycle: '🚲', motorcycle: '🏍️', ship: '🚢',
    boat: '⛵', anchor: '⚓', house: '🏠', office: '🏢',
    tent: '⛺', bridge: '🌉', statue_of_liberty: '🗽', package: '📦',
    mail: '✉️', email: '📧', inbox: '📥', memo_badge: '📝',
    camera: '📷', video_camera: '📹', tv: '📺', radio: '📻',
    moneybag: '💰', dollar: '💵', money: '💵', credit_card: '💳',
    gem: '💎', crown: '👑', ring: '💍', watch: '⌚',
    glasses: '👓', shirt: '👕', jeans: '👖', dress: '👗',
    shoe: '👞', sneaker: '👟', boot: '👢', hat: '🎩',
    umbrella: '☂️', backpack: '🎒', purse: '👛', shopping_cart: '🛒',
    // Misc / reactions
    eyes: '👀', eye: '👁️', lips: '👄', ear: '👂',
    nose: '👃', brain: '🧠', bone: '🦴', tooth: '🦷',
    tongue_out: '😝', sweat_drops: '💦', dash: '💨', wind: '🌬️',
    hourglass_done: '⌛', clock: '🕐', dice: '🎲', sparkle: '✨',
    balloon: '🎈', confetti: '🎊', tada: '🎉', party_popper: '🎉',
    gift: '🎁', ribbon: '🎀', flag: '🏁', checkered_flag: '🏁',
    peace: '🕊️', dove: '🕊️', scales: '⚖️', compass: '🧭',
    crystal_ball: '🔮', magic_wand: '🪄', jigsaw: '🧩', puzzle: '🧩',
});

/** All shortcode names, sorted — stable order for the suggestion list. */
const SHORTCODE_NAMES = Object.freeze(Object.keys(EMOJI_SHORTCODES).sort());

/**
 * The shortcode token being typed at the caret, or null.
 *
 * Matches `:smi`, `:smile` and `:smile:` — a closed shortcode initially looks
 * like "the user already finished it", but people type the closing colon from
 * habit and then expect it to complete, so the token is recognised either way
 * and the closing colon is part of the replaced range.
 *
 * A boundary check (`^`, whitespace, or an opening bracket) is required before
 * the colon so `10:30` and `note:` do not open a suggestion list.
 *
 * Only the text BEFORE the caret is examined, so editing in the middle of a
 * message completes the token at the cursor rather than a later `:`.
 *
 * @param {string} text
 * @param {number} [caret] - defaults to the end of the text
 * @returns {{ start: number, end: number, query: string }|null}
 */
export function activeShortcodeToken(text, caret) {
    const value = String(text ?? '');
    const position = Number.isFinite(caret) ? Math.max(0, Math.min(caret, value.length)) : value.length;

    /**
     * Scan backwards over the shortcode alphabet instead of leaning on one
     * regex.
     *
     * A regex that captures both the boundary and the optional closing colon
     * has to be unwound back into absolute offsets, and the closing colon shifts
     * them — the first implementation was one character short for `:smile:`
     * precisely because of that. A character scan is short enough to read and
     * cannot disagree with the caret it was handed.
     */
    // Step over a closing colon the caret sits BEHIND, and over one it sits
    // BEFORE: `:smile:|` and `:smile|:` are the same token to the user.
    let end = position;
    if (end < value.length && value[end] === ':') end += 1;
    let scan = end > 0 && value[end - 1] === ':' ? end - 1 : end;

    let start = scan;
    while (start > 0 && /[a-zA-Z0-9_+\-]/.test(value[start - 1])) start -= 1;
    const query = value.slice(start, scan);

    // The opening colon must sit immediately before the name, at a boundary.
    const colonAt = start - 1;
    if (query.length < 2 || colonAt < 0 || value[colonAt] !== ':') return null;
    if (colonAt > 0 && !/[\s([{>]/.test(value[colonAt - 1])) return null;

    return { start: colonAt, end, query: query.toLowerCase() };
}

/**
 * Rank shortcodes for a query.
 *
 * Prefix matches rank first (the user is spelling a name), then substring
 * matches, then a plain "sounds like" fallback — all stable within a rank so
 * the list does not reshuffle as one more character is typed.
 *
 * @param {string} query
 * @param {{ limit?: number, dictionary?: Record<string, string> }} [options]
 * @returns {Array<{ name: string, emoji: string }>}
 */
export function searchShortcodes(query, options = {}) {
    const limit = Number.isFinite(options.limit) ? Math.trunc(options.limit) : MAX_SHORTCODE_SUGGESTIONS;
    const dictionary = options.dictionary || EMOJI_SHORTCODES;
    const needle = String(query || '').toLowerCase().replace(/^:/, '').replace(/:$/, '');
    if (!needle) return [];

    const names = options.dictionary
        ? Object.keys(dictionary).sort()
        : SHORTCODE_NAMES;

    const prefix = [];
    const contains = [];
    for (const name of names) {
        if (name.startsWith(needle)) prefix.push(name);
        else if (name.includes(needle)) contains.push(name);
        if (prefix.length >= limit) break;
    }

    return prefix.concat(contains)
        .slice(0, limit)
        .map((name) => ({ name, emoji: dictionary[name] }));
}

/**
 * Replace the active token with an emoji.
 *
 * The caret lands immediately after the inserted emoji so typing continues
 * where the user was, and no trailing space is added — a space would fight the
 * text that already follows the token when editing mid-message.
 *
 * @param {string} text
 * @param {{ start: number, end: number }} token
 * @param {string} emoji
 * @returns {{ text: string, caret: number }}
 */
export function applyShortcode(text, token, emoji) {
    const value = String(text ?? '');
    if (!token || !emoji) return { text: value, caret: value.length };
    const start = Math.max(0, Math.min(token.start, value.length));
    const end = Math.max(start, Math.min(token.end, value.length));
    const next = value.slice(0, start) + emoji + value.slice(end);
    return { text: next, caret: start + emoji.length };
}

/* ── 3. Scenario insertion ───────────────────────────────────────────── */

/**
 * The character's `scenario` as a quoted context line.
 *
 * Android lets you drop the scenario into the composer so the partner can be
 * reminded of the setting without the user retyping it. Newlines are collapsed
 * (a multi-paragraph scenario would otherwise push the composer to its max
 * height and read like a pasted essay) and the result is prefixed with `> `,
 * which is both the markdown quote the engine already receives as plain text and
 * the conventional "this is context, not dialogue" marker.
 *
 * @param {string} scenario
 * @param {{ maxLength?: number }} [options]
 * @returns {string} '' when there is no usable scenario
 */
export function formatScenarioContext(scenario, options = {}) {
    const maxLength = Number.isFinite(options.maxLength)
        ? Math.max(1, Math.trunc(options.maxLength))
        : MAX_SCENARIO_LENGTH;
    const flat = String(scenario || '').replace(/\s+/g, ' ').trim();
    if (!flat) return '';

    const clipped = flat.length > maxLength
        ? `${flat.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
        : flat;
    return `> ${clipped}`;
}

/**
 * Insert a scenario context line into the composer.
 *
 * A leading blank line separates it from anything already typed, so the
 * quotation does not run into the user's sentence. The caret goes to the END of
 * the composer: the scenario is context that precedes what they are about to
 * say, so they type after it.
 *
 * @param {string} existingText
 * @param {string} scenario
 * @param {{ maxLength?: number }} [options]
 * @returns {{ text: string, caret: number, inserted: boolean }}
 */
export function buildScenarioInsertion(existingText, scenario, options = {}) {
    const current = String(existingText ?? '');
    const quoted = formatScenarioContext(scenario, options);
    if (!quoted) {
        return { text: current, caret: current.length, inserted: false };
    }
    // Re-inserting the same scenario would silently duplicate the paragraph.
    if (current.includes(quoted)) {
        return { text: current, caret: current.length, inserted: false };
    }
    const separator = !current.trim() ? '' : (current.endsWith('\n\n') ? '' : (current.endsWith('\n') ? '\n' : '\n\n'));
    const text = current + separator + quoted;
    return { text, caret: text.length, inserted: true };
}

/* ── 4. Draft persistence ────────────────────────────────────────────── */

/** Prefix for every per-conversation draft key. */
export const DRAFT_KEY_PREFIX = 'hl.chat.draft.';

/**
 * Storage key for a thread's draft.
 *
 * The task specifies `hl.chat.draft.<interactionId>`. A brand-new thread has no
 * interaction id yet (the engine mints one on the first turn), so the
 * deterministic `participant_key` is the fallback and the owning entity id the
 * last resort — a draft must never be silently dropped just because the thread
 * has not produced a message.
 *
 * @param {{ interactionId?: string, interaction_id?: string,
 *   participantKey?: string, participant_key?: string, entityId?: string,
 *   entity_id?: string }|null|undefined} thread
 * @returns {string} '' when no identity is available
 */
export function draftStorageKey(thread) {
    if (!thread) return '';
    const identity = thread.interactionId
        || thread.interaction_id
        || thread.participantKey
        || thread.participant_key
        || thread.entityId
        || thread.entity_id
        || '';
    const trimmed = String(identity).trim();
    return trimmed ? `${DRAFT_KEY_PREFIX}${trimmed}` : '';
}

/**
 * Read a draft. Never throws: `localStorage` can be disabled (private mode,
 * hardened browser), and a composer that dies because storage is unavailable
 * would be worse than one without drafts.
 *
 * @param {Storage|undefined} storage
 * @param {string} key
 * @returns {string}
 */
export function loadDraft(storage, key) {
    if (!storage || !key) return '';
    try {
        const value = storage.getItem(key);
        return typeof value === 'string' ? value : '';
    } catch {
        return '';
    }
}

/**
 * Persist a draft (or remove the key when the text is blank).
 *
 * A blank composer means "no draft"; keeping an empty string around would make
 * the key exist forever and defeat any future pruning.
 *
 * @param {Storage|undefined} storage
 * @param {string} key
 * @param {string} text
 * @returns {boolean} true when the write (or removal) succeeded
 */
export function saveDraft(storage, key, text) {
    if (!storage || !key) return false;
    const value = String(text ?? '');
    try {
        if (!value) {
            storage.removeItem(key);
            return true;
        }
        storage.setItem(key, value.slice(0, MAX_DRAFT_LENGTH));
        return true;
    } catch {
        // Quota exceeded or storage disabled — the composer keeps working.
        return false;
    }
}

/** Remove a thread's draft (after a successful send). */
export function clearDraft(storage, key) {
    if (!storage || !key) return false;
    try {
        storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

/* ── 5. Disabled composer ────────────────────────────────────────────── */

/**
 * Why the composer cannot send, in priority order.
 *
 * `aiDisabled` wins over `offline`: a switched-off partner could not answer
 * even with a perfect connection, and that is the more useful explanation. The
 * detail view already replaces the whole composer with a banner for that case
 * (Task 02-5); this still reports it so the placeholder is right if the composer
 * is ever rendered beside the banner.
 *
 * @param {{ aiDisabled?: boolean, connected?: boolean, recording?: boolean }} state
 * @returns {{ disabled: boolean, reason: 'aiDisabled'|'offline'|null }}
 */
export function composerState(state = {}) {
    if (state.aiDisabled) return { disabled: true, reason: 'aiDisabled' };
    if (state.connected === false) return { disabled: true, reason: 'offline' };
    return { disabled: false, reason: null };
}

/**
 * i18n suffix for a composer reason, so the view does not re-derive the mapping.
 * @param {'aiDisabled'|'offline'|null} reason
 * @returns {'disabled'|'offline'|'normal'}
 */
export function placeholderKeyFor(reason) {
    if (reason === 'aiDisabled') return 'disabled';
    if (reason === 'offline') return 'offline';
    return 'normal';
}

/* ── 6. Send-on-Enter hint ───────────────────────────────────────────── */

/** `localStorage` key remembering that the Enter/Shift+Enter hint was shown. */
export const ENTER_HINT_STORAGE_KEY = 'hl.chat.input.enterHintDismissed';

/**
 * Whether the send-on-Enter hint should be visible.
 *
 * Shown the FIRST time only: once dismissed (on the first send, or by hand) the
 * key is set and the line never returns — a permanent hint under every composer
 * is furniture, not help.
 *
 * @param {Storage|undefined} storage
 * @returns {boolean}
 */
export function shouldShowEnterHint(storage) {
    if (!storage) return false;
    try {
        return storage.getItem(ENTER_HINT_STORAGE_KEY) !== '1';
    } catch {
        return false;
    }
}

/** Remember that the hint has been seen. */
export function dismissEnterHint(storage) {
    if (!storage) return false;
    try {
        storage.setItem(ENTER_HINT_STORAGE_KEY, '1');
        return true;
    } catch {
        return false;
    }
}

/**
 * Should a keydown send the message?
 *
 * Enter sends; Shift+Enter (and every other modifier) inserts a newline. IME
 * composition must never send — `e.isComposing` / keyCode 229 is how a
 * Japanese/Chinese candidate list is confirmed, and sending there would fire a
 * half-typed message on every selection.
 *
 * @param {{ key?: string, shiftKey?: boolean, ctrlKey?: boolean,
 *   altKey?: boolean, metaKey?: boolean, isComposing?: boolean,
 *   keyCode?: number }} event
 * @returns {boolean}
 */
export function isSendKey(event) {
    if (!event) return false;
    if (event.isComposing || event.keyCode === 229) return false;
    if (event.key !== 'Enter') return false;
    return !(event.shiftKey || event.ctrlKey || event.altKey || event.metaKey);
}
