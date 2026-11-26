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

const monday = Date.UTC(2026, 10, 23, 12);
const day = 86_400_000;
const record = (id, km, timestamp = monday, type = 'běh') => ({ id, km, timestamp: new Date(timestamp), type });
const week = distances => distances.map((km, i) => record(String(i), km, monday + i * day));

test('distance and weekly regularity match the agreed examples', () => {
  assert.deepEqual([1, 2, 5, 10, 20, 30].map(runningDistancePoints), [5, 10, 27, 58, 133, 200]);
  for (const [distances, expected] of [
    [[1], 6], [[5], 32], [[10], 63], [[2, 2, 2, 2, 2], 57],
    [[20], 138], [[5, 5, 5, 5], 133], [[20, 20], 276], [[5, 5, 5, 5, 5, 5, 5], 274],
  ]) assert.equal(activityPoints(week(distances), monday + 6 * day).total, expected);
});

test('splitting one day never grants five daily bonuses and contribution sums stay exact', () => {
  const runs = Array.from({ length: 5 }, (_, i) => record(String(i), 2, monday + i * 1000));
  const score = activityPoints(runs, monday + 6000);
  assert.equal(score.total, 55);
  assert.equal(score.consistencyPoints, 5);
  assert.equal(score.records.get('0').consistencyPoints, 1);
  assert.equal(score.records.get('1').consistencyPoints, 2);
  assert.equal([...score.records.values()].reduce((sum, run) => sum + run.distancePoints + run.consistencyPoints, 0), 55);
});

test('full 30-day gaps compound and a return adds new points without restoring losses', () => {
  const runs = [record('old', 20)];
  for (const [elapsed, result] of [[29, 138], [30, 124], [59, 124], [60, 112], [90, 101]]) {
    const score = activityPoints(runs, monday + elapsed * day);
    assert.equal(score.total, result);
    assert.equal(score.deducted, 138 - result);
  }
  const returned = [...runs, record('return', 5, monday + 60 * day)];
  assert.equal(activityPoints(returned, monday + 60 * day).total, 144);
  assert.equal(activityPoints(returned, monday + 89 * day).total, 144);
  assert.equal(activityPoints(returned, monday + 90 * day).total, 129);
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
  assert.equal(score.records.get('monday').consistencyPoints, 5);
  assert.equal(score.level, 2);
  assert.equal(score.nextLevelAt, 300);
});
