import * as THREE from 'three';
import { activityPageMaterial } from './room-activity-print.mjs?v=scene-desk-styling-20261010';

const education = new Set(['kindergarten','elementary','middleschool','highschool','college','university']);
const workOnly = new Set(['hospital','laboratory','mobileit','security','police','government', ...education]);
const accents = { music:'#715746',gaming:'#5b617f',creative:'#b9765d',gym:'#538879',
    hospital:'#598b85',laboratory:'#64808c',mobileit:'#617b86',kindergarten:'#b58d42',
    elementary:'#668c6d',government:'#9b8357',library:'#456d55',university:'#4b715d' };
const titles = {
    home: ['Daily planning','Work journal','Evening reading','Quiet notes','Shared plans'],
    office: ['Project plan','Working notes','Review notes','Focus journal','Team ideas'],
    library: ['Reading plan','Source notes','Evening reading','Late study','Group notes'],
    coworking: ['Day plan','Project notes','Ideas review','Quiet focus','Shared ideas'],
    music: ['Warm-up score','Recording score','Listening notes','Mixing notes','Set list'],
    gaming: ['Practice plan','Strategy notes','Team play','Solo strategy','Tournament notes'],
    creative: ['Colour palette','Composition study','Sketch review','Quiet sketchbook','Shared studies'],
    study: ['Reading plan','Research notes','Annotations','Late notes','Study group'],
    lounge: ['Morning journal','Weekend notes','Evening reading','Quiet journal','Shared stories'],
    kitchen: ['Breakfast plan','Recipe study','Dinner notes','Next-day plan','Shared recipe'],
    gym: ['Warm-up plan','Training log','Recovery notes','Next session','Group workout'],
    bedroom: ['Morning journal','Daily notes','Evening reading','Closed journal','Weekend plans'],
    workshop: ['Build plan','Measured drawing','Design review','Tool checklist','Shared build'],
    gallery: ['Exhibition plan','Material study','Display review','Closed catalogue','Visitor notes'],
    scifi: ['Survey plan','Analysis log','Briefing notes','Watch log','Shared mission'],
    security: ['Shift preparation','Review checklist','Handover notes','Night watch notes','Briefing plan'],
    police: ['Briefing plan','Workspace notes','Handover log','Night shift notes','Team briefing'],
    government: ['Service plan','Meeting notes','Follow-up list','Closed journal','Workshop notes'],
    hospital: ['Preparation checklist','Workspace notes','Handover checklist','Observation checklist','Review notes'],
    laboratory: ['Bench checklist','Lab record','Research review','Closed lab notebook','Team findings'],
    mobileit: ['Intake checklist','Test log','Deployment checklist','Closed service log','Handover notes']
};

// One stable scene asset, five children selected by setDayDress. Keep the
// existing daily-kit footprint and mount, so rearrangement keys still restore.
export function createDailyDeskKit(id, { box, mesh, rod, material }) {
    const kit = new THREE.Group(); kit.name = 'Groove tabletop · daily materials'; kit.userData.dayKit = true;
    const accent = accents[id] || '#52746c', cover = material(accent), paper = material('#e9dfc8'), ink = material('#354b50');
    const ceramic = material('#e6d6b8');
    const names = education.has(id) ? ['Lesson plan','Learning materials','Review notes','Closed teaching journal','Workshop cards'] : titles[id] || titles.home;
    for (let phase = 0; phase < 5; phase++) {
        const g = new THREE.Group(); g.name = names[phase]; g.userData.activity = names[phase]; kit.add(g);
        const open = phase !== 3 && !(id === 'bedroom' && phase === 0);
        box(g,[open ? 155 : 104,4,125],[0,2,0],cover,2);
        box(g,[open ? 150 : 100,9,120],[0,8.5,0],paper,1);
        if (!open) box(g,[104,4,125],[0,15,0],cover,2);
        const page = mesh(g, new THREE.PlaneGeometry(open ? 149 : 100,119),
            activityPageMaterial(id,phase,open ? null : accent),[0,open ? 13.1 : 17.1,0]);
        page.rotation.x = -Math.PI/2; page.castShadow = false; page.userData.presentationOnly = true;
        if (open) rod(g,[-47,3,73],[48,3,73],2,cover);
        if (phase === 4 && ['kindergarten','elementary','creative'].includes(id)) {
            for (let n=0;n<3;n++) box(g,[28,1.2,20],[-46+n*33,15,40],material(['#bc8865','#799c81','#d1b260'][n]),1);
        }
        if (!workOnly.has(id) && phase === 0 && ['home','office','coworking','lounge','kitchen'].includes(id)) {
            // A clear gap beside the pages, with the cup resting on the desktop.
            mesh(g,new THREE.CylinderGeometry(19,17,39,16),ceramic,[100,19.5,-30]);
            mesh(g,new THREE.CylinderGeometry(16,16,1,16),ink,[100,39.5,-30]);
        }
        g.visible = phase === 0;
    }
    return kit;
}

// The stock journal has an ornate fantasy cover. Keep its horizontal footprint
// and prop ID, with a plain printed notebook suited to the current workspace.
export function createDeskNotebook(id, { box, mesh, material }) {
    const g = new THREE.Group(), accent = accents[id] || '#52746c';
    g.name = 'Workspace notebook'; g.userData.propId = 'journal'; g.userData.authoredDeskNotebook = true;
    const cover = material(accent), paper = material('#e9dfc8');
    box(g,[141.6,2,230],[0,1,0],cover,2);
    box(g,[137.6,22,226],[0,13,0],paper,1);
    box(g,[141.6,2,230],[0,25,0],cover,2);
    const label=mesh(g,new THREE.PlaneGeometry(137.6,226),activityPageMaterial(id,3,accent),[0,26.1,0]);
    label.rotation.x=-Math.PI/2;label.castShadow=false;label.userData.presentationOnly=true;
    return g;
}

export function placeDailyDeskKit(kit, props) {
    // Detached shallow resource copies give bounds in desktop millimetres,
    // independent of the desk's current world position, lift and tilt.
    const boxes=[];
    for(const prop of props){
        const copy=prop.clone(true);copy.updateMatrixWorld(true);
        copy.traverse(o=>{
            if(!o.isMesh || o.userData.presentationOnly || o.userData.govPool || o.userData.hcPool) return;
            // Procedural tools share merged meshes. Their aggregate bounds also
            // cover the empty gaps between tools; triangles retain those gaps.
            if(o.material.vertexColors){
                const p=o.geometry.attributes.position,idx=o.geometry.index;
                for(let n=0;n<(idx?idx.count:p.count);n+=3){
                    const b=new THREE.Box3();
                    for(let j=0;j<3;j++)b.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(n+j):n+j).applyMatrix4(o.matrixWorld));
                    boxes.push(b);
                }
            }else{
                o.geometry.computeBoundingBox();boxes.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
            }
        });
    }
    const shape=new THREE.Box3().setFromObject(kit.clone(true));
    // Prefer the visible front wings. Rear placements can disappear beneath
    // the raised shelf, especially in music and teaching arrangements.
    const candidates=[[-440,150],[440,230],[-440,230],[520,150],[-520,150],
        [520,230],[-520,230],[440,100],[-440,100],[340,150],[-340,150],
        [440,30],[-440,30],[440,-150],[-440,-150]];
    // Dense teaching/operations desks need more than the corners. These
    // samples stay inside the 48-inch top and outside its front center cutout.
    for(const z of [180,120,60,0,-60,-120])
        for(const x of [-500,-400,-300,300,400,500])candidates.push([x,z]);
    for(const z of [0,-60,-120])for(const x of [-200,-100,0,100,200])candidates.push([x,z]);
    let chosen=candidates[0],least=Infinity;
    const overlapAt=(x,z)=>{
        const b=shape.clone().translate(new THREE.Vector3(x,1,z));let overlap=0;
        for(const p of boxes){
            const dx=Math.max(0,Math.min(b.max.x+8,p.max.x)-Math.max(b.min.x-8,p.min.x));
            const dz=Math.max(0,Math.min(b.max.z+8,p.max.z)-Math.max(b.min.z-8,p.min.z));
            overlap+=dx*dz;
        }
        return overlap;
    };
    for(const [x,z] of candidates){
        const overlap=overlapAt(x,z);
        if(overlap<least){least=overlap;chosen=[x,z];}
        if(overlap===0)break;
    }
    // A few crowded teaching desks need a position between the coarse samples.
    // Search the same safe wings before accepting even a small intersection.
    if(least>0){
        search: for(let z=230;z>=-150;z-=20){
            for(let x=-520;x<=520;x+=20){
                if(z>0 && Math.abs(x)<300)continue;
                const overlap=overlapAt(x,z);
                if(overlap<least){least=overlap;chosen=[x,z];}
                if(overlap===0)break search;
            }
        }
    }
    kit.position.set(chosen[0],1,chosen[1]);
    kit.userData.authoredDesktopOverlap=least;
}
