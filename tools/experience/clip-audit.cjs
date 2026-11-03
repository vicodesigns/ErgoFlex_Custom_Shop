#!/usr/bin/env node
// Clipping / collision audit for Director cuts. Drives the same stage as
// render-cut.cjs, steps each chapter through --samples fractions (so desk
// motion, camera and film-fx edits are all applied) and reports world-space
// bounding boxes that interpenetrate.
//
//   node tools/experience/clip-audit.cjs --cut cut.json --shots all --out report.json [--samples 13]
//   node tools/experience/clip-audit.cjs --cut cut.json --shots 1 --dump     (print the item tree)
//
// Items are the named top-level groups of the room (Prop:*, Accessory:*,
// desk objects) plus the desk model itself. Pairs are flagged when their
// boxes overlap by more than --tol metres on every axis (default 0.01); the
// desk model is only compared against chairs and tables, because every desk
// accessory legitimately rests on it. Boxes are conservative (axis aligned),
// so a flag is a candidate to look at, not proof of a visible clip.
const puppeteer=require('puppeteer-core'),fs=require('fs');
const opts={cut:null,shots:'all',out:null,samples:13,tol:0.01,dump:false,server:'http://127.0.0.1:3017'};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');if(k==='dump')opts.dump=true;else opts[k]=process.argv[++i];}
if(!opts.cut){console.error('Usage: clip-audit.cjs --cut cut.json [--shots all|0,1,…] [--samples N] [--tol m] [--out report.json] [--dump]');process.exit(2);}
const cut=JSON.parse(fs.readFileSync(opts.cut,'utf8'));
const indices=opts.shots==='all'?cut.shots.map((_,i)=>i):String(opts.shots).split(',').map(Number);
const FX_FIELDS=['screens','ledMode','ledGlow','ledSurfaces','ledGain','sceneGlobals','clock','timeOfDay','accessories','sceneEdits','lights'];

// Runs inside the stage iframe.
function collect(){
  const THREE=window.__THREE;
  const room=window.ErgoFlex.workspaceRoom?.root,desk=window.ErgoFlex.loadedModel;
  let scene=desk||room;while(scene?.parent)scene=scene.parent;scene.updateMatrixWorld(true);
  const items=[];
  const add=(o,kind)=>{
    if(!o.visible)return;
    const b=new THREE.Box3().setFromObject(o);if(b.isEmpty())return;
    items.push({name:o.name||o.type,kind,min:b.min.toArray(),max:b.max.toArray(),parent:o.parent?.name||''});
  };
  if(desk)add(desk,'desk');
  const seen=new Set();
  const walk=(o,depth)=>{
    for(const c of o.children){
      if(c.userData?.filmFx)continue;
      const named=/^(Prop:|Accessory:|Desk object|Scene object)/.test(c.name)||c.userData?.propId||c.userData?.accessoryId||c.userData?.sceneAssetKey;
      if(named&&!seen.has(c)){seen.add(c);add(c,/chair|steelcase|seat|stool|sofa|armchair/i.test(c.name)?'seat':/table|desk|bench/i.test(c.name)?'table':'item');continue;}
      if(depth<4)walk(c,depth+1);
    }
  };
  if(room)walk(room,0);
  if(desk)walk(desk,0);
  return items;
}

(async()=>{
  const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle=vulkan','--enable-features=Vulkan','--mute-audio']});
  const report=[];
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,200)));
    await page.goto(opts.server+'/experience/experience.css');
    await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
    const frame=await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
    await frame.evaluate(async()=>{window.__filmFx=window.__filmFx||await import('/tools/experience/film-fx.mjs');window.__THREE=await import('three');});
    for(const i of indices){
      const shot=cut.shots[i],fx=FX_FIELDS.some(k=>shot[k]!==undefined);
      await frame.evaluate(async s=>{window.__filmFx.clear();window.__filmFx.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx.unhookPreset();}},shot);
      if(fx)await frame.evaluate(s=>window.__filmFx.install(s),shot);
      await frame.evaluate(()=>{window.__rc=document.createElement('canvas');window.__rc.width=480;window.__rc.height=270;window.ErgoPresentation.beginBake(480,270);});
      const hits=new Map();let first=null;
      for(let k=0;k<opts.samples;k++){
        const t=k/(opts.samples-1),secs=t*shot.seconds;
        const items=await frame.evaluate(async(t,secs,fxOn,src)=>{
          if(fxOn)await window.__filmFx.frame(t,secs,{video:false});
          try{await window.ErgoPresentation.bakeFrame(t,window.__rc,secs);}finally{if(fxOn)window.__filmFx.after();}
          return new Function('return ('+src+')')()();
        },t,secs,fx,collect.toString()).catch(e=>{console.log('sample failed',e.message);return[];});
        if(opts.dump&&!first){first=items;console.log(`\n${shot.id} t=${t}`);for(const it of items)console.log(' ',it.kind.padEnd(6),it.name.slice(0,44).padEnd(45),it.min.map(v=>v.toFixed(2)).join(','),'→',it.max.map(v=>v.toFixed(2)).join(','));}
        const tol=Number(opts.tol);
        for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
          const A=items[a],B=items[b];
          if(A.kind==='desk'&&B.kind==='item'||B.kind==='desk'&&A.kind==='item')continue;
          if(A.name===B.name)continue;
          const pen=[0,1,2].map(ax=>Math.min(A.max[ax],B.max[ax])-Math.max(A.min[ax],B.min[ax]));
          if(pen.every(p=>p>tol)){
            const key=A.name+' | '+B.name,h=hits.get(key)||{a:A.name,b:B.name,kinds:A.kind+'/'+B.kind,samples:[],maxPen:[0,0,0]};
            h.samples.push(+t.toFixed(3));h.maxPen=h.maxPen.map((m,ax)=>+Math.max(m,pen[ax]).toFixed(3));hits.set(key,h);
          }
        }
      }
      await frame.evaluate(()=>{window.ErgoPresentation.endBake();window.__filmFx.clear();}).catch(()=>{});
      const list=[...hits.values()];report.push({shot:shot.id,index:i,hits:list});
      console.log(`${String(i+1).padStart(2,'0')} ${shot.id}: ${list.length} overlapping pair(s)`);
      for(const h of list)console.log(`   ${h.kinds.padEnd(11)} ${h.a} × ${h.b}  pen[m] ${h.maxPen.join(' ')}  at t=${h.samples.join(',')}`);
    }
  }finally{await browser.close();}
  if(opts.out)fs.writeFileSync(opts.out,JSON.stringify(report,null,1));
})().catch(e=>{console.error(e);process.exit(1);});
