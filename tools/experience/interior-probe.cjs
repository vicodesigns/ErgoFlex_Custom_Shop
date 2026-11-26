#!/usr/bin/env node
// interior-probe.cjs: what a film chapter's room is made of, for interior look-dev (interior-cinema.mjs).
// Boots the film stage like render-still.cjs, prepares one shot and prints the room's shell: layout, walls, lights,
// the big surfaces with their materials, and every root-level furnishing with its box (room millimetres).
//   node tools/experience/interior-probe.cjs --cut cut.json --shot coast [--look cinema] [--match 'regex'] [--eval 'js'] [--server http://127.0.0.1:3017]
const puppeteer=require('puppeteer-core'),fs=require('fs');
const opts={server:'http://127.0.0.1:3017',shot:'0'};
for(let i=2;i<process.argv.length;i++)opts[process.argv[i].replace(/^--/,'')]=process.argv[++i];
const cut=JSON.parse(fs.readFileSync(opts.cut,'utf8')),shot=cut.shots.find(s=>s.id===opts.shot)||cut.shots[Number(opts.shot)];
if(!shot){console.error('no such shot');process.exit(2);}
if(opts.look)shot.look=opts.look;
(async()=>{
  const win=process.platform==='win32',angle=process.env.ANGLE||(win?'d3d11':'vulkan');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(win?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/google-chrome'),headless:'new',defaultViewport:{width:1280,height:720},
    args:['--no-sandbox','--ignore-gpu-blocklist','--use-angle='+angle,...(angle==='vulkan'?['--enable-features=Vulkan']:[]),'--mute-audio']});
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>console.log('[stage error]',String(e).slice(0,240)));
    await page.goto(opts.server+'/experience/experience.css');
    if(opts.storage){let seed=JSON.parse(fs.readFileSync(opts.storage,'utf8'));if(seed.format==='ergoflex-studio-state-v1')seed=Object.fromEntries(Object.entries(seed.keys).filter(([,r])=>!r.deleted).map(([k,r])=>[k,r.value]));
      await page.evaluate(s=>{localStorage.clear();for(const [k,v] of Object.entries(s))localStorage.setItem(k,v);},seed);}
    await page.evaluate(()=>{document.documentElement.innerHTML='<body style="margin:0;background:#000"><iframe id="s" style="width:1280px;height:720px;border:0" src="/?view=product&presentation=1&tour=1"></iframe></body>';});
    const frame=await (await page.waitForSelector('#s')).contentFrame();
    await frame.waitForFunction(()=>window.ErgoPresentation,{timeout:180000});
    await frame.evaluate(async s=>{await window.ErgoPresentation.prepare(s);},shot);
    const out=await frame.evaluate(re=>{
      const room=window.ErgoFlex.workspaceRoom,root=room.root,r=n=>Math.round(n),lines=[];
      const L=room.roomLayout||{};lines.push(`room ${room.id} look ${room.look} layout ${L.id} w ${L.width} d ${L.depth} h ${L.height} back ${L.back} left ${L.left??'-'} scale ${root.scale.x.toFixed(6)}`);
      lines.push('layout keys: '+Object.keys(L).filter(k=>typeof L[k]!=='function'&&k!=='props'&&k!=='stations').map(k=>k+'='+JSON.stringify(L[k])).join(' ').slice(0,900));
      root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();
      const Box3=root.children[0]&&(()=>{let o=root;while(!o.isMesh)o=o.children.find(c=>c.isMesh)||o.children[0];o.geometry.computeBoundingBox();return o.geometry.boundingBox.constructor;})();
      const box=o=>{const b=new Box3();o.traverse(m=>{if(!m.isMesh||!m.geometry)return;m.geometry.computeBoundingBox();const g=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inv);b.union(g);});return b;};
      const fmt=b=>b.isEmpty()?'(empty)':`x ${r(b.min.x)}..${r(b.max.x)} y ${r(b.min.y)}..${r(b.max.y)} z ${r(b.min.z)}..${r(b.max.z)}`;
      const mat=m=>{m=[].concat(m)[0];return m?`${m.type.replace('Mesh','').replace('Material','')} #${m.color?.getHexString?.()} r${m.roughness??'-'} m${m.metalness??'-'}${m.map?' map':''}${m.bumpMap?' bump':''}${m.normalMap?' nrm':''}${m.emissive&&m.emissiveIntensity&&m.emissive.getHex()?' em#'+m.emissive.getHexString()+'*'+m.emissiveIntensity:''}${m.userData?.surface?' ['+m.userData.surface+']':''}${m.transparent?' transp':''}`:'';};
      lines.push('walls: '+room.walls.map(w=>`${w.obj?.name||'?'}{${Object.keys(w).filter(k=>k!=='obj').map(k=>k+':'+JSON.stringify(w[k])).join(',').slice(0,120)}}`).join(' | '));
      let scene=root;while(scene.parent)scene=scene.parent;
      scene.traverse(o=>{if(o.isLight){const p=o.getWorldPosition(o.position.clone()).applyMatrix4(inv);lines.push(`light ${o.type} "${o.name}" in "${o.parent?.name}" #${o.color.getHexString()} i ${o.intensity.toFixed(3)} at ${r(p.x)},${r(p.y)},${r(p.z)}${o.castShadow?' shadow':''}${o.distance?' dist '+r(o.distance/root.scale.x):''} vis ${o.visible}`);}});
      const match=re?new RegExp(re,'i'):null;
      for(const o of root.children){
        const b=box(o),s=b.isEmpty()?null:b.getSize(b.min.clone());
        const big=s&&(Math.max(s.x,s.z)>1500||s.y>1500);
        if(match?!match.test(o.name):false)continue;
        lines.push(`${o.isMesh?'mesh ':'group'} "${o.name}" ${fmt(b)}${o.isMesh?' '+mat(o.material):''}${o.visible?'':' HIDDEN'}${o.userData.presentationOnly?' presentation':''}`);
        if(!o.isMesh&&(match||big)&&o.children.length<=(match?400:14))o.traverse(m=>{if(m!==o&&m.isMesh)lines.push(`      · "${m.name}" ${fmt(box(m))} ${mat(m.material)}`);});
      }
      return lines.join('\n');
    },opts.match||null);
    console.log(out);
    // --eval '<js expression>': run in the stage (window.ErgoFlex is the studio api) and print the result
    if(opts.eval)console.log(JSON.stringify(await frame.evaluate(src=>(0,eval)(src),opts.eval),null,1));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
