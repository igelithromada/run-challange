const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), Module = require('node:module'), ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const filename = path.resolve(file), module = { exports: {} }, requireFile = Module.createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] || requireFile(name), console, Date, Intl, URL, File, Blob, Uint8Array, ...globals }, { filename });
  return module.exports;
}
const text = node => typeof node === 'string' ? node : typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function button(node, label) { if (!node) return; if (Array.isArray(node)) { for (const child of node) { const found = button(child, label); if (found) return found; } return; } if (node.type === 'button' && text(node).includes(label)) return node; return button(node.props?.children, label); }

test('a 10 MB photo is resized before upload and decoded resources are released', async () => {
  let closed = 0, canvas;
  const api = load('app/lib/preparePhoto.ts', {}, { HTMLImageElement: class {}, createImageBitmap: async () => ({ width: 4000, height: 3000, close() { closed++; } }),
    document: { createElement: () => canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: fn => fn(new Blob([new Uint8Array(500000)], { type: 'image/jpeg' })) } } });
  const result = await api.preparePhoto(new File([new Uint8Array(10 * 1024 * 1024)], 'camera.jpg', { type: 'image/jpeg' }));
  assert.equal(result.size, 500000); assert.equal(result.type, 'image/jpeg');
  assert.equal(canvas.width, 1920); assert.equal(canvas.height, 1440); assert.equal(closed, 1);
});
test('photo resizing keeps small pictures and portrait aspect ratios', () => {
  const api = load('app/lib/preparePhoto.ts');
  assert.deepEqual({ ...api.fitPhotoDimensions(3000, 4000) }, { width: 1440, height: 1920 });
  assert.deepEqual({ ...api.fitPhotoDimensions(400, 300) }, { width: 400, height: 300 });
  assert.throws(() => api.fitPhotoDimensions(0, 1));
});

test('GPS detects re-enabling both before starting and after an automatic GPS pause', async () => {
  let hook = 0, now = 1000000, enabled = false, watcher, watches = 0, nextTimer = 0;
  const slots = [], effects = [], timers = new Map();
  const hooks = { useState: initial => { const i = hook++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; },
    useRef: value => { const i = hook++; return slots[i] || (slots[i] = { current: value }); },
    useEffect: (fn, deps) => { const i = hook++; const previous = slots[i]; if (!previous || deps.some((v, n) => v !== previous.deps[n])) { effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } } };
  class Clock extends Date { static now() { return now; } }
  const position = () => ({ coords: { latitude: 49, longitude: 18, accuracy: 5 }, timestamp: now });
  const Component = load('app/components/ActivityRecorder.tsx', { react: hooks, './InstallPwaPrompt': () => null }, {
    Date: Clock, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    window: { setInterval: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; }, clearInterval: id => timers.delete(id), addEventListener() {}, removeEventListener() {} },
    navigator: { permissions: { query: async () => ({ state: 'granted' }) }, geolocation: {
      getCurrentPosition: (yes, no) => enabled ? yes(position()) : no({ code: 2 }),
      watchPosition: (yes, no) => { watcher = { yes, no }; return ++watches; }, clearWatch() {},
    } },
  }).default;
  function render() { hook = 0; const tree = Component({ type: 'běh' }); effects.splice(0).forEach(fn => fn()); return tree; }
  const tick = async ms => { const timer = [...timers.values()].find(t => t.ms === ms); assert.ok(timer, `timer ${ms}`); timer.fn(); await new Promise(resolve => setImmediate(resolve)); };
  render(); await new Promise(resolve => setImmediate(resolve));
  assert.match(text(render()), /GPS vypnuto/);
  enabled = true; await tick(6000); assert.match(text(render()), /Připraveno/);
  button(render(), 'Spustit').props.onClick(); watcher.yes(position());
  assert.match(text(render()), /GPS aktivní/);
  enabled = false; now += 10000; await tick(2500); assert.match(text(render()), /GPS vypnuto/);
  enabled = true; now += 5000; await tick(2500);
  assert.match(text(render()), /GPS aktivní/); assert.equal(watches, 2, 'restarts the watch after recovery');
  button(render(), 'Pozastavit').props.onClick(); render(); await tick(2500);
  assert.match(text(render()), /Pozastaveno/, 'an intentional pause is preserved');
});

test('the header hides the notification bell when there are no notifications', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Navbar = load('app/components/Navbar.tsx', { 'next/navigation': { useRouter: () => ({ push() {} }) }, '../lib/firebase': { auth: { currentUser: null } }, '../lib/notifications/target': { notificationTarget() {} }, '../lib/imageUrl': { cloudinaryImageUrl: value => value } }).default;
  const html = renderToStaticMarkup(React.createElement(Navbar, { onMenuClick() {} }));
  assert.doesNotMatch(html, /aria-label="Upozornění/);
  assert.match(html, /aria-label="Otevřít navigaci"/);
  assert.doesNotMatch(html, /notification-wrap/, 'removes the fourth header track when there are no notifications');
});
