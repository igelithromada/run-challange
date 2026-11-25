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
const { activityPoints } = require('../app/lib/activityPoints');

test('points count Prague calendar days once across activity types and total the existing awards', () => {
  const runs = [
    { id: 'walk', type: 'chůze', km: 1, timestamp: '2026-11-01T23:30:00Z' },
    { id: 'run', type: 'běh', km: 10, timestamp: '2026-11-02T06:00:00Z' },
    { id: 'next', type: 'běh', km: 90, timestamp: '2026-11-03T12:00:00Z' },
    { id: 'future', type: 'běh', km: 200, timestamp: '2026-12-01T12:00:00Z' },
    { id: 'deleted', type: 'běh', km: 150, deleting: true, timestamp: '2026-11-03T12:00:00Z' },
    { id: 'invalid', type: 'kliky', km: 0, repetitions: 0, timestamp: '2026-11-03T12:00:00Z' },
  ];
  const score = activityPoints([...runs, runs[1]], Date.parse('2026-11-25T12:00:00Z'));
  assert.equal(score.activeDays, 2);
  assert.equal(score.dailyPoints, 2);
  assert.equal(score.badges, 2);
  assert.equal(score.badgePoints, 4);
  assert.equal(score.achievements, 6);
  assert.equal(score.achievementPoints, 80);
  assert.equal(score.total, 86);
  assert.equal(score.level, 3);
  assert.equal(score.nextLevelAt, 120);
});

test('levels start at one and switch on the exact point threshold', () => {
  assert.equal(activityPoints([]).level, 1);
  const runs = Array.from({ length: 145 }, (_, index) => ({
    id: String(index), km: 0.001, timestamp: new Date(Date.UTC(2026, 0, index + 1, 12)),
  }));
  const before = activityPoints(runs.slice(0, -1), Date.UTC(2026, 11, 1));
  const after = activityPoints(runs, Date.UTC(2026, 11, 1));
  assert.equal(before.total, 199);
  assert.equal(before.level, 4);
  assert.equal(after.total, 200);
  assert.equal(after.level, 5);
  assert.equal(after.rank.name, 'Sportovec');
});
