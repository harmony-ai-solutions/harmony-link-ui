import test from 'node:test';
import assert from 'node:assert/strict';
import {
    countActiveSessions,
    entityHasActiveSessions,
    filterEntitiesByPresence,
} from './entitySessionUtils.js';

// Wire shape of GET /api/entities/sessions: { [entityId]: [{device_type, handler_id}] }
const sessionsMap = {
    'Alleycat-Annie-2-20260903211838': [
        { device_type: 'phone', handler_id: 'h-1' },
        { device_type: 'plugin', handler_id: 'h-2' },
    ],
    'Claire-20260901120000': [],
};

test('countActiveSessions counts the sessions of an entity', () => {
    assert.equal(countActiveSessions(sessionsMap, 'Alleycat-Annie-2-20260903211838'), 2);
    assert.equal(countActiveSessions(sessionsMap, 'Claire-20260901120000'), 0);
});

test('countActiveSessions is defensive against missing ids and malformed maps', () => {
    assert.equal(countActiveSessions(sessionsMap, 'unknown-entity'), 0);
    assert.equal(countActiveSessions(sessionsMap, null), 0);
    assert.equal(countActiveSessions(sessionsMap, undefined), 0);
    assert.equal(countActiveSessions(null, 'any'), 0);
    assert.equal(countActiveSessions(undefined, 'any'), 0);
    // A malformed (non-array) entry must not throw.
    assert.equal(countActiveSessions({ 'bad-entity': null }, 'bad-entity'), 0);
    assert.equal(countActiveSessions({ 'bad-entity': 'oops' }, 'bad-entity'), 0);
});

test('entityHasActiveSessions is a boolean predicate over countActiveSessions', () => {
    assert.equal(entityHasActiveSessions(sessionsMap, 'Alleycat-Annie-2-20260903211838'), true);
    assert.equal(entityHasActiveSessions(sessionsMap, 'Claire-20260901120000'), false);
    assert.equal(entityHasActiveSessions(sessionsMap, 'unknown'), false);
    assert.equal(entityHasActiveSessions(null, 'unknown'), false);
});

test('filterEntitiesByPresence "all" keeps every entity in order', () => {
    const entities = [
        { id: 'Alleycat-Annie-2-20260903211838', alias: 'Alleycat Annie 2' },
        { id: 'Claire-20260901120000', alias: 'Claire' },
        { id: 'Illumi-20260905130000', alias: 'Illumi' },
    ];
    const result = filterEntitiesByPresence(entities, sessionsMap, 'all');
    assert.deepEqual(result.map(e => e.id), entities.map(e => e.id));
});

test('filterEntitiesByPresence "active" keeps only entities with live sessions', () => {
    const entities = [
        { id: 'Alleycat-Annie-2-20260903211838', alias: 'Alleycat Annie 2' },
        { id: 'Claire-20260901120000', alias: 'Claire' },
        { id: 'Illumi-20260905130000', alias: 'Illumi' },
    ];
    const result = filterEntitiesByPresence(entities, sessionsMap, 'active');
    assert.deepEqual(result.map(e => e.id), ['Alleycat-Annie-2-20260903211838']);
});

test('filterEntitiesByPresence falls back to "all" for unknown filter values', () => {
    const entities = [{ id: 'Alleycat-Annie-2-20260903211838' }];
    assert.equal(filterEntitiesByPresence(entities, sessionsMap, 'nonsense').length, 1);
    assert.equal(filterEntitiesByPresence(entities, sessionsMap, undefined).length, 1);
});

test('filterEntitiesByPresence tolerates null entity list and null map', () => {
    assert.deepEqual(filterEntitiesByPresence(null, sessionsMap, 'active'), []);
    assert.deepEqual(filterEntitiesByPresence([], null, 'active'), []);
    assert.deepEqual(filterEntitiesByPresence(undefined, undefined, 'all'), []);
});
