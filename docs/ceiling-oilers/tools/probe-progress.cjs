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
// render-still.cjs: a copy of render-cut.cjs for ONE still at any size, written as a lossless PNG (render-cut's --at stills are 960x540 JPEGs).
//   node tools/experience/render-still.cjs --cut cut.json --shots 0 --at 0.995 --size 7680x4320 --ss 1 --out dir --quality hq13 --storage <seed> --state-keys ergoflex.sceneAssets.v1
//   → dir/NN-still-<WxH>.png  (--ss > 1 renders larger and Lanczos-downsamples to --size)
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
const FX_FIELDS=['deskObjects','screens','ledMode','ledGlow','ledSurfaces','ledGain','ledColor','sceneGlobals','clock','timeOfDay','accessories','sceneEdits','lights','ledStatus','obstacles','ledFill','floorLight','quality','ledReceivers','ledNeutral','deskFinish','screenGain','lightEdits','sceneBranding','sceneDeskEdits','featuredBuild','statusLight','screenLook'];
// --quality hq13 | '{json}': film-quality overrides on every shot (shot.quality wins). See film-quality.mjs.
const QUALITY=opts.quality?(/^\s*\{/.test(opts.quality)?JSON.parse(opts.quality):opts.quality):null;
if(QUALITY)for(const s of cut.shots)if(s.quality===undefined)s.quality=QUALITY;
const usesFx=shot=>FX_FIELDS.some(k=>shot[k]!==undefined);
async function loadFx(frame){await frame.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});}
async function grab(frame,t,seconds,quality=.96,chapter=seconds,video=false){
  const url=await frame.evaluate(async(t,s,q,c,v)=>{const fx=window.__filmFx;if(fx)await fx.frame(t,c,{video:v});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}return window.__rc.toDataURL(q==='png'?'image/png':'image/jpeg',q==='png'?undefined:q);},t,seconds,quality,chapter,video);
  return Buffer.from(url.slice(url.indexOf(',')+1),'base64');
}


// ---- fixC probe 2: touchscreen at given PROGRESS values (after baking --at-sec), every part in the desk model's own frame ----
async function probeShot(frame,i){
  const shot=cut.shots[i];await loadFx(frame);
  await frame.evaluate(async s=>{window.__filmFx.clear();window.__filmFx.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx.unhookPreset();}},shot);
  await frame.evaluate(s=>window.__filmFx.install(s),shot);
  await frame.evaluate(async()=>{window.__THREE=await import("three");});
  await frame.evaluate(()=>{window.__rc=document.createElement('canvas');window.__rc.width=320;window.__rc.height=180;window.ErgoPresentation.beginBake(320,180);});
  const sec=Number(opts['at-sec']||5.0);
  await frame.evaluate(async(t,s)=>{const fx=window.__filmFx;if(fx)await fx.frame(t,s,{video:true});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}},sec/shot.seconds,sec);
  const progs=String(opts.progress||'0,0.25,0.5,0.75,1').split(',').map(Number);
  const out=await frame.evaluate((progs)=>{
    const T=window.__THREE,m=window.ErgoFlex.loadedModel;let root=m;while(root.parent)root=root.parent;
    const vis=o=>{while(o){if(o.visible===false)return false;o=o.parent;}return true;};
    const under=(o,rx)=>{while(o){if(o.name&&rx.test(o.name))return true;o=o.parent;}return false;};
    let anim=null;m.traverse(o=>{if(o.name==='Animated touchscreen')anim=o;});
    const res={progress:[],parts:{}};
    root.updateMatrixWorld(true);const inv=m.matrixWorld.clone().invert();
    const lbox=o=>{const b=new T.Box3();const g=o.geometry;if(!g)return null;const p=g.attributes.position,v=new T.Vector3();const M=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld);for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k).applyMatrix4(M);b.expandByPoint(v);}return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(x=>+x.toFixed(3));};
    m.traverse(o=>{if(o.isMesh&&/^(Desktop|Extended desktop|Standard desktop|Touch_Screen|Top_Shelf$|Left wing|Right wing)/.test(o.name)&&!/LED|reflection|bounce|logo/i.test(o.name))res.parts[o.name+(res.parts[o.name]?'#2':'')]={vis:vis(o),box:lbox(o)};});
    res.modelScale=[m.scale.x,m.scale.y,m.scale.z];const ws=new T.Vector3();m.getWorldScale(ws);res.worldScale=[ws.x,ws.y,ws.z];
    const tris=o=>{const g=o.geometry,pos=g.attributes.position,idx=g.index,n=idx?idx.count/3:pos.count/3,M=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),r=[];for(let i=0;i<n;i++){const t=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,idx?idx.getX(i*3+k):i*3+k).applyMatrix4(M));r.push({t,b:new T.Box3().setFromPoints(t)});}return r;};
    const segHit=(a,b,tr)=>{const e1=new T.Vector3().subVectors(tr[1],tr[0]),e2=new T.Vector3().subVectors(tr[2],tr[0]),d=new T.Vector3().subVectors(b,a),len=d.length();if(len<1e-9)return false;d.divideScalar(len);const p=new T.Vector3().crossVectors(d,e2),det=e1.dot(p);if(Math.abs(det)<1e-12)return false;const iv=1/det,tv=new T.Vector3().subVectors(a,tr[0]),u=tv.dot(p)*iv;if(u<0||u>1)return false;const q=new T.Vector3().crossVectors(tv,e1),v=d.dot(q)*iv;if(v<0||u+v>1)return false;const tt=e2.dot(q)*iv;return tt>=0&&tt<=len;};
    const dist=(p,tr)=>{const c=new T.Vector3();new T.Triangle(tr[0],tr[1],tr[2]).closestPointToPoint(p,c);return c.distanceTo(p);};
    for(const p of progs){
      window.ErgoFlex.setFilmTouchscreen({progress:p,screen:null});root.updateMatrixWorld(true);
      const S=[],O=[];m.traverse(o=>{if(!o.isMesh||!vis(o))return;if(/LED|reflection|bounce|glow|spill/i.test(o.name))return;if((anim&&under(o,/^Animated touchscreen$/))||/^Touch_Screen(_|$)/.test(o.name))S.push(o);else O.push(o);});
      const ST=[];for(const s of S)for(const x of tris(s))ST.push({...x,n:s.name});
      const sb=new T.Box3();for(const s of ST)sb.union(s.b);const margin=3,eb=sb.clone().expandByScalar(margin);
      const per={};
      for(const o of O){const OT=tris(o).filter(x=>x.b.intersectsBox(eb));if(!OT.length)continue;let hits=0,minD=Infinity,hitBy={};
        for(const s of ST){const sx=s.b.clone().expandByScalar(margin);for(const ot of OT){if(!sx.intersectsBox(ot.b))continue;
          if(s.b.intersectsBox(ot.b)){let h=false;for(let k=0;k<3&&!h;k++)h=segHit(s.t[k],s.t[(k+1)%3],ot.t)||segHit(ot.t[k],ot.t[(k+1)%3],s.t);if(h){hits++;minD=0;hitBy[s.n]=(hitBy[s.n]||0)+1;continue;}}
          for(const q of s.t){const d=dist(q,ot.t);if(d<minD)minD=d;}for(const q of ot.t){const d=dist(q,s.t);if(d<minD)minD=d;}}}
        per[o.name]={hits,min:+minD.toFixed(3),hitBy};}
      const parts={};for(const s of S){parts[s.name+(parts[s.name]?'#':'')]=lbox(s);}
      res.progress.push({p,screenBox:[sb.min.x,sb.min.y,sb.min.z,sb.max.x,sb.max.y,sb.max.z].map(x=>+x.toFixed(3)),obst:per,parts});
    }
    return res;},progs);
  console.log('PROBE2 '+JSON.stringify(out));
  fs.writeFileSync(path.join(opts.out,'probe2.json'),JSON.stringify(out,null,1));
  await frame.evaluate(()=>window.ErgoPresentation.endBake());
}
(async()=>{
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,'--mute-audio']});
  try{const frame=await stage(browser);for(const i of indices)await probeShot(frame,i);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
