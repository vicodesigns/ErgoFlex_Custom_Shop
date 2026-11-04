import {headphoneSocketTransform,headphoneHookState,finishDeskHeadphones} from './desk-headphone-hook.mjs';
import * as THREE from 'three';
import { DoubleItemTap, cloneItem, nodeSnapshot } from './scene-item-editing.mjs?v=item-gumball-clipboard-20261016';
import { surfaceDrop } from './item-surface-drop.mjs';
import { notebookTransform } from './notebook-transform.mjs';
import { matchingHighschoolDefault } from './hbhs-design.mjs';
import { DeskAutoStow } from './desk-auto-stow.mjs?v=middle-shelf-stow-20261026';

export const DESK_SURFACES={desktop:'Desktop',shelf:'Top shelf','lower-shelf':'Lower shelf','base-shelf':'Base shelf'};
const phases=['morning','afternoon','evening','night','party'];
const plain=o=>({p:{x:o.position.x,y:o.position.y,z:o.position.z},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}});
const apply=(o,t)=>{o.position.set(t.p.x,t.p.y,t.p.z);o.quaternion.set(t.q.x,t.q.y,t.q.z,t.q.w);if(Math.abs(o.quaternion.lengthSq()-1)>1e-9)o.quaternion.normalize();o.scale.set(t.s.x,t.s.y,t.s.z);o.updateMatrixWorld(true);};
const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};

// Local transforms belong to a desk surface, never to the room or live CAD.
// Authored IDs use their stable mount order; added IDs survive project imports.
export class SceneDeskObjects {
    constructor(manager){this.taps=new DoubleItemTap();this.manager=manager;this.editing=false;this.selected=null;this.role='desktop';this.loading=false;this.drag=null;this.ready=Promise.resolve();this.library=[];this.stow=new DeskAutoStow(this);}
    get current(){return this.manager.active?.objects?.get(this.selected);}
    capture(r){for(const [id,item] of r.objects||[])if(!item.saved.removed){item.saved.transform=this.stow.authored(item);r.state.objects[id]=item.saved;}}
    bind(r){
        if(r.objects)return;
        r.objects=new Map();r.state.objects||={};
        const highschool=this.manager.ctx.sceneId?.()==='highschool';
        const previousDefaults=highschool?structuredClone(r.state.objects):null,claimed=new Set();
        const defaults=Object.entries(r.rig.mounts).flatMap(([role,mount])=>[...mount.children].map((obj,i)=>({role,obj,i})));
        for(const {role,obj,i} of defaults){
            if(obj.userData.transientGameScreen)continue;
            const identity=obj.userData.deskObject;
            const id=identity?.desk===r.id?identity.id:'default-'+role+'-'+i;
            const name=this.manager.ctx.objectName?.(obj)||obj.name||'Desk object';
            const previous=highschool && !identity ? matchingHighschoolDefault(previousDefaults,claimed,id,role,name) : r.state.objects[id];
            const saved=previous||{role,added:false,removed:false,label:name,transform:plain(obj)};
            this.register(r,id,obj,saved,obj.scale.clone());
        }
        const pending=Object.entries(r.state.objects).filter(([id,s])=>s.added&&!s.removed&&!r.objects.has(id)).map(async([id,saved])=>{
            try{const original=saved.copySource&&(r.objects.get(saved.copySource)||[...r.objects.values()].find(i=>i.saved.label===saved.copyLabel));
                const source=original?.obj;
                const template=source||(saved.copyAccessory?await this.manager.ctx.loadAccessoryCopy(saved.copyAccessory):await this.manager.ctx.loadProp(saved.propId));
                const obj=saved.copySource?cloneItem(template,saved.copyNodes):template;if(saved.copySource&&!source)this.manager.ctx.disposeObject?.(template);if(this.manager.records.get(r.id)!==r||!r.rig){this.manager.ctx.disposeObject?.(obj);return;}
                this.register(r,id,obj,saved,new THREE.Vector3(...(saved.copyBaseScale||[1000,1000,1000])));this.manager.sync();
            }catch(error){this.manager.ctx.status('Could not restore '+saved.label+'.');console.error('[Desk objects]',error);}
        });
        this.ready=Promise.all([this.ready,...pending]);
        this.phase(r);
    }
    // Purchased accessories retain their cart/export mounts. Only edited
    // transforms override the catalog layout, so normal sizing still adapts.
    syncAccessories(){
        const r=this.manager.active;if(!r?.product)return;
        const objects=this.manager.ctx.productAccessories(),live=new Set(objects);
        for(const [id,item] of r.objects)if(item.obj.userData.accessoryId&&!live.has(item.obj)){
            r.objects.delete(id);delete r.state.objects[id];if(this.selected===id)this.selected=null;
        }
        for(const obj of objects){
            const id='accessory-'+obj.userData.accessoryId;
            const item=r.objects.get(id);
            const previous=item?.saved||r.state.objects[id];
            if(obj.userData.accessoryId==='task-light'&&previous&&previous.clampMount!=='rear-edge-v1'){
                // Upgrade a saved freestanding lamp onto the rear edge once.
                // Keep its chosen side; subsequent clamp edits stay untouched.
                previous.transform.p.x=Math.max(-(r.state.size==='60x30'?762:610)+35,Math.min((r.state.size==='60x30'?762:610)-35,previous.transform.p.x));
                previous.transform.p.y=0;previous.transform.p.z=obj.position.z;
                previous.transform.q={x:0,y:0,z:0,w:1};
                previous.clampMount='rear-edge-v1';
            }
            if(item){if(item.saved.custom){this.purchaseMount(item.saved.role)?.add(obj);apply(obj,item.saved.transform);}continue;}
            const role=this.manager.ctx.accessoryRole(obj),saved=r.state.objects[id]||{role,added:false,removed:false,label:this.manager.ctx.objectName(obj),transform:plain(obj)};
            if(obj.userData.accessoryId==='task-light')saved.clampMount='rear-edge-v1';
            if(!saved.custom)saved.transform=plain(obj);
            this.register(r,id,obj,saved,new THREE.Vector3(1,1,1));
        }
        this.phase(r);this.manager.sync();
    }
    purchaseMount(role){return this.manager.ctx.purchaseMount?.(role);}
    register(r,id,obj,saved,baseScale){
        const previous=r.objects?.get(id);if(previous)this.stow.restoreItem(previous);
        saved=headphoneSocketTransform(obj,saved,r.rig.mounts,this.manager.ctx.headphoneRecovery?.()?.[[this.manager.key,r.id,id].join('|')]);
        if(obj.userData.deskHeadphones)finishDeskHeadphones(obj,r.id);
        if(obj.userData.headphoneHook&&saved.headphoneSocket!=='hook-v1'){const sockets=r.rig.mounts.shelf?.userData.headphoneSockets||[],socket=sockets.find(s=>s.side===(saved.transform.p.x<0?'left':'right'))||sockets[0];if(socket){const fitted=headphoneHookState(socket);saved={...saved,role:fitted.role,transform:fitted.transform,headphoneSocket:'hook-v1'};}}
        const mount=r.rig.mounts[saved.role];if(!mount)return;
        // Keep the original object hidden when removed, so defaults never return
        // after switching desks or changing the active daypart.
        saved.transform=notebookTransform(obj,saved.transform);
        (r.product&&obj.userData.accessoryId?this.purchaseMount(saved.role):mount)?.add(obj);apply(obj,saved.transform);
        this.manager.ctx.unregisterProp?.(obj);
        obj.userData.deskObject={desk:r.id,id};obj.userData.sceneAsset=false;delete obj.userData.editorId;
        const reference=obj.userData.deskObjectBaseScale;
        if(Array.isArray(reference)&&reference.length===3&&reference.every(v=>Number.isFinite(v)&&v>0))baseScale=new THREE.Vector3(...reference);
        else obj.userData.deskObjectBaseScale=baseScale.toArray();
        r.state.objects[id]=saved;r.objects.set(id,{id,obj,saved,baseScale});
        if(obj.userData.deskHeadphones&&!saved.removed){
            const sockets=r.rig.mounts.shelf?.userData.headphoneSockets||[],side=saved.transform.p.x<0?'left':'right',socket=sockets.find(s=>s.side===side)||sockets[0],hookId='headphone-hook-'+side;
            if(socket&&!r.objects.has(hookId)){const hook=this.manager.ctx.createHeadphoneHook?.();if(hook)this.register(r,hookId,hook,r.state.objects[hookId]||headphoneHookState(socket),new THREE.Vector3(1000,1000,1000));}
        }
        this.phase(r);
    }
    phase(r){
        const mode=this.manager.ctx.phase(),index=phases.indexOf(mode);
        for(const item of r.objects?.values()||[]){const o=item.obj;
            o.visible=!item.saved.removed&&(!o.userData.dressPhases||o.userData.dressPhases.includes(mode))&&(!o.userData.dailyInput||![2,4].includes(index));
            if(o.userData.dayKit)o.children.forEach((c,i)=>c.visible=i===index);
            const canvas=o.getObjectByName('Artist painting');
            if(canvas?.paintingTexture){
                const map=item.saved.artworkVisible===false?null:canvas.paintingTexture;
                if(canvas.material.map!==map){canvas.material.map=map;canvas.material.color.set(map?'#ffffff':'#a4a7a8');canvas.material.needsUpdate=true;}
            }
        }
    }
    setArtwork(id,visible){
        const m=this.manager,r=m.active,item=r?.objects?.get(id);
        if(!item?.obj.getObjectByName('Artist painting')||m.playing||m.recording)return false;
        const before=m.serialize();item.saved.artworkVisible=visible===true;
        this.phase(r);m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
    }
    select(id){this.selected=this.manager.active?.objects?.has(id)?id:null;if(this.selected){this.stow.restoreItem(this.current);this.manager.ctx.objectSelected?.();}this.manager.sync();}
    setEditing(on){this.editing=!!on;if(on&&this.current)this.stow.restoreItem(this.current);if(!on)this.endDrag();this.manager.ctx.objectEditing?.(this.editing);this.manager.sync();}
    async add(propId,role=this.role){
        const m=this.manager,r=m.active;if(!r||!r.rig.mounts[role]||this.loading||m.playing||m.recording)return false;
        if(Object.keys(r.state.objects||{}).length>=200){m.ctx.status('This desk has reached its 200 object limit.');return false;}
        this.loading=true;m.sync();const before=m.serialize();
        try{
            const obj=await m.ctx.loadProp(propId);
            if(m.records.get(r.id)!==r||!r.rig){m.ctx.disposeObject?.(obj);return false;}
            const id='object-'+crypto.randomUUID(),entry=m.ctx.propEntry(propId),max=Math.max(...(entry?.size||[100]));
            // Large library models start at a usable tabletop size. The editor
            // can restore 100% or choose any other scale.
            const scale=Math.min(1,400/max);obj.scale.multiplyScalar(scale);obj.position.set(0,-(entry?.min?.[1]||0)*scale,0);
            const saved={role,added:true,removed:false,propId,label:entry?.name||propId,transform:plain(obj)};
            this.register(r,id,obj,saved,new THREE.Vector3(1000,1000,1000));
            this.selected=id;this.role=role;this.setEditing(true);m.persist();m.ctx.edit?.(before,m.serialize());m.ctx.status(saved.label+' added to '+r.state.name+' · '+DESK_SURFACES[role]+'.');return id;
        }catch(error){m.ctx.status('Could not load this library object.');console.error('[Desk objects]',error);return false;}
        finally{this.loading=false;m.sync();}
    }
    copySelection(){
        const item=this.current;if(!item||item.saved.removed)return null;
        return {saved:structuredClone(item.saved),source:item.saved.copySource||item.id,accessory:item.saved.copyAccessory||item.obj.userData.accessoryId,propId:item.saved.propId||item.obj.userData.propId,baseScale:item.baseScale.toArray(),nodes:nodeSnapshot(item.obj),template:cloneItem(item.obj)};
    }
    pasteSelection(copy,count=1){
        const m=this.manager,r=m.active;if(!r||!copy||this.loading||m.playing||m.recording||Object.keys(r.state.objects).length>=200)return false;
        const role=r.rig.mounts[copy.saved.role]?copy.saved.role:'desktop',before=m.serialize(),obj=cloneItem(copy.template,copy.nodes),id='object-'+crypto.randomUUID();
        const saved={...structuredClone(copy.saved),role,added:true,removed:false,custom:false,label:copy.saved.label+' copy',copySource:copy.source,copyLabel:copy.saved.copyLabel||copy.saved.label,...(copy.propId?{propId:copy.propId}:{}),copyNodes:copy.nodes,copyBaseScale:copy.baseScale,...(copy.accessory?{copyAccessory:copy.accessory}:{}),transform:structuredClone(copy.saved.transform)};
        saved.transform.p.x+=count*100;saved.transform.p.z+=count*70;
        this.register(r,id,obj,saved,new THREE.Vector3(...copy.baseScale));this.selected=id;this.role=role;this.setEditing(true);m.persist();m.ctx.edit?.(before,m.serialize());m.ctx.status(saved.label+' pasted. Ctrl+Z to undo.');return id;
    }
    change(values){
        const m=this.manager,item=this.current,r=m.active;if(!item||m.playing||m.recording)return false;
        this.stow.restore(r);
        const before=m.serialize(),o=item.obj;
        if(r.product&&o.userData.accessoryId)item.saved.custom=true;
        if(values.role&&r.rig.mounts[values.role]){(r.product&&o.userData.accessoryId?this.purchaseMount(values.role):r.rig.mounts[values.role]).add(o);item.saved.role=values.role;this.role=values.role;o.position.y=0;}
        for(const [field,axis] of [['x','x'],['y','y'],['z','z']])if(Number.isFinite(values[field]))o.position[axis]=Math.max(axis==='y'&&!o.userData.accessoryId?0:-5000,Math.min(5000,values[field]));
        if(Number.isFinite(values.rotation))o.rotation.y=THREE.MathUtils.degToRad(values.rotation);
        if(Number.isFinite(values.tilt))o.rotation.x=THREE.MathUtils.degToRad(values.tilt);
        if(Number.isFinite(values.roll))o.rotation.z=THREE.MathUtils.degToRad(values.roll);
        if(Number.isFinite(values.scale))o.scale.copy(item.baseScale).multiplyScalar(Math.max(1,Math.min(500,values.scale))/100);
        o.updateMatrixWorld(true);m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
    }
    dropToSurface(){
        const m=this.manager,item=this.current;
        if(!this.editing||m.ctx.objectsEditable?.()===false||!item||!shown(item.obj)||m.playing||m.recording||this.drag)return false;
        const target=surfaceDrop([item.obj],m.ctx.scene);
        if(!target){m.ctx.status('No surface below this item.');return true;}
        if(Math.abs(target.delta)<=target.epsilon)return true;
        const before=m.serialize(),o=item.obj;o.updateWorldMatrix(true,false);
        const matrix=o.parent.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(0,target.delta,0)).multiply(o.matrixWorld);
        matrix.decompose(o.position,o.quaternion,o.scale);o.updateMatrixWorld(true);
        if(m.active.product&&o.userData.accessoryId)item.saved.custom=true;
        m.persist();m.ctx.edit?.(before,m.serialize());m.sync();
        m.ctx.status(item.saved.label+' placed on the surface below. Ctrl+Z to undo.');return true;
    }
    remove(){
        const m=this.manager,r=m.active,item=this.current;if(!item||m.playing||m.recording)return false;
        const before=m.serialize();
        if(item.obj.userData.accessoryId&&(r.product||r.peripherals)){
            m.ctx.removeAccessory(item.obj.userData.accessoryId);this.selected=null;m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
        }
        item.saved.removed=true;item.obj.visible=false;this.selected=null;
        if(item.saved.added&&item.id!=='default-library-iphone'){r.objects.delete(item.id);delete r.state.objects[item.id];m.ctx.disposeObject?.(item.obj);}
        m.persist();m.ctx.edit?.(before,m.serialize());m.sync();return true;
    }
    pick(e){
        const m=this.manager,rect=m.ctx.canvas.getBoundingClientRect();m.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);m.ray.setFromCamera(m.pointer,m.ctx.camera);
        const hit=m.ray.intersectObjects([m.ctx.room()?.root,m.ctx.liveObject(),...(m.active?.product?Object.values(m.active.rig.mounts):[]),...(m.active?.product?m.ctx.productAccessories():[])].filter(Boolean),true).find(h=>{
            if(!shown(h.object)||h.object.material?.isShaderMaterial)return false;
            for(let o=h.object;o;o=o.parent)if(o.userData.deskObject)return true;
            return false;
        });
        for(let o=hit?.object;o;o=o.parent)if(o.userData.deskObject)return{...o.userData.deskObject,hit};
        return null;
    }
    click(e){if(!this.editing||this.manager.ctx.objectsEditable?.()===false)return false;if(this.suppressClick){this.suppressClick=false;return true;}const picked=this.pick(e);if(!picked)return false;this.manager.select(picked.desk);this.select(picked.id);return true;}
    down(e){
        const m=this.manager;if(!this.editing||m.ctx.objectsEditable?.()===false||e.target!==m.ctx.canvas||e.button!==0||m.playing||m.recording)return false;
        this.suppressClick=false;
        const picked=this.pick(e);if(!picked)return false;m.select(picked.desk);this.select(picked.id);m.ctx.halt();
        if(this.taps.test(picked.desk+':'+picked.id,e)){m.ctx.objectDoubleSelected?.(this.current);e.preventDefault();e.stopImmediatePropagation();return true;}
        m.ctx.objectDragStart?.();
        const item=this.current,parent=item.obj.parent;parent.updateWorldMatrix(true,false);
        const normal=new THREE.Vector3(0,1,0).transformDirection(parent.matrixWorld),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,picked.hit.point),point=new THREE.Vector3();
        if(!m.ray.ray.intersectPlane(plane,point))return false;
        this.drag={pointer:e.pointerId,key:picked.desk+':'+picked.id,start:[e.clientX,e.clientY],started:false,plane,parent,last:parent.worldToLocal(point),controls:m.ctx.controls.enabled,before:m.serialize(),changed:false};
        m.ctx.controls.enabled=false;m.ctx.canvas.setPointerCapture(e.pointerId);m.ctx.canvas.style.cursor='grabbing';e.preventDefault();e.stopImmediatePropagation();return true;
    }
    moveDrag(e){
        const d=this.drag,m=this.manager;if(!d||d.pointer!==e.pointerId)return false;
        if(!d.started&&Math.hypot(e.clientX-d.start[0],e.clientY-d.start[1])<5){e.preventDefault();e.stopImmediatePropagation();return true;}d.started=true;
        const rect=m.ctx.canvas.getBoundingClientRect();m.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);m.ray.setFromCamera(m.pointer,m.ctx.camera);const point=new THREE.Vector3();
        if(m.ray.ray.intersectPlane(d.plane,point)){d.parent.worldToLocal(point);const delta=point.clone().sub(d.last),o=this.current?.obj;if(o){if(m.active.product&&o.userData.accessoryId)this.current.saved.custom=true;o.position.x+=delta.x;o.position.z+=delta.z;o.updateMatrixWorld(true);d.changed||=delta.length()>.001;}d.last.copy(point);}
        e.preventDefault();e.stopImmediatePropagation();return true;
    }
    endDrag(e){const d=this.drag,m=this.manager;if(!d||(e&&d.pointer!==e.pointerId))return false;this.drag=null;this.taps.remember(d.key,e,d.changed);this.suppressClick=d.changed;if(m.ctx.canvas.hasPointerCapture(d.pointer))m.ctx.canvas.releasePointerCapture(d.pointer);m.ctx.controls.enabled=d.controls;m.ctx.canvas.style.cursor='';m.persist();if(d.changed)m.ctx.edit?.(d.before,m.serialize());m.sync();if(e){e.preventDefault();e.stopImmediatePropagation();}return true;}
}
