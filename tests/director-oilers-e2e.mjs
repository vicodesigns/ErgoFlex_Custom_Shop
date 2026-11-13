// Director, chapter 6 (oilers, the high school) in the alternate cut (real GPU Chrome). Vico's notes on it:
//  - the white APA set-design desk clipped through the student chair beside it, the whole chapter;
//  - a girl appeared when the desk moved, who should have been there all along: the featured desk's user is at the
//    desk from 0 s, but the one shot of her seated (7.5-8.2 s, "at the featured desk") had the camera inside a student
//    (Ava, whom the cut leaves out because the camera flies through her seat), so she was first seen rising at ~10 s;
//  - the room's front wall did not match the others: its wainscot came out orange and 1.45 m high (film-edits gave the
//    charcoal wainscot and the orange rail, two copies of one library prop, one shared material copy).
// Checks, at times across the chapter and through the 8-11 s lift to 43.5 in:
//  - no chair (room chairs, the desk user's chair, the drafting stool) inside any ErgoFlex desk of the room: chair vertices
//    tested against every desk mesh's own bounding box (oriented with the mesh, so tilted tops count where they are);
//  - one featured-desk user, shown at every sampled time (no gap, no second copy); the film camera never inside a person;
//    at 7.9 s the desk user is in frame with nobody between her and the camera;
//  - one front wall, one wainscot, one rail and one Oiler spirit wall; the wainscot charcoal, the rail orange, each its own
//    material; the three end inside the side walls and match the room's dado (top and orange rail heights).
//   HQ=exports/cinematic-intro-20261110-alt flock /tmp/claude-1000/hq12-stills.lock node tests/director-oilers-e2e.mjs
//   (HQ defaults to the alternate cut here; SHOTS=dir keeps stills)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.HQ ||= 'exports/cinematic-intro-20261110-alt';
const {root,HQ,chapterList,wait,seek,openDirectorBrowser,openChapter}=await import('./director-e2e-harness.mjs');

const chapter=chapterList()?.find(c=>c.id==='oilers');
if(!chapter||!fs.existsSync(path.join(root,chapter.page))){console.log(`Director oilers e2e: skipped (${HQ} has no oilers chapter page in this checkout).`);process.exit(0);}
const shots=process.env.SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'director-oilers-e2e-'));fs.mkdirSync(shots,{recursive:true});
const {base,page,errors,close}=await openDirectorBrowser();
const failures=[],check=(ok,what)=>{console.log(`${ok?'ok  ':'FAIL'} ${what}`);if(!ok)failures.push(what);};
const TIMES=[0,4,7.9,8.5,9,9.5,10,10.5,11,12,13.9];
try{
  await openChapter(page,base,chapter);
  await page.waitForFunction(()=>!!document.getElementById('stage').contentWindow.__filmEdits,{timeout:60000});await wait(3000);
  const sample=()=>page.evaluate(()=>{
    const w=document.getElementById('stage').contentWindow,E=w.ErgoFlex,t=w.ErgoPresentation.three(),T=w.__directorThree.THREE,P=E.workspaceRoom.people;
    const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    t.scene.updateMatrixWorld(true);
    // chairs vs desks
    const meshes=[];for(const [id,r] of E.sceneDesks.records)if(r.group&&shown(r.group))r.group.traverse(m=>{if(m.isMesh&&shown(m)&&m.geometry&&!m.material?.transparent&&!/LED|glow|reflection|shadow|pool|light/i.test(m.name)){m.geometry.computeBoundingBox();const b=m.geometry.boundingBox.clone().expandByScalar(-.002);if(!b.isEmpty())meshes.push({id,inv:m.matrixWorld.clone().invert(),b,wb:new T.Box3().setFromObject(m)});}});
    const chairs=[];t.scene.traverse(o=>{const k=(o.name||'')+' '+(o.userData?.propId||'');if(!/chair|stool|leap/i.test(k)||!shown(o))return;const p=o.parent;if(p&&/chair|stool|leap/i.test((p.name||'')+' '+(p.userData?.propId||'')))return;chairs.push(o);});
    const clashes=[],v=new T.Vector3(),l=new T.Vector3();
    for(const c of chairs){const cb=new T.Box3().setFromObject(c),near=meshes.filter(d=>d.wb.intersectsBox(cb));if(!near.length)continue;let n=0,on='';
      c.traverse(m=>{if(!m.isMesh||!shown(m)||!m.geometry?.attributes?.position)return;const pos=m.geometry.attributes.position,step=Math.max(1,Math.floor(pos.count/3000));
        for(let i=0;i<pos.count;i+=step){v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);for(const d of near){l.copy(v).applyMatrix4(d.inv);if(d.b.containsPoint(l)){n++;on=d.id;break;}}}});
      if(n)clashes.push(`${c.userData?.sceneAssetKey||c.name} in ${on} (${n} points)`);}
    // people
    const people=P.people.filter(o=>o.visible&&shown(o)),user=people.filter(o=>o.userData.person.desk&&!o.userData.person.station);
    const cam=t.camera.getWorldPosition(new T.Vector3()),boxes=people.map(o=>({o,b:new T.Box3().setFromObject(o)}));
    const inside=boxes.filter(x=>x.b.containsPoint(cam)).map(x=>x.o.userData.person.id);
    let view=null;
    if(user.length===1){const ub=boxes.find(x=>x.o===user[0]).b,head=new T.Vector3((ub.min.x+ub.max.x)/2,ub.max.y-.12,(ub.min.z+ub.max.z)/2),ndc=head.clone().project(t.camera);
      const ray=new T.Ray(cam,head.clone().sub(cam).normalize()),far=cam.distanceTo(head),hit=new T.Vector3();
      const between=boxes.filter(x=>x.o!==user[0]&&ray.intersectBox(x.b,hit)&&cam.distanceTo(hit)<far).map(x=>x.o.userData.person.id);
      view={inFrame:Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&ndc.z<1,between};}
    // the front wall
    const named=re=>{const out=[];t.scene.traverse(o=>{if(re.test(o.name||'')&&shown(o))out.push(o);});return out;};
    const box=o=>new T.Box3().setFromObject(o),mat=o=>{let m=null;o.traverse(x=>{if(!m&&x.isMesh)m=x.material;});return m;};
    const wall=named(/^Added prop:kenney-furniture-wall#oilfw$/),wn=named(/^Added prop:kenney-furniture-paneling#oilwn$/),rl=named(/^Added prop:kenney-furniture-paneling#oilrl$/),pride=named(/^Wall Oiler pride display$/);
    const side=named(/^High school side wall$/)[0],win=named(/^High school window wall$/)[0];
    const caps=[];win?.traverse(o=>{if(o.name==='Wainscot cap rail')caps.push(box(o));});
    const front={wall:wall.length,wainscot:wn.length,rail:rl.length,pride:pride.length};
    if(wall.length===1&&wn.length===1&&rl.length===1&&side&&win){
      const zmin=box(side).min.z-.1,zmax=box(win).max.z+.1,inRoom=o=>{const b=box(o);return b.min.z>=zmin&&b.max.z<=zmax;};
      Object.assign(front,{wnColor:'#'+mat(wn[0]).color.getHexString(),rlColor:'#'+mat(rl[0]).color.getHexString(),ownMaterials:mat(wn[0])!==mat(rl[0]),
        inside:[wall[0],wn[0],rl[0]].every(inRoom),wnTop:+box(wn[0]).max.y.toFixed(3),rlMid:+((box(rl[0]).min.y+box(rl[0]).max.y)/2).toFixed(3),
        roomTop:caps.length?+Math.max(...caps.map(b=>b.max.y)).toFixed(3):null,roomRail:caps.length?+((Math.min(...caps.map(b=>b.min.y))+Math.min(...caps.map(b=>b.max.y)))/2).toFixed(3):null});
    }
    return {clashes,users:user.map(o=>o.userData.person.id),userChar:user.map(o=>o.userData.person.id.split('-')[1]),inside,view,front,height:E.sceneDesks.records.get('main')?.state?.height};
  });
  let character=null;
  for(const s of TIMES){
    await seek(page,s);await wait(1800);const r=await sample();
    await (await page.$('#stage')).screenshot({path:path.join(shots,`oilers-${s}.png`)});
    check(!r.clashes.length,`${s} s (desk at ${r.height} in): no chair inside a desk${r.clashes.length?': '+r.clashes.join('; '):''}`);
    check(r.users.length===1,`${s} s: one featured-desk user shown (${r.users.join(', ')||'nobody'})`);
    character??=r.userChar[0];check(r.userChar[0]===character,`${s} s: the same person at the desk (${r.userChar[0]})`);
    check(!r.inside.length,`${s} s: the camera is not inside a person${r.inside.length?' (inside '+r.inside.join(', ')+')':''}`);
    if(s===7.9)check(r.view?.inFrame&&!r.view.between.length,`7.9 s ("at the featured desk"): the desk user is in frame, nobody in front of her: ${JSON.stringify(r.view)}`);
    if(s===0){
      const f=r.front;console.log('     front wall:',JSON.stringify(f));
      check(f.wall===1&&f.wainscot===1&&f.rail===1&&f.pride===1,'one front wall, wainscot, rail and Oiler spirit wall');
      check(f.wnColor==='#2a2c30'&&f.rlColor==='#e8721c'&&f.ownMaterials,`front wainscot charcoal, rail orange, each its own material (${f.wnColor} / ${f.rlColor})`);
      check(f.inside,'front wall, wainscot and rail end inside the side walls');
      check(Math.abs(f.wnTop-f.roomTop)<.03&&Math.abs(f.rlMid-f.roomRail)<.03,`front wainscot matches the room's dado: top ${f.wnTop} vs ${f.roomTop}, orange rail ${f.rlMid} vs ${f.roomRail}`);
    }
  }
}catch(e){failures.push(e.message);console.log('FAIL',e.message);}
finally{if(errors.length){failures.push('page errors');console.log('page errors:',errors.slice(0,5));}await close();}
console.log(failures.length?`\n${failures.length} failed`:'\nDirector oilers e2e: all passed','· stills in',shots);process.exit(failures.length?1:0);
