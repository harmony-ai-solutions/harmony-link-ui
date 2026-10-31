import test from 'node:test';
import assert from 'node:assert/strict';

import {
    acquireCharacterImage,
    characterImageCacheKey,
    characterImageRefCount,
    hasCharacterImage,
    releaseCharacterImage,
    resetCharacterImageCache,
    setObjectUrlApi,
} from './characterImageCache.js';

/**
 * The avatar cache reuses `objectUrlCache`'s reference-counted registry, so the
 * tests assert the two behaviours the inbox actually depends on:
 *
 *  1. N rows naming the SAME profile image share ONE request and ONE URL;
 *  2. the URL survives the first unmount and is revoked when the last holder
 *     leaves (never by a component itself).
 *
 * A fake `URL` records creation/revocation so the assertions are about the
 * browser handles, not just the bookkeeping.
 */
function fakeUrlApi() {
    let next = 1;
    const created = [];
    const revoked = [];
    return {
        created,
        revoked,
        createObjectURL: () => {
            const url = `blob:char/${next}`;
            next += 1;
            created.push(url);
            return url;
        },
        revokeObjectURL: (url) => { revoked.push(url); },
        live: () => created.filter((url) => !revoked.includes(url)),
    };
}

function setup() {
    resetCharacterImageCache();
    const api = fakeUrlApi();
    setObjectUrlApi(api);
    return api;
}

function teardown() {
    resetCharacterImageCache();
    setObjectUrlApi(null);
}

test('the cache key separates profile, primary/specific image and variant', () => {
    assert.equal(
        characterImageCacheKey({ profileId: 'p1' }),
        'p1:primary:thumb'
    );
    assert.equal(
        characterImageCacheKey({ profileId: 'p1', imageId: 'i1', variant: null }),
        'p1:i1:original'
    );
    assert.notEqual(
        characterImageCacheKey({ profileId: 'p1', imageId: 'i1' }),
        characterImageCacheKey({ profileId: 'p1', imageId: 'i1', variant: null })
    );
    assert.equal(characterImageCacheKey({ profileId: '' }), '');
    assert.equal(characterImageCacheKey(), '');
});

test('two rows naming one avatar share one fetch and one URL', async () => {
    const api = setup();
    let fetches = 0;
    const load = async () => {
        fetches += 1;
        return api.createObjectURL();
    };
    const key = characterImageCacheKey({ profileId: 'p1' });

    const first = await acquireCharacterImage(key, load);
    const second = await acquireCharacterImage(key, load);

    assert.equal(fetches, 1, 'the blob is downloaded once per key');
    assert.equal(first, second);
    assert.equal(characterImageRefCount(key), 2);
    assert.equal(hasCharacterImage(key), true);
    teardown();
});

test('concurrent mounts join the same in-flight fetch', async () => {
    const api = setup();
    let fetches = 0;
    let releaseFetch;
    const gate = new Promise((resolve) => { releaseFetch = resolve; });
    const load = async () => {
        fetches += 1;
        await gate;
        return api.createObjectURL();
    };
    const key = characterImageCacheKey({ profileId: 'p1', imageId: 'i1' });

    const a = acquireCharacterImage(key, load);
    const b = acquireCharacterImage(key, load);
    releaseFetch();
    const [urlA, urlB] = await Promise.all([a, b]);

    assert.equal(fetches, 1, 'a second mount must not start a second request');
    assert.equal(urlA, urlB);
    teardown();
});

test('the URL outlives the first unmount and is revoked by the last release', async () => {
    const api = setup();
    const key = characterImageCacheKey({ profileId: 'p1' });
    const url = await acquireCharacterImage(key, async () => api.createObjectURL());
    await acquireCharacterImage(key, async () => api.createObjectURL());

    assert.equal(releaseCharacterImage(key), false, 'one avatar row left');
    assert.deepEqual(api.revoked, [], 'the remaining holder still needs the bytes');
    assert.equal(releaseCharacterImage(key), true, 'the last holder let go');
    assert.deepEqual(api.revoked, [url]);
    assert.equal(hasCharacterImage(key), false);
    assert.equal(characterImageRefCount(key), 0);
    teardown();
});

test('a released image is fetched again on a later mount', async () => {
    const api = setup();
    let fetches = 0;
    const key = characterImageCacheKey({ profileId: 'p1' });
    const load = async () => {
        fetches += 1;
        return api.createObjectURL();
    };

    await acquireCharacterImage(key, load);
    releaseCharacterImage(key);
    await acquireCharacterImage(key, load);

    assert.equal(fetches, 2, 'the cache keeps nothing alive with zero holders');
    teardown();
});

test('an empty key and a failed fetch never touch the registry', async () => {
    const api = setup();
    let fetches = 0;
    const empty = await acquireCharacterImage('', async () => {
        fetches += 1;
        return api.createObjectURL();
    });
    assert.equal(empty, null);
    assert.equal(fetches, 0);

    const key = characterImageCacheKey({ profileId: 'p1' });
    assert.equal(await acquireCharacterImage(key, async () => null), null);
    assert.equal(hasCharacterImage(key), false);

    // A retry after a transient failure actually retries.
    const retried = await acquireCharacterImage(key, async () => api.createObjectURL());
    assert.ok(retried);
    assert.equal(characterImageRefCount(key), 1);
    teardown();
});

test('an unmount during the fetch releases the URL immediately', async () => {
    const api = setup();
    let releaseFetch;
    const gate = new Promise((resolve) => { releaseFetch = resolve; });
    const key = characterImageCacheKey({ profileId: 'p1' });

    const pending = acquireCharacterImage(key, async () => {
        await gate;
        return api.createObjectURL();
    });
    // The row unmounts before the bytes arrive.
    releaseCharacterImage(key);
    releaseFetch();

    assert.equal(await pending, null, 'nothing is handed to a holder that left');
    assert.deepEqual(api.revoked, api.created, 'the created URL is revoked');
    teardown();
});
