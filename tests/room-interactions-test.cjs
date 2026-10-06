const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..'), out = '/tmp/ef-room-interaction-review';
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
    const file = path.join(root, new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
        res.end(data);
    });
});
(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error'&&/Shader Error|VALIDATE_STATUS|WebGLProgram/.test(m.text()))errors.push(m.text());});
        await page.setViewport({ width: 1500, height: 1200 });

        await page.goto(`http://127.0.0.1:${server.address().port}/?room=music&view=room&layout=house`);
        await page.waitForFunction(() => window.ErgoFlex?.wheelRigs.length===4&&getComputedStyle(document.querySelector('#loader')).display==='none',{timeout:120000});
        await page.evaluate(async()=>{ErgoFlex.renderer.setPixelRatio(.6);ErgoFlex.renderer.shadowMap.enabled=false;await ErgoFlex.workspaceRoom.ready;ErgoFlex.setMusicLayout('house');await ErgoFlex.workspaceRoom.ready;});

        if(process.argv.includes('--safety')){
            await page.evaluate(()=>{ErgoFlex.renderer.setPixelRatio(.3);ErgoFlex.setLedEffect({mode:'solid'});ErgoFlex.setLedColor('#0345ff');ErgoFlex.setLedsEnabled(true);ErgoFlex.setTouchscreenOpen(true);});
            await page.$eval('#glide-speed',e=>{e.value=[...e.options].at(-1).value;e.dispatchEvent(new Event('change'));});
            await page.click('#remote-alert-sound');
            await page.waitForFunction(()=>ErgoFlex.ledSoundState.audioState==='running');
            const place=async(kind,gap)=>page.evaluate(async({kind,gap})=>{
                const THREE=await import('three'),ef=ErgoFlex,r=ef.roomInteractions,d=r.deskBox(),e=r.entries.find(e=>kind==='chair'?e.pushable&&/steelcase/.test(e.name):/cabinet/i.test(e.name));
                r.entries.forEach(other=>other.obj.visible=other===e);
                const b=new THREE.Box3().setFromObject(e.obj);r.moveObject(e.obj,d.max.x+gap-b.min.x,(d.min.z+d.max.z-b.min.z-b.max.z)/2);
                return {id:e.id,p:e.obj.getWorldPosition(new THREE.Vector3()).toArray(),start:ef.glidePosition,scale:ef.workspaceRoom.root.scale.x};
            },{kind,gap});
            const drive=async(dx)=>page.evaluate(dx=>ErgoFlex.setGlidePosition(ErgoFlex.glidePosition.x+dx,ErgoFlex.glidePosition.z),dx);
            const heavy=await place('cabinet',.3);await drive(.7);
            await page.waitForFunction(()=>ErgoFlex.collisionState.alert,{timeout:60000});
            const event=await page.evaluate(async id=>{const THREE=await import('three'),ef=ErgoFlex,e=ef.roomInteractions.entries.find(e=>e.id===id);return {state:ef.collisionState,at:ef.glidePosition,p:e.obj.getWorldPosition(new THREE.Vector3()).toArray(),sound:ef.ledSoundState,source:ef.ledMotionState.source,colour:[...ef.ledPreviewFrame[0].slice(0,3)],target:ef.glideTarget};},heavy.id);
            console.log('Heavy collision latched',event.state.alert.name);
            assert.equal(event.state.alert.kind,'contact');assert.equal(event.state.alert.pushable,false);assert.deepEqual(event.p,heavy.p);assert.equal(event.sound.alertCount,1);assert.equal(event.source,'collision');assert.ok(event.colour[0]>event.colour[2]*5);
            assert.equal(await drive(-.2),false,'Held until CLEAR');await page.evaluate(()=>ErgoFlex.jogYaw(1));assert.equal(await page.evaluate(()=>ErgoFlex.yawCommand),0);
            await new Promise(r=>setTimeout(r,400));assert.deepEqual(await page.evaluate(()=>ErgoFlex.glidePosition),event.at);assert.deepEqual(event.target,event.at);
            assert.equal(await page.$eval('#room-safety-alert',e=>e.hidden),false);
            await page.screenshot({path:path.join(out,'heavy-collision-alert.png')});
            await page.click('[data-safety-clear]');assert.equal(await page.evaluate(()=>ErgoFlex.collisionState.alert),null);assert.equal(await page.evaluate(()=>ErgoFlex.ledMotionState.source),'base');assert.equal(await page.evaluate(()=>ErgoFlex.ledColor),'#0345ff');
            await drive(-.2);await page.waitForFunction(x=>ErgoFlex.glidePosition.x<x-.15,{timeout:60000},event.at.x);await page.evaluate(()=>ErgoFlex.haltAllMotion());
            const chair=await place('chair',.4);await page.click('#remote-shield');await drive(.7);
            await page.waitForFunction(()=>ErgoFlex.collisionState.alert,{timeout:60000});
            const guarded=await page.evaluate(async id=>{const THREE=await import('three'),ef=ErgoFlex,e=ef.roomInteractions.entries.find(e=>e.id===id),b=new THREE.Box3().setFromObject(e.obj);return {state:ef.collisionState,gap:b.min.x-ef.roomInteractions.deskBox().max.x,p:e.obj.getWorldPosition(new THREE.Vector3()).toArray(),source:ef.ledMotionState.source,sound:ef.ledSoundState};},chair.id);
            assert.equal(guarded.state.alert.kind,'ahead');assert.equal(guarded.state.guard,true);assert.deepEqual(guarded.p,chair.p);assert.ok(Math.abs(guarded.gap/chair.scale-150)<5);assert.equal(guarded.source,'obstacle-ahead');assert.equal(guarded.sound.alertCount,2);
            assert.equal(await page.$eval('#room-safety-alert header',e=>getComputedStyle(e).backgroundColor),'rgb(165, 101, 11)','Amber warning header stays readable');
            console.log('Shield stopped at',guarded.gap/chair.scale,'mm');
            await page.screenshot({path:path.join(out,'shield-obstacle-ahead.png')});
            await page.setViewport({width:480,height:900});await page.screenshot({path:path.join(out,'mobile-obstacle-ahead.png')});
            const clearRect=await page.$eval('[data-safety-clear]',e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});assert.ok(clearRect.x>=0&&clearRect.right<=480&&clearRect.y>=0&&clearRect.bottom<=900,'Mobile CLEAR is accessible');
            await page.click('[data-safety-clear]');await page.click('#remote-shield');await page.click('#remote-alert-sound');
            console.log('Mobile clear and toggles work');
            // Contact with portable furniture stops once, then acknowledged push works.
            await drive(.5);await page.waitForFunction(()=>ErgoFlex.collisionState.alert?.kind==='contact',{timeout:60000});
            assert.equal(await page.evaluate(()=>ErgoFlex.ledSoundState.alertCount),2,'Sound off suppresses cue');
            const at=await page.evaluate(()=>ErgoFlex.glidePosition);await page.click('[data-safety-clear]');await drive(.12);
            await page.waitForFunction(x=>ErgoFlex.glidePosition.x>x+.1,{timeout:60000},at.x);await page.evaluate(()=>ErgoFlex.haltAllMotion());assert.equal(await page.evaluate(()=>ErgoFlex.collisionState.alert),null);console.log('Acknowledged chair push works');
            // Both physical display sizes use the live light/dark artwork.
            await page.setViewport({width:1500,height:1200});
            const saveScreen=async(name)=>{await new Promise(r=>setTimeout(r,160));const url=await page.evaluate(()=>ErgoFlex.touchscreenDisplay.canvas.toDataURL());fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(url.split(',')[1],'base64'));};
            await page.evaluate(()=>ErgoFlex.setMusicMode('morning',false));await saveScreen('touchscreen-light');assert.equal(await page.evaluate(()=>ErgoFlex.touchscreenDisplay.theme),'light');
            await page.evaluate(()=>ErgoFlex.setMusicMode('night',false));await saveScreen('touchscreen-dark');assert.equal(await page.evaluate(()=>ErgoFlex.touchscreenDisplay.theme),'dark');
            await page.evaluate(()=>ErgoFlex.setMusicMode('afternoon',false));await page.select('#studio-environment','led');await saveScreen('touchscreen-led-studio');assert.equal(await page.evaluate(()=>ErgoFlex.touchscreenDisplay.theme),'dark');
            const screens=await page.evaluate(()=>{const out=[];ErgoFlex.loadedModel.traverse(o=>{if(/touchscreen display/i.test(o.name))out.push(o.children[0]?.material.map===ErgoFlex.touchscreenTexture);});return out;});assert.deepEqual(screens,[true,true]);
            assert.deepEqual(errors,[]);console.log('Browser safety passes:',JSON.stringify({heavy:event.state.alert,guardGapMm:guarded.gap/chair.scale,soundCues:guarded.sound.alertCount,screens:out}));return;
        }

        const baseline=await page.evaluate(async()=>{
            const THREE=await import('three'),r=ErgoFlex.workspaceRoom;
            const speakers=r.assets().filter(o=>/speaker/.test(o.userData.propId||''));
            const colours=[];speakers.forEach(o=>o.traverse(m=>{if(m.isMesh)for(const mat of Array.isArray(m.material)?m.material:[m.material])colours.push({name:mat.name,hex:mat.color.getHexString(),metalness:mat.metalness});}));
            return {wall:r.root.getObjectByName('Music control-room acoustic wall').children[0].material.color.getHexString(),colours,
                receivers:r.root.userData.ledSpill?.receivers,objects:ErgoFlex.roomInteractions.entries.map(e=>({name:e.name,movable:e.movable,pushable:e.pushable,surface:e.surface})),
                settings:ErgoFlex.ledMusicMode.dj.settings,sensitivity:ErgoFlex.ledMusicMode.sensitivity};
        });
        assert.equal(baseline.wall,'252b32');assert.ok(baseline.colours.some(m=>m.hex==='14191f'));assert.ok(baseline.colours.some(m=>m.hex==='c4cbd2'&&m.metalness===.8));
        assert.ok(baseline.receivers>50);assert.ok(baseline.objects.some(e=>/steelcase/.test(e.name)&&e.movable));assert.ok(baseline.objects.some(e=>/cabinet/i.test(e.name)&&e.movable&&!e.pushable));
        for(const key of ['beatAlign','remixPresets','remixSliders','remixPhysics','burstsOn','randomizeOn','remixBursts'])assert.equal(baseline.settings[key],true,key);
        assert.equal(baseline.settings.dynamicsMode,'wide');assert.equal(baseline.sensitivity,1);
        console.log('Room style, shared LED receivers and DJ defaults:',JSON.stringify(baseline));
        await page.select('#camera-view','room');
        await page.evaluate(()=>{ErgoFlex.setMusicMode('night',false);ErgoFlex.setLedEffect({mode:'solid'});ErgoFlex.setLedColor('#f10404');ErgoFlex.setLedsEnabled(true);});
        await new Promise(r=>setTimeout(r,1400));
        await page.screenshot({path:path.join(out,'music-red-room.png')});
        const readFloor=()=>page.evaluate(async()=>{
            const THREE=await import('three'),ef=ErgoFlex,pixels=ef.renderer.getContext(),box=ef.roomInteractions.deskBox();
            const p=new THREE.Vector3(box.max.x+.16,0,(box.min.z+box.max.z)/2).project(ef.roomInteractions.camera),c=ef.renderer.domElement;
            ef.renderer.render(ef.roomInteractions.scene,ef.roomInteractions.camera);const data=new Uint8Array(5*5*4);
            pixels.readPixels(Math.round((p.x+1)/2*c.width)-2,Math.round((p.y+1)/2*c.height)-2,5,5,pixels.RGBA,pixels.UNSIGNED_BYTE,data);
            const rgb=[0,0,0];for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)rgb[k]+=data[i+k]/25;
            return {rgb,gain:ef.roomLedSpill.uniforms.efRoomGain.value,starts:ef.roomLedSpill.uniforms.efRoomStart.value.map(v=>v.toArray())};
        });
        const red=await readFloor();await page.evaluate(()=>ErgoFlex.setLedsEnabled(false));await new Promise(r=>setTimeout(r,300));const off=await readFloor();
        assert.equal(off.gain,0);assert.ok(red.rgb[0]>off.rgb[0]+3,`Floor gets red LED light: ${red.rgb} vs ${off.rgb}`);
        await page.evaluate(()=>{ErgoFlex.setLedsEnabled(true);ErgoFlex.setLedColor('#0436ff');});await new Promise(r=>setTimeout(r,300));const blue=await readFloor();assert.ok(blue.rgb[2]>off.rgb[2]+3,'Floor follows blue light');
        console.log('Rendered floor pixels',{red:red.rgb,off:off.rgb,blue:blue.rgb});
        // Isolate the contact pair after the rendered scene checks, then use actual Glide.
        await page.$eval('#glide-speed',e=>{e.value=[...e.options].at(-1).value;e.dispatchEvent(new Event('change'));});
        await page.evaluate(()=>ErgoFlex.renderer.setPixelRatio(.3));
        const push=await page.evaluate(async()=>{
            const THREE=await import('three'),ef=ErgoFlex,r=ef.roomInteractions,desk=r.deskBox(),e=r.entries.find(e=>/steelcase/.test(e.name)),b=new THREE.Box3().setFromObject(e.obj);
            r.entries.filter(other=>other!==e).forEach(other=>other.obj.visible=false);
            r.moveObject(e.obj,desk.max.x+.15-b.min.x,(desk.min.z+desk.max.z-b.min.z-b.max.z)/2);
            const before=e.obj.getWorldPosition(new THREE.Vector3()).toArray(),start=ef.glidePosition;
            ef.setGlidePosition(start.x+.55,start.z);return {id:e.id,before,start};
        });
        await page.waitForFunction(x=>Math.abs(ErgoFlex.glidePosition.x-x)<.002||ErgoFlex.roomCollisionBlocked,{timeout:60000},push.start.x+.55);
        assert.equal(await page.evaluate(()=>ErgoFlex.collisionState.alert?.kind),'contact');
        await page.click('[data-safety-clear]');await page.evaluate(x=>ErgoFlex.setGlidePosition(x,ErgoFlex.glidePosition.z),push.start.x+.55);
        await page.waitForFunction(x=>Math.abs(ErgoFlex.glidePosition.x-x)<.002,{timeout:60000},push.start.x+.55);
        console.log('Driven state',await page.evaluate(()=>({at:ErgoFlex.glidePosition,target:ErgoFlex.glideTarget,blocked:ErgoFlex.roomCollisionBlocked,bounds:ErgoFlex.glideBounds})));
        assert.ok(await page.evaluate(x=>Math.abs(ErgoFlex.glidePosition.x-x)<.01,push.start.x+.55),'Chair path reaches requested position');
        const after=await page.evaluate(async id=>{const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id);return e.obj.getWorldPosition(new THREE.Vector3()).toArray();},push.id);
        assert.ok(after[0]>push.before[0]+.25,'Desk driving pushes the chair');assert.ok(Math.abs(after[1]-push.before[1])<1e-8,'Chair stays on its floor');
        const moved=await readFloor();assert.ok(Math.abs(moved.starts[7][0]-blue.starts[7][0]-.55)<.01,'Room LED sources move with desk');
        // A cabinet remains fixed and stops the same controls.
        const fixed=await page.evaluate(async()=>{
            const THREE=await import('three'),ef=ErgoFlex,r=ef.roomInteractions,d=r.deskBox(),e=r.entries.find(e=>/cabinet/i.test(e.name)),b=new THREE.Box3().setFromObject(e.obj);
            e.obj.visible=true;const chair=r.entries.find(e=>/steelcase/.test(e.name));r.moveObject(chair.obj,0,.9);
            r.moveObject(e.obj,d.max.x+.15-b.min.x,(d.min.z+d.max.z-b.min.z-b.max.z)/2);
            const before=e.obj.getWorldPosition(new THREE.Vector3()).toArray(),start=ef.glidePosition;ef.setGlidePosition(start.x+.7,start.z);return {id:e.id,before,start};
        });
        await page.waitForFunction(()=>ErgoFlex.roomCollisionBlocked,{timeout:60000});
        const stopped=await page.evaluate(async id=>{const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id);return {position:ErgoFlex.glidePosition,furniture:e.obj.getWorldPosition(new THREE.Vector3()).toArray()};},fixed.id);
        assert.deepEqual(stopped.furniture,fixed.before);assert.ok(stopped.position.x<fixed.start.x+.3,'Cabinet stops desk');
        await page.click('[data-safety-clear]');
        // Pick an actual visible mesh surface, rather than the empty centre of a chair.
        const aimAt = id => page.evaluate(async id=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id),b=new THREE.Box3().setFromObject(e.obj),center=b.getCenter(new THREE.Vector3());
            const offset=e.surface==='wall'?new THREE.Vector3(e.wall.axis==='x'?(e.wall.sign||1)*2:.4,.3,e.wall.axis==='z'?(e.wall.sign||1)*2:.4):new THREE.Vector3(1.8,1.7,2.2);
            r.camera.position.copy(center).add(offset);r.controls.target.copy(center);r.controls.update();r.camera.updateMatrixWorld(true);ErgoFlex.workspaceRoom.update(r.camera);
            const rect=r.canvas.getBoundingClientRect(),meshes=[];e.obj.traverse(o=>{if(o.isMesh)meshes.push(o);});
            const belongs=obj=>{for(let p=obj;p;p=p.parent)if(p===e.obj)return true;return false;};
            for(const mesh of meshes){
                const p=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()),v=p.clone().project(r.camera),x=rect.left+(v.x+1)*rect.width/2,y=rect.top+(1-v.y)*rect.height/2;
                if(document.elementFromPoint(x,y)!==r.canvas)continue;r.point({clientX:x,clientY:y});
                const hit=r.ray.intersectObject(r.root,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
                if(hit&&belongs(hit.object))return {x,y,world:hit.point.toArray()};
            }
            throw new Error('No visible mesh surface for '+e.name);
        },id);
        const projectShift = (hit,delta) => page.evaluate(async ({hit,delta})=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,rect=r.canvas.getBoundingClientRect(),p=new THREE.Vector3(...hit.world).add(new THREE.Vector3(...delta)).project(r.camera);
            return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2};
        },{hit,delta});
        const drag = await page.evaluate(async()=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>/steelcase/.test(e.name)),b=new THREE.Box3().setFromObject(e.obj),floor=ErgoFlex.workspaceRoom.floorBounds;
            r.entries.filter(other=>other!==e).forEach(other=>other.obj.visible=false);
            r.moveObject(e.obj,floor.max.x-1.1-b.max.x,floor.max.z-.8-b.max.z);
            return {before:e.obj.position.toArray(),id:e.id};
        });
        const chairHit=await aimAt(drag.id),chairEnd=await projectShift(chairHit,[-.22,0,-.18]);
        await page.mouse.move(chairHit.x,chairHit.y);await page.mouse.down();
        assert.equal(await page.evaluate(()=>!!ErgoFlex.roomInteractions.drag),true,'Click selects chair');
        await page.mouse.move(chairEnd.x,chairEnd.y,{steps:8});await page.mouse.up();
        const dragged=await page.evaluate(id=>{const r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id);return {at:e.obj.position.toArray(),captured:!!r.drag,orbit:r.controls.enabled};},drag.id);
        assert.ok(Math.hypot(dragged.at[0]-drag.before[0],dragged.at[2]-drag.before[2])>50);assert.ok(Math.abs(dragged.at[1]-drag.before[1])<1e-6);assert.equal(dragged.captured,false);assert.equal(dragged.orbit,true);
        await page.click('[data-room-object-turn="15"]');
        assert.ok(await page.evaluate(id=>{const r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id);return Math.abs(e.obj.rotation.y)>.05;},drag.id),'Rotation button turns floor furnishing');
        // A heavy cabinet is manually movable and rotates around its own footprint.
        const cabinet=await page.evaluate(async()=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>/cabinet/i.test(e.name)),b=new THREE.Box3().setFromObject(e.obj),f=ErgoFlex.workspaceRoom.floorBounds;
            r.entries.forEach(other=>other.obj.visible=other===e);r.moveObject(e.obj,f.max.x-1.2-b.max.x,f.max.z-1.2-b.max.z);
            return {id:e.id,before:e.obj.position.toArray(),key:e.obj.userData.sceneAssetKey};
        });
        const cabinetHit=await aimAt(cabinet.id),cabinetEnd=await projectShift(cabinetHit,[-.2,0,-.12]);
        await page.mouse.move(cabinetHit.x,cabinetHit.y);await page.mouse.down();await page.mouse.move(cabinetEnd.x,cabinetEnd.y,{steps:8});await page.mouse.up();
        assert.ok(await page.evaluate(({id,before})=>{const e=ErgoFlex.roomInteractions.entries.find(e=>e.id===id);return Math.hypot(e.obj.position.x-before[0],e.obj.position.z-before[2])>50;},cabinet),'Heavy cabinet drags');
        assert.equal(await page.evaluate(()=>ErgoFlex.roomInteractions.rotateSelected(45)),true,'Heavy cabinet rotates');
        const cabinetSaved=await page.evaluate(id=>{const e=ErgoFlex.roomInteractions.entries.find(e=>e.id===id);return {key:e.obj.userData.sceneAssetKey,p:e.obj.position.toArray(),q:e.obj.quaternion.toArray()};},cabinet.id);
        // Wall art slides horizontally and vertically, and clamps at the room boundary.
        const art=await page.evaluate(async()=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.surface==='wall'&&/waveform/i.test(e.name));
            r.entries.forEach(other=>other.obj.visible=other===e);for(let p=e.obj;p;p=p.parent)p.visible=true;
            const b=new THREE.Box3().setFromObject(e.obj);return {id:e.id,axis:e.wall.axis,before:b.getCenter(new THREE.Vector3()).toArray()};
        });
        const artHit=await aimAt(art.id),artDelta=art.axis==='x'?[0,.15,.2]:[.2,.15,0],artEnd=await projectShift(artHit,artDelta);
        await page.mouse.move(artHit.x,artHit.y);await page.mouse.down();assert.ok(await page.evaluate(()=>ErgoFlex.roomInteractions.drag?.entry.surface==='wall'));
        await page.mouse.move(artEnd.x,artEnd.y,{steps:8});await page.mouse.up();
        const artMoved=await page.evaluate(async id=>{const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>e.id===id);return new THREE.Box3().setFromObject(e.obj).getCenter(new THREE.Vector3()).toArray();},art.id);
        assert.ok(Math.abs(artMoved[1]-art.before[1]-.15)<.01);assert.ok(Math.abs(artMoved[art.axis==='x'?0:2]-art.before[art.axis==='x'?0:2])<1e-8,'Artwork stays attached to wall plane');
        assert.equal(await page.evaluate(()=>ErgoFlex.roomInteractions.rotateSelected(15)),false,'Wall art cannot rotate away from wall');
        assert.equal(await page.$eval('[data-room-object-turn="15"]',e=>e.hidden),true);
        await page.screenshot({path:path.join(out,'music-wall-placement.png')});
        await new Promise(r=>setTimeout(r,450));
        // Scene switches rebuild both registries and remove old material clones.
        await page.evaluate(async()=>{ErgoFlex.setRoomScene('library',false);await ErgoFlex.workspaceRoom.ready;});
        assert.equal(await page.evaluate(()=>ErgoFlex.roomInteractions.root===ErgoFlex.workspaceRoom.root&&ErgoFlex.roomLedSpill.root===ErgoFlex.workspaceRoom.root),true);
        assert.ok(await page.evaluate(()=>ErgoFlex.roomInteractions.entries.some(e=>e.movable)),'Library supports movable furniture');
        await page.evaluate(async()=>{ErgoFlex.setRoomScene('music',false);await ErgoFlex.workspaceRoom.ready;});
        const restored=await page.evaluate(key=>{const e=ErgoFlex.roomInteractions.entries.find(e=>e.obj.userData.sceneAssetKey===key);return {p:e.obj.position.toArray(),q:e.obj.quaternion.toArray()};},cabinetSaved.key);
        for(let i=0;i<3;i++)assert.ok(Math.abs(restored.p[i]-cabinetSaved.p[i])<1e-5,'Saved furniture position restores');
        for(let i=0;i<4;i++)assert.ok(Math.abs(restored.q[i]-cabinetSaved.q[i])<1e-6,'Saved furniture rotation restores');
        // Touch uses the same floor plane and exposes the same rotation controls.
        await page.setViewport({width:480,height:900});
        await page.evaluate(()=>{const r=ErgoFlex.roomInteractions,e=r.entries.find(e=>/cabinet/i.test(e.name));r.entries.forEach(other=>other.obj.visible=other===e);});
        const touchId=await page.evaluate(()=>ErgoFlex.roomInteractions.entries.find(e=>/cabinet/i.test(e.name)).id),touchHit=await aimAt(touchId),touchEnd=await projectShift(touchHit,[-.1,0,0]);
        const touchBefore=await page.evaluate(id=>ErgoFlex.roomInteractions.entries.find(e=>e.id===id).obj.position.toArray(),touchId),cdp=await page.createCDPSession();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchHit.x,y:touchHit.y}]});
        assert.ok(await page.evaluate(()=>ErgoFlex.roomInteractions.drag),'Touch selects furniture');
        for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchHit.x+(touchEnd.x-touchHit.x)*i/6,y:touchHit.y+(touchEnd.y-touchHit.y)*i/6}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.ok(await page.evaluate(({id,before})=>{const e=ErgoFlex.roomInteractions.entries.find(e=>e.id===id);return Math.hypot(e.obj.position.x-before[0],e.obj.position.z-before[2])>30;},{id:touchId,before:touchBefore}),'Touch drag moves cabinet');
        await page.setViewport({width:1500,height:1200});
        await page.evaluate(async()=>{ErgoFlex.setRoomScene('library',false);await ErgoFlex.workspaceRoom.ready;});
        const support=await page.evaluate(async()=>{
            const THREE=await import('three'),r=ErgoFlex.roomInteractions,e=r.entries.find(e=>/study table/i.test(e.name));
            const before=e.objects.map(obj=>obj.getWorldPosition(new THREE.Vector3()).toArray());r.moveObject(e.obj,.1,.1);
            const after=e.objects.map(obj=>obj.getWorldPosition(new THREE.Vector3()).toArray());return {count:e.objects.length,before,after};
        });
        assert.ok(support.count>1,'Study table includes its dressing');
        support.before.forEach((p,i)=>{assert.ok(Math.abs(support.after[i][0]-p[0]-.1)<1e-7);assert.ok(Math.abs(support.after[i][2]-p[2]-.1)<1e-7);assert.ok(Math.abs(support.after[i][1]-p[1])<1e-7);});
        await page.select('#camera-view','room');
        await page.evaluate(()=>{const r=ErgoFlex.roomInteractions;r.select(r.entries.find(e=>/bookshelf/i.test(e.name)));});
        await page.screenshot({path:path.join(out,'library-furniture-controls.png')});
        assert.deepEqual(errors,[]);
        console.log('Music and Library: rendering, off/colour spill, moving sources, driving chair pushes, fixed cabinet blocking, floor dragging, rotation, wall sliding, saved placements and scene switch pass. Screenshots:',out);
    } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
