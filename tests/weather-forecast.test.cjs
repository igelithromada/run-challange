const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const testModule = { exports: {} };
  const requireFile = Module.createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module: testModule, exports: testModule.exports,
    require: name => { if (dependencies[name]) return dependencies[name]; if (name.startsWith(".")) { for (const ext of [".ts", ".tsx"]) { const target = path.resolve(path.dirname(filename), name + ext); if (fs.existsSync(target)) return load(path.relative(path.resolve(__dirname, ".."), target), dependencies, globals); } } return requireFile(name); }, URL, URLSearchParams, Date, Intl, AbortController, Response,
    setTimeout, clearTimeout, console: { ...console, error() {} }, ...globals }, { filename });
  return testModule.exports;
}
const helpers = load('app/lib/weather.ts');
const base = Date.parse('2026-11-17T00:00:00+01:00');
function fixture() {
  const time = Array.from({ length: 49 }, (_, i) => base / 1000 + i * 3600);
  return { current: { time: base / 1000, weather_code: 3, temperature_2m: 4, is_day: 0, precipitation: 0 },
    hourly: { time, weather_code: time.map(() => 61), temperature_2m: time.map(() => 5),
      precipitation: time.map((_, i) => i / 10), precipitation_probability: time.map((_, i) => i), is_day: time.map(() => 1) } };
}
async function apiResult(data, now) {
  class Clock extends Date { static now() { return now; } }
  const api = load('app/api/weather/route.ts', {}, { Date: Clock, fetch: async () => Response.json(data) });
  const response = await api.GET();
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}

test('weather begins at the actual current hour even when the provider current timestamp is old', async () => {
  const now = base + 7.5 * 3600000;
  const { body, status, cache } = await apiResult(fixture(), now);
  assert.equal(status, 200);
  assert.equal(body.hourly[0].interval.startTime, new Date(base + 7 * 3600000).toISOString());
  assert.equal(body.hourly[0].interval.endTime, new Date(base + 8 * 3600000).toISOString());
  assert.equal(body.hourly.length, 24);
  assert.equal(body.fetchedAt, new Date(now).toISOString());
  assert.match(cache, /s-maxage=900/);
  assert.doesNotMatch(cache, /stale-while-revalidate/);
});
test('hourly amount, probability and condition describe the same following interval', async () => {
  const data = fixture();
  data.hourly.weather_code[7] = 3;
  data.hourly.weather_code[8] = 95;
  const { body } = await apiResult(data, base + 7.5 * 3600000);
  assert.equal(body.hourly[0].precipitation.amount, .8);
  assert.equal(body.hourly[0].precipitation.probability.percent, 8);
  assert.equal(body.hourly[0].weatherCondition.type, 'THUNDERSTORM');
  assert.equal(body.current.precipitation.probability.percent, 8);
});
test('high probability does not manufacture rain millimetres; missing quantities remain unknown', async () => {
  const data = fixture(); data.hourly.precipitation[8] = 0; data.hourly.precipitation_probability[8] = 90;
  data.hourly.precipitation[9] = null; data.hourly.precipitation_probability[9] = null;
  const { body } = await apiResult(data, base + 7.5 * 3600000);
  assert.equal(body.hourly[0].precipitation.amount, 0);
  assert.equal(body.hourly[0].precipitation.probability.percent, 90);
  assert.equal(body.hourly[1].precipitation.amount, null);
  assert.equal(body.hourly[1].precipitation.probability.percent, null);
  assert.equal(helpers.formatPrecipitation(0), '0,0 mm');
  assert.equal(helpers.formatPrecipitation(.04), '< 0,1 mm');
  assert.equal(helpers.formatPrecipitation(null), '—');
});
test('a cached forecast rolls forward while the page stays open, including at midnight', async () => {
  const { body } = await apiResult(fixture(), base + 23.5 * 3600000);
  assert.equal(helpers.weatherTime(body.hourly[0].interval.startTime), '23:00');
  const hours = helpers.upcomingWeatherHours(body.hourly, base + 24 * 3600000);
  assert.equal(hours.length, 12);
  assert.equal(helpers.weatherTime(hours[0].interval.startTime), '00:00');
  assert.equal(Date.parse(hours[0].interval.startTime), base + 24 * 3600000);
});
test('expired provider data is an error instead of wrapping back to the start of the day', async () => {
  assert.equal((await apiResult(fixture(), base + 96 * 3600000)).status, 502);
});
test('day/night follows provider daylight with a Prague-zone fallback', () => {
  assert.equal(helpers.weatherIsNight({ isDay: true }, base), false);
  assert.equal(helpers.weatherIsNight({ isDay: false }, base + 12 * 3600000), true);
  assert.equal(helpers.weatherIsNight({}, '2026-11-17T06:30:00Z'), false);
});
const visuals = load('app/components/WeatherVisual.tsx');
test('clear, partly cloudy, rain and storm have different single-SVG symbols', () => {
  const markup = ['CLEAR', 'PARTLY_CLOUDY', 'RAIN', 'THUNDERSTORM'].map(type => renderToStaticMarkup(React.createElement(visuals.default, { type, size: 48 })));
  assert.equal(new Set(markup).size, 4);
  for (const html of markup) {
    assert.equal((html.match(/<svg /g) || []).length, 1);
    assert.match(html, /viewBox="0 0 24 24"/);
    assert.doesNotMatch(html, /weather-visual-cloud|weather-visual-drops/);
  }
  assert.match(markup[0], /wx-sun/);
  assert.match(markup[1], /wx-cloud/);
  assert.match(markup[2], /wx-rain/);
  assert.match(markup[3], /wx-lightning/);
  assert.equal(visuals.weatherDescription(''), 'Počasí není dostupné');
});
test('current conditions use current precipitation and the hourly strip starts in the future', () => {
  const now = base + 7.5 * 3600000;
  const weather = { current: { temperature: { degrees: 4 }, weatherCondition: { type: 'CLOUDY' }, relativeHumidity: 88, precipitation: { amount: .1, probability: { percent: 99 } } },
    hourly: [{ interval: { startTime: new Date(base + 7 * 3600000).toISOString(), endTime: new Date(base + 8 * 3600000).toISOString() }, precipitation: { amount: .4, probability: { percent: 20 } }, weatherCondition: { type: 'RAIN' } },
      { interval: { startTime: new Date(base + 8 * 3600000).toISOString(), endTime: new Date(base + 9 * 3600000).toISOString() }, precipitation: { amount: 2, probability: { percent: 95 } } }] };
  let state = 0;
  const hooks = { ...React, useState: () => [[weather, now, false, ''][state++], () => {}], useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn };
  const Card = load('app/components/WeatherCard.tsx', { react: hooks, '../lib/weather': helpers, './WeatherVisual': visuals, '../lib/firebase': { auth: { currentUser: null } }, '../lib/location': load('app/lib/location.ts') }).default;
  const html = renderToStaticMarkup(React.createElement(Card));
  const top = html.slice(html.indexOf('weather-precipitation-stat'), html.indexOf('weather-hour-section'));
  assert.match(top, /0,1 mm/); assert.match(top, /<small>Srážky<\/small>/);
  assert.doesNotMatch(top, /95 %/);
  assert.doesNotMatch(html, /Teď/); assert.match(html, /08:00/);
  assert.doesNotMatch(html, /Předpověď pro 07:00–08:00/);
  assert.doesNotMatch(top, /Pravděp\./);
});

 test('manual weather refresh bypasses both HTTP and upstream caches', async () => {
  const data = fixture(); let options;
  class Clock extends Date { static now() { return base + 7.5 * 3600000; } }
  const api = load('app/api/weather/route.ts', {}, { Date: Clock, fetch: async (url, init) => { options = init; return Response.json(data); } });
  const response = await api.GET({ url: 'https://example.test/api/weather?refresh=1' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.next, undefined);
 });

test('GPS weather validates coordinates and preserves the selected local coordinates and terrain selection', async () => {
  let requested;
  const data = fixture(); data.timezone = 'Europe/Paris';
  class Clock extends Date { static now() { return base + 7.5 * 3600000; } }
  const api = load('app/api/weather/route.ts', {}, { Date: Clock, fetch: async url => { requested = new URL(url); return Response.json(data); } });
  const response = await api.GET({ url: 'https://example.test/api/weather?lat=48.85661&lon=2.35222' });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(requested.searchParams.get('latitude'), '48.85661'); assert.equal(requested.searchParams.get('longitude'), '2.35222');
  assert.equal(requested.searchParams.get('timezone'), 'auto'); assert.equal(requested.searchParams.get('cell_selection'), 'land'); assert.equal(body.locationName, 'Moje poloha'); assert.equal(body.timeZone.id, 'Europe/Paris');
  for (const query of ['lat=91&lon=18', 'lat=49', 'lat=bad&lon=18']) assert.equal((await api.GET({ url: `https://example.test/api/weather?${query}` })).status, 400);
});
