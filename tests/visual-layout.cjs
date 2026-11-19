// Run with npm run test:visual after installing Chromium with npx playwright-core install chromium.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright-core');

function loadTs(module, filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  module._compile(outputText, filename);
}
require.extensions['.tsx'] = require.extensions['.ts'] = loadTs;
const { ActivityCardHeading, ActivityCardStats } = require('../app/components/ActivityCardContent');
const Metric = require('../app/components/Metric').default;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const css = ['styles','professional-ui','visual-hierarchy','chat'].map(name => fs.readFileSync('app/'+name+'.css','utf8')).join('\n');

test('mobile record and summary layouts across themes', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const heading = render(ActivityCardHeading, { nickname:'Veronika s velmi dlouhou přezdívkou', activityType:'běh', date:new Date('2026-11-18T06:07:00') });
    const record = (type, minutes) => render(ActivityCardStats, { activityType:type, run:{ km:5.2, minuty:minutes, repetitions:30, tempo:6 } });
    const summary = ['distance','time','pace'].map(tone => render(Metric,{tone,label:tone,value:12})).join('');
    for (const width of [320,360,393]) {
      await page.setViewportSize({ width, height:800 });
      for (const theme of ['white','dark']) {
        await page.setContent('<html data-theme="'+theme+'"><main class="container"><article id="run" class="activity-card activity-card-modern">'+heading+record('běh',30)+'</article><article id="one">'+record('kliky',0)+'</article><article id="two">'+record('dřepy',5)+'</article><div id="summary" class="tile-group activity-summary-grid" data-metric-layout="summary">'+summary+'</div></main></html>');
        await page.addStyleTag({content:css});
        const box = selector => page.locator(selector).boundingBox();
        const middle = rect => rect.x + rect.width/2;
        const near = (a,b) => assert.ok(Math.abs(a-b)<2, width+'px '+theme+': '+a+' vs '+b);
        for (const id of ['run','one','two']) {
          const group = '#'+id+' .activity-metrics';
          const first = await box(group+' > :first-child'), last = await box(group+' > :last-child');
          near(first.y,last.y);
          near(middle(await box(group)),(middle(first)+middle(last))/2);
        }
        const last = await box('#summary > :last-child');
        near(middle(last), middle(await box('#summary')));
        assert.ok(last.y > (await box('#summary > :first-child')).y);
        const name = await box('#run .activity-person-name'), date = await box('#run time');
        assert.ok(name.x+name.width<=date.x+1 && date.x+date.width<=width);
        assert.equal(await page.locator('#run .app-metric-icon svg').count(),3);
      }
    }
  } finally { await browser.close(); }
});
