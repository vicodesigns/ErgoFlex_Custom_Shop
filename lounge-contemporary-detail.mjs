import * as THREE from 'three';
import {interiorCraftFinishes} from './interior-craft-detail.mjs';

// Wall compositions use the same measured bays as the furnishings. Keeping
// their roots on the appropriate wall also keeps cutaway views coherent.
export function dressContemporaryLounge({room,root,layout:l,helpers:h,p,materials:m,groups,fixture,line,artwork}) {
    const {box,mesh,rod,sphere}=h, w=l.width, b=l.back, front=b+l.depth;
    const finish=(color,extra={})=>{const mat=h.material(color,{roughness:.8,...extra});mat.userData.roomFinishLocked=true;return mat;};
    const paper=finish('#e7ddc9',{roughness:.98}),ceramic=finish('#b18060',{roughness:.36}),ink=finish('#293d43'),opal=finish('#f2e6cc',{emissive:'#ffe3b3',emissiveIntensity:.4});
    const weave=finish('#b6a88d',{roughness:.98});
    interiorCraftFinishes(room,{linen:[weave],ceramic:[ceramic]});
    const lamps=[];
    const asset=new URL('./assets/decor/lounge/coastal-oil-v1.png',import.meta.url).href;
    const maps=[];root.userData.loungeArt={url:asset,status:'loading'};
    room.loungeArtReady=typeof document.createElementNS!=='function'?Promise.resolve(false):new Promise(resolve=>{
        new THREE.TextureLoader().load(asset,texture=>{
            if(room.root!==root){root.userData.loungeArt.status='superseded';texture.dispose();resolve(false);return;}
            texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
            (root.ownedTextures||=[]).push(texture);
            for(const {material,face,ratio,offset} of maps){
                const copy=texture.clone();copy.repeat.set(Math.min(1,ratio/1.5),Math.min(1,1.5/ratio));copy.offset.set(offset*(1-copy.repeat.x),.5*(1-copy.repeat.y));copy.needsUpdate=true;
                root.ownedTextures.push(copy);material.map=copy;material.needsUpdate=true;
                // Room LED/bounce binding may already have made a shader-owned
                // material copy while the image was loading. Update the live
                // face as well as the original material used on disposal.
                for(const live of [].concat(face.material)){live.map=copy;live.needsUpdate=true;}
            }
            root.userData.loungeArt={url:asset,status:'ready',frames:maps.length,width:texture.image?.width};resolve(true);
        },undefined,()=>{root.userData.loungeArt.status='failed';resolve(false);});
    });
    function graphic(ratio,seed){
        const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.max(240,Math.round(768/ratio));const c=canvas.getContext('2d'),hh=canvas.height;
        c.fillStyle='#ded6c5';c.fillRect(0,0,768,hh);
        for(let i=0;i<1600;i++){c.fillStyle=i%2?'#fffbed12':'#463b3010';c.fillRect((Math.sin(i*19.12)*.5+.5)*768,(Math.sin(i*31.19)*.5+.5)*hh,1,1);}
        c.strokeStyle='#344848';c.lineWidth=2.5;
        const study=Math.round(seed*2)%3;
        for(let i=0;i<19;i++){const t=i/18;c.beginPath();
            if(study===0){c.moveTo(100+t*65,hh*.82);c.bezierCurveTo(650-t*250,hh*.08,150+t*380,hh*.12,650-t*50,hh*.65);}
            else if(study===1){c.moveTo(100,hh*(.2+t*.6));c.bezierCurveTo(300,hh*(.1+t*.4),430,hh*(.85-t*.4),660,hh*(.65-t*.2));}
            else c.ellipse(390,hh*.49,90+i*6,hh*(.11+i*.012),-.35,.1,Math.PI*1.9);
            c.stroke();
        }
        c.fillStyle='#a46d49';c.globalAlpha=.7;c.fillRect(440,hh*.18,42,hh*.42);c.globalAlpha=1;
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;(root.ownedTextures||=[]).push(texture);return texture;
    }
    function frame(parent,width,height,at,section=.5,medium='painting'){
        const g=new THREE.Group();g.position.set(...at);parent.add(g);
        box(g,[width,height,34],[0,0,0],m.oak,5);
        box(g,[width-32,height-32,4],[0,0,19],m.steel,2);
        box(g,[width-48,height-48,3],[0,0,22],paper,2);
        const ratio=(width-110)/(height-110),pigment=finish('#ffffff',{map:medium==='graphic'?graphic(ratio,section):artwork,roughness:.88});
        const face=mesh(g,new THREE.PlaneGeometry(width-110,height-110),pigment,[0,0,24]);face.castShadow=false;
        if(medium==='painting')maps.push({material:pigment,face,ratio,offset:section});
        return g;
    }
    function pictureLight(parent,width,y,z=70){
        rod(parent,[-width*.23,y+60,15],[-width*.23,y+60,z],8,m.steel);
        rod(parent,[width*.23,y+60,15],[width*.23,y+60,z],8,m.steel);
        box(parent,[width*.58,20,45],[0,y+60,z],m.steel,5);
        line(parent,[width*.52,6,24],[0,y+47,z],true);
    }
    for(const child of [...groups.heroArt.children]){groups.heroArt.remove(child);child.geometry?.dispose();}
    frame(groups.heroArt,Math.min(2100,w-920),600,[0,0,0],.5,'graphic');
    const windowEnd=b+2300+(l.tier?1850:1350)/2;
    const artStart=Math.max(windowEnd+180,l.tier>=3?l.barZ+1050:windowEnd+180),artEnd=front-150;
    const artW=Math.min(1900,artEnd-artStart-40),artH=l.tier?1080:1000,artZ=(artStart+artEnd)/2;
    const gallery=fixture(groups.left,'modern-sofa-gallery','Framed coastal painting above leather seating',[-w/2+26,1650,artZ],Math.PI/2);
    frame(gallery,artW,artH,[0,0,0]);pictureLight(gallery,artW,artH/2);
    lamps.push({at:[-w/2+450,2050,artZ],power:2,channel:0,role:'painting wash'});
    // A pair of fixed curtain stacks frames the opening without crossing glass.
    const curtains=fixture(groups.left,'modern-window-textiles','Woven linen curtain stacks',[-w/2+50,0,b+2300],Math.PI/2);
    const winW=l.tier?1850:1350;
    rod(curtains,[-winW/2-140,2400,0],[winW/2+140,2400,0],10,m.steel);
    for(const side of [-1,1])for(let i=0;i<7;i++){
        const panel=mesh(curtains,new THREE.CylinderGeometry(18,21,2360,10,1,false),weave,[side*(winW/2+38)+side*i*18,1200,18]);
        panel.scale.z=.75;
    }
    // A low book cabinet gives the existing three-part wall composition a
    // furniture datum; its depth stays inside the perimeter circulation bay.
    if(l.tier>=2){
        const credenza=fixture(groups.right,'modern-curated-credenza','Walnut book cabinet with ceramics',[w/2-195,0,b+2850],-Math.PI/2,true);
        box(credenza,[1510,60,330],[0,90,0],ink,8);
        box(credenza,[1510,530,18],[0,385,-156],m.oak,4);
        for(const x of [-743,743])box(credenza,[24,530,330],[x,385,0],m.oak,4);
        const lowerShelf=box(credenza,[1510,26,330],[0,133,0],m.oak,4);
        box(credenza,[1550,32,350],[0,666,0],m.stone,8);
        for(const x of [-490,0,490])box(credenza,[18,475,300],[x,385,5],ink,2);
        box(credenza,[1460,16,300],[0,370,5],ink,2);
        const bookColors=['#526d68','#d2b591','#ad785e','#344950','#e5dac3'];
        for(const cx of [-610,-245,245,610])for(let i=0;i<5;i++){
            const height=170+i%3*18;
            const book=box(credenza,[28+i%3*4,height,155],[cx-70+i*35,146+height/2,50],finish(bookColors[i%5]),2);book.userData.stagedSupportUuid=lowerShelf.uuid;
        }
        for(let i=0;i<3;i++)box(credenza,[210,17,170],[-245,386.5+i*17,35],finish(bookColors[i]),2);
        for(const [x,r,hh] of [[-470,48,160],[-340,35,115]]){
            mesh(credenza,new THREE.CylinderGeometry(r*.7,r,hh,24),ceramic,[x,682+hh/2,0]);
            for(let i=0;i<3;i++)rod(credenza,[x,682+hh,0],[x+(i-1)*32,1000+i*25,(i-1)*18],3,m.oak);
        }
        const shade=mesh(credenza,new THREE.CylinderGeometry(115,160,180,40,1,true),weave,[470,1040,0]);shade.material.side=THREE.DoubleSide;
        rod(credenza,[470,682,0],[470,960,0],14,m.steel);box(credenza,[180,24,180],[470,694,0],m.stone,20);
        lamps.push({at:[w/2-230,1020,b+3320],power:3.2,channel:0,role:'cabinet lamp'});
        const old=groups.relief;
        for(const child of [...old.children]){old.remove(child);child.geometry?.dispose();}
        for(let i=0;i<3;i++)frame(old,430,740,[-520+i*520,20,0],i/2,'graphic');
        pictureLight(old,1450,420);
    }
    // Back-wall library and art balance the main desk without crowding its bay.
    if(l.tier>=2){
        const library=fixture(groups.rear,'modern-library-wall','Curated walnut display shelving',[-w/2+950,0,b+160],0,true);
        const width=l.tier>=3?1120:820;
        box(library,[width,1750,25],[0,1125,-125],ink,8);
        for(const x of [-width/2,width/2])box(library,[32,1900,260],[x,1050,0],m.oak,3);
        const libraryShelves=new Map();for(const y of [150,640,1130,1620,2000]){libraryShelves.set(y,box(library,[width,30,260],[0,y,0],m.oak,3));if(y>150)line(library,[width-65,5,20],[0,y-19,105],true);}
        for(let row=0;row<3;row++)for(let i=0;i<6;i++){const hh=180+(i%4)*24,book=box(library,[28+i%3*7,hh,150],[-width/2+70+i*44,655+row*490+hh/2,14],finish(['#d6c4a5','#527371','#a76445','#303e47'][i%4]),2);book.userData.stagedSupportUuid=libraryShelves.get(640+row*490).uuid;}
        for(const row of [0,1,2]){const vase=mesh(library,new THREE.SphereGeometry(1,24,16),row%2?ceramic:m.stone,[width*.26,655+row*490+75,0]);vase.scale.set(70,75,65);}
        lamps.push({at:[-w/2+900,2100,b+500],power:3,channel:0,role:'library wash'});
        const art=fixture(groups.rear,'modern-desk-side-art','Portrait painting and picture light',[w/2-900,1760,b+32]);
        frame(art,820,1100,[0,0,0],.8,'graphic');pictureLight(art,820,600);
    }
    // Small rooms get one considered picture rather than the large-room library.
    if(l.tier===1){
        const art=fixture(groups.right,'modern-desk-side-art','Framed colour study',[w/2-30,1720,b+650],-Math.PI/2);
        frame(art,980,1120,[0,0,0],.2,'graphic');pictureLight(art,900,590);
    }
    // Table and reading light share one measured base outside the sofa and
    // coffee-table envelopes. The lamp has a visible shade and warm emitter.
    const lampX=l.sofaX+(l.tier?800:650),lampZ=front-350;
    const reading=fixture(root,'modern-reading-table','Stone side table and shaded reading lamp',[lampX,0,lampZ],0,true);
    mesh(reading,new THREE.CylinderGeometry(100,110,14,32),m.oak,[0,7,0]);
    mesh(reading,new THREE.CylinderGeometry(195,195,28,40),m.stone,[0,565,0]);
    mesh(reading,new THREE.CylinderGeometry(65,90,537,32),m.oak,[0,282.5,0]);
    rod(reading,[0,579,0],[0,1110,0],14,m.steel);
    mesh(reading,new THREE.CylinderGeometry(135,195,230,40,1,true),weave,[0,1210,0]).material.side=THREE.DoubleSide;
    sphere(reading,[48,48,48],[0,1170,0],opal).castShadow=false;
    lamps.push({at:[lampX,1170,lampZ],power:3.8,channel:0,role:'reading lamp'});
    // Tailored rug borders, woven inner field and a throw folded over the sofa.
    const rug=groups.rug,rw=l.tier?2700:2250,rd=rw;
    for(const x of [-rw/2+38,rw/2-38])box(rug,[5,1,rd-76],[x,5.5,0],weave);
    for(const z of [-rd/2+38,rd/2-38])box(rug,[rw-76,1,5],[0,5.5,z],weave);
    root.userData.loungeDesignDetails={revision:3,paintedArt:asset,artCount:2+(l.tier>=2?4:l.tier===1?1:0),curtains:true,visibleReadingLamp:true};
    return {lamps,update(phase){opal.emissiveIntensity=phase==='night'?.25:.45;}};
}
