#!/usr/bin/env node
// Wellness (ch 7) measurement in the real stage, as render-cut.cjs draws it (prepare, film fx, bakeFrame at chapter time):
// every sample logs the featured desk (height in inches, the desktop's real top from its meshes), Maya (every drawn
// model of her: bones in room millimetres), the desk actor's state (tau: 0 seated .. 2.6 standing, k: hands on the keys)
// and the task chair (where it is). One JSON line per sample.
//   node tools/experience/render-server.cjs 4977 &
//   node docs/wellness-order/wellness-probe.cjs --cut C:/work/vwell/x.json --shot wellness --log out.jsonl [--from 0] [--to T] [--step 0.0333]
//        [--size 320x180] [--frames dir] [--server http://127.0.0.1:4977]
// (based on tools/experience/people-ghost-probe.cjs; GPU: run it through /f/eng-tools/gpuretry.sh)
const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path');
const opts={cut:null,shot:'wellness',from:0,to:null,step:1/30,frames:null,size:'320x180',server:'http://127.0.0.1:4977',log:null};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');opts[k]=process.argv[++i];}
const cut=JSON.parse(fs.readFileSync(opts.cut,'utf8')),shot=cut.shots.find(s=>s.id===opts.shot);if(!shot){console.error('no shot '+opts.shot);process.exit(2);}
const FX_FIELDS=['deskObjects','screens','ledMode','ledGlow','ledSurfaces','ledGain','ledColor','sceneGlobals','clock','timeOfDay','accessories','sceneEdits','lights','ledStatus','obstacles','ledFill','floorLight','quality','ledReceivers','ledNeutral','deskFinish','screenGain','lightEdits','sceneBranding','sceneDeskEdits','featuredBuild'];
const fx=FX_FIELDS.some(k=>shot[k]!==undefined),[W,H]=opts.size.split('x').map(Number),step=Number(opts.step),from=Number(opts.from),to=opts.to===null?shot.seconds:Number(opts.to);
if(opts.frames)fs.mkdirSync(opts.frames,{recursive:true});
if(opts.log)fs.writeFileSync(opts.log,'');
(async()=>{
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(win?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/google-chrome'),headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--ignore-gpu-blocklist','--enable-gpu-rasterization','--use-angle='+angle,'--mute-audio']});
  try{
    const page=await browser.newPage();await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
    page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,240)));
    page.on('console',m=>{const t=m.text();if(m.type()==='error'||/\[people\]/.test(t))console.log('[stage]',t.slice(0,240));});
    await page.goto(opts.server+'/experience/experience.css');
    await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
    const frame=await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
    if(fx)await frame.evaluate(async()=>{if(!window.__filmFx)window.__filmFx=await import('/tools/experience/film-fx.mjs');});
    await frame.evaluate(async s=>{window.__filmFx?.clear();window.__filmFx?.beforePrepare(s);try{await window.ErgoPresentation.prepare(s);}finally{window.__filmFx?.unhookPreset();}},shot);
    if(fx)await frame.evaluate(s=>window.__filmFx.install(s),shot);
    await frame.evaluate((w,h)=>{window.__rc=document.createElement('canvas');window.__rc.width=w;window.__rc.height=h;window.ErgoPresentation.beginBake(w,h);},W,H);
    const chapterFrames=Math.max(2,Math.round(shot.seconds*30));let n=0;
    for(let s=0;s<from-1e-9;s+=1/30){const t=Math.min(1,s/((chapterFrames-1)/30));await frame.evaluate(async(t,s)=>{const fx=window.__filmFx;if(fx)await fx.frame(t,s,{video:true});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}},t,s);}
    for(let s=from;s<=to+1e-9;s+=step,n++){
      const t=Math.min(1,s/((chapterFrames-1)/30));
      const r=await frame.evaluate(async(t,s,c,want)=>{
        const fx=window.__filmFx;if(fx)await fx.frame(t,c,{video:true});try{await window.ErgoPresentation.bakeFrame(t,window.__rc,s);}finally{fx?.after();}
        const room=window.ErgoFlex.workspaceRoom,P=room?.people,st=room?.peopleState?.()||{};
        const out={h:st.height!=null?+st.height.toFixed(3):null,pose:st.pose?{x:Math.round(st.pose.x),z:Math.round(st.pose.z),yaw:+((st.pose.yaw||0)*180/Math.PI).toFixed(2)}:null,kb:st.keyboard?[Math.round(st.keyboard.x),Math.round(st.keyboard.z)]:null,maya:[],img:null};
        if(!P)return out;
        const grp=P.people[0]?.parent;if(grp)grp.updateMatrixWorld(true);
        const loc=obj=>{const v=obj.getWorldPosition(obj.position.clone());if(grp)grp.worldToLocal(v);return [+v.x.toFixed(1),+v.y.toFixed(1),+v.z.toFixed(1)];};
        const BONES=['head','neck_01','spine_03','pelvis','hand_l','hand_r','middle_03_l','middle_03_r','lowerarm_l','lowerarm_r','upperarm_l','upperarm_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
        for(const o of P.people){if(!o.visible)continue;const who=P.character(o);if(who!=='maya')continue;const a=o.userData.personAmount??1;
          const bones={},rb=o.userData.personRig?.bones;if(rb)for(const nm of BONES){const b=rb.get(nm);if(b)bones[nm]=loc(b);}
          out.maya.push({key:P.keyOf(o.userData.person),id:o.userData.person.id,amount:+a.toFixed(3),at:[Math.round(o.position.x),Math.round(o.position.z)],yaw:+(o.rotation.y*180/Math.PI).toFixed(1),bones});}
        const actor=P.actors.find(a=>a.character==='maya');
        if(actor){out.tau=actor.state?+actor.state.tau.toFixed(3):null;out.k=actor.state?+actor.state.k.toFixed(3):null;out.away=+(actor.away||0).toFixed(3);out.cover=+(actor.cover??0).toFixed(3);
          const ch=actor.chair;if(ch)out.chair={vis:ch.visible,at:loc(ch),yaw:+(ch.rotation.y*180/Math.PI).toFixed(1)};}
        // the featured desk's desktop: the highest mesh top among the desk's meshes whose name says top / desktop (cached list)
        // (the desktop: of the featured desk's own meshes (not its dressing, props, people), the thin ones (< 90 mm) with the
        // largest footprint, within 15 % of the largest; listed once in out.deskMeshes)
        if(!window.__deskTops){const cand=[];room.root.traverse(m=>{if(!m.isMesh||!m.geometry)return;let p=m,path='';while(p){path=(p.name||'')+'>'+path;p=p.parent;}if(!/ErgoFlex desk/.test(path)||/Desk dressing|Prop:|Person|LED|Added prop|Film screen/.test(path))return;
            m.updateMatrixWorld(true);if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const b=m.geometry.boundingBox.clone();b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);const sx=(b.max.x-b.min.x)*1000,sy=(b.max.y-b.min.y)*1000,sz=(b.max.z-b.min.z)*1000;if(sy<90&&sx*sz>2e5)cand.push([m,sx*sz,path.slice(-90)]);});
          const big=Math.max(...cand.map(c=>c[1]));window.__deskTops=cand.filter(c=>c[1]>.85*big).map(c=>c[0]);out.deskMeshes=cand.filter(c=>c[1]>.85*big).map(c=>[c[2],Math.round(c[1]/1e3)]);}
        let top=-1e9,bot=1e9,minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
        for(const m of window.__deskTops){if(!m.geometry)continue;if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const bb=m.geometry.boundingBox;m.updateMatrixWorld(true);
          for(const x of [bb.min.x,bb.max.x])for(const y of [bb.min.y,bb.max.y])for(const z of [bb.min.z,bb.max.z]){const v=m.localToWorld(m.position.clone().set(x,y,z));if(grp)grp.worldToLocal(v);top=Math.max(top,v.y);bot=Math.min(bot,v.y);minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);minz=Math.min(minz,v.z);maxz=Math.max(maxz,v.z);}}
        out.desk={n:window.__deskTops.length,top:+top.toFixed(1),bottom:+bot.toFixed(1),x:[+minx.toFixed(0),+maxx.toFixed(0)],z:[+minz.toFixed(0),+maxz.toFixed(0)]};
        // once: where the screens and the tablet are (room mm, the people's frame), for the noticing glance
        if(!window.__objsDone){window.__objsDone=1;out.objects=[];room.root.traverse(m=>{if(!/tablet|Tablet|monitor-screen|Monitor|Prop:tablet-pc/.test(m.name||''))return;const v=m.getWorldPosition(m.position.clone());if(grp)grp.worldToLocal(v);out.objects.push([m.name.slice(0,80),m.type,[+v.x.toFixed(0),+v.y.toFixed(0),+v.z.toFixed(0)]]);});}
        if(want)out.img=window.__rc.toDataURL('image/jpeg',.9);
        return out;
      },t,s,s,!!opts.frames);
      if(opts.frames&&r.img)fs.writeFileSync(path.join(opts.frames,'t'+s.toFixed(3).padStart(7,'0')+'.jpg'),Buffer.from(r.img.slice(r.img.indexOf(',')+1),'base64'));
      delete r.img;
      if(opts.log)fs.appendFileSync(opts.log,JSON.stringify({s:+s.toFixed(4),...r})+'\n');
      if(n%30===0)console.log(s.toFixed(2),JSON.stringify({h:r.h,tau:r.tau,k:r.k,away:r.away,maya:r.maya.map(m=>m.key+':'+m.amount),chair:r.chair,desk:r.desk}));
    }
    console.log(`${opts.shot} ${from}-${to} s every ${step.toFixed(4)} s: ${n} samples`);
    await frame.evaluate(()=>{window.ErgoPresentation.endBake();window.__filmFx?.clear();}).catch(()=>{});
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
