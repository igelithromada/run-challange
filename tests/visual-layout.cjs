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
const { default: Card, RecordMetrics } = require('../app/components/RecordCard');
const Metric = require('../app/components/Metric').default;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const css = ['styles','professional-ui','visual-hierarchy','chat','appearance'].map(name => fs.readFileSync('app/'+name+'.css','utf8')).join('\n');

test('mobile record and summary layouts across themes', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const heading = render(ActivityCardHeading, { nickname:'Veronika s velmi dlouhou přezdívkou', activityType:'běh', date:new Date('2026-11-18T06:07:00') });
    const record = (type, minutes) => render(ActivityCardStats, { activityType:type, run:{ km:5.2, minuty:minutes, repetitions:30, tempo:6 } });
    const summary = ['distance','time','pace'].map(tone => render(Metric,{tone,label:tone,value:12})).join('');
    const team = render(Card, {className:'record-summary-card',children:React.createElement(Team,{team:{name:'Sousedé',memberCount:3,description:'Denní procházky'}})});
    const teamDetail = description => render(Card, { className: 'record-summary-card', children: React.createElement(React.Fragment, null,
      React.createElement(Team, { team: { name: 'Sousedé', memberCount: 3, description }, detail: true }),
      React.createElement(RecordMetrics, { layout: 'summary' }, ['Běh', 'Chůze', 'Dřepy', 'Kliky'].map(label =>
        React.createElement(Metric, { key: label, label, value: 1 })
      )),
    ) });
    const challenge = render(Challenge, {challenge:{id:'test',name:'Pět kilometrů',kind:'distance',goal:5,state:'active',activityType:'běh',startDate:'2026-11-01',endDate:'2026-11-30',description:'Běháme společně'},joined:true});
    const results = render(Row, {person:{name:'Radek',km:5,count:1,pace:6,minutes:30,rank:1},type:'běh',metric:'km'});
    for (const width of [320,360,393]) {
      await page.setViewportSize({ width, height:800 });
      for (const theme of ['white','dark','default','auto','weather','custom']) {
        await page.setContent('<html data-theme="'+theme+'"><main class="container"><article id="run" class="activity-card activity-card-modern">'+heading+record('běh',30)+'</article><article id="one">'+record('kliky',0)+'</article><article id="two">'+record('dřepy',5)+'</article><div id="summary" class="tile-group activity-summary-grid" data-metric-layout="summary">'+summary+'</div><section id="team">'+team+'</section><section id="challenge">'+challenge+'</section>'+results+'<section id="team-with-description">'+teamDetail('Denní procházky')+'</section><section id="team-without-description">'+teamDetail('')+'</section>'+'</main></html>');
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
        const divider = id => page.locator('#'+id+' .app-metric-grid').evaluate(el => {
          const rule = getComputedStyle(el, '::before');
          return { content: rule.content, height: rule.height, inset: rule.insetInlineStart };
        });
        assert.deepEqual(await divider('team-with-description'), { content: '""', height: '1px', inset: '8px' });
        assert.equal((await divider('team-without-description')).content, 'none');
        const linkCoversTitle = await page.locator('#challenge h3').evaluate(el => {
          const r = el.getBoundingClientRect(); el.scrollIntoView({ behavior: "instant", block: "center" });
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

test('challenge participant count links to the same profile list as teams', async () => {
  const PeopleList = require('../app/components/PeopleList').default;
  const people = [{ id: 'radek', nickname: 'Radek' }, { id: 'verca', nickname: 'Verča' }];
  const challenge = render(Challenge, {
    challenge: { id: 'test', name: 'Společná výzva', kind: 'sharedDistance', goal: 5, state: 'active',
      activityType: 'běh', startDate: '2026-11-01', endDate: '2026-11-30', participantCount: 2 },
    joined: true, detail: true, participantsHref: '#ucastnici',
  });
  const roster = render(PeopleList, { id: 'ucastnici', title: 'Účastníci', people });
  const members = render(PeopleList, { id: 'clenove', title: 'Členové', people, managerId: 'radek' });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 600 } });
    await page.setContent('<main class="container">' + challenge + roster + members + '</main>');
    await page.addStyleTag({ content: css });
    const count = page.getByRole('link', { name: 'Účastníci 2' });
    await count.click();
    assert.equal(new URL(page.url()).hash, '#ucastnici');
    const participantLinks = page.getByRole('region', { name: 'Účastníci' }).getByRole('link');
    assert.equal(await participantLinks.count(), 2);
    assert.equal(await participantLinks.first().getAttribute('href'), '/user/radek');
    assert.equal(await participantLinks.first().getAttribute('class'),
      await page.getByRole('region', { name: 'Členové' }).getByRole('link').first().getAttribute('class'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  } finally { await browser.close(); }
});

test('entry forms share light controls in every theme and chat picker is opaque', async () => {
  const Panel = require('../app/components/EntryFormPanel').default;
  const Field = require('../app/components/FormField').default;
  const field = (label, control) => React.createElement(Field, { label }, control);
  const forms = ['Přidat běh', 'Vytvořit tým', 'Vytvořit výzvu'].map((title, i) =>
    render(Panel, { title, children: React.createElement(React.Fragment, null,
      field('Název', React.createElement('input', { type: i ? 'text' : 'number' })),
      field('Popis', React.createElement('textarea')),
      field('Typ cíle', React.createElement('select', null, React.createElement('option', null, 'Vzdálenost'))),
    ) })
  ).join('');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    for (const width of [320, 360, 393, 768]) {
      await page.setViewportSize({ width, height: 800 });
      for (const theme of ['dark', 'white', 'default', 'auto', 'weather', 'custom']) {
        await page.setContent('<html data-theme="'+theme+'"><main class="container">'+forms+'</main><dialog class="chat-activity-picker">Záznamy</dialog></html>');
        await page.addStyleTag({ content: css + '\n.entry-form-fields * { transition: none !important; }' });
        const controls = page.locator('.entry-form-fields :is(input, textarea, select)');
        const styles = await controls.evaluateAll(elements => elements.map(element => {
          const { backgroundColor, color, colorScheme, fontSize, borderRadius } = getComputedStyle(element);
          return { backgroundColor, color, colorScheme, fontSize, borderRadius };
        }));
        assert.match(styles[0].backgroundColor, /^rgb\((245, 247, 249|255, 255, 255)\)$/);
        assert.equal(styles[0].colorScheme, 'light');
        for (const style of styles) assert.deepEqual(style, styles[0]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const background = await page.locator('dialog').evaluate(dialog => {
          dialog.showModal();
          const canvas = document.createElement('canvas').getContext('2d');
          canvas.fillStyle = getComputedStyle(dialog).backgroundColor;
          canvas.fillRect(0, 0, 1, 1);
          return canvas.getImageData(0, 0, 1, 1).data[3];
        });
        assert.equal(background, 255);
      }
    }
  } finally { await browser.close(); }
});

test('running points, deductions and the rules fit mobile widths', async () => {
  const Summary = require('../app/components/ActivityPointSummary').default;
  const Rules = require('../app/components/RunningPointsRules').default;
  const { activityPoints } = require('../app/lib/activityPoints');
  const record = { id: 'run', km: 20, timestamp: '2026-11-23T12:00:00Z' };
  const score = activityPoints([record], Date.parse('2026-12-23T12:00:00Z'));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    for (const width of [320, 393]) {
      await page.setViewportSize({ width, height: 720 });
      for (const theme of ['white', 'dark']) {
        const show = async props => {
          await page.setContent('<html data-theme="'+theme+'"><main class="container"><section class="tile">'+
            render(Summary, props)+render(Rules, {})+'</section></main></html>');
          await page.addStyleTag({ content: css });
        };
        await show({ score });
        assert.equal(await page.getByText('Vzdálenost', { exact: true }).count(), 1);
        assert.equal(await page.getByText('Pravidelnost', { exact: true }).count(), 1);
        const distance = page.locator('.activity-point-source-card[data-point-tone="distance"]');
        const consistency = page.locator('.activity-point-source-card[data-point-tone="consistency"]');
        assert.equal(await distance.getByText('Vzdálenost', { exact: true }).count(), 1);
        assert.equal(await distance.getByText('+133 bodů', { exact: true }).count(), 1);
        assert.equal(await consistency.getByText('Pravidelnost', { exact: true }).count(), 1);
        assert.equal(await consistency.getByText('0 bodů', { exact: true }).count(), 1);
        assert.equal(await page.locator('.activity-point-deduction b').textContent(), '−13 bodů');
        assert.equal(await page.locator('.activity-point-progress-values strong').textContent(), '120 bodů');
        await page.getByText('Pravidla bodování', { exact: true }).click();
        assert.equal(await page.getByText('32 bodů', { exact: true }).isVisible(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await show({ score, record: score.records.get('run') });
        assert.equal(await page.getByText('Za tento běh', { exact: true }).count(), 1);
        assert.equal(await page.locator('.activity-point-total').getByText('+133 bodů', { exact: true }).count(), 1);
        assert.equal(await page.locator('.activity-point-deduction b').textContent(), '−13 bodů');
        await show({ score: activityPoints([record], Date.parse('2026-11-24T12:00:00Z')) });
        assert.equal(await page.locator('.activity-point-deduction').count(), 0);
      }
    }
  } finally { await browser.close(); }
});

test('a running record shows the level as information and a single points button beside the activity type', async () => {
  const RunHeading = require('../app/components/ActivityRunHeading').default;
  const { activityPoints } = require('../app/lib/activityPoints');
  const timestamp = '2026-11-23T12:00:00Z';
  const score = activityPoints([{ id: 'run', km: 5.3, timestamp }], Date.parse(timestamp));
  const base = { nickname: 'Veronika s dlouhou přezdívkou', activityType: 'běh', date: new Date(timestamp), uid: 'u', score };
  const heading = render(RunHeading, { ...base, recordId: 'run' });
  const short = render(RunHeading, { ...base, recordId: 'short' });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    for (const theme of ['white', 'dark']) {
      await page.setContent('<html data-theme="'+theme+'"><main class="container"><article class="activity-card activity-card-modern" id="scored">'+heading+'</article><article class="activity-card activity-card-modern" id="short">'+short+'</article></main></html>');
      await page.addStyleTag({ content: css });
      const card = page.locator('#scored');
      assert.equal(await card.getByRole('img', { name: 'Úroveň 1', exact: true }).count(), 1);
      assert.equal(await card.locator('.activity-level-indicator button').count(), 0);
      const row = card.locator('.activity-kind-row');
      assert.equal(await row.getByText('Běh', { exact: true }).count(), 1);
      assert.equal(await row.getByRole('button', { name: 'Body za běh, +29 bodů' }).count(), 1);
      assert.equal(await card.getByRole('button').count(), 1);
      assert.equal(await page.locator('#short .activity-run-points').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  } finally { await browser.close(); }
});

test('appearance settings fit every scheme and shared surfaces keep readable contrast', async () => {
  const AppearanceSettings = require('../app/components/AppearanceSettings').default;
  const { DEFAULT_APPEARANCE, TIME_PERIODS } = require('../app/lib/appearance');
  const schemes = ['default', 'light', 'dark', 'auto', 'weather', 'custom'];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    for (const theme of schemes) {
      const settings = render(AppearanceSettings, { appearance: { ...DEFAULT_APPEARANCE, theme }, onSave() {} });
      const mode = theme === 'light' ? 'white' : theme;
      await page.setContent('<html data-theme="' + mode + '"><body><main class="container settings-page">' + settings +
        '<section class="auth-card"><button class="auth-secondary">Přihlášení</button></section>' +
        '<section class="notification-panel">Upozornění</section>' +
        '<section class="app-fallback-card">Stránka nebyla nalezena</section>' +
        '<section class="trainer-day-modal">Trénink</section><section class="social-modal">Komentáře</section>' +
        '<dialog open class="activity-awards-dialog">Body za běh</dialog>' +
        '<dialog open class="chat-activity-picker">Výběr záznamu</dialog></main></body></html>');
      await page.addStyleTag({ content: css });
      const panel = page.getByRole('region', { name: 'Vzhled' });
      assert.equal(await panel.locator('.appearance-preset').count(), 5);
      assert.equal(await panel.locator('[aria-pressed="true"]').count(), theme === 'custom' ? 0 : 1);
      assert.equal(await panel.getByRole('switch').isEnabled(), !['light', 'dark'].includes(theme));
      const previewInk = await panel.locator('.appearance-preview svg').evaluateAll(icons => icons.map(icon => getComputedStyle(icon).color));
      assert.deepEqual(previewInk, ['rgb(40, 53, 67)', 'rgb(244, 245, 246)', 'rgb(224, 250, 255)', 'rgb(255, 255, 255)', 'rgb(255, 240, 188)']);
      const pageGradient = await page.locator('html').evaluate(root => getComputedStyle(root).backgroundImage);
      assert.equal(pageGradient.startsWith('linear-gradient'), !['light', 'dark'].includes(theme));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode);
      await page.evaluate(() => document.documentElement.toggleAttribute('data-solid-theme', true));
      if (theme === 'custom') await page.evaluate(() => document.documentElement.style.setProperty('--custom-theme-color', '#ffffff'));

      const palettes = theme === 'auto' ? [...new Set(TIME_PERIODS.map(([, period]) => period))]
        : theme === 'weather' ? ['clear', 'cloudy', 'cloudy-night', 'night', 'fog', 'rain', 'rain-night', 'snow', 'snow-night', 'storm', 'wind']
        : [''];
      const colors = new Set();
      for (const palette of palettes) {
        const result = await page.evaluate(({ theme, palette }) => {
          const root = document.documentElement;
          if (theme === 'auto') root.dataset.autoPeriod = palette;
          if (theme === 'weather') root.dataset.weather = palette;
          const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
          const luminance = color => {
            paint.clearRect(0, 0, 1, 1);
            paint.fillStyle = color;
            paint.fillRect(0, 0, 1, 1);
            const rgb = [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value / 255)
              .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
            return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
          };
          const contrast = (foreground, background) => {
            const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
            return (high + .05) / (low + .05);
          };
          const overlays = [...document.querySelectorAll('.auth-card,.app-fallback-card,.notification-panel,.trainer-day-modal,.social-modal,dialog')].map(node => {
            const style = getComputedStyle(node);
            return contrast(style.color, style.backgroundColor);
          });
          const styles = getComputedStyle(document.body);
          const background = getComputedStyle(root).backgroundColor;
          const pageContrast = contrast(styles.color, background);
          return { overlays, pageContrast, background, image: getComputedStyle(root).backgroundImage };
        }, { theme, palette });
        assert.equal(result.image, 'none', theme);
        assert.ok(result.pageContrast >= 4.5, theme + '/' + palette);
        for (const contrast of result.overlays) assert.ok(contrast >= 4.5, theme + '/' + palette);
        colors.add(result.background);
      }
      assert.equal(colors.size, palettes.length, theme + ' keeps its palettes with a solid background');
      await page.setViewportSize({ width: 940, height: 820 });
      const rows = await panel.locator('.appearance-preset').evaluateAll(buttons => new Set(buttons.map(button => button.offsetTop)).size);
      assert.equal(rows, 1);
      await page.setViewportSize({ width: 320, height: 720 });
    }
  } finally { await browser.close(); }
});

test('navigation follows the custom color and light cards stand out against the page', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    await page.setContent('<main class="container settings-page"><section class="tile">Nastavení</section>' +
      '<article class="tile activity-card-modern">Záznam</article><article class="route-card">Trasa</article>' +
      '<section class="progress-chart-section">Pokrok</section></main>' +
      '<div class="site-sidebar-overlay"><nav class="site-sidebar-panel"><header class="site-sidebar-header">' +
      '<button class="site-sidebar-icon-button">Zavřít</button></header>' +
      '<button class="site-sidebar-profile is-active"><span class="site-sidebar-profile-icon">Ú</span>Můj účet</button>' +
      '<div class="site-sidebar-grid"><button class="site-sidebar-item is-active">Týmy</button>' +
      '<button class="site-sidebar-item">Výzvy</button></div></nav></div>');
    await page.addStyleTag({ content: css + '\nhtml .site-sidebar-panel button:is(.site-sidebar-item,.site-sidebar-profile,.site-sidebar-icon-button) { transition: none !important; }' });
    const palette = (theme, customColor) => page.evaluate(async ({ theme, customColor }) => {
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.style.setProperty('--custom-theme-color', customColor);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = color => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const surfaces = ['.site-sidebar-panel', '.site-sidebar-profile', '.site-sidebar-profile-icon', '.site-sidebar-icon-button',
        '.site-sidebar-item.is-active', '.site-sidebar-item:not(.is-active)'].map(selector => {
        const { backgroundColor, color } = getComputedStyle(document.querySelector(selector));
        return { background: rgb(backgroundColor), foreground: rgb(color) };
      });
      const cards = [...document.querySelector('main').children].map(el => {
        const { backgroundColor, borderTopColor } = getComputedStyle(el);
        return { background: rgb(backgroundColor), border: rgb(borderTopColor) };
      });
      return { surfaces, cards };
    }, { theme, customColor });

    const violet = await palette('custom', '#a820e0');
    const green = await palette('custom', '#10b457');
    violet.surfaces.forEach(({ background, foreground }, index) => {
      assert.ok(background[2] > background[1] + 12, JSON.stringify({ index, background }));
      assert.ok(green.surfaces[index].background[1] > green.surfaces[index].background[2], JSON.stringify({ index, green: green.surfaces[index].background }));
      assert.ok(foreground[0] >= 240);
    });
    const light = await palette('white', '#a820e0');
    assert.deepEqual(light.surfaces[0].background, [255, 255, 255, 255]);
    for (const card of light.cards) {
      assert.deepEqual(card.background, [237, 242, 246, 255]);
      assert.ok(card.border[0] < 215);
    }
    assert.deepEqual(light.surfaces[5].background, light.cards[0].background);
  } finally { await browser.close(); }
});
