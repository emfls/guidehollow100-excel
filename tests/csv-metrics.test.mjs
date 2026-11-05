import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvent, initMetrics, track } from '../public/tools/csv-compare/metrics.mjs';

test('event whitelist drops file contents, filenames, identifiers, amounts, and arbitrary messages', () => {
  assert.equal(buildEvent('page_view', {}), null);
  assert.equal(buildEvent('user@example.com', {}), null);
  assert.deepEqual(buildEvent('compare_complete', {mode:'files', has_review:true,
    filename:'private.csv', key:'account-123', amount:100, message:'private error', reason:'other'}),
  {name:'compare_complete', params:{mode:'files', reason:'other', has_review:true}});
  assert.deepEqual(buildEvent('tool_feedback', {reason:'helpful', stage:'file'}),
    {name:'tool_feedback', params:{reason:'helpful', stage:'file'}});
});

test('unsafe enum values and coerced booleans never enter analytics events', () => {
  assert.deepEqual(buildEvent('file_ready', {mode:'my-private-file', reason:'<script>',
    stage:'user@example.com', has_review:'true'}), {name:'file_ready', params:{}});
  assert.deepEqual(buildEvent('tool_sample', null), {name:'tool_sample', params:{}});
});

function browser(preference = null, qa = false, blockedStorage = false) {
  const appended = [];
  const cookies = [];
  const elements = Object.fromEntries(['metrics-allow','metrics-deny','metrics-status'].map(id =>
    [id, {textContent:'', addEventListener(_name, callback) { this.click = callback; }}]));
  globalThis.window = {location:{origin:'https://sheet.example.com', pathname:'/tools/csv-compare/', hostname:'sheet.example.com'},
    localStorage:{getItem() {if (blockedStorage) throw Error('blocked'); return preference;},
      setItem(_key, value) {if (blockedStorage) throw Error('blocked'); preference = value;}}};
  globalThis.document = {referrer:'https://ref.example.com/private?email=secret#token',
    getElementById(id) {return elements[id] || appended.find(item => item.id === id) || null;},
    createElement() {return {};}, head:{appendChild(item) {appended.push(item);}},
    set cookie(value) {cookies.push(value);}};
  initMetrics({measurementId:'G-TEST123', qa});
  return {appended, cookies, elements, events:() => window.dataLayer?.map(args => [...args]) || []};
}

test('default consent sends nothing; allow configures sanitized page fields and future events only', () => {
  const env = browser();
  track('file_ready', {mode:'files'});
  assert.equal(env.appended.length, 0);
  assert.deepEqual(env.events(), []);
  env.elements['metrics-allow'].click();
  assert.equal(env.appended.length, 1);
  const config = env.events().find(event => event[0] === 'config')[2];
  assert.equal(config.page_location, 'https://sheet.example.com/tools/csv-compare/');
  assert.equal(config.page_referrer, 'https://ref.example.com');
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.deepEqual(env.events().find(event => event[0] === 'consent' && event[1] === 'update')[2],
    {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
  assert.equal(env.events().filter(event => event[1] === 'file_ready').length, 0);
  track('file_ready', {mode:'files', filename:'secret.csv'});
  assert.deepEqual(env.events().at(-1), ['event', 'file_ready', {mode:'files'}]);
  env.elements['metrics-allow'].click();
  assert.equal(env.appended.length, 1);
  assert.equal(env.events().filter(event => event[1] === 'page_view').length, 1);
});

test('revocation disables this stream, clears its cookies, and blocks further tracking', () => {
  const env = browser('granted');
  env.elements['metrics-deny'].click();
  assert.equal(window['ga-disable-G-TEST123'], true);
  assert.ok(env.cookies.some(cookie => cookie.startsWith('_ga=')));
  assert.ok(env.cookies.some(cookie => cookie.startsWith('_ga_TEST123=')));
  assert.ok(env.cookies.every(cookie => /^_ga(?:_TEST123)?=/.test(cookie)));
  const count = env.events().length;
  track('compare_complete', {mode:'files'});
  assert.equal(env.events().length, count);
  assert.match(env.elements['metrics-status'].textContent, /새로고침/);
});

test('QA and blocked storage never inject Google scripts or emit events', () => {
  for (const [qa, blocked] of [[true,false], [false,true]]) {
    const env = browser('granted', qa, blocked);
    env.elements['metrics-allow'].click();
    track('tool_sample', {mode:'sample'});
    env.elements['metrics-deny'].click();
    assert.equal(env.appended.length, 0);
    assert.deepEqual(env.events(), []);
  }
  delete globalThis.window;
  delete globalThis.document;
});

test('failed revocation storage still stops events and accurately reports unsaved choice', () => {
  const env = browser('granted');
  window.localStorage.setItem = () => { throw Error('read-only'); };
  env.elements['metrics-deny'].click();
  const count = env.events().length;
  track('tool_feedback', {reason:'helpful'});
  assert.equal(env.events().length, count);
  assert.match(env.elements['metrics-status'].textContent, /저장하지 못/);
  delete globalThis.window;
  delete globalThis.document;
});
