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
const Team = require('../app/components/TeamCardContent').default;
const Challenge = require('../app/components/ChallengeSummaryCard').default;
const Row = require('../app/components/ResultsPersonRow').default;
const Card = require('../app/components/RecordCard').default;
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
    const team = render(Card, {className:'record-summary-card',children:React.createElement(Team,{team:{name:'Sousedé',memberCount:3,description:'Denní procházky'}})});
    const challenge = render(Challenge, {challenge:{id:'test',name:'Pět kilometrů',kind:'distance',goal:5,state:'active',activityType:'běh',startDate:'2026-11-01',endDate:'2026-11-30',description:'Běháme společně'},joined:true});
    const results = render(Row, {person:{name:'Radek',km:5,count:1,pace:6,minutes:30,awards:[],rank:1},type:'běh',metric:'km'});
    for (const width of [320,360,393]) {
      await page.setViewportSize({ width, height:800 });
      for (const theme of ['white','dark']) {
        await page.setContent('<html data-theme="'+theme+'"><main class="container"><article id="run" class="activity-card activity-card-modern">'+heading+record('běh',30)+'</article><article id="one">'+record('kliky',0)+'</article><article id="two">'+record('dřepy',5)+'</article><div id="summary" class="tile-group activity-summary-grid" data-metric-layout="summary">'+summary+'</div><section id="team">'+team+'</section><section id="challenge">'+challenge+'</section>'+results+'</main></html>');
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
        const parity = (selector, properties) => page.locator(selector).first().evaluate((el, props) => props.map(p => getComputedStyle(el)[p]), properties);
        const headingProps = ['display','padding','gap'];
        for (const id of ['team','challenge']) {
          assert.deepEqual(await parity('#'+id+' article > header',headingProps),await parity('#run > header',headingProps));
          near((await box('#'+id+' .activity-avatar')).width,(await box('#run .activity-avatar')).width);
        }
        const linkCoversTitle = await page.locator('#challenge h3').evaluate(el => {
          const r = el.getBoundingClientRect(); el.scrollIntoView();
          const visible = el.getBoundingClientRect();
          return r.width > 0 && Boolean(document.elementFromPoint(visible.x+2,visible.y+2)?.closest('a[href="/challenges/test"]'));
        });
        assert.equal(linkCoversTitle,true);
        assert.deepEqual(await parity('.results-person .activity-metrics',['padding','display','gap']),await parity('#run .activity-metrics',['padding','display','gap']));
        await page.locator('.results-person summary').click();
        assert.ok(await page.locator('.results-person details .app-metric-value').first().isVisible());
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
