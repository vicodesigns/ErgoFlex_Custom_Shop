#!/usr/bin/env node
// The browser counterpart of people-ghost-audit.mjs (S20): renders a span of one chapter in the real stage, as
// render-cut.cjs does (prepare, film fx, bakeFrame at chapter time), and after every frame asks the room's people
// (window.ErgoFlex.workspaceRoom.people) who is drawn: per character, every visible model with its opacity, and the
// changes of posture (pairs) with whether their skeletons were ready. Prints every sample where a character is two
// models at once, and optionally writes the frames (for before/after clips and stills).
//   node tools/experience/render-server.cjs 3120 &
//   node tools/experience/people-ghost-probe.cjs --cut exports/cinematic-intro-cut-cine/review-cut.json --shot storage \
//        --from 2.4 --to 4.0 [--step 0.0083333] [--frames out-dir] [--size 640x360] [--server http://127.0.0.1:3120]
// GPU: take the lock first (mkdir /c/work/gpu.lock; rmdir after).
const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path');
const opts={cut:null,shot:null,from:0,to:null,step:1/120,frames:null,size:'640x360',server:'http://127.0.0.1:3120',threshold:.02};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');opts[k]=process.argv[++i];}
if(!opts.cut||!opts.shot){console.error('Usage: people-ghost-probe.cjs --cut cut.json --shot id [--from s] [--to s] [--step s] [--frames dir]');process.exit(2);}
const cut=JSON.parse(fs.readFileSync(opts.cut,'utf8')),shot=cut.shots.find(s=>s.id===opts.shot);if(!shot){console.error('no shot '+opts.shot);process.exit(2);}
const FX_FIELDS=['deskObjects','screens','ledMode','ledGlow','ledSurfaces','ledGain','ledColor','sceneGlobals','clock','timeOfDay','accessories','sceneEdits','lights','ledStatus','obstacles','ledFill','floorLight','quality','ledReceivers','ledNeutral','deskFinish','screenGain','lightEdits','sceneBranding','sceneDeskEdits','featuredBuild'];
const fx=FX_FIELDS.some(k=>shot[k]!==undefined),[W,H]=opts.size.split('x').map(Number),step=Number(opts.step),from=Number(opts.from),to=opts.to===null?shot.seconds:Number(opts.to);
if(opts.frames)fs.mkdirSync(opts.frames,{recursive:true});
(async()=>{
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(win?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/google-chrome'),headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,'--mute-audio']});
  try{
    const page=await browser.newPage();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,240)));
    page.on('requestfailed',r=>console.log('[request failed]',r.url().slice(0,160),r.failure()?.errorText));
    page.on('console',m=>{if(m.type()==='error')console.log('[stage]',m.text().slice(0,240));});
    await page.goto(opts.server+'/experience/experience.css');
    await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
    const frame=await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
    if(fx)await frame.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});
    await frame.evaluate(async s=>{window.__filmFx?.clear();window.__filmFx?.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx?.unhookPreset();}},shot);
    if(fx)await frame.evaluate(s=>window.__filmFx.install(s),shot);
    await frame.evaluate((w,h)=>{window.__rc=document.createElement('canvas');window.__rc.width=w;window.__rc.height=h;window.ErgoPresentation.beginBake(w,h);},W,H);
    const chapterFrames=Math.max(2,Math.round(shot.seconds*30)),ghosts=[],prev={},fast={};let n=0,pairsSeen=null;
    for(let s=from;s<=to+1e-9;s+=step,n++){
      const t=Math.min(1,s/((chapterFrames-1)/30));
      const r=await frame.evaluate(async(t,s,c,q,want,th)=>{
        const fx=window.__filmFx;if(fx)await fx.frame(t,c,{video:true});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}
        const P=window.ErgoFlex.workspaceRoom?.people,by={};
        if(P)for(const o of P.people){if(!o.visible)continue;const a=o.userData.personAmount??1;if(a<=th)continue;const who=P.character(o)||o.userData.person.id;
          // head and hands in room millimetres (the frame of the group the people stand in)
          const parts={},bones=o.userData.personRig?.bones;if(bones&&o.parent){o.parent.updateMatrixWorld(true);for(const n of ['head','hand_l','hand_r']){const b=bones.get(n);if(!b)continue;const p=b.getWorldPosition(o.position.clone());o.parent.worldToLocal(p);parts[n]=[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)];}}
          (by[who]||=[]).push({key:P.keyOf(o.userData.person),id:o.userData.person.id,amount:+a.toFixed(3),rigged:!!o.userData.personRig,at:[Math.round(o.position.x),Math.round(o.position.z)],yaw:+(o.rotation.y*180/Math.PI).toFixed(1),parts});}
        const pairs=P?P.pairs.map(p=>({from:P.keyOf(p.from),to:P.keyOf(p.to),at:p.at,ready:!!p.ready,length:p.length&&+p.length.toFixed(3)})):[];
        return {by,pairs,pending:P?P.pending.size:0,img:want?window.__rc.toDataURL('image/jpeg',q):null};
      },t,s,s,.9,!!opts.frames,Number(opts.threshold));
      if(!pairsSeen){pairsSeen=r.pairs;console.log('pairs at first frame:',JSON.stringify(r.pairs),'pending',r.pending);}
      if(opts.log)fs.appendFileSync(opts.log,JSON.stringify({s:+s.toFixed(5),by:r.by})+'\n');
      // continuity: head and hands of one figure between consecutive sub-frames, per 1/120 s (people-ghost-audit.mjs JUMP)
      for(const [who,list] of Object.entries(r.by)){
        const m=list.length===1?list[0]:null,last=prev[who];
        if(m&&last&&s-last.s<=step+1e-6){let d=0,part='';for(const k in m.parts)if(last.parts[k]){const v=Math.hypot(...m.parts[k].map((x,i)=>x-last.parts[k][i]))*(1/120)/(s-last.s);if(v>d){d=v;part=k;}}
          if(d>(fast[who]?.mm||0))fast[who]={mm:Math.round(d),part,s:+s.toFixed(4)};if(d>40)console.log(`JUMP ${s.toFixed(4)} s ${who}: ${part} ${Math.round(d)} mm in 1/120 s (${last.key} -> ${m.key})`);}
        prev[who]=m?{s,parts:m.parts,key:m.key}:null;
      }
      for(const [who,list] of Object.entries(r.by))if(list.length>1){ghosts.push({s,who,list});console.log(`GHOST ${s.toFixed(4)} s ${who}: ${list.map(m=>`${m.key}(${m.id}) ${m.amount}${m.rigged?'':' unrigged'}`).join(' + ')}`);}
      if(opts.frames&&r.img)fs.writeFileSync(path.join(opts.frames,String(n).padStart(4,'0')+'.jpg'),Buffer.from(r.img.slice(r.img.indexOf(',')+1),'base64'));
    }
    console.log(`${opts.shot} ${from}-${to} s every ${step.toFixed(4)} s: ${n} frames, ${ghosts.length} with a character drawn twice; fastest head/hand per 1/120 s: ${JSON.stringify(fast)}`);
    await frame.evaluate(()=>{window.ErgoPresentation.endBake();window.__filmFx?.clear();}).catch(()=>{});
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
