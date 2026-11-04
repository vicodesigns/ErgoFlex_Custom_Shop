import * as THREE from 'three';
import { interiorCraftFinishes } from './interior-craft-detail.mjs?v=natural-finishes-20261104';

export const HOME_SESSIONS = {
    morning: { title:'A fresh start', note:'Coffee / plan / begin', accent:'#b58b57', light:[.55,.5,.05,.2] },
    afternoon: { title:'One thing at a time', note:'Focus / notes / a short break', accent:'#7d958c', light:[.65,.65,.08,.35] },
    evening: { title:'The reading hour', note:'Tea / a chapter / tomorrow', accent:'#c08c6b', light:[.55,.4,.12,1] },
    night: { title:'Ready for tomorrow', note:'Close / charge / unwind', accent:'#8c9baf', light:[.42,.18,.04,.5] },
    party: { title:'Come on in', note:'Coffee / conversation / company', accent:'#ad8c72', light:[.7,.75,.3,.75] }
};

// Reuse the existing pinboard; retain its photographs and calendar. Only one
// small pinned card changes, and the same canvas/texture survives each switch.
export function homeSessionPinboard(map) {
    const base=document.createElement('canvas');base.width=map.image.width;base.height=map.image.height;base.getContext('2d').drawImage(map.image,0,0);
    return phase=>{
        const s=HOME_SESSIONS[phase]||HOME_SESSIONS.afternoon,c=map.image.getContext('2d');c.drawImage(base,0,0);
        c.save();c.translate(584,438);c.rotate(-.035);c.shadowColor='rgba(45,35,25,.24)';c.shadowBlur=8;c.shadowOffsetY=4;
        c.fillStyle='#f2ebd9';c.fillRect(-185,-60,370,120);c.shadowColor='transparent';
        c.fillStyle=s.accent;c.beginPath();c.arc(0,-48,6,0,7);c.fill();c.fillStyle='#39493f';c.textAlign='center';c.font='600 25px sans-serif';c.fillText(s.title,0,-5,340);
        c.fillStyle='#69756a';c.font='18px sans-serif';c.fillText(s.note,0,30,340);c.restore();map.needsUpdate=true;
    };
}

// A small daily reset station lives on the existing cabinet. It does not add
// floor clutter or occupy the desk, and follows edits to its supporting cabinet.
export function buildHomeSessionDetail(room,layout,h) {
    const {box,mesh,rod,material,markSceneAsset}=h,root=room.root,compact=layout.id==='apartment';
    const cabinet=root.getObjectByName('Oak storage'),cx=compact?1120:layout.width/2-570;
    const kit=new THREE.Group();kit.name='Home coffee & reset tray';kit.position.set(cx+(compact?110:25),740,layout.back+285);cabinet.add(kit);
    markSceneAsset(kit,{key:`home:${layout.id}:fixture:reset-tray`});
    const ceramic=material('#e6decf',{roughness:.34}),felt=material('#64776e',{roughness:.98}),metal=material('#aab2b0',{roughness:.31,metalness:.8}),wood=material('#bfa17a',{roughness:.62}),dark=material('#3e4946',{roughness:.65});
    felt.userData.roomSurface='fabric';metal.userData.roomSurface='metal';wood.userData.roomSurface='wood';
    const width=compact?170:200;box(kit,[width,7,130],[0,3.5,0],wood,7);
    box(kit,[width-12,1,118],[0,7.5,0],felt,3);
    const variants=[];
    const mug=(g,x,z,filled)=>{
        const cup=new THREE.Group();cup.position.set(x,8,z);g.add(cup);
        const points=[[0,0],[22,0],[24,4],[28,58],[27,61],[24,61],[21,8],[0,8]].map(p=>new THREE.Vector2(...p));
        mesh(cup,new THREE.LatheGeometry(points,24),ceramic);
        // A handle lies in the vertical radial plane, with both ends meeting the cup.
        mesh(cup,new THREE.TorusGeometry(13,3,6,20),ceramic,[30,33,0]);
        if(filled)mesh(cup,new THREE.CylinderGeometry(24.5,24.5,.5,24),material('#70543c',{roughness:.25}),[0,52,0]);
        return cup;
    };
    for(const phase of Object.keys(HOME_SESSIONS)){
        const g=new THREE.Group();g.name=HOME_SESSIONS[phase].title;g.userData.homeSession=phase;kit.add(g);variants.push(g);
        if(phase==='morning'){mug(g,-30,0,true);rod(g,[48,12,-35],[48,12,31],2,metal);mesh(g,new THREE.SphereGeometry(1,12,8),metal,[48,12,31]).scale.set(6,1.4,10);}
        else if(phase==='afternoon'){
            mesh(g,new THREE.LatheGeometry([[0,0],[21,0],[23,4],[22,80],[18,96],[12,100],[12,107],[9,107],[9,100],[19,80],[19,7],[0,7]].map(p=>new THREE.Vector2(...p)),24),ceramic,[-30,8,0]);
            mesh(g,new THREE.CylinderGeometry(29,29,3,24),wood,[39,9.5,0]);mug(g,39,0,false).position.y=11;
        }else if(phase==='evening'){
            box(g,[55,58,60],[-39,37,0],ceramic,7);box(g,[59,7,64],[-39,69.5,0],wood,3);box(g,[26,20,1],[-39,40,30.5],felt,1);mug(g,35,0,true);
        }else if(phase==='night'){
            box(g,[98,10,65],[-15,13,0],felt,6);box(g,[57,25,40],[-15,30.5,0],ceramic,12);const coil=mesh(g,new THREE.TorusGeometry(17,1.5,6,24),dark,[57,10,12]);coil.rotation.x=-Math.PI/2;box(g,[7,4,13],[67,10,-11],metal,1);
        }else{
            mug(g,-43,-22,false);mug(g,32,23,false);for(let i=0;i<3;i++)mesh(g,new THREE.CylinderGeometry(29,29,2,24),wood,[-42,9+i*2,35]);
        }
    }
    interiorCraftFinishes(room,{ceramic:[ceramic],linen:[felt],wood:[wood],metal:[metal]});
    return phase=>{variants.forEach(o=>o.visible=o.userData.homeSession===phase);root.userData.homeSession={phase,...HOME_SESSIONS[phase]};};
}
