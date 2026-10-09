const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'exports/portal-ui-review');
fs.mkdirSync(out, {recursive:true});
const server = http.createServer((req,res) => {
 const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:1000});
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=product`,{waitUntil:'domcontentloaded'});
  const ready=async()=>{
   await page.waitForFunction(()=>window.ErgoFlex?.wheelRigs.length===4 && getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
   await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.5);ErgoFlex.renderer.shadowMap.enabled=false;ErgoFlex.renderer.setAnimationLoop(null);});
  };
  await ready();
  const render=()=>page.evaluate(()=>{ErgoFlex.renderer.render(ErgoFlex.roomInteractions.scene,ErgoFlex.roomInteractions.camera);});
  const theme=async value=>{await page.select('[data-portal-appearance]',value);await page.waitForFunction(t=>document.documentElement.dataset.portalTheme===t && getComputedStyle(document.querySelector('#setup-sidebar')).backgroundColor===(t==='dark'?'rgb(23, 36, 43)':'rgb(251, 252, 252)'),{},value);};
  const mode=async value=>{await page.click(`[data-portal-mode="${value}"]`);await page.waitForFunction(m=>ErgoFlex.shellMode===m,{},value);};
  const metrics=()=>page.evaluate(()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   return {theme:document.documentElement.dataset.portalTheme,header:box('.portal-header'),sidebar:box('#setup-sidebar'),viewer:box('#viewer-shell'),overflow:document.documentElement.scrollWidth-innerWidth,panelBg:getComputedStyle(document.querySelector('#setup-sidebar')).backgroundColor};
  });
  const review=[];
  for(const m of ['store','studio']){
   await mode(m);
   for(const t of ['light','dark']){
    await theme(t);await render();
    const state=await metrics();assert.equal(state.overflow,0);assert.ok(Math.abs(state.viewer.y-state.header.bottom)<2,'Viewer clears fixed header');
    assert.ok(state.sidebar.right<=state.viewer.x+1);assert.equal(await page.$eval(`[data-portal-mode="${m}"]`,e=>e.getAttribute('aria-pressed')),'true');
    await page.screenshot({path:path.join(out,`${m}-${t}.png`)});review.push({mode:m,...state});
   }
  }
  // Keyboard tabs select the intended tools; expanding settings happens once.
  await page.focus('[data-sidebar-tab="editor"]');await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('#setup-sidebar',e=>e.dataset.tab),'finishes');
  const accordion='.config-header[aria-controls="desktop-content"]';
  const before=await page.$eval(accordion,e=>e.getAttribute('aria-expanded'));
  await page.focus(accordion);await page.keyboard.press('Space');
  assert.notEqual(await page.$eval(accordion,e=>e.getAttribute('aria-expanded')),before);
  assert.equal(await page.$eval('#desktop-content',e=>e.inert),before==='true');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval(accordion,e=>e.getAttribute('aria-expanded')),before);
  assert.equal(await page.$eval('#leds-content',e=>getComputedStyle(e).maxHeight),'none','All LED settings can be reached');
  // Mode switches must keep finish configuration and retain appearance.
  const finish=await page.evaluate(()=>ErgoFlex.currentConfig.woodFinish);
  await mode('store');await mode('studio');assert.equal(await page.evaluate(()=>ErgoFlex.currentConfig.woodFinish),finish);
  // Existing build-list dialog stays themed and returns focus after Escape.
  await page.click('#cart-btn');await page.waitForSelector('#cart-modal:not(.hidden)');await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>document.querySelector('#cart-modal').contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.equal(await page.$eval('#cart-modal',e=>e.classList.contains('hidden')),true);
  await mode('store');
  await page.click('#portal-build-summary button');
  await page.waitForSelector('#cart-modal:not(.hidden)');
  await page.screenshot({path:path.join(out,'build-list-dark.png')});
  await page.keyboard.press('Escape');
  assert.ok(await page.$eval('#cart-count',e=>Number(e.textContent)>0),'Build action still works');
  await page.$eval('#desktop-content',e=>e.scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(out,'finishes-dark.png')});
  await page.$eval('#premium-artwork',e=>{e.open=true;e.scrollIntoView({block:'start'});});
  await page.screenshot({path:path.join(out,'artwork-dark.png')});
  await page.$eval('.accessory-block',e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(out,'accessories-dark.png')});
  await page.evaluate(()=>ErgoFlex.prepareLedCommandCenter().open());
  await page.waitForSelector('#led-command-center:not([hidden])');
  assert.ok(await page.$eval('#led-command-center',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.height>=300;}),'LED settings fit above minimized remote');
  await page.screenshot({path:path.join(out,'led-dark.png')});
  await theme('light');
  await page.click('[data-ledcc-tab="music"]');await page.click('[data-ledcc-music="dj"]');
  await page.screenshot({path:path.join(out,'led-music-light.png')});
  await page.click('[data-ledcc-close]');await theme('dark');
  // Persistent preference and system-follow behavior.
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  assert.equal(await page.$eval('html',e=>e.dataset.portalTheme),'dark');
  await page.select('[data-portal-appearance]','system');await page.waitForFunction(()=>document.documentElement.dataset.portalTheme==='light');
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.waitForFunction(()=>document.documentElement.dataset.portalTheme==='dark');
  // Narrow folded phone and a wider unfolded device, including reachable options.
  for(const width of [344,412,700]){
   await page.setViewport({width,height:915});
   for(const m of ['store','studio']){
    await mode(m);await page.evaluate(()=>scrollTo(0,0));await render();
    const state=await metrics();assert.equal(state.overflow,0,`No horizontal overflow at ${width}`);
    const nav=await page.$eval('.portal-modes',e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right};});assert.ok(nav.left>=0&&nav.right<=width);
    await page.click('[data-portal-jump="options"]');
    await page.waitForFunction(()=>document.querySelector('#setup-sidebar').getBoundingClientRect().top<innerHeight);
    const hit=await page.$eval('.studio-sidebar-header',e=>{const r=e.getBoundingClientRect();return r.top>=document.querySelector('.portal-header').getBoundingClientRect().bottom-1;});assert.ok(hit,'Options clear sticky header');
    await page.screenshot({path:path.join(out,`${m}-mobile-${width}.png`)});
    await page.click('[data-portal-jump="preview"]');
   }
   await page.evaluate(()=>ErgoFlex.prepareLedCommandCenter().open());
   assert.ok(await page.$eval('#led-command-center',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'Mobile LED sheet stays in viewport');
   assert.ok(await page.$eval('.ledcc-scroll',e=>getComputedStyle(e).overflowY==='auto'),'Mobile lighting settings scroll');
   await page.click('[data-ledcc-close]');
  }
  // Mobile Light theme also uses readable native controls.
  await theme('light');await page.setViewport({width:412,height:915});await mode('store');await page.click('[data-portal-jump="options"]');
  await page.screenshot({path:path.join(out,'store-mobile-light.png')});
  // Interface contrast is independent of the active room and its lighting.
  await page.setViewport({width:1440,height:1000});
  await mode('studio');await theme('dark');
  await page.evaluate(()=>ErgoFlex.setRoomScene('library',false));
  await page.waitForFunction(()=>ErgoFlex.measuredRoom?.id==='library' && document.querySelector('#viewer-shell').dataset.roomScene==='library',{timeout:30000});
  await render();await page.screenshot({path:path.join(out,'studio-room-dark.png')});
  // The desk-only entry also provides appearance and themed LED panels.
  await page.goto(`http://127.0.0.1:${server.address().port}/product-demo.html`,{waitUntil:'domcontentloaded'});await ready();
  await page.waitForSelector('.demo-top [data-portal-appearance]');
  assert.equal(await page.$eval('html',e=>e.dataset.portalTheme),'dark');
  await page.screenshot({path:path.join(out,'desk-demo-dark.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({errors,review,checks:['2 portals × 2 themes','344/412/700px phones','keyboard accordions and tabs','appearance persistence/system updates','mode-switch configuration retention','dialog focus','LED settings unclipped']},null,2));
  console.log('Portal UI: desktop themes, mobile navigation, persistence, keyboard access and dialog checks passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
