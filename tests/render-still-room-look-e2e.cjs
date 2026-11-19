// Room looks reach the film render path (18 Nov 2026): the stage render-still.cjs / render-cut.cjs drive (the presentation
// iframe, ErgoPresentation.prepare, then film-fx install) builds a chapter's room in the shot's look, for Create, the
// Commons and the OCC media lab, and in the default look (refresh) when the shot has none.
//   Create   classic: no 'Oiled oak studio floor', no 'Potted fern'      refresh: both
//   Commons  classic: no potted fern / solar shades / field guides, the 'Framed landscape print'   refresh: the reverse
//   Media lab (chapter 'coast')  classic: the sheet 'PORTFOLIO CRITIQUE'   refresh: 'LATE EDIT / CONFORM'
// It starts its OWN render-server.cjs from this checkout on a free port and checks that the server serves this checkout's
// room-looks.mjs: a render server left running from another checkout (e.g. :3017 from main) serves that checkout's code
// whatever checkout render-still.cjs runs from, and a look its code does not have comes out as no look at all.
//   node tests/render-still-room-look-e2e.cjs     (CHROME_PATH, ANGLE as render-still.cjs; CUT=<review-cut.json>)
const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path'),net=require('net'),http=require('http'),{spawn}=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const CUT=process.env.CUT||path.join(root,'exports/cinematic-intro-cut-cine/review-cut.json');
if(!fs.existsSync(CUT)){console.log('render-still room look e2e: skipped (no '+path.relative(root,CUT)+' here)');process.exit(0);}
const cut=JSON.parse(fs.readFileSync(CUT,'utf8'));
const NAMES=['Oiled oak studio floor','Limewashed gallery brickwork','Potted fern','Woven solar shades','North Coast field guides','Framed landscape print','LATE EDIT / CONFORM','PORTFOLIO CRITIQUE'];
const CASES={
  create:{room:'creative',refresh:n=>n['Oiled oak studio floor']&&n['Potted fern'],classic:n=>!n['Oiled oak studio floor']&&!n['Limewashed gallery brickwork']&&!n['Potted fern']},
  commons:{room:'library',refresh:n=>n['Potted fern']&&n['Woven solar shades']&&n['North Coast field guides']&&!n['Framed landscape print'],
    classic:n=>!n['Potted fern']&&!n['Woven solar shades']&&!n['North Coast field guides']&&n['Framed landscape print']},
  coast:{room:'occmedialab',refresh:n=>n['LATE EDIT / CONFORM']&&!n['PORTFOLIO CRITIQUE'],classic:n=>!n['LATE EDIT / CONFORM']&&n['PORTFOLIO CRITIQUE']},   // (the 'coast' chapter's room: its campus-life sheets by look)
};
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const get=url=>new Promise((res,rej)=>http.get(url,r=>{let b='';r.setEncoding('utf8');r.on('data',d=>b+=d);r.on('end',()=>res({status:r.statusCode,body:b}));}).on('error',rej));
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
(async()=>{
  const port=await freePort(),server=spawn(process.execPath,[path.join(root,'tools/experience/render-server.cjs'),String(port)],{cwd:root,stdio:['ignore','pipe','pipe']});
  const base=`http://127.0.0.1:${port}`;let browser=null;
  try{
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('render server did not start')),20000);server.stdout.on('data',d=>{if(/render server/.test(d)){clearTimeout(t);resolve();}});server.once('exit',c=>reject(Error('render server exited '+c)));});
    // the server serves this checkout (the code under test), not another one
    const served=await get(base+'/room-looks.mjs'),local=fs.readFileSync(path.join(root,'room-looks.mjs'),'utf8');
    check(served.status===200&&served.body.replace(/\r/g,'')===local.replace(/\r/g,''),'the render server serves this checkout\'s room-looks.mjs');
    const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(win?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/google-chrome'),headless:'new',defaultViewport:{width:1280,height:720},
      args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,...(angle==='vulkan'?['--enable-features=Vulkan']:[]),'--mute-audio']});
    for(const [id,c] of Object.entries(CASES)){
      const film=cut.shots.find(s=>s.id===id);if(!film){check(false,`the cut has a ${id} chapter`);continue;}
      for(const look of ['classic',null]){
        const shot={...film};if(look)shot.look=look;else delete shot.look;
        // the stage as render-still.cjs boots it (stage(), renderShot()), fresh for each case
        const page=await browser.newPage();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
        page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,240)));
        await page.goto(base+'/experience/experience.css');
        await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
        const frame=await (await page.waitForSelector('#s')).contentFrame();
        await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
        await frame.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});
        await frame.evaluate(async s=>{window.__filmFx?.clear();window.__filmFx?.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx?.unhookPreset();}},shot);
        await frame.evaluate(s=>window.__filmFx.install(s),shot);
        const got=await frame.evaluate(names=>{const r=window.ErgoFlex.workspaceRoom,n={};r.root?.traverse(o=>{if(names.includes(o.name))n[o.name]=(n[o.name]||0)+1;});return {id:r.id,layout:r.roomLayout?.id,look:r.look,n};},NAMES);
        const want=look||'refresh';
        check(got.id===c.room&&got.look===want,`${id} ${look||'(no look)'}: the render path's room is ${got.id} / ${got.layout} in look ${got.look} (want ${want})`);
        check(c[want](got.n),`${id} ${look||'(no look)'}: it builds the ${want} pieces ${JSON.stringify(got.n)}`);
        await page.close();
      }
    }
  }catch(error){failures.push(error.message);console.error('FAIL '+error.message);}
  finally{await browser?.close().catch(()=>{});server.kill();}
  assert.equal(failures.length,0,failures.join('; '));
  console.log('render-still room look e2e: the film render path builds Create and the Commons in the shot\'s look (classic) and the default (refresh) without one.');
})().catch(e=>{console.error(e);process.exit(1);});
