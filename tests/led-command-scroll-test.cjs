const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),puppeteer=require('puppeteer');
const root=path.resolve(process.env.ERGOFLEX_TEST_ROOT||path.join(__dirname,'..'));
const server=http.createServer((req,res)=>{
 if(req.url==='/app-remote.css'){res.setHeader('Content-Type','text/css');return res.end(fs.readFileSync(path.join(root,'app-remote.css')));}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app-remote.css"><div id="led-command-center"><section class="ledcc-sheet"><header class="ledcc-header"><nav class="ledcc-segments"><button>Light</button><button>Music</button><button>Automate</button></nav></header><div class="ledcc-scroll"><section class="ledcc-desk">Desk lights</section><section data-ledcc-page="music">${Array.from({length:40},(_,i)=>`<div class="ledcc-card"><button id="setting-${i}">Setting ${i+1}</button></div>`).join('')}</section><div class="ledcc-diagnostics">Strip mapping</div></div></section></div>`);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage(),cdp=await page.createCDPSession();
 for(const [width,height,compact] of [[390,844,true],[690,798,true],[1200,500,true],[1200,800,false]]){
  await page.setViewport({width,height,hasTouch:true,isMobile:compact});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate((height,compact)=>{const root=document.getElementById('led-command-center');root.dataset.compact=String(compact);Object.assign(root.style,{left:'0',top:'100px',width:'100%',height:Math.min(300,height-120)+'px'});},height,compact);
  const state=await page.evaluate(compact=>{const root=document.getElementById('led-command-center'),outer=root.querySelector('.ledcc-scroll'),inner=root.querySelector('[data-ledcc-page]'),scroller=compact?outer:inner,r=scroller.getBoundingClientRect();return {x:r.x+r.width*.8,y:r.bottom-20,end:r.top+20,overflow:getComputedStyle(inner).overflowY,max:scroller.scrollHeight-scroller.clientHeight};},compact);
  assert.equal(state.overflow,compact?'visible':'auto');assert.ok(state.max>300,'Settings exceed panel height');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:state.x,y:state.y}]});
  for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:state.x,y:state.y+(state.end-state.y)*n/8}]});await new Promise(r=>setTimeout(r,25));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,250));
  assert.ok(await page.evaluate(compact=>(document.querySelector(compact?'.ledcc-scroll':'[data-ledcc-page]')).scrollTop>20,compact),'Touch over settings scrolls the intended panel');
  await page.evaluate(compact=>{const scroller=document.querySelector(compact?'.ledcc-scroll':'[data-ledcc-page]');scroller.scrollTop=scroller.scrollHeight;},compact);
  await page.click('#setting-39');
  const visible=await page.evaluate(()=>{const last=document.getElementById('setting-39').getBoundingClientRect(),header=document.querySelector('.ledcc-header').getBoundingClientRect(),sheet=document.querySelector('.ledcc-sheet').getBoundingClientRect();return last.top>=header.bottom&&last.bottom<=sheet.bottom;});
  assert.ok(visible,'Final setting is reachable below the fixed header');
 }
 console.log('PASS: touch scrolling over settings on Fold/phone/short panels, final setting reachable, desktop page scrolling retained.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
