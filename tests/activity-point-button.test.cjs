const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

test('the amount opens the existing breakdown for that run and the profile keeps its level button', () => {
  const { outputText } = ts.transpileModule(fs.readFileSync('app/components/ActivityLevelButton.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  let open = false;
  let restoredFocus = false;
  const element = () => null;
  const jsxModule = { __esModule: true, default: element };
  const dependencies = {
    react: { useState: () => [open, value => { open = value; }], useRef: () => ({ current: { focus: () => { restoredFocus = true; } } }) },
    './ActivityPointSummary': { ...jsxModule, formatPoints: value => value + ' bodů', LevelShield: () => null },
    './OverlayDialog': jsxModule,
    './RunningPointsRules': jsxModule,
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => dependencies[name] ?? require(name),
    requestAnimationFrame: callback => callback() });
  const record = { distancePoints: 29, consistencyPoints: 0 };
  const score = { level: 2, rank: { name: 'Začátečník', tone: 'beginner' }, records: new Map([['run', record]]) };
  const button = props => exports.default({ score, nickname: 'Veronika', ...props });
  let [trigger, dialog] = button({ recordId: 'run' }).props.children;
  assert.equal(trigger.props['aria-label'], 'Body za běh, +29 bodů');
  assert.equal(dialog, false);
  trigger.props.onClick();
  [, dialog] = button({ recordId: 'run' }).props.children;
  assert.equal(dialog.props.label, 'Body za běh · Veronika');
  assert.equal(dialog.props.children.props.children[1].props.record, record);
  dialog.props.onDismiss();
  assert.equal(open, false);
  assert.equal(restoredFocus, true);
  [trigger] = button({}).props.children;
  assert.equal(trigger.props['aria-label'], 'Úroveň 2 uživatele Veronika');
  assert.equal(button({ recordId: 'missing' }), null);
});
