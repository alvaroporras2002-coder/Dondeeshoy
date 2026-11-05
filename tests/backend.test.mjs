import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleApi, validateEvent } from '../worker/api.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_dondeeshoy.sql', import.meta.url), 'utf8'));
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            first: async () => statement.get(...values) || null,
            all: async () => ({ results: statement.all(...values) }),
            run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}
function browser(env) {
  let cookie = '';
  return async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
    const headers = { origin: 'https://example.test', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra };
    if (cookie) headers.cookie = cookie;
    const response = await handleApi(new Request('https://example.test' + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
}
const futureDate = () => { const date = new Date(); date.setUTCDate(date.getUTCDate() + 2); return date.toISOString().slice(0, 10); };
const validEvent = () => ({ title: 'Una buena noche', venue: 'Patio de prueba', zone: 'Heredia', category: 'envivo', date: futureDate(), time: '20:00', price: 6000, description: 'Música y buena compañía en el centro.', lat: 9.99, lng: -84.12, imageData: '', groupEligible: true });

test('event validation rejects invalid dates, coordinates, prices and active image formats', () => {
  assert.equal(validateEvent(validEvent()).price, 6000);
  for (const patch of [{ date: '2026-02-31' }, { date: '2020-01-01' }, { time: '29:00' }, { lat: 50 }, { lng: 0 }, { price: -5 }, { price: 1.5 }, { price: 0, groupEligible: true }, { groupEligible: 'true' }, { imageData: 'data:image/svg+xml;base64,PHN2Zz4=' }]) {
    assert.throws(() => validateEvent({ ...validEvent(), ...patch }));
  }
});

test('same-day validation uses Costa Rica time and rejects elapsed or current start times', () => {
  const now = new Date('2026-11-05T20:00:00Z'); // 14:00 in Costa Rica.
  const event = { ...validEvent(), date: '2026-11-05' };
  assert.throws(() => validateEvent({ ...event, time: '13:59' }, now), /horario/);
  assert.throws(() => validateEvent({ ...event, time: '14:00' }, now), /horario/);
  assert.equal(validateEvent({ ...event, time: '14:01' }, now).time, '14:01');
});

test('event API persists and lists only unverified records; rejects cross-origin and malformed writes', async () => {
  const db = database(), client = browser({ DB: db });
  const result = await client('/api/events', validEvent());
  assert.equal(result.status, 201);
  assert.equal(result.body.event.verified, false);
  assert.equal(result.body.event.source, 'community');
  assert.match(result.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  const list = await client('/api/events');
  assert.equal(list.body.events.length, 1);
  assert.equal(list.body.events[0].title, 'Una buena noche');
  assert.equal('creator_session_hash' in list.body.events[0], false);
  assert.equal((await client('/api/events', validEvent(), 'POST', { origin: 'https://attacker.test' })).status, 403);
  assert.equal((await client('/api/events', null)).status, 400);
  assert.equal((await client('/api/events', validEvent(), 'POST', { 'Content-Type': 'text/plain' })).status, 415);
  db.sqlite.close();
});

test('one host plus exactly four different sessions qualifies; duplicates, overflow and host removal fail', async () => {
  const db = database(), env = { DB: db }, host = browser(env);
  const create = await host('/api/groups', { eventId: 'demo-sunset', eventTitle: 'An untrusted title', hostName: 'Álvaro' });
  assert.equal(create.status, 201);
  const groupId = create.body.group.id;
  assert.equal(create.body.group.eventTitle, 'Sunset Beats & Rooftop Sessions');
  assert.equal(create.body.group.isHost, true);
  assert.equal(create.body.group.memberCount, 1);
  assert.equal(create.body.group.discountEligible, false);
  assert.equal((await host(`/api/groups/${groupId}/join`, { name: 'Otra vez' })).status, 409);
  const friends = Array.from({ length: 4 }, () => browser(env));
  for (let i = 0; i < friends.length; i++) {
    const join = await friends[i](`/api/groups/${groupId}/join`, { name: `Compa ${i + 1}` });
    assert.equal(join.status, 200);
    assert.equal(join.body.group.discountEligible, i === 3);
    assert.equal(join.body.group.isHost, false);
    assert.equal(join.body.group.isMember, true);
    assert.equal(JSON.stringify(join.body.group).includes('session_hash'), false);
  }
  const overflow = await browser(env)(`/api/groups/${groupId}/join`, { name: 'Llegué tarde' });
  assert.equal(overflow.status, 409);
  assert.equal((await host(`/api/groups/${groupId}/membership`, undefined, 'DELETE')).status, 409);
  const leave = await friends[0](`/api/groups/${groupId}/membership`, undefined, 'DELETE');
  assert.equal(leave.status, 200);
  assert.equal(leave.body.group.discountEligible, false);
  assert.equal(leave.body.group.friendsConfirmed, 3);
  assert.equal(leave.body.group.isMember, false);
  const replace = await browser(env)(`/api/groups/${groupId}/join`, { name: 'Nuevo compa' });
  assert.equal(replace.status, 200);
  assert.equal(replace.body.group.memberCount, 5);
  const get = await host(`/api/groups/${groupId}`);
  assert.equal(get.body.group.isHost, true);
  db.sqlite.close();
});

test('free, ineligible or invented events cannot create benefit groups', async () => {
  const db = database(), client = browser({ DB: db });
  for (const [eventId, status] of [['demo-mesa', 400], ['demo-risas', 400], ['invented-event', 404]]) {
    assert.equal((await client('/api/groups', { eventId, eventTitle: 'Invented', hostName: 'Host' })).status, status);
  }
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM groups').get().total, 0);
  db.sqlite.close();
});

test('competing confirmations cannot overfill a group', async () => {
  const db = database(), env = { DB: db }, host = browser(env);
  const created = await host('/api/groups', { eventId: 'demo-sunset', hostName: 'Host de prueba' });
  const id = created.body.group.id;
  const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => browser(env)(`/api/groups/${id}/join`, { name: `Compa ${index}` })));
  assert.equal(responses.filter(response => response.status === 200).length, 4);
  assert.equal(responses.filter(response => response.status === 409).length, 4);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS total FROM group_members WHERE group_id = ?').get(id).total, 5);
  db.sqlite.close();
});

test('expired community events cannot create or accept group confirmations', async () => {
  const db = database(), env = { DB: db }, host = browser(env);
  const createdEvent = await host('/api/events', validEvent());
  const eventId = createdEvent.body.event.id;
  const createdGroup = await host('/api/groups', { eventId, hostName: 'Host' });
  assert.equal(createdGroup.status, 201);
  const groupId = createdGroup.body.group.id;
  db.sqlite.prepare('UPDATE community_events SET event_date = ?, event_time = ? WHERE id = ?').run('2000-01-01', '12:00', eventId);
  const group = await host(`/api/groups/${groupId}`);
  assert.equal(group.body.group.expired, true);
  assert.equal(group.body.group.discountEligible, false);
  assert.equal((await browser(env)(`/api/groups/${groupId}/join`, { name: 'Compa' })).status, 409);
  assert.equal((await host('/api/groups', { eventId, hostName: 'Host' })).status, 400);
  db.sqlite.close();
});

test('database failure returns an error without claiming a saved event', async () => {
  const response = await browser({ DB: { prepare() { throw new Error('Offline database'); } } })('/api/events', validEvent());
  assert.equal(response.status, 500);
  assert.ok(response.body.error);
  assert.equal('event' in response.body, false);
  const unavailable = await browser({})('/api/health');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.persistent, false);
});
