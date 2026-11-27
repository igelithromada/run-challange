const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { activityPoints, runningDistancePoints } = require('../app/lib/activityPoints');
const { RUN_POINTS, parseRunningPointsConfig } = require('../app/lib/runningPointsConfig');

const monday = Date.UTC(2026, 10, 23, 12);
const day = 86_400_000;
const record = (id, km, timestamp = monday, type = 'běh') => ({ id, km, timestamp: new Date(timestamp), type });
const week = distances => distances.map((km, i) => record(String(i), km, monday + i * day));

test('distance and weekly regularity match the agreed examples', () => {
  assert.deepEqual([1, 2, 5, 10, 20, 30].map(km => runningDistancePoints(km)), [5, 10, 27, 58, 133, 200]);
  for (const [distances, expected] of [
    [[1], 5], [[5], 27], [[5, 5], 59], [[10], 58], [[2, 2, 2, 2, 2], 56],
    [[20], 133], [[5, 5, 5, 5], 128], [[20, 20], 271], [[5, 5, 5, 5, 5, 5, 5], 269],
  ]) assert.equal(activityPoints(week(distances), monday + 6 * day).total, expected);
});

test('splitting one day never grants five daily bonuses and contribution sums stay exact', () => {
  const sameDay = Array.from({ length: 5 }, (_, i) => record(String(i), 2, monday + day + i * 1000));
  const score = activityPoints([record('first', 1), ...sameDay], monday + day + 6000);
  assert.equal(score.total, 60);
  assert.equal(score.records.get('first').consistencyPoints, 0);
  assert.equal(score.consistencyPoints, 5);
  assert.equal(score.records.get('0').consistencyPoints, 1);
  assert.equal(score.records.get('1').consistencyPoints, 2);
  assert.equal([...score.records.values()].reduce((sum, run) => sum + run.distancePoints + run.consistencyPoints, 0), 60);
});

test('full 30-day gaps compound and a return adds new points without restoring losses', () => {
  const runs = [record('old', 20)];
  for (const [elapsed, result] of [[29, 133], [30, 120], [59, 120], [60, 108], [90, 97]]) {
    const score = activityPoints(runs, monday + elapsed * day);
    assert.equal(score.total, result);
    assert.equal(score.deducted, 133 - result);
  }
  const returned = [...runs, record('return', 5, monday + 60 * day)];
  assert.equal(activityPoints(returned, monday + 60 * day).total, 135);
  assert.equal(activityPoints(returned, monday + 89 * day).total, 135);
  assert.equal(activityPoints(returned, monday + 90 * day).total, 121);
  assert.equal(activityPoints([record('tiny', 1)], monday + 900 * day).total, 0);
});

test('weeks reset at Prague midnight and ignore duplicate, future, deleted and non-running records', () => {
  const sunday = Date.parse('2026-11-22T22:50:00Z');
  const nextMonday = sunday + 20 * 60_000;
  const prior = [-3, -2, -1].map(i => record('earlier' + i, 5, sunday + i * day));
  const a = record('sunday', 5, sunday);
  const b = record('monday', 5, nextMonday);
  const score = activityPoints([
    b, a, ...prior, a, record('walk', 5, sunday, 'chůze'), record('short', 0.9, sunday),
    { ...record('deleted', 12, sunday), deleting: true }, record('future', 1, nextMonday + day),
  ], nextMonday);
  assert.equal(score.records.size, 5);
  assert.equal(score.records.get('sunday').consistencyPoints, 10);
  assert.equal(score.records.get('monday').consistencyPoints, 0);
  assert.equal(score.level, 2);
  assert.equal(score.nextLevelAt, 300);
});

test('configured rates affect history, deductions, and levels while day one stays at zero', () => {
  const rules = { ...RUN_POINTS, perKm: 10, weeklyBonuses: [0, 3, 5, 10, 15, 20, 25],
    inactivityPercent: 0, levelFactor: 25 };
  assert.deepEqual(parseRunningPointsConfig(rules), rules);
  const runs = week([5, 5]);
  const score = activityPoints(runs, monday + 90 * day, rules);
  assert.equal(score.total, 111);
  assert.equal(score.records.get('0').consistencyPoints, 0);
  assert.equal(score.records.get('1').consistencyPoints, 3);
  assert.equal(score.deducted, 0);
  assert.equal(score.levelStart, 50);
  assert.equal(score.nextLevelAt, 150);
  for (const invalid of [
    { distanceDivisor: 0 }, { inactivityPercent: 101 }, { weeklyBonuses: [1, 3, 5, 10, 15, 20, 25] }, { weeklyBonuses: [0, 3] },
  ]) assert.equal(parseRunningPointsConfig({ ...rules, ...invalid }), null);
});

test('the scoring settings API serves defaults, restricts changes to admins, and persists valid settings', async () => {
  const vm = require('node:vm');
  let saved = null;
  const adminDb = { doc: path => {
    assert.equal(path, 'appSettings/runningPoints');
    return {
      get: async () => ({ exists: saved !== null, data: () => saved }),
      set: async rules => { saved = rules; },
    };
  }};
  const requireAccess = (request, adminOnly) => {
    const role = request.headers.get('authorization');
    if (!role) throw new Error('unauthorized');
    if (adminOnly && role !== 'admin') throw new Error('forbidden');
    return { adminDb };
  };
  const { outputText } = ts.transpileModule(fs.readFileSync('app/api/running-points/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  vm.runInNewContext(outputText, { exports: mod.exports, console, require: name => {
    if (name === '../../lib/apiAuth') return {
      requireUser: request => requireAccess(request, false),
      requireAdmin: request => requireAccess(request, true),
      authErrorResponse: error => ({ status: error.message === 'forbidden' ? 403 : 401, message: error.message }),
    };
    if (name === '../../lib/runningPointsConfig') return require('../app/lib/runningPointsConfig');
    return require(name);
  }});
  const { GET, PATCH } = mod.exports;
  const request = (role, body) => new Request('https://example.test/api/running-points', {
    headers: role ? { authorization: role } : {},
    ...(body ? { method: 'PATCH', body: JSON.stringify(body) } : {}),
  });
  assert.equal((await GET(request())).status, 401);
  assert.deepEqual((await (await GET(request('member'))).json()).rules, RUN_POINTS);
  const edited = { ...RUN_POINTS, weeklyBonuses: [0, 3, 5, 10, 15, 20, 25] };
  assert.equal((await PATCH(request('member', edited))).status, 403);
  assert.equal((await PATCH(request('admin', { ...edited, inactivityDays: 0 }))).status, 400);
  assert.equal(saved, null);
  assert.equal((await PATCH(request('admin', edited))).status, 200);
  assert.deepEqual((await (await GET(request('member'))).json()).rules, edited);
});
