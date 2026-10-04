const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-editor-'));
  try {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
    const fileUrl = 'file://' + path.join(__dirname,'ergoflex-editor.html');
    await page.goto(fileUrl,{waitUntil:'load'});
    await page.waitForSelector('#heroTitle');
    const frame = await (await page.$('#preview')).contentFrame();
    await frame.waitForSelector('[data-ef-field="heroTitle"]');
    await frame.$eval('.ef-proof',el => el.click());
    await page.waitForFunction(() => document.activeElement?.id === 'proof1Title');
    await frame.$eval('[data-ef-field="heroTitle"]',el => el.click());
    await page.waitForFunction(() => document.activeElement?.id === 'heroTitle');
    assert.equal(await page.$eval('#heroTitle',el => el.value),'Meet ErgoFlex: The Smart Workstation That Moves With You.');
    assert.equal(await page.$eval('#proof1Title',el => el.value),'Two issued U.S. patents');
    assert.equal(await page.$eval('#proof2Title',el => el.value),'Third patent application pending');
    assert.equal(await page.$eval('#platform1Title',el => el.value),'See a desk respond to its user.');
    assert.equal(await page.$eval('#heroButton',el => el.value),'Plan an interactive demo');
    assert.equal(await page.$eval('#format1Title',el => el.value),'Watch smart ergonomics in motion.');
    assert.equal(await page.$eval('#format2Title',el => el.value),'Find a position that fits.');
    assert.equal(await page.$eval('#format3Title',el => el.value),'Explore the thinking behind the desk.');
    await frame.$eval('#ef-tech-platform-title',el => el.click());
    await page.waitForFunction(() => document.activeElement?.id === 'platformTitle');
    await page.$eval('#platformTitle',el => {el.value='Your editable product story';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.$eval('#clip0_title',el => el.value),'Vision control');
    for (const [i,title] of ['Vision control','Touchscreen control, light & sound feedback','Voice control & pre-collision sensing','Groove routines & playback','Sound-reactive LED inlay'].entries()) {
      assert.equal(await page.$eval(`#clip${i}_title`,el => el.value),title);
    }
    assert.match(await page.$eval('#clip0_description',el => el.value),/hands-free way to interact/);
    assert.match(await page.$eval('#clip1_description',el => el.value),/integrated touch display/);
    assert.match(await page.$eval('#clip2_description',el => el.value),/proximity sensing/);
    assert.match(await page.$eval('#clip3_description',el => el.value),/forward or in reverse/);
    assert.match(await page.$eval('#clip4_description',el => el.value),/respond to sound/);
    assert.equal(await page.$eval('#hostButtonUrl',el => el.value),'mailto:vico@ergoflexdesk.com?subject=Tech%20Week%20ErgoFlex%20demo');
    const expectedVisionPoster = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname,'assets/vision-control-04s.jpg')).toString('base64');
    assert.equal(await frame.$eval('#ef-tech-player',el => el.getAttribute('poster')),expectedVisionPoster);
    assert.equal(await frame.$eval('#ef-tech-player',el => el.muted),true);
    assert.equal(await page.$eval('#lime',el => el.value),'#f078ff');
    await page.$eval('#lime',el => {el.value='#ee88ff';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.$eval('#heroTitle',el => {el.value='A custom demo headline';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.$eval('#clip0_title',el => {el.value='New first video';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.$eval('#width',el => {el.value='1100';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('#download-button');
    const output = path.join(downloadDir,'ergoflex-divi-code-module-edited.html');
    for (let i=0;i<50 && !fs.existsSync(output);i++) await new Promise(r => setTimeout(r,100));
    assert.ok(fs.existsSync(output),'exported HTML was downloaded');
    const html = fs.readFileSync(output,'utf8');
    assert.match(html,/<h1>A custom demo headline<\/h1>/);
    assert.match(html,/New first video/);
    assert.match(html,/max-width:1100px/);
    assert.match(html,/Your editable product story/);
    assert.doesNotMatch(html,/prototype/i);
    assert.match(html,/--lime:#ee88ff/);
    assert.match(html,/<script>/);
    assert.doesNotMatch(html,/data-ef-field|ergoflex-select/);
    const chooser = await Promise.all([page.waitForFileChooser(),page.click('#import-button')]).then(([c]) => c);
    await chooser.accept([output]);
    await page.waitForFunction(() => document.querySelector('#heroTitle')?.value === 'A custom demo headline');
    assert.equal(await page.$eval('#clip0_title',el => el.value),'New first video');
    assert.equal(await page.$eval('#lime',el => el.value),'#ee88ff');
    assert.equal(await page.$eval('#platformTitle',el => el.value),'Your editable product story');
    const live = await browser.newPage();
    await live.goto('file://' + output,{waitUntil:'load'});
    assert.equal(await live.$eval('#ef-tech-player',el => el.getAttribute('poster')),expectedVisionPoster);
    for (let i=0;i<5;i++) {
      await live.click(`[data-clip="${i}"]`);
      assert.equal(await live.$eval(`[data-clip="${i}"]`,el => el.getAttribute('aria-pressed')),'true');
      assert.equal(await live.$eval('#ef-tech-player',el => el.muted),i === 0);
      const posterFile = {1:'light-sound-02s.jpg',2:'voice-control-02s.jpg',4:'led-inlay-59s.jpg'}[i];
      if (posterFile) {
        const expected = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname,'assets',posterFile)).toString('base64');
        assert.equal(await live.$eval('#ef-tech-player',el => el.getAttribute('poster')),expected);
        assert.equal(await live.$eval(`[data-clip="${i}"] img`,el => el.getAttribute('src')),expected);
      }
      assert.equal(await live.$eval('#ef-tech-title',el => el.textContent),await live.$eval(`[data-clip="${i}"] strong`,el => el.textContent));
    }
    for (const width of [1440,390,320]) {
      await live.setViewport({width,height:900});
      assert.ok(await live.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`no horizontal overflow at ${width}px`);
    }
    await live.close();
    const preview = await browser.newPage();
    await preview.goto('file://' + path.join(__dirname,'ergoflex-demos.html'),{waitUntil:'load'});
    await preview.setViewport({width:1440,height:1000});
    await preview.screenshot({path:'/tmp/ergoflex-tech-week-desktop.png',fullPage:true});
    await preview.setViewport({width:390,height:844});
    await preview.screenshot({path:'/tmp/ergoflex-tech-week-mobile.png',fullPage:true});
    await preview.close();
    console.log('Editor click-to-edit, text/color changes, export, re-import, five video selectors, and desktop/mobile overflow checks passed.');
  } finally { await browser.close(); fs.rmSync(downloadDir,{recursive:true,force:true}); }
})().catch(error => {console.error(error);process.exitCode=1;});
