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
const { activityPoints, awardsForRecord, pointsForAward } = require('../app/lib/activityPoints');

test('points only total badges and achievements across activity types', () => {
  const runs = [
    { id: 'walk', type: 'chůze', km: 1, timestamp: '2026-11-01T23:30:00Z' },
    { id: 'run', type: 'běh', km: 10, timestamp: '2026-11-02T06:00:00Z' },
    { id: 'next', type: 'běh', km: 90, timestamp: '2026-11-03T12:00:00Z' },
    { id: 'future', type: 'běh', km: 200, timestamp: '2026-12-01T12:00:00Z' },
    { id: 'deleted', type: 'běh', km: 150, deleting: true, timestamp: '2026-11-03T12:00:00Z' },
    { id: 'invalid', type: 'kliky', km: 0, repetitions: 0, timestamp: '2026-11-03T12:00:00Z' },
  ];
  const score = activityPoints([...runs, runs[1]], Date.parse('2026-11-25T12:00:00Z'));
  assert.equal(score.badges, 2);
  assert.equal(score.badgePoints, 4);
  assert.equal(score.achievements, 6);
  assert.equal(score.achievementPoints, 80);
  assert.equal(score.total, 84);
  assert.equal(score.level, 3);
  assert.equal(score.nextLevelAt, 120);
});

test('levels start at one and switch on the exact point threshold', () => {
  assert.equal(activityPoints([]).level, 1);
  const runs = Array.from({ length: 5 }, (_, index) => ({
    id: String(index), type: index === 0 ? 'chůze' : 'běh', km: 0.1,
    timestamp: new Date(Date.UTC(2026, 0, index + 1, 6)),
  }));
  const before = activityPoints(runs.slice(0, -1), Date.UTC(2026, 11, 1));
  const after = activityPoints(runs, Date.UTC(2026, 11, 1));
  assert.equal(before.total, 18);
  assert.equal(before.level, 1);
  assert.equal(after.total, 20);
  assert.equal(after.level, 2);
});

test('records earn repeatable badges and only the milestones they cross', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const first = { id: 'first', km: 6, timestamp: '2026-11-01T12:00:00Z' };
  const threshold = { id: 'threshold', km: 4, timestamp: '2026-11-02T06:00:00Z' };
  const later = { id: 'later', km: 1, timestamp: '2026-11-03T12:00:00Z' };
  const runs = [later, threshold, first, threshold];
  const gain = id => awardsForRecord(runs, id, now).map(award => [award.id, award.count * pointsForAward(award)]);
  assert.deepEqual(gain('first'), [['first', 5]]);
  assert.deepEqual(gain('threshold'), [['km10', 10], ['morning', 2]]);
  assert.deepEqual(gain('later'), []);
  assert.equal(awardsForRecord(runs, 'missing', now), null);
  assert.equal(gain('first').concat(gain('threshold'), gain('later')).reduce((sum, [, points]) => sum + points, 0), activityPoints(runs, now).total);
});

test('milestone attribution is stable for equal timestamps and follows an edited history', () => {
  const timestamp = '2026-11-02T12:00:00Z';
  const a = { id: 'a', km: 6, timestamp }, b = { id: 'b', km: 4, timestamp };
  const now = Date.parse('2026-11-25T12:00:00Z');
  assert.deepEqual(awardsForRecord([b, a], 'b', now).map(award => award.id), ['km10']);
  assert.deepEqual(awardsForRecord([{ ...a, km: 10 }, b], 'b', now), []);
});
