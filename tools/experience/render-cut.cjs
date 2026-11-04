#!/usr/bin/env node
// Headless renderer for Director cuts. Drives the real presentation stage
// (window.ErgoPresentation inside an isolated iframe) on the local GPU.
//
//   node tools/experience/render-cut.cjs --cut cut.json --shots 0,3 --out dir --stills 12
//     → dir/NN-stills/*.jpg plus dir/NN-sheet.jpg (contact sheet with times)
//   node tools/experience/render-cut.cjs --cut cut.json --shots all --out dir --video
//     → dir/NN.mkv, 1920×1080 near-lossless H.264 (yuv444p, CRF 8)
//
// Shot fields read here: ledPeriod (music LED cycle, default 6 s),
// screenOffset (seconds into the media clip at chapter start).
// Film-effect fields (implemented in film-fx.mjs / film-tod.mjs, injected into
// the stage iframe only when a shot uses them; see
// exports/cinematic-intro-20261030/screens/HARNESS.md):
//   screens:[{target:'main-landscape'|'main-portrait'|'tablet'|'tv'|'arcade'|
//     'occ-display'|'media'|<id from --list-screens>|<mesh name or path part>,
//     src:'exports/…/02-landscape.mp4' (or .png/.jpg), offset:0 (s into the
//     clip at chapter 0), fit:'cover'|'contain'|'stretch', loop:true, rate:1,
//     rotate:0|90|180|270, flipX:false, brightness:1, inset:0|[l,t,r,b], res}]
//     Each bake frame seeks every clip to chapter seconds × rate + offset
//     (frame-accurate seek-and-wait) and redraws its sRGB canvas texture.
//   ledMode:'media'  the app's picture-driven (Game Mode screen) LED path,
//     sampled from ledSource (a screens target/index; default screens[0], or
//     the stage media clip) and eased on bake time. ledPreset: calm|normal|
//     intense|full (default normal).  ledGlow:0…1 LED brightness (fraction of
//     full; the stage default is .35), any LED mode. ledSurfaces:{desktopStrength,
//     floorStrength, …} the app's LED surface sliders (0…200 strengths).
//     ledGain: multiplier on media-mode pixels. sceneGlobals:{environmentScale,
//     exposure} for the shot.
//   clock:{from:'08:00', to:'17:30', start:0, end:<seconds>, ease:'linear'|
//     'smooth', second:'real'|'clock'|'hide'}  animated wall/desk clocks.
//   timeOfDay:[{at:0,mode:'morning'},{at:16,mode:'evening',ease:'smooth'}]
//     lighting-only interpolation between the room's daypart presets.
//   accessories:{add:['tablet-pc'|{id,x,z,rotation,scale,role}], remove:[…]}
//   sceneEdits:[{match:'<name regex>'|'@grid'|'@pulse'|'@sweep'|'@pylons'|
//     '@stageLight'|'@floor', path, materialName, hide, position, rotation,
//     scale, lightType+intensity (light multiplier), material:{color, roughness,
//     metalness, clearcoat, emissiveScale,
//     …}, opacity:<multiplier | [[sec,v],…]>, radialFade:[r0,r1]}]
//   lights:[{preset:'productRig', scale, key/rimLeft/rimRight/pool/contact:
//     {…}|false} | {type:'rect'|'spot'|'point'|'directional', position|at:
//     {az,el,dist}, target, color, intensity, width, height, angle, penumbra}]
// --list-screens [--list-at 0.5] [--list-objects '^Room:|leap']: print every screen-like mesh (and clock) for the shots,
//   with world position, size, aspect, facing and on-screen pixel size; also
//   writes <out>/NN-screens.json.
// --storage seed.json (localStorage key → string, e.g. saved builds/artwork, or
//   studio-state.json: the shared editing state every studio browser saves to)
// Options: --screen exports/…/screen-film.mp4 (replace the media clip)
// --size 1920x1080  --fps 30  --blur 4 (sub-frames per output frame,
// 180° shutter: half of them are averaged)  --ss 1.5 (supersample, then
// Lanczos down)  --at 0,0.25,1 (exact chapter fractions for stills)
// Uses a plain static server (no live reload, so writes under exports/ can't
// reload the stage mid-render, and Range works for media seeks):
//   node tools/experience/render-server.cjs 3017
const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path'),{spawn,execFileSync}=require('child_process');

const opts={listScreens:false,cut:null,shots:'all',out:'.',stills:0,at:null,video:false,size:'1920x1080',fps:30,blur:1,ss:1,server:'http://127.0.0.1:3017'};
for(let i=2;i<process.argv.length;i++){
  const k=process.argv[i].replace(/^--/,'');
  if(k==='video')opts.video=true;else if(k==='list-screens')opts.listScreens=true;else opts[k]=process.argv[++i];
}
if(!opts.cut){console.error('Usage: render-cut.cjs --cut cut.json [--shots all|0,1,…] [--out dir] [--stills N | --at fractions | --video]');process.exit(2);}
const cut=JSON.parse(fs.readFileSync(opts.cut,'utf8'));
const indices=opts.shots==='all'?cut.shots.map((_,i)=>i):String(opts.shots).split(',').map(s=>{const n=Number(s);return Number.isInteger(n)?n:cut.shots.findIndex(x=>x.id===s);});
if(indices.some(i=>!cut.shots[i])){console.error('Unknown shot in --shots',opts.shots);process.exit(2);}
const [W,H]=opts.size.split('x').map(Number),fps=Number(opts.fps),blur=Math.max(1,Number(opts.blur)|0),ss=Math.max(1,Number(opts.ss));
const RW=Math.round(W*ss/2)*2,RH=Math.round(H*ss/2)*2;
fs.mkdirSync(opts.out,{recursive:true});
const pad=i=>String(i+1).padStart(2,'0');

async function stage(browser){
  const page=await browser.newPage();
  // Films always render full motion: the stage pins every frame to the end pose when the OS asks for reduced
  // motion (Windows over RDP / animation effects off), which froze camera and desk in the first Win HQ13.
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  // --screen <repo path>: swap the in-scene media clip (ambient-clip.mp4) for
  // a cleared one in this render only. The app's own asset is untouched.
  if(opts.screen){await page.setRequestInterception(true);page.on('request',r=>/\/ambient-clip\.mp4(\?|$)/.test(r.url())?r.continue({url:opts.server+'/'+opts.screen.replace(/^\/+/,'')}):r.continue());}
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))console.log('[stage]',m.text().slice(0,240));});
  page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,240)));
  await page.goto(opts.server+'/experience/experience.css');
  // --storage <json>: seed this origin's localStorage (e.g. the owner's saved
  // builds and desk artwork) before the stage loads. The stage copies it into
  // memory, so renders never write back to it.
  // A studio-state.json (tools/studio-server.mjs) works too: its current values become the seed.
  // --state-keys k1,k2: overlay those keys from the live studio-state.json (repo root, or --state file) on the seed,
  // e.g. ergoflex.sceneAssets.v1 so Vico's latest scene edits are in the render while the curated seed keeps the rest.
  if(opts['state-keys']){const st=JSON.parse(fs.readFileSync(opts.state||path.resolve(__dirname,'..','..','studio-state.json'),'utf8')),seed0=opts.storage?null:{};
    const keys=String(opts['state-keys']).split(',').filter(Boolean),got=keys.filter(k=>st.keys?.[k]&&!st.keys[k].deleted);
    console.log(`[provenance] state-keys rev ${st.rev}: ${got.map(k=>k+'@'+st.keys[k].rev).join(' ')||'none'}`);
    opts.__overlay=Object.fromEntries(got.map(k=>[k,st.keys[k].value]));if(seed0)opts.storage=null;}
  if(opts.storage||opts.__overlay){let seed=opts.storage?JSON.parse(fs.readFileSync(opts.storage,'utf8')):{};if(seed.format==='ergoflex-studio-state-v1')seed=Object.fromEntries(Object.entries(seed.keys).filter(([,r])=>!r.deleted).map(([k,r])=>[k,r.value]));if(opts.__overlay)Object.assign(seed,opts.__overlay);await page.evaluate(s=>{localStorage.clear();for(const [k,v] of Object.entries(s))localStorage.setItem(k,v);},seed);}
  await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
  const frame=await (await page.waitForSelector('#s')).contentFrame();
  await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
  const rm=await frame.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  console.log(`[provenance] reduced-motion ${rm}`);if(rm)throw Error('The stage reports prefers-reduced-motion: reduce; the render would have no camera or desk motion.');
  return frame;
}

// Shots that use film-effect fields load the helper into the stage iframe.
const FX_FIELDS=['deskObjects','screens','ledMode','ledGlow','ledSurfaces','ledGain','ledColor','sceneGlobals','clock','timeOfDay','accessories','sceneEdits','lights','ledStatus','obstacles','ledFill','floorLight','quality'];
// --quality hq13 | '{json}': film-quality overrides on every shot (shot.quality wins). See film-quality.mjs.
const QUALITY=opts.quality?(/^\s*\{/.test(opts.quality)?JSON.parse(opts.quality):opts.quality):null;
if(QUALITY)for(const s of cut.shots)if(s.quality===undefined)s.quality=QUALITY;
const usesFx=shot=>FX_FIELDS.some(k=>shot[k]!==undefined);
async function loadFx(frame){await frame.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});}
async function grab(frame,t,seconds,quality=.96,chapter=seconds,video=false){
  const url=await frame.evaluate(async(t,s,q,c,v)=>{const fx=window.__filmFx;if(fx)await fx.frame(t,c,{video:v});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}return window.__rc.toDataURL('image/jpeg',q);},t,seconds,quality,chapter,video);
  return Buffer.from(url.slice(url.indexOf(',')+1),'base64');
}

async function renderShot(frame,i){
  const shot=cut.shots[i],tag=pad(i),started=Date.now(),fx=usesFx(shot);
  if(fx)await loadFx(frame);
  await frame.evaluate(async s=>{window.__filmFx?.clear();window.__filmFx?.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx?.unhookPreset();}},shot);
  // studio.js phases LED effects from performance.now() at setLedEffect, but
  // bakes pass chapter time. Re-arm the effect prepare() chose with its start
  // at 0 so the reactive lighting animates from the first frame.
  if(shot.kind==='music'&&shot.ledMode!=='media')await frame.evaluate(period=>{const now=performance.now;performance.now=()=>0;try{window.ErgoFlex.setLedEffect({mode:'spectrum',period},false);}finally{performance.now=now;}},Number(shot.ledPeriod)||6);
  // shot.screenOffset (s): start the in-scene media clip that far in. Bakes
  // seek the clip to chapter time, so this only shifts what the screen shows.
  const off=Number(shot.screenOffset)||0;
  if(fx){const info=await frame.evaluate(s=>window.__filmFx.install(s),{...shot,__stageClip:opts.screen});console.log(`${tag} ${shot.id}: film fx`,JSON.stringify(info));}
  const stillMode=!opts.video,w=stillMode?960:RW,h=stillMode?540:RH;
  await frame.evaluate((w,h)=>{window.__rc=document.createElement('canvas');window.__rc.width=w;window.__rc.height=h;window.ErgoPresentation.beginBake(w,h);},w,h);
  try{
    if(stillMode){
      const fractions=opts.at?String(opts.at).split(',').map(Number):(n=>Array.from({length:n},(_,k)=>k/(n-1)))(Math.max(2,Number(opts.stills)||8));
      const dir=path.join(opts.out,tag+'-stills');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
      for(const [k,t] of fractions.entries())fs.writeFileSync(path.join(dir,String(k).padStart(3,'0')+'.jpg'),await grab(frame,t,t*shot.seconds+off,.9,t*shot.seconds,false));
      const cols=4,rows=Math.ceil(fractions.length/cols);
      const labels=fractions.map((t,k)=>`[${k}:v]scale=480:270,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6:x=6:y=6:text='${(t*shot.seconds).toFixed(2)}s  t=${t.toFixed(3)}'[v${k}]`);
      const ins=fractions.flatMap((_,k)=>['-i',path.join(dir,String(k).padStart(3,'0')+'.jpg')]);
      if(fractions.length===1)fs.copyFileSync(path.join(dir,'000.jpg'),path.join(opts.out,tag+'-sheet.jpg'));else
      execFileSync('ffmpeg',['-v','error','-y',...ins,'-filter_complex',labels.join(';')+';'+fractions.map((_,k)=>`[v${k}]`).join('')+`xstack=inputs=${fractions.length}:layout=${fractions.map((_,k)=>`${(k%cols)*480}_${Math.floor(k/cols)*270}`).join('|')}:fill=black`,path.join(opts.out,tag+'-sheet.jpg')]);
      console.log(`${tag} ${shot.id}: ${fractions.length} stills → ${path.join(opts.out,tag+'-sheet.jpg')} (${((Date.now()-started)/1000).toFixed(1)}s)`);
      return;
    }
    // shot.renderRange [t0,t1] (chapter seconds): render only that span, end
    // exclusive, still on the chapter clock (for sub-shots joined in post).
    const range=Array.isArray(shot.renderRange)?shot.renderRange.map(Number):null;
    const outFrames=range?Math.max(2,Math.round((range[1]-range[0])*fps)):Math.max(2,Math.round(shot.seconds*fps)),sub=blur,total=(outFrames-1)*sub+1;
    const n0=range?Math.round(range[0]*fps)*sub:0,chapterFrames=Math.max(2,Math.round(shot.seconds*fps));
    const vf=[];if(sub>1){const open=Math.max(1,Math.round(sub/2));vf.push(`tmix=frames=${open}:weights=${Array(open).fill(1).join(' ')}`,`select=not(mod(n\\,${sub}))`);}
    if(ss>1)vf.push(`scale=${W}:${H}:flags=lanczos`);
    vf.push('setpts=N/('+fps+'*TB)');
    const file=path.join(opts.out,tag+'.mkv');
    const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(fps*sub),'-c:v','mjpeg','-i','-','-vf',vf.join(','),'-r',String(fps),'-c:v','libx264','-preset','medium','-crf','8','-pix_fmt','yuv444p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',file],{stdio:['pipe','inherit','inherit']});
    const done=new Promise((res,rej)=>ff.on('close',c=>c===0?res():rej(Error('ffmpeg exited '+c))));
    for(let n=0;n<total;n++){
      // Same sampling as the in-browser bake: t spans 0…1 across the chapter.
      const seconds=(n0+n)/(fps*sub),t=Math.min(1,seconds/((chapterFrames-1)/fps));
      const jpg=await grab(frame,t,seconds+off,.97,seconds,true);
      if(!ff.stdin.write(jpg))await new Promise(r=>ff.stdin.once('drain',r));
      if(n%(fps*sub*2)===0)process.stdout.write(`\r${tag} ${shot.id}: ${Math.round(n/total*100)}%   `);
    }
    ff.stdin.end();await done;
    console.log(`\r${tag} ${shot.id}: ${outFrames} frames → ${file} (${((Date.now()-started)/1000).toFixed(0)}s)`);
  }finally{await frame.evaluate(()=>{window.ErgoPresentation.endBake();window.__filmFx?.clear();}).catch(()=>{});}
}

async function listShot(frame,i){
  const shot=cut.shots[i],tag=pad(i);await loadFx(frame);
  await frame.evaluate(async s=>{window.__filmFx.clear();window.__filmFx.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx.unhookPreset();}},shot);
  if(shot.accessories)await frame.evaluate(s=>window.__filmFx.install({id:s.id,room:s.room,seconds:s.seconds,accessories:s.accessories}),shot);
  // --list-at <fraction>: bake that moment first, so the desk's pose (clips, motion.initial) is applied.
  const at=opts['list-at']!==undefined?Number(opts['list-at']):null;
  if(at!==null)await frame.evaluate(async(t,s)=>{window.__rc=document.createElement('canvas');window.__rc.width=320;window.__rc.height=180;window.ErgoPresentation.beginBake(320,180);await window.ErgoPresentation.bakeFrame(t,window.__rc,s);},at,at*shot.seconds);
  const result=await frame.evaluate((s,re)=>{
    const out={screens:window.__filmFx.listScreens(s),clocks:window.__filmFx.listClocks()};
    // --list-objects <regex>: world position and yaw of matching objects (plus the desk's pivot).
    if(re){const m=window.ErgoFlex.loadedModel;let root=m;while(root.parent)root=root.parent;root.updateMatrixWorld(true);const r=new RegExp(re,'i'),q=o=>{const p=o.getWorldPosition(o.position.clone()),e=new o.quaternion.constructor();o.getWorldQuaternion(e);const b=new (window.__filmFx.Box3)().setFromObject(o);return {name:o.name,position:[p.x,p.y,p.z].map(v=>+v.toFixed(4)),yaw:+(2*Math.atan2(e.y,e.w)*180/Math.PI).toFixed(2),box:b.isEmpty()?null:[b.min.x,b.min.z,b.max.x,b.max.z,b.max.y].map(v=>+v.toFixed(3))};};
      const box=window.__filmFx.deskBox?.();out.objects=[{...q(m),name:'(desk pivot) '+m.name}];if(box)out.objects.push({name:'(desk box centre)',position:box.map(v=>+v.toFixed(4)),yaw:0});root.traverse(o=>{if(o!==m&&r.test(o.name))out.objects.push(q(o));});}
    return out;},shot,opts['list-objects']||null);
  if(at!==null)await frame.evaluate(()=>window.ErgoPresentation.endBake());
  for(const o of result.objects||[])console.log(`  object ${o.name}  at [${o.position.join(', ')}] yaw ${o.yaw}°${o.box?`  box x ${o.box[0]}..${o.box[2]} z ${o.box[1]}..${o.box[3]} top ${o.box[4]}`:''}`);
  await frame.evaluate(()=>window.__filmFx.clear());
  fs.writeFileSync(path.join(opts.out,tag+'-screens.json'),JSON.stringify({shot:shot.id,room:shot.room,seconds:shot.seconds,...result},null,1));
  console.log(`\n${tag} ${shot.id} (${shot.room}${shot.layout?'/'+shot.layout:''}, ${shot.kind}) — ${result.screens.length} screens, ${result.clocks.length} clocks`);
  for(const s of result.screens)console.log(`  ${(s.alias||s.id).padEnd(34)} ${s.orientation.padEnd(9)} ${String(s.aspect).padEnd(7)} ${(s.widthM*1000).toFixed(0)}×${(s.heightM*1000).toFixed(0)} mm${s.curved?' curved':''}  at [${s.position.join(', ')}] yaw ${s.facingYawDeg}° pitch ${s.facingPitchDeg}°  visible ${s.visibleSamples} max ${s.maxOnScreenPx.join('×')} px  (${s.path})`);
  for(const c of result.clocks)console.log(`  clock ${c.kind.padEnd(7)} ${c.name} at [${c.position.join(', ')}]`);
}

(async()=>{
  // Provenance: which commit and studio-state rev this render used (Win and Desk 02 renders must be comparable).
  {const root=path.resolve(__dirname,'..','..');let sha='?',dirty='';try{sha=execFileSync('git',['-C',root,'rev-parse','--short','HEAD']).toString().trim();
    dirty=execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=no']).toString().trim()?'+dirty':'';}catch{}
   let rev='?';try{rev=JSON.parse(fs.readFileSync(path.join(root,'studio-state.json'),'utf8')).rev;}catch{}
   console.log(`[provenance] git ${sha}${dirty} studio-state rev ${rev} host ${require('os').hostname()} ${process.platform} ${new Date().toISOString()}`);}
  // Windows render box: CHROME_PATH overrides the binary, ANGLE the backend (d3d11 on Windows, vulkan on Linux).
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(win?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/google-chrome'),headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,...(angle==='vulkan'?['--enable-features=Vulkan']:[]),'--mute-audio']});
  {const pg=await browser.newPage();const gpu=await pg.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');const x=gl&&gl.getExtension('WEBGL_debug_renderer_info');return gl?(x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):'no webgl2';}).catch(e=>'probe failed: '+e.message);
   console.log(`[provenance] webgl ${gpu}`);await pg.close();}
  try{const frame=await stage(browser);for(const i of indices)await (opts.listScreens?listShot:renderShot)(frame,i);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
