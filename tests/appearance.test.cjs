const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  module._compile(outputText, filename);
};

const { normalizeAppearance, timePeriod, weatherPalette } = require('../app/lib/appearance');

test('appearance normalizes older stored themes and validates custom colors', () => {
  assert.deepEqual(normalizeAppearance({ theme: 'white', customColor: '#892002', gradientEnabled: false }), {
    theme: 'light', customColor: '#892002', gradientEnabled: false,
  });
  assert.deepEqual(normalizeAppearance({ theme: 'unknown', customColor: '#invalid' }), {
    theme: 'default', customColor: '#36D1DC', gradientEnabled: true,
  });
});

test('time and weather palettes distinguish day, night, and changing conditions', () => {
  assert.deepEqual([0, 5, 7, 10, 13, 16, 19, 22].map(timePeriod),
    ['noc', 'svitani', 'rano', 'dopoledne', 'odpoledne', 'zapad', 'soumrak', 'noc']);
  const current = (type, isDay, wind) => ({ isDay, weatherCondition: { type }, wind: { speed: { value: wind } } });
  assert.equal(weatherPalette(current('CLOUDY', true, 16), 12), 'cloudy');
  assert.equal(weatherPalette(current('CLOUDY', false, 16), 12), 'cloudy-night');
  assert.equal(weatherPalette(current('SNOW', true, 10), 5), 'snow');
  assert.equal(weatherPalette(current('RAIN', false, 28), 12), 'rain-night');
  assert.equal(weatherPalette(current('CLEAR', undefined, 0), 22), 'night');
  assert.equal(weatherPalette(current('CLEAR', true, 30), 12), 'wind');
  assert.equal(weatherPalette(current('THUNDERSTORM', true, 44), 12), 'storm');
  assert.equal(weatherPalette({}, 12), null);
});
