import * as THREE from 'three';
import { RoomGrounding } from './room-polish.mjs?v=institutional-sweep-20261009';
import { solveFloorMove, overlapArea } from './room-collision.mjs?v=room-regressions-20261007';

const visible = obj => { for(let p=obj;p;p=p.parent)if(!p.visible)return false;return true; };
export const floorBox = box => ({minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z,minY:box.min.y,maxY:box.max.y});
const portable = /chair|steelcase|stool|bench|ottoman|potted|plant|monstera|floor.*lamp|lamp.*floor|vocal-mic|tool.cart|robot-dog/i;
const architecture = /ceiling|window|curtain|door|daylight|lighting.track|suspended.*light|groove/i;
const descendant = (obj,parent) => { for(let p=obj;p;p=p.parent)if(p===parent)return true;return false; };

export class RoomInteractions {
    constructor({canvas,camera,controls,scene,room,deskBox,deskObject,enabled,onChange,onStatus,onSelection,onEditStart,onEditEnd,safety}) {
        Object.assign(this,{canvas,camera,controls,scene,room,deskBox,deskObject,enabled,onChange,onStatus,onSelection,onEditStart,onEditEnd,safety});
        this.entries=[];this.root=null;this.drag=null;this.selected=null;this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
        this.highlight=new THREE.Box3Helper(new THREE.Box3(),0x41d4b0);this.highlight.visible=false;scene.add(this.highlight);
        window.addEventListener('pointerdown',e=>this.down(e),true);
        window.addEventListener('pointermove',e=>this.move(e),true);
        window.addEventListener('pointerup',e=>this.end(e),true);
        window.addEventListener('pointercancel',e=>this.end(e),true);
        window.addEventListener('blur',()=>this.end());
        window.addEventListener('keydown',e=>{if(e.key==='Escape'){this.end();this.select(null);}});
    }
    bind(room=this.room()) {
        this.end();this.select(null);this.root=room?.root;this.entries=[];
        if(!this.root)return;
        room.grounding?.dispose(); room.grounding = null;
        this.root.updateWorldMatrix(true,true);
        const scale=this.root.scale.x,floor=room.floorBounds,wallRoots=new Set(room.walls.map(w=>w.obj));
        const candidates=new Set([...this.root.children,...room.assets()]);
        // Procedural decorations keep their entire frame/board as one object.
        for(const wall of room.walls)for(const obj of wall.obj.children)if(obj.isGroup)candidates.add(obj);
        for(const obj of candidates){
            if(obj.userData.presentationOnly||wallRoots.has(obj)||obj===room.ceilingFixture||obj.isLight||obj.userData.grooveMarker||architecture.test(obj.name))continue;
            if([...candidates].some(parent=>parent!==obj&&!wallRoots.has(parent)&&descendant(obj,parent)))continue;
            const b=new THREE.Box3().setFromObject(obj),size=b.getSize(new THREE.Vector3());
            if(b.isEmpty()||Math.max(size.x,size.z)<scale*50)continue;
            const attached=room.walls.find(w=>descendant(obj,w.obj)),name=(obj.userData.propId||'')+' '+obj.name;
            let wall=attached;
            if(!wall&&obj.userData.propAnchor==='wall'){
                const center=b.getCenter(new THREE.Vector3());
                wall=room.walls.reduce((best,w)=>!best||Math.abs(center[w.axis]-w.limit)<Math.abs(center[best.axis]-best.limit)?w:best,null);
            }
            let surface;
            if(wall&&obj.userData.propAnchor==='wall')surface='wall';
            else if(b.min.y>=-scale*5&&b.min.y<=scale*120&&b.max.y>scale*.5)surface='floor';
            else if(wall)surface='wall';
            else continue;
            // The floor slab and architectural overlays are not furnishings.
            if(surface==='floor'&&size.x>floor.max.x-floor.min.x-scale*50&&size.z>floor.max.z-floor.min.z-scale*50)continue;
            if(surface==='floor'&&attached)this.root.attach(obj);
            const flat=surface==='floor'&&size.y<scale*35;
            const pushable=surface==='floor'&&!flat&&portable.test(name)&&Math.max(size.x,size.z)<scale*1300;
            const entry={id:obj.uuid,obj,movable:true,pushable,collider:surface==='floor'&&!flat,surface,wall,
                name:obj.userData.sceneAssetName||obj.userData.propId||obj.name||(flat?'Floor rug':'Room furnishing'),objects:[obj]};
            this.entries.push(entry);obj.userData.propAnchor=surface;obj.userData.floorInteraction=surface==='wall'?'wall':pushable?'pushable':'placeable';
        }
        // Keep table dressing, equipment and activity kits with their support.
        for(const entry of this.entries.filter(e=>e.surface==='floor'&&e.collider)){
            const life=room.life?.entries.find(e=>e.objects.includes(entry.obj));
            if(life&&['table','piano','training'].includes(life.role))entry.objects.push(...life.objects);
            const b=new THREE.Box3().setFromObject(entry.obj);
            for(const obj of this.root.children){
                if(this.entries.some(e=>e.obj===obj)||wallRoots.has(obj)||obj.isLight||obj===room.ceilingFixture)continue;
                const childBox=new THREE.Box3().setFromObject(obj),c=childBox.getCenter(new THREE.Vector3());
                if(!childBox.isEmpty()&&childBox.min.y>=b.max.y-scale*45&&childBox.min.y<=b.max.y+scale*45&&c.x>=b.min.x&&c.x<=b.max.x&&c.z>=b.min.z&&c.z<=b.max.z)entry.objects.push(obj);
            }
            entry.objects=[...new Set(entry.objects)].filter(obj=>!entry.objects.some(parent=>parent!==obj&&descendant(obj,parent)));
        }
        this.entries.forEach((entry,i)=>entry.objects.forEach((obj,j)=>room.registerInteractionAsset(obj,`${room.id}:${room.roomLayout?.id||'shell'}:placement:${i}:${j}:${obj.name}`)));
        room.grounding = room.roomLayout ? new RoomGrounding(room, this.entries) : null;
    }
    select(entry) {
        this.selected=entry;this.highlight.visible=!!entry;
        if(entry)this.highlight.box.setFromObject(entry.obj);
        this.onSelection?.(entry);
    }
    obstacles(except=null) {
        return this.entries.filter(e=>e.collider&&e.obj!==except&&e.obj.parent&&visible(e.obj)).map(e=>({...e,movable:e.pushable,box:floorBox(new THREE.Box3().setFromObject(e.obj))}));
    }
    applyTransform(objects,matrix) {
        for(const obj of objects){
            if(!obj.parent)continue;
            obj.updateWorldMatrix(true,false);
            const local=obj.parent.matrixWorld.clone().invert().multiply(matrix).multiply(obj.matrixWorld);
            local.decompose(obj.position,obj.quaternion,obj.scale);obj.updateMatrixWorld(true);
        }
    }
    moveObject(obj,x,z,y=0) {
        const entry=this.entries.find(e=>e.obj===obj);
        this.applyTransform(entry?.objects||[obj],new THREE.Matrix4().makeTranslation(x,y,z));
        if(this.selected)this.highlight.box.setFromObject(this.selected.obj);
    }
    commitPushes(result) {for(const p of result.pushes){const entry=this.entries.find(e=>e.id===p.id);if(entry)this.moveObject(entry.obj,p.x,p.z);}if(result.pushes.length)this.onChange?.();}
    moveDesk(box,delta) {
        const room=this.room();if(!room?.root||room.root!==this.root)return {...delta,blocked:false};
        const obstacles=this.obstacles(),stop=this.safety?.check(floorBox(box),delta,obstacles,room.root.scale.x);
        if(stop)return stop;
        const result=solveFloorMove(floorBox(box),delta,obstacles,floorBox(room.floorBounds),{step:room.root.scale.x*25,gap:room.root.scale.x*3});
        // A cleared portable object can transmit contact to another furnishing
        // below the desktop. Report the actual blocker from the push chain.
        if(result.blocked&&result.contact&&this.safety)result.event=this.safety.contact(result.contact,floorBox(box),room.root.scale.x);
        this.commitPushes(result);return result;
    }
    turnSafety(before,after) {
        if(this.root!==this.room()?.root)return null;
        return this.safety?.turn(floorBox(before),floorBox(after),this.obstacles(),this.root.scale.x);
    }
    canTurn(before,after) {
        if(this.root!==this.room()?.root)return true;
        return !this.obstacles().some(o=>overlapArea(floorBox(after),o.box)>Math.max(1e-10,overlapArea(floorBox(before),o.box)+1e-10));
    }
    rotateSelected(degrees) {
        const entry=this.selected,room=this.room();if(!entry||entry.surface!=='floor'||this.drag||!this.enabled())return false;
        const edit=this.onEditStart?.();
        const before=new THREE.Box3().setFromObject(entry.obj),pivot=before.getCenter(new THREE.Vector3());pivot.y=0;
        const matrix=new THREE.Matrix4().makeTranslation(pivot.x,0,pivot.z).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(degrees))).multiply(new THREE.Matrix4().makeTranslation(-pivot.x,0,-pivot.z));
        // Use actual rotated geometry bounds; rotating the old AABB overestimates round chairs.
        const saved=entry.objects.map(obj=>({obj,p:obj.position.clone(),q:obj.quaternion.clone(),s:obj.scale.clone()}));
        this.applyTransform(entry.objects,matrix);
        const after=new THREE.Box3().setFromObject(entry.obj),f=room.floorBounds;
        const dx=THREE.MathUtils.clamp(0,f.min.x-after.min.x,f.max.x-after.max.x),dz=THREE.MathUtils.clamp(0,f.min.z-after.min.z,f.max.z-after.max.z);
        const fits=after.max.x-after.min.x<=f.max.x-f.min.x&&after.max.z-after.min.z<=f.max.z-f.min.z;
        this.moveObject(entry.obj,dx,dz);after.translate(new THREE.Vector3(dx,0,dz));
        const obstacles=entry.collider?this.obstacles(entry.obj):[],desk=this.deskBox();if(entry.collider&&desk)obstacles.push({box:floorBox(desk)});
        const blocked=!fits||obstacles.some(o=>overlapArea(floorBox(after),o.box)>Math.max(1e-10,overlapArea(floorBox(before),o.box)+1e-10));
        if(blocked){saved.forEach(({obj,p,q,s})=>{obj.position.copy(p);obj.quaternion.copy(q);obj.scale.copy(s);obj.updateMatrixWorld(true);});this.onStatus?.('Move this furnishing into a clear space before rotating it.');}
        else {this.onEditEnd?.(edit);this.onChange?.();}
        this.highlight.box.setFromObject(entry.obj);return !blocked;
    }
    point(event) {
        const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
        this.ray.setFromCamera(this.pointer,this.camera);
    }
    down(e) {
        if(e.target!==this.canvas||e.button!==0||!this.enabled()||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;
        if(this.drag){this.end();return;}
        this.point(e);
        const hit=this.ray.intersectObject(this.root||new THREE.Group(),true).find(h=>visible(h.object));
        if(!hit){this.select(null);return;}
        const entry=this.entries.find(row=>row.objects.some(obj=>descendant(hit.object,obj)));
        if(!entry){this.select(null);return;}
        const desk=this.deskObject?.(),deskHit=desk&&this.ray.intersectObject(desk,true).find(h=>visible(h.object)&&!h.object.material?.isShaderMaterial);
        if(deskHit&&deskHit.distance<hit.distance-.01)return;
        const normal=entry.surface==='wall'?new THREE.Vector3(entry.wall.axis==='x'?1:0,0,entry.wall.axis==='z'?1:0):new THREE.Vector3(0,1,0);
        const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),anchor=new THREE.Vector3();
        if(!this.ray.ray.intersectPlane(plane,anchor))return;
        this.drag={entry,pointer:e.pointerId,plane,last:anchor.clone(),controlsEnabled:this.controls.enabled,changed:false,edit:this.onEditStart?.()};
        this.controls.enabled=false;this.controls.autoRotate=false;this.canvas.setPointerCapture(e.pointerId);this.canvas.style.cursor='grabbing';this.select(entry);
        this.onStatus?.(`Drag ${entry.name} along the ${entry.surface}. ${entry.surface==='floor'?'Use the rotation buttons to turn it.':'Release to place it.'}`);
        e.preventDefault();e.stopImmediatePropagation();
    }
    move(e) {
        const d=this.drag;if(!d||d.pointer!==e.pointerId)return;
        this.point(e);const point=new THREE.Vector3();
        if(this.ray.ray.intersectPlane(d.plane,point)){
            const room=this.room(),box=new THREE.Box3().setFromObject(d.entry.obj),delta=point.clone().sub(d.last);
            if(d.entry.surface==='wall'){
                const axis=d.entry.wall.axis,tangent=axis==='x'?'z':'x',f=room.floorBounds,height=(room.roomLayout?.height||3000)*room.root.scale.x;
                delta[axis]=0;delta[tangent]=THREE.MathUtils.clamp(delta[tangent],f.min[tangent]-box.min[tangent],f.max[tangent]-box.max[tangent]);
                delta.y=THREE.MathUtils.clamp(delta.y,room.root.scale.x*120-box.min.y,height-box.max.y);
                this.moveObject(d.entry.obj,delta.x,delta.z,delta.y);d.changed||=delta.length()>1e-8;
            }else{
                const obstacles=d.entry.collider?this.obstacles(d.entry.obj):[],desk=this.deskBox();
                if(d.entry.collider&&desk)obstacles.push({id:'desk',box:floorBox(desk),movable:false});
                const result=solveFloorMove(floorBox(box),{x:delta.x,z:delta.z},obstacles,floorBox(room.floorBounds),{step:room.root.scale.x*25,gap:room.root.scale.x*3});
                this.moveObject(d.entry.obj,result.x,result.z);this.commitPushes(result);d.changed||=Math.hypot(result.x,result.z)>1e-8;
            }
            d.last.copy(point);this.highlight.box.setFromObject(d.entry.obj);
        }
        e.preventDefault();e.stopImmediatePropagation();
    }
    end(e) {
        const d=this.drag;if(!d||(e&&e.pointerId!==d.pointer))return;
        if(this.canvas.hasPointerCapture(d.pointer))this.canvas.releasePointerCapture(d.pointer);
        this.controls.enabled=d.controlsEnabled;this.canvas.style.cursor='';this.drag=null;
        if(d.changed){this.onEditEnd?.(d.edit);this.onChange?.();}
        if(e){e.preventDefault();e.stopImmediatePropagation();}
    }
}
