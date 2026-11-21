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


// ---- fixC touchscreen probe: bakes the chapter at each --times second and measures the touchscreen against the desk ----
// Output: one JSON line per time (PROBE {...}) and <out>/probe.json
async function probeShot(frame,i){
  const shot=cut.shots[i];await loadFx(frame);
  await frame.evaluate(async s=>{window.__filmFx.clear();window.__filmFx.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx.unhookPreset();}},shot);
  await frame.evaluate(s=>window.__filmFx.install(s),shot);
  await frame.evaluate(async()=>{window.__THREE=await import("three");});
  await frame.evaluate(()=>{window.__rc=document.createElement('canvas');window.__rc.width=320;window.__rc.height=180;window.ErgoPresentation.beginBake(320,180);});
  const times=String(opts.times||'5,5.5,6,6.5,7,7.5,8').split(',').map(Number);
  const obstRx=opts.obst?new RegExp(opts.obst):null;
  const rows=[];
  for(const sec of times){
    const t=sec/shot.seconds;
    await frame.evaluate(async(t,s)=>{const fx=window.__filmFx;if(fx)await fx.frame(t,s,{video:true});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}},t,sec);
    const row=await frame.evaluate((sec,obstSrc)=>{
      const m=window.ErgoFlex.loadedModel;let root=m;while(root.parent)root=root.parent;root.updateMatrixWorld(true);
      const V=m.position.constructor,B=window.__filmFx.Box3;
      const vis=o=>{while(o){if(o.visible===false)return false;o=o.parent;}return true;};
      const under=(o,rx)=>{while(o){if(o.name&&rx.test(o.name))return true;o=o.parent;}return false;};
      let anim=null;m.traverse(o=>{if(o.name==='Animated touchscreen')anim=o;});
      const inv=m.matrixWorld.clone().invert();
      // world -> desk model local (the model's own units) and world metres
      const S=[],O=[];
      const isScreen=o=>(anim&&under(o,/^Animated touchscreen$/))||/^Touch_Screen(_|$)/.test(o.name);
      root.traverse(o=>{if(!o.isMesh||!vis(o)||o.isSkinnedMesh)return;if(under(o,/^Person/))return;
        if(isScreen(o))S.push(o);else O.push(o);});
      const tris=(o)=>{const g=o.geometry,pos=g.attributes.position,idx=g.index,n=idx?idx.count/3:pos.count/3,out=[];
        for(let i=0;i<n;i++){const t=[0,1,2].map(k=>new V().fromBufferAttribute(pos,idx?idx.getX(i*3+k):i*3+k).applyMatrix4(o.matrixWorld));
          const b=new B().setFromPoints(t);out.push({t,b});}return out;};
      const sb=new B();for(const s of S){const b=new B().setFromObject(s);if(!b.isEmpty())sb.union(b);}
      const ST=[];for(const s of S)for(const x of tris(s))ST.push({...x,o:s.name});
      const margin=0.08,eb=sb.clone().expandByScalar(margin);
      const ray=new (window.__filmFx.Ray||m.position.constructor)();
      const segHit=(a,b,tr)=>{ // segment a-b against triangle tr (Moller-Trumbore)
        const e1=new V().subVectors(tr[1],tr[0]),e2=new V().subVectors(tr[2],tr[0]),d=new V().subVectors(b,a),len=d.length();if(len<1e-9)return false;d.divideScalar(len);
        const p=new V().crossVectors(d,e2),det=e1.dot(p);if(Math.abs(det)<1e-12)return false;const inv=1/det,tv=new V().subVectors(a,tr[0]),u=tv.dot(p)*inv;if(u<0||u>1)return false;
        const q=new V().crossVectors(tv,e1),v=d.dot(q)*inv;if(v<0||u+v>1)return false;const tt=e2.dot(q)*inv;return tt>=0&&tt<=len;};
      const closest=(p,tr)=>{const T=window.__THREE.Triangle;if(T){const tri=new T(tr[0],tr[1],tr[2]);const c=new V();tri.closestPointToPoint(p,c);return c.distanceTo(p);}return Math.min(...tr.map(v=>v.distanceTo(p)));};
      const per={};
      for(const o of O){const bo=new B().setFromObject(o);if(bo.isEmpty()||!eb.intersectsBox(bo))continue;if(/LED|reflection|glow|spill/i.test(o.name)&&!(obstSrc&&new RegExp(obstSrc).test(o.name)))continue;
        const OT=tris(o).filter(x=>x.b.intersectsBox(eb));if(!OT.length)continue;let hits=0,minD=Infinity;
        for(const s of ST){const sbx=s.b.clone().expandByScalar(margin);
          for(const ot of OT){if(!sbx.intersectsBox(ot.b))continue;
            if(s.b.intersectsBox(ot.b)){let h=false;for(let k=0;k<3&&!h;k++){h=segHit(s.t[k],s.t[(k+1)%3],ot.t)||segHit(ot.t[k],ot.t[(k+1)%3],s.t);}if(h){hits++;minD=0;continue;}}
            for(const p of s.t){const d=closest(p,ot.t);if(d<minD)minD=d;}for(const p of ot.t){const d=closest(p,s.t);if(d<minD)minD=d;}
            const mids=[0,1,2].map(k=>new V().addVectors(s.t[k],s.t[(k+1)%3]).multiplyScalar(.5));for(const p of mids){const d=closest(p,ot.t);if(d<minD)minD=d;}}}
        const key=o.name+(o.parent&&o.parent.name?' ['+o.parent.name+']':'');per[key]={hits,minMm:+(minD*1000).toFixed(1),box:[bo.min.x,bo.min.y,bo.min.z,bo.max.x,bo.max.y,bo.max.z].map(v=>+v.toFixed(3))};}
      // the screen pose in the model's own frame
      let moving=null,rails=null;if(anim)for(const c of anim.children){if(c.name==='Touchscreen slide rails')rails=c;else if(!c.name&&c.isGroup)moving=c;}
      const dispMesh=[];if(anim)anim.traverse(o=>{if(o.isMesh&&vis(o)&&/display/i.test(o.parent?.name||o.name))dispMesh.push(o);});
      const dispBox=new B();for(const d of dispMesh)dispBox.union(new B().setFromObject(d));
      const loc=v=>v.clone().applyMatrix4(inv);
      const lb=new B();for(const s of ST)for(const p of s.t)lb.expandByPoint(loc(p));
      // Noah: the visible person whose id has noah, his right hand and index tip
      let hand=null,tip=null,who=null,head=null;
      root.traverse(o=>{if(o.name&&/^Person:.*noah/.test(o.name)&&vis(o)){who=o.name;o.traverse(b=>{if(b.isBone){if(b.name==='hand_r')hand=b;if(b.name==='head')head=b;if(/^(index|middle)_?0?3_r$|index3_r|index_03_r/.test(b.name))tip=tip||b;}});}});
      const hp=hand?hand.getWorldPosition(new V()):null,tp=tip?tip.getWorldPosition(new V()):null;
      let handScreen=null;if(hp&&ST.length){let d=Infinity;for(const s of ST){const dd=closest(hp,s.t);if(dd<d)d=dd;}handScreen=+(d*1000).toFixed(1);}
      let tipScreen=null;if(tp&&ST.length){let d=Infinity;for(const s of ST){const dd=closest(tp,s.t);if(dd<d)d=dd;}tipScreen=+(d*1000).toFixed(1);}
      const r3=v=>v?[v.x,v.y,v.z].map(x=>+x.toFixed(4)):null;
      const rr=window.ErgoFlex.workspaceRoom?.root;const roomInfo=rr?{scale:rr.getWorldScale(new V()).x,quat:rr.getWorldQuaternion(new (window.__THREE.Quaternion)()).toArray().map(x=>+x.toFixed(5)),pos:r3(rr.getWorldPosition(new V()))}:null;
      let who2=null;root.traverse(o=>{if(o.name&&/^Person:.*noah/.test(o.name)&&vis(o))who2={name:o.name,pos:[o.position.x,o.position.y,o.position.z].map(x=>+x.toFixed(1)),rotY:+(o.rotation.y*180/Math.PI).toFixed(2),world:r3(o.getWorldPosition(new V()))};});
      return {sec,roomInfo,noahObj:who2,moving:moving?{x:+moving.position.x.toFixed(4),rotZdeg:+(moving.rotation.z*180/Math.PI).toFixed(2),visible:vis(moving)}:null,
        screenWorldBox:[sb.min.x,sb.min.y,sb.min.z,sb.max.x,sb.max.y,sb.max.z].map(v=>+v.toFixed(4)),screenLocalBox:[lb.min.x,lb.min.y,lb.min.z,lb.max.x,lb.max.y,lb.max.z].map(v=>+v.toFixed(3)),
        displayWorldCentre:dispBox.isEmpty()?null:r3(dispBox.getCenter(new V())),screenMeshes:S.map(s=>s.name).slice(0,30),
        noah:who,head:head?r3(head.getWorldPosition(new V())):null,hand:r3(hp),handLocal:hp?r3(loc(hp)):null,tip:r3(tp),handToScreenMm:handScreen,tipToScreenMm:tipScreen,obstacles:per,
        deskTop:(()=>{const e=[];m.traverse(o=>{if(o.isMesh&&vis(o)&&/desktop/i.test(o.name)){const b=new B().setFromObject(o);e.push([o.name,[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(v=>+v.toFixed(3))]);}});return e;})()};
    },sec,obstRx?opts.obst:null);
    rows.push(row);console.log('PROBE '+JSON.stringify(row));
  }
  await frame.evaluate(()=>window.ErgoPresentation.endBake());
  fs.writeFileSync(path.join(opts.out,'probe.json'),JSON.stringify(rows,null,1));
}
(async()=>{
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,'--mute-audio']});
  try{const frame=await stage(browser);for(const i of indices)await probeShot(frame,i);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
