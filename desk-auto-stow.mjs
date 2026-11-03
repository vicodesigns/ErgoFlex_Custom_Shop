import {inputStowKind,shelfSupportsBox} from './desk-shelf-space.mjs';
import * as THREE from 'three';
import { compactStowParts } from './desk-stow-parts.mjs?v=middle-shelf-stow-20261026';

export const STOW_ANGLE = 9;
export const EASEL_ANGLE = 50;
const clone = v => structuredClone(v);
export const deskTransform = o => ({p:{x:o.position.x,y:o.position.y,z:o.position.z},q:{x:o.quaternion.x,y:o.quaternion.y,z:o.quaternion.z,w:o.quaternion.w},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}});
const apply = (o,t) => {o.position.set(t.p.x,t.p.y,t.p.z);o.quaternion.set(t.q.x,t.q.y,t.q.z,t.q.w);o.scale.set(t.s.x,t.s.y,t.s.z);o.updateMatrixWorld(true);};
const identity = item => `${item.obj.userData.accessoryId||''} ${item.obj.userData.propId||''} ${item.saved.propId||''} ${item.saved.label||''} ${item.obj.name}`.toLowerCase();
const effect=o=>o.isLight||o.material?.isShaderMaterial||o.material?.blending===THREE.AdditiveBlending||o.name==='Light pool'||o.userData.reflectionPool||(o.isGroup&&o.children.length>0&&o.children.every(effect));

// Fixed hardware never gets put away. Work surfaces are retained only for the
// activity their angle supports. All other loose desktop objects are stowed.
export function deskItemDisposition(item,tilt,recipe='') {
    if(item.saved.role!=='desktop'||tilt<=STOW_ANGLE)return 'stay';
    if(item.obj.isGroup&&!item.obj.children.length)return 'stay';
    if(effect(item.obj))return 'stay';
    // Some older institutional fixtures combine the apron, input rails and
    // their controls in a single mesh. They are mounted hardware, not loose props.
    if(item.obj.isMesh&&item.obj.name==='Furnishing detail'){
        if(!item.obj.geometry.boundingBox)item.obj.geometry.computeBoundingBox();
        if(item.obj.geometry.boundingBox.min.y*item.obj.scale.y< -60)return 'stay';
    }
    const id=identity(item);
    if(/painter-shelf|painter accessory shelf/.test(id))return tilt>=EASEL_ANGLE?'stay':'hide';
    if(/artist-easel|art-easel|artist easel|artist painting|canvas/.test(id))return (recipe==='architect'?tilt<EASEL_ANGLE:tilt>=EASEL_ANGLE)?'stay':'hide';
    if(/drafting-kit|drafting board|architect floor plan/.test(id))return tilt<EASEL_ANGLE?'stay':'hide';
    if(/task-light|clamp|easel-rail|easel-accessory|keyboard-tray|cable-tray|cpu-holder|led-strip|monitor-arm|monitor mount/.test(id))return 'stay';
    if(tilt<EASEL_ANGLE&&recipe==='architect'&&/ruler|pencil|draft|plan|sketch|drawing/.test(id))return 'stay';
    if(tilt>=EASEL_ANGLE&&recipe==='artist'&&/brush|palette|paint|easel|canvas/.test(id))return 'stay';
    return 'stow';
}

// Bounding boxes in a requested local frame, including only currently visible
// geometry. This handles authored rotations and mm/metre GLBs without resizing.
export function visibleDeskBounds(root,matrix) {
    root.updateWorldMatrix(true,true);
    const inverse=root.matrixWorld.clone().invert(),bounds=new THREE.Box3();
    const visit=o=>{
        if((o!==root&&!o.visible)||effect(o))return;
        if(o.geometry){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(matrix.clone().multiply(inverse).multiply(o.matrixWorld)));}
        for(const c of o.children)visit(c);
    };
    visit(root);return bounds;
}
const overlaps=(a,b,gap=8)=>a.min.x<b.max.x+gap&&a.max.x>b.min.x-gap&&a.min.z<b.max.z+gap&&a.max.z>b.min.z-gap&&a.min.y<b.max.y+gap&&a.max.y>b.min.y-gap;

export class DeskAutoStow {
    constructor(editor){this.editor=editor;}
    restoreItem(item){
        if(!item.autoStow)return;
        const {parent,transform}=item.autoStow;
        for(const o of item.autoStow.parts||[]){o.removeFromParent();o.stowOwnedResources?.forEach(resource=>resource.dispose());}
        delete item.obj.stowPlacement;
        parent.add(item.obj);item.obj.matrixAutoUpdate=true;apply(item.obj,transform);
        if(item.autoStow.matrixAutoUpdate===false){item.obj.matrix.copy(item.autoStow.matrix);item.obj.matrixAutoUpdate=false;item.obj.updateMatrixWorld(true);}
        delete item.autoStow;
    }
    restore(r){for(const item of r.objects?.values()||[])this.restoreItem(item);delete r.stowSignature;r.stowStatus=null;}
    authored(item){return item.autoStow?.transform||deskTransform(item.obj);}
    mount(r,role,item){return r.product&&item?.obj.userData.accessoryId?this.editor.purchaseMount(role):r.rig?.mounts[role];}
    update(r){
        let editing=this.editor.editing&&r.id===this.editor.manager.selected;
        const angle=Number(r.state.tilt)||0;
        // Tilting the desk finishes an item edit and stows that item too.
        // At a stationary angle it can still be selected for reorganization.
        if(editing&&this.editor.selected&&angle>STOW_ANGLE&&r.stowTilt!==undefined&&Math.abs(angle-r.stowTilt)>.01){this.editor.setEditing(false);editing=false;}
        r.stowTilt=angle;
        const recipe=r.spec?.plan?'architect':r.state.peripheralRecipe||this.editor.manager.ctx.activityRecipe?.()||'';
        if(angle<=STOW_ANGLE){this.restore(r);return;}
        const edited=editing?this.editor.selected:null;
        if(edited)this.restoreItem(r.objects?.get(edited)||{});
        const items=[...(r.objects?.values()||[])];
        const wanted=items.filter(i=>i.id!==edited&&i.obj.visible&&!i.saved.removed&&deskItemDisposition(i,angle,recipe)==='stow');
        for(const i of items)if(deskItemDisposition(i,angle,recipe)==='hide')i.obj.visible=false;
        const signature=JSON.stringify([r.state.size,angle>=EASEL_ANGLE?'easel':'drafting',recipe,edited,this.editor.manager.ctx.phase(),items.map(i=>[i.id,i.obj.visible,i.obj.children.filter(c=>c.visible).map(c=>c.uuid),this.authored(i)])]);
        if(r.stowSignature===signature){if(r.stowStatus)r.stowStatus.angle=angle;for(const i of wanted)if(i.autoStow?.hidden||i.autoStow?.parts)i.obj.visible=false;return;}
        this.restore(r);r.stowSignature=signature;
        const packing=[];
        for(const item of wanted){
            const parts=compactStowParts(item);
            if(!parts){packing.push(item);continue;}
            const t=deskTransform(item.obj);item.autoStow={parent:item.obj.parent,transform:clone(t),parts};item.obj.visible=false;
            for(const [i,obj] of parts.entries()){
                obj.name=item.saved.label+' · stored supply '+(i+1);obj.userData.deskObject={...item.obj.userData.deskObject};item.obj.parent.add(obj);apply(obj,t);
                if(!obj.userData.deskStowFixed)packing.push({id:item.id+'-part-'+i,obj,saved:item.saved,owner:item});
            }
        }
        const selected=new Set(wanted),bins=[];
        for(const role of ['shelf','lower-shelf','base-shelf']){
            const mount=r.rig?.mounts[role];if(!mount)continue;
            mount.updateWorldMatrix(true,false);
            const size=mount.userData.surfaceSize||this.editor.manager.ctx.surfaceSize?.(role)||{};
            const width=size.width|| (r.state.size==='48x30'?1100:1400),depth=size.depth||280;
            let height=role==='shelf'?650:role==='lower-shelf'?180:900;
            if(role==='lower-shelf'&&r.rig.mounts.shelf){const p=new THREE.Vector3().setFromMatrixPosition(r.rig.mounts.shelf.matrixWorld);mount.worldToLocal(p);height=Math.max(30,p.y-25);}
            const space=mount.userData.storageSpace,occupied=(space?.obstacles||[]).map(b=>new THREE.Box3(new THREE.Vector3().fromArray(b.min),new THREE.Vector3().fromArray(b.max)));
            for(const item of items)if(!selected.has(item)&&item.obj.visible&&!effect(item.obj)){
                let box;
                if(/monitor-arm/.test(item.obj.userData.accessoryId||'')){
                    // The jointed arms span empty air. Reserve their clamp and
                    // mast, rather than treating the entire span as a solid wall.
                    box=new THREE.Box3(new THREE.Vector3(-60,-35,-55),new THREE.Vector3(60,360,55)).applyMatrix4(mount.matrixWorld.clone().invert().multiply(item.obj.matrixWorld));
                }else box=visibleDeskBounds(item.obj,mount.matrixWorld.clone().invert().multiply(item.obj.matrixWorld));
                if(!box.isEmpty())occupied.push(box);
            }
            bins.push({role,mount,width,depth,height,occupied,space,edge:24,minX:space?.minX??-width/2+24,maxX:space?.maxX??width/2-24,minZ:space?.minZ??-depth/2+24,maxZ:space?.maxZ??depth/2-24});
        }
        const work=packing.map(item=>{
            const t=deskTransform(item.obj),q=new THREE.Quaternion().set(t.q.x,t.q.y,t.q.z,t.q.w),s=new THREE.Vector3(t.s.x,t.s.y,t.s.z);
            // Remove desktop pitch/roll for safe shelf storage. Keep its heading.
            const forward=new THREE.Vector3(0,0,1).applyQuaternion(q),yaw=Math.atan2(forward.x,forward.z);
            const options=[yaw,yaw+Math.PI/2].map(turn=>{const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),turn);return{rotation,bounds:visibleDeskBounds(item.obj,new THREE.Matrix4().compose(new THREE.Vector3(),rotation,s))};});
            // Flat boards, mats and paper collections can stand in the rear
            // file bay when they cannot lie flat. Their real scale is retained.
            for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1)])for(const turn of [yaw,yaw+Math.PI/2]){
                // A book can file on either edge. The shorter edge also fits
                // the shallow lower tier of the upper shelving assembly.
                const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),turn).multiply(new THREE.Quaternion().setFromAxisAngle(axis,Math.PI/2));
                options.push({rotation,upright:true,bounds:visibleDeskBounds(item.obj,new THREE.Matrix4().compose(new THREE.Vector3(),rotation,s))});
            }
            return{item,t,options,input:inputStowKind(item),area:Math.min(...options.slice(0,2).map(o=>{const size=o.bounds.getSize(new THREE.Vector3());return size.x*size.z;}))};
        }).sort((a,b)=>(a.input==='keyboard'?0:a.input==='mouse'?1:2)-(b.input==='keyboard'?0:b.input==='mouse'?1:2)||b.area-a.area||a.item.id.localeCompare(b.item.id));
        let count=0,overflow=0;
        for(const {item,t,options,input} of work){
            let best=null;
            const preferred=input?['lower-shelf','shelf','base-shelf']:['shelf','base-shelf'];
            const orderedBins=preferred.flatMap(role=>bins.filter(b=>b.role===role));
            for(const [priority,bin] of orderedBins.entries()){
                for(const option of options){
                    if(option.bounds.isEmpty()||(input&&option.upright))continue;
                    const size=option.bounds.getSize(new THREE.Vector3());if(size.x>bin.maxX-bin.minX||size.z>bin.maxZ-bin.minZ||size.y>bin.height)continue;
                    const centerX=input==='keyboard'?-90:input==='mouse'?260:0;
                    const xs=[centerX-size.x/2,bin.minX,bin.maxX-size.x,...bin.occupied.flatMap(b=>[b.max.x+12,b.min.x-size.x-12])],zs=[-size.z/2,bin.minZ,bin.maxZ-size.z,...bin.occupied.flatMap(b=>[b.max.z+12,b.min.z-size.z-12])];
                    const ys=input?[0]:[0,...bin.occupied.filter(b=>b.max.y-b.min.y<35).map(b=>b.max.y+10)];
                    for(const y of ys)for(const z of zs)for(const x of xs){
                        const box=new THREE.Box3(new THREE.Vector3(x,y,z),new THREE.Vector3(x+size.x,y+size.y,z+size.z));
                        if(box.min.x<bin.minX||box.min.z<bin.minZ||box.min.y<0||box.max.x>bin.maxX||box.max.z>bin.maxZ||box.max.y>bin.height||!shelfSupportsBox(bin.space,box)||bin.occupied.some(b=>overlaps(box,b)))continue;
                        const score=priority*1e7+(option.upright?50000:0)+y*5000+(input?Math.abs((box.min.x+box.max.x)/2-centerX)+Math.abs((box.min.z+box.max.z)/2)*2:(z-bin.minZ)*5+x-bin.minX);
                        if(!best||score<best.score)best={bin,option,box,score};
                    }
                }
                if(best)break;
            }
            item.autoStow={parent:item.obj.parent,transform:clone(t)};
            if(best){
                const {bin,option,box}=best;const target=this.mount(r,bin.role,item)||bin.mount;target.updateWorldMatrix(true,false);
                item.autoStow.matrixAutoUpdate=item.obj.matrixAutoUpdate;item.autoStow.matrix=item.obj.matrix.clone();
                const placed=new THREE.Matrix4().compose(box.min.clone().sub(option.bounds.min),option.rotation,new THREE.Vector3(t.s.x,t.s.y,t.s.z));
                const local=target.matrixWorld.clone().invert().multiply(bin.mount.matrixWorld).multiply(placed);
                target.add(item.obj);item.obj.matrixAutoUpdate=true;local.decompose(item.obj.position,item.obj.quaternion,item.obj.scale);item.obj.updateMatrixWorld(true);
                bin.occupied.push(box);item.autoStow.role=bin.role;item.autoStow.bounds=box.clone();item.obj.stowPlacement={role:bin.role,bounds:box.clone()};count++;
            }else{
                // Oversized equipment cannot be shrunk or left on a steep desk.
                // Treat it as stored off the work surface; preserve its layout.
                item.autoStow.hidden=true;item.obj.visible=false;overflow++;
                if(item.owner){item.owner.autoStow.unpacked||=[];item.owner.autoStow.unpacked.push({name:item.obj.name,size:options[0].bounds.getSize(new THREE.Vector3()).toArray()});}
            }
        }
        r.stowStatus={count,overflow,angle,mode:angle>=EASEL_ANGLE?'easel':'drafting'};
    }
}
