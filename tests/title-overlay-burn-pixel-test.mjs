// WYSIWYG: the Director's title overlay (title-editor.mjs cardSvg, as Render still composites it) against what
// finish-intro.py burns (libass, --title-still), pixel by pixel, for a default title and edited ones (per-line
// offsets, line spacing, scale, weight 500 / 700, italic, colour, position).
//   CHROME=<chrome.exe> node tests/title-overlay-burn-pixel-test.mjs [--keep DIR]   (python3 + ffmpeg on PATH)
// Both draw on the same mid-grey 1920x1080 frame at a time the title is fully in. Per title it compares, per line,
// the bounding box of the text (bright pixels) and of the shadow box (dark pixels), plus the mean difference over
// the title's area. Tolerances (TOL) are what the two rasterisers (Skia vs libass/FreeType) differ by at edges.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {restTime,cleanFilmTitles} from '../experience/film-titles.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const {default:puppeteer}=await import('puppeteer-core');
const keep=process.argv.includes('--keep')?process.argv[process.argv.indexOf('--keep')+1]:null;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ergoflex-title-pixels-'));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
let failures=0;const check=(ok,label)=>{log(ok?'PASS':'FAIL',label);if(!ok)failures++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// edge: px at any text bounding-box edge (measured: 0-1 px unscaled, 3 px on a 1.2x bold headline); the shadow box
// gets one more (its soft edge). mean: |difference| (0..255 grey) over the title's area; what remains is antialiasing
// along every glyph edge (Skia vs FreeType), measured 2.9-4.6.
const TOL={edge:3,mean:6};
const W=1920,H=1080,GREY=128,START=43.35;
const base={rel_in:3.6,rel_out:9.4,eyebrow:'SIT · STAND',title:'Your height. Your rhythm.',detail:'Sit to focus. Rise to 52.5″ to recharge.'};
const CASES=[
  ['default',{...base,id:'rise-0'}],
  ['lines moved + spacing',{...base,id:'rise-1',typography:{eyebrow:{dy:-24,dx:6},detail:{dy:18,dx:-10}}}],
  ['placed, scaled, bold, colour',{...base,id:'rise-2',position:{x:400,y:640},scale:1.2,typography:{title:{weight:700,color:'#ffcc00'},eyebrow:{weight:500,dy:-12}}}],
  // a line dragged in the frame (M3): fractional offsets as a drag leaves them, on a scaled, placed title
  ['dragged lines',{...base,id:'rise-4',position:{x:210,y:700},scale:1.1,typography:{detail:{dx:2,dy:61.42},eyebrow:{dx:-13.7,dy:7.25}}}],
  ['italic supporting + medium headline',{...base,id:'rise-3',typography:{detail:{italic:true,size:44},title:{weight:500,spacing:1}}}],
];
const port=await new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
{const st=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8'));delete st.keys?.['ergoflex.director.filmDrafts.v1'];delete st.keys?.['ergoflex.director.filmDrafts.setAside.v1'];delete st.keys?.['ergoflex.director.ui.v1'];fs.writeFileSync(path.join(tmp,'state.json'),JSON.stringify(st));}   // (no film drafts from other sessions: tests start clean)
const server=spawn(process.execPath,[path.join(root,'tools/studio-server.mjs'),'--port',String(port),'--host','127.0.0.1','--state',path.join(tmp,'state.json')],{cwd:root,stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/experience/`)).ok)break;}catch{}await sleep(100);}
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',userDataDir:path.join(tmp,'profile'),defaultViewport:{width:1280,height:800},args:['--no-sandbox','--mute-audio']});
const gray=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-vf','format=gray','-f','rawvideo','-'],{maxBuffer:1<<26});
// Bounding box of pixels matching `on` inside the rectangle r.
function bbox(px,r,on){let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=Math.max(0,r[1]);y<Math.min(H,r[3]);y++)for(let x=Math.max(0,r[0]);x<Math.min(W,r[2]);x++)if(on(px[y*W+x])){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return x1<0?null:[x0,y0,x1,y1];}
const meanDiff=(a,b,r)=>{let s=0,n=0;for(let y=r[1];y<r[3];y++)for(let x=r[0];x<r[2];x++){s+=Math.abs(a[y*W+x]-b[y*W+x]);n++;}return s/n;};
try{
  const page=await browser.newPage();
  await page.setRequestInterception(true);page.on('request',r=>r.url().endsWith('/pixel-test.html')?r.respond({status:200,contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/experience/director.css"></head><body class="film-frame"><div id="panel"></div><div id="timeline"></div></body></html>'}):r.continue());
  await page.goto(`http://127.0.0.1:${port}/pixel-test.html`);
  const bg=path.join(tmp,'bg.png');execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=c=0x${GREY.toString(16).repeat(3)}:s=${W}x${H}`,'-frames:v','1',bg]);
  for(const [name,raw] of CASES){
    const t=cleanFilmTitles([raw],16)[0],at=Math.round(restTime(t)*100)/100;
    // Director overlay (Render still's composite: the same cardSvg the frame shows)
    const url=await page.evaluate(async(t,at,grey)=>{
      const {createTitleEditor}=await import('/experience/title-editor.mjs');
      const shot={id:'rise',seconds:16,filmTitles:[t]};
      const ed=createTitleEditor({panel:document.querySelector('#panel'),timeline:document.querySelector('#timeline'),shot:()=>shot,time:()=>at/16,seek:()=>{},commit:fn=>fn(),status:()=>{},render:()=>{},renderTimeline:()=>{},showInspector:()=>{},onSelect:()=>{},snapDelta:()=>({}),dragFeedback:()=>{},endDragFeedback:()=>{},ready:()=>{},open:()=>false});
      ed.setSource({src:{titles:[]}});await ed.fontsLoaded;await document.fonts.ready;
      const c=document.createElement('canvas');c.width=1920;c.height=1080;const g=c.getContext('2d');g.fillStyle=`rgb(${grey},${grey},${grey})`;g.fillRect(0,0,1920,1080);
      return ed.compositeStill(c.toDataURL('image/png'),at,'image/png');
    },t,at,GREY);
    const over=path.join(tmp,`${name.replace(/\W+/g,'-')}-overlay.png`);fs.writeFileSync(over,Buffer.from(url.slice(url.indexOf(',')+1),'base64'));
    // finish-intro burn (libass), same frame, same time
    const D=path.join(tmp,'hq-'+CASES.findIndex(c=>c[0]===name));fs.mkdirSync(D);
    const {id,timed,...entry}=t;
    fs.writeFileSync(path.join(D,'titles-src.json'),JSON.stringify({titles:[{chapter:'rise',...entry}],cta:{chapter:'rise',rel_in:15,rel_out:null,text:''},logo:{chapter:'rise',rel_in:15}}));
    fs.writeFileSync(path.join(D,'edl.json'),JSON.stringify({fps:30,dissolve:1.5,total:60,chapters:[{index:1,id:'awaken',duration:44.85,start:0,end:44.85},{index:2,id:'rise',duration:16,start:START,end:START+16}],transitions:[.8]}));
    const burn=path.join(tmp,`${name.replace(/\W+/g,'-')}-burn.png`);
    execFileSync('python3',[path.join(root,'tools/experience/finish-intro.py'),D,'--title-still',`rise:${at}`,'--bg',bg,'--out',burn],{cwd:root,stdio:'ignore'});
    const A=gray(over),B=gray(burn);
    // the title's area: everything that differs from the plain frame in either image, padded
    const area=(()=>{const f=v=>Math.abs(v-GREY)>6;const a=bbox(A,[0,0,W,H],f),b=bbox(B,[0,0,W,H],f);if(!a||!b)return null;return [Math.min(a[0],b[0])-4,Math.min(a[1],b[1])-4,Math.max(a[2],b[2])+5,Math.max(a[3],b[3])+5];})();
    if(!area){check(false,`${name}: both images show a title`);continue;}
    const text=v=>v>GREY+40,shade=v=>v<GREY-20&&v>GREY-60;
    const ta=bbox(A,area,text),tb=bbox(B,area,text),sa=bbox(A,area,shade),sb=bbox(B,area,shade);
    const d=(p,q)=>p&&q?Math.max(...p.map((v,i)=>Math.abs(v-q[i]))):Infinity,m=meanDiff(A,B,area);
    log(name,JSON.stringify({at,text:[ta,tb],shade:[sa,sb],mean:+m.toFixed(2)}));
    check(d(ta,tb)<=TOL.edge,`${name}: text edges within ${TOL.edge} px of the burn (worst ${d(ta,tb)} px)`);
    check(d(sa,sb)<=TOL.edge+1,`${name}: shadow box edges within ${TOL.edge+1} px of the burn (worst ${d(sa,sb)} px)`);
    // per line: text rows split at the gaps between lines (both images)
    const rows=(px,r)=>{const out=[];let cur=null;for(let y=r[1];y<r[3];y++){let x0=-1,x1=-1;for(let x=r[0];x<r[2];x++)if(text(px[y*W+x])){if(x0<0)x0=x;x1=x;}if(x0>=0){if(!cur)cur=[y,y,x0,x1];cur[1]=y;cur[2]=Math.min(cur[2],x0);cur[3]=Math.max(cur[3],x1);}else if(cur&&y-cur[1]>3){out.push(cur);cur=null;}}if(cur)out.push(cur);return out;};
    const ra=rows(A,area),rb=rows(B,area);
    check(ra.length===rb.length&&ra.every((r,i)=>r.every((v,k)=>Math.abs(v-rb[i][k])<=TOL.edge)),`${name}: each line's top / bottom / left / right within ${TOL.edge} px (overlay ${JSON.stringify(ra)} · burn ${JSON.stringify(rb)})`);
    check(m<=TOL.mean,`${name}: mean difference over the title ${m.toFixed(2)} (≤ ${TOL.mean})`);
    if(keep){fs.mkdirSync(keep,{recursive:true});for(const f of [over,burn])fs.copyFileSync(f,path.join(keep,path.basename(f)));}
  }
}catch(error){log('ERROR',error.stack);failures++;}
finally{await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:300});log('done · failures',failures);process.exitCode=failures?1:0;}
