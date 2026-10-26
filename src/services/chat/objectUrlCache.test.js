import test from 'node:test';
import assert from 'node:assert/strict';

import {
    acquireObjectUrl,
    hasObjectUrl,
    objectUrlEntryCount,
    objectUrlRefCount,
    releaseObjectUrl,
    resetObjectUrls,
    retainObjectUrl,
    revokeAllObjectUrls,
    setObjectUrlApi,
} from './objectUrlCache.js';

/**
 * A fake `URL` implementation that records creations and revocations, so the
 * tests can assert on the EXACT lifecycle instead of on `entries` bookkeeping.
 * Bookkeeping can be right while the browser handle leaks (a URL created and
 * never revoked), which is the actual acceptance criterion.
 */
function fakeUrlApi() {
    let next = 1;
    const created = [];
    const revoked = [];
    return {
        created,
        revoked,
        createObjectURL: () => {
            const url = `blob:fake/${next}`;
            next += 1;
            created.push(url);
            return url;
        },
        revokeObjectURL: (url) => { revoked.push(url); },
        live: () => created.filter((url) => !revoked.includes(url)),
    };
}

function setup() {
    resetObjectUrls();
    const api = fakeUrlApi();
    setObjectUrlApi(api);
    return api;
}

function teardown() {
    resetObjectUrls();
    setObjectUrlApi(null);
}

// ── Single holder ───────────────────────────────────────────────────────

test('a fetch is cached and revoked when its only holder releases', async () => {
    const api = setup();
    let fetches = 0;
    const url = await acquireObjectUrl('image', 'm1', async () => {
        fetches += 1;
        return api.createObjectURL();
    });

    assert.ok(url);
    assert.equal(fetches, 1);
    assert.equal(objectUrlRefCount('image', 'm1'), 1);
    assert.equal(hasObjectUrl('image', 'm1'), true);

    assert.equal(releaseObjectUrl('image', 'm1'), true);
    assert.deepEqual(api.live(), [], 'the blob handle must be released');
    assert.equal(hasObjectUrl('image', 'm1'), false);
    assert.equal(objectUrlEntryCount(), 0);
    teardown();
});

test('releasing with no holder left is a no-op, not a crash', () => {
    setup();
    assert.equal(releaseObjectUrl('image', 'never-fetched'), false);
    assert.equal(releaseObjectUrl('image', 'm1'), false);
    assert.equal(releaseObjectUrl(undefined, 'm1'), false);
    teardown();
});

// ── Multiple holders (the thumbnail + lightbox case) ────────────────────

test('two holders share ONE blob and it survives the first release', async () => {
    const api = setup();
    let fetches = 0;
    const load = async () => {
        fetches += 1;
        return api.createObjectURL();
    };

    const first = await acquireObjectUrl('image', 'm1', load);
    const second = await acquireObjectUrl('image', 'm1', load);

    assert.equal(fetches, 1, 'the blob must not be downloaded twice');
    assert.equal(first, second);
    assert.equal(objectUrlRefCount('image', 'm1'), 2);

    // The thumbnail unmounts while the lightbox is still open.
    assert.equal(releaseObjectUrl('image', 'm1'), false);
    assert.deepEqual(api.revoked, [], 'the lightbox still needs these bytes');
    assert.equal(hasObjectUrl('image', 'm1'), true);

    // The lightbox closes.
    assert.equal(releaseObjectUrl('image', 'm1'), true);
    assert.deepEqual(api.revoked, [first]);
    teardown();
});

test('retainObjectUrl balances a release without a second fetch', async () => {
    const api = setup();
    const url = await acquireObjectUrl('image', 'm1', async () => api.createObjectURL());

    assert.equal(retainObjectUrl('image', 'm1'), url);
    assert.equal(objectUrlRefCount('image', 'm1'), 2);

    assert.equal(releaseObjectUrl('image', 'm1'), false);
    assert.equal(releaseObjectUrl('image', 'm1'), true);
    assert.deepEqual(api.revoked, [url]);
    teardown();
});

test('retainObjectUrl on an unknown entry returns null and counts nothing', () => {
    setup();
    assert.equal(retainObjectUrl('image', 'gone'), null);
    assert.equal(objectUrlRefCount('image', 'gone'), 0);
    // A lightbox that retained nothing must not drive the count negative when
    // it closes.
    assert.equal(releaseObjectUrl('image', 'gone'), false);
    teardown();
});

// ── Concurrency ─────────────────────────────────────────────────────────

test('concurrent acquires join ONE in-flight fetch', async () => {
    const api = setup();
    let fetches = 0;
    let resolveFetch;
    const gate = new Promise((resolve) => { resolveFetch = resolve; });
    const load = async () => {
        fetches += 1;
        await gate;
        return api.createObjectURL();
    };

    const a = acquireObjectUrl('image', 'm1', load);
    const b = acquireObjectUrl('image', 'm1', load);
    // Both callers are waiting on the same promise; let it settle.
    resolveFetch();
    const [urlA, urlB] = await Promise.all([a, b]);

    assert.equal(fetches, 1);
    assert.equal(urlA, urlB);
    assert.equal(objectUrlRefCount('image', 'm1'), 2);
    teardown();
});

test('an unmount during the fetch revokes immediately instead of caching', async () => {
    // This is the scroll-fast case: the bubble mounts, its fetch is in flight,
    // the render window slides and it unmounts before the bytes arrive. Caching
    // the URL would leak it for the window's lifetime.
    const api = setup();
    let resolveFetch;
    const gate = new Promise((resolve) => { resolveFetch = resolve; });
    const pending = acquireObjectUrl('image', 'm1', async () => {
        await gate;
        return api.createObjectURL();
    });

    // The cleanup runs before the fetch resolves.
    releaseObjectUrl('image', 'm1');
    resolveFetch();
    const url = await pending;

    assert.equal(url, null, 'nothing came back for a holder that left');
    assert.equal(api.created.length, 1);
    assert.deepEqual(api.revoked, api.created, 'the created URL must be revoked');
    assert.equal(objectUrlEntryCount(), 0);
    teardown();
});

// ── Failure ─────────────────────────────────────────────────────────────

test('a failed fetch caches nothing and can be retried', async () => {
    const api = setup();
    const first = await acquireObjectUrl('image', 'm1', async () => null);
    assert.equal(first, null);
    assert.equal(hasObjectUrl('image', 'm1'), false);
    assert.equal(objectUrlEntryCount(), 0);

    // A retry after a failure actually retries.
    const second = await acquireObjectUrl('image', 'm1', async () => api.createObjectURL());
    assert.ok(second);
    assert.equal(objectUrlRefCount('image', 'm1'), 1);
    teardown();
});

test('a throwing fetch is swallowed and reported as null', async () => {
    setup();
    const url = await acquireObjectUrl('image', 'm1', async () => {
        throw new Error('network down');
    });
    assert.equal(url, null);
    assert.equal(objectUrlEntryCount(), 0);
    teardown();
});

test('an empty message id never touches the registry', async () => {
    const api = setup();
    let fetches = 0;
    const url = await acquireObjectUrl('image', '', async () => {
        fetches += 1;
        return api.createObjectURL();
    });
    assert.equal(url, null);
    assert.equal(fetches, 0);
    teardown();
});

// ── Kinds are independent ───────────────────────────────────────────────

test('audio and image entries for one message are separate', async () => {
    const api = setup();
    const image = await acquireObjectUrl('image', 'm1', async () => api.createObjectURL());
    const audio = await acquireObjectUrl('audio', 'm1', async () => api.createObjectURL());

    assert.notEqual(image, audio);
    assert.equal(releaseObjectUrl('image', 'm1'), true);
    // The audio hold is untouched by the image release.
    assert.equal(objectUrlRefCount('audio', 'm1'), 1);
    assert.equal(hasObjectUrl('audio', 'm1'), true);
    teardown();
});

// ── Teardown ────────────────────────────────────────────────────────────

test('revokeAllObjectUrls releases everything and reports the count', async () => {
    const api = setup();
    await acquireObjectUrl('image', 'm1', async () => api.createObjectURL());
    await acquireObjectUrl('image', 'm2', async () => api.createObjectURL());
    await acquireObjectUrl('audio', 'm3', async () => api.createObjectURL());

    assert.equal(objectUrlEntryCount(), 3);
    assert.equal(revokeAllObjectUrls(), 3);
    assert.deepEqual(api.live(), []);
    assert.equal(objectUrlEntryCount(), 0);
    teardown();
});

test('scrolling a long thread leaves no live blob behind', async () => {
    // The acceptance criterion, expressed directly: mount and unmount 200 image
    // bubbles (the render window sliding through a long thread) and assert the
    // browser holds ZERO live object URLs at the end.
    const api = setup();
    for (let i = 0; i < 200; i += 1) {
        const id = `msg-${i}`;
        await acquireObjectUrl('image', id, async () => api.createObjectURL());
        releaseObjectUrl('image', id);
    }
    assert.equal(api.created.length, 200, 'every mount fetched once');
    assert.deepEqual(api.live(), [], 'no memory growth: nothing left unrevoked');
    assert.equal(objectUrlEntryCount(), 0);
    teardown();
});

test('scrolling back to a still-held message reuses its blob', async () => {
    // A message that stays mounted (it is being read) must not be re-fetched
    // when a neighbour scrolls in: the cache is what keeps scroll-back cheap.
    const api = setup();
    let fetches = 0;
    const load = async () => {
        fetches += 1;
        return api.createObjectURL();
    };

    await acquireObjectUrl('image', 'kept', load);
    await acquireObjectUrl('image', 'scrolled', load);
    releaseObjectUrl('image', 'scrolled');
    await acquireObjectUrl('image', 'kept', load);

    assert.equal(fetches, 2, 'the held message was not downloaded again');
    assert.equal(objectUrlRefCount('image', 'kept'), 2);
    teardown();
});
