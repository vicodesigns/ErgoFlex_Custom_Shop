import * as THREE from 'three';

const phases = ['morning', 'afternoon', 'evening', 'night', 'party'];
const sessions = [
    ['01 / LOOK & DRAW', 'Charcoal contours / warm-up studies'],
    ['02 / MIX & BLOCK IN', 'Limited palette / light and shadow'],
    ['03 / PAINT & REFINE', 'Edges, reflected colour, quiet details'],
    ['04 / CLEAN & REVIEW', 'Palette covered / notes for tomorrow'],
    ['05 / OPEN STUDIO', 'A small collection / share the process']
];
function map(draw, w = 768, h = 192) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
}

// A single still life progresses through the sessions. The same composition
// stays recognizable in the drawing, block-in, wet painting and final display.
export function artistStudyMaps(finished) {
    const results = phases.map((phase, i) => map((c, w, h) => {
        c.fillStyle = i === 0 ? '#d8d1bf' : '#ac7c5a'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#5c5046'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, h * .64); c.lineTo(w, h * .64); c.stroke();
        c.beginPath(); c.ellipse(w * .42, h * .5, w * .15, h * .17, 0, 0, Math.PI * 2); c.stroke();
        c.strokeRect(w * .37, h * .26, w * .1, h * .16);
        c.beginPath(); c.ellipse(w * .42, h * .26, w * .07, h * .02, 0, 0, Math.PI * 2); c.stroke();
        for (const [x,y] of [[.66,.66],[.75,.7],[.22,.68],[.58,.73]]) {
            c.beginPath(); c.ellipse(w*x,h*y,w*.065,h*.05,0,0,Math.PI*2); c.stroke();
        }
        if (i > 0) {
            c.save(); c.beginPath(); c.rect(0, 0, w * [0,.61,.91,.96,1][i], h); c.clip();
            c.drawImage(finished.image,0,0,w,h); c.restore();
        }
        // Canvas tooth and light charcoal construction lines, with no shiny overlay.
        c.strokeStyle = '#62534414'; c.lineWidth = .7;
        for (let p = 0; p < Math.max(w,h); p += 5) { c.beginPath(); c.moveTo(p,0); c.lineTo(p,h); c.moveTo(0,p); c.lineTo(w,p); c.stroke(); }
        if (i === 0) {
            c.strokeStyle = '#685d4930'; c.setLineDash([8,10]);
            for (const x of [.27,.42,.57]) { c.beginPath(); c.moveTo(w*x,h*.15); c.lineTo(w*x,h*.87); c.stroke(); }
        }
    },512,640));
    finished.dispose(); return results;
}

export function artistSessionDetails(room, layout, h, { board, storage, canvas, studyMaps, taboret, palettePaint }) {
    const { box, mesh, rod, material, markSceneAsset } = h;
    const paper = material('#ede6d6', { roughness: .96 });
    const ink = material('#3f4946', { roughness: .75 });
    const aluminum = material('#aeb7b5', { metalness: .82, roughness: .3 });
    const recordMaps = sessions.map(([title, subtitle]) => map((c,w,h) => {
        c.fillStyle='#ece6d9';c.fillRect(0,0,w,h);c.fillStyle='#9d6048';c.fillRect(20,24,5,h-48);
        c.fillStyle='#354942';c.font='600 32px sans-serif';c.fillText(title,46,75);
        c.fillStyle='#685d50';c.font='26px Georgia';c.fillText(subtitle,46,127,w-70);
    }));
    const brief=mesh(board,new THREE.PlaneGeometry(850,68),material('#ffffff',{map:recordMaps[0],roughness:.95}),[0,-290,44]);
    brief.name='Artist session brief';brief.ownedTextures=recordMaps;brief.castShadow=false;
    canvas.name='Artist evolving still life';canvas.ownedTextures=studyMaps;
    const labels=['PAPER / COTTON RAG','CHARCOAL / GRAPHITE','COLOUR / PIGMENTS','PRINTS / PROOFS','PORTFOLIO / ARCHIVE'];
    labels.forEach((label,i)=>{
        const t=map((c,w,h)=>{c.fillStyle='#eee4d0';c.fillRect(0,0,w,h);c.fillStyle='#514c3f';c.font='600 24px sans-serif';c.fillText(label,14,45,w-28);},512,72);
        const face=mesh(storage,new THREE.PlaneGeometry(76,18),material('#ffffff',{map:t,roughness:.95}),[layout.cabinet[0]-291.2,175+i*148,layout.cabinet[1]]);
        face.rotation.y=-Math.PI/2;face.castShadow=false;
    });
    // On the existing taboret: a flat lid for clean-up, or swatch paper and
    // charcoal beside the mixing area. The brushes retain their editor identity.
    let setting=null;
    if(taboret){
        setting=new THREE.Group();setting.name='Artist daily palette';setting.position.set(0,720,0);taboret.add(setting);
        markSceneAsset(setting,{key:`creative:${layout.id}:fixture:daily-palette`});
        for(const [i,phase] of phases.entries()){
            const g=new THREE.Group();g.name=sessions[i][0];g.userData.artistSession=phase;setting.add(g);
            if(i===0){
                box(g,[270,2,175],[-40,10,-30],paper,1);
                for(let n=0;n<3;n++)rod(g,[-145+n*70,13,-85],[-130+n*70,13,25],3,ink);
                box(g,[28,12,23],[65,18,26],material('#b4afa5',{roughness:1}),3);
            }else if(i===3||i===4){
                box(g,[366,9,286],[-40,12.5,-40],aluminum,3);
                // Turned handle with two feet, resting on the palette cover.
                for(const x of [-80,0])box(g,[8,10,12],[x,22,-40],ink,2);
                rod(g,[-80,28,-40],[0,28,-40],4,ink);
                if(i===4){
                    const t=map((c,w,h)=>{c.fillStyle='#eee6d6';c.fillRect(0,0,w,h);c.fillStyle='#455c50';c.font='26px Georgia';c.fillText('Still life / studio notes',22,55);c.font='19px sans-serif';c.fillText('CHARCOAL  •  OIL ON LINEN',22,99);},512,128);
                    const card=mesh(g,new THREE.PlaneGeometry(225,60),material('#ffffff',{map:t,roughness:.95}),[-30,17.2,-110]);card.rotation.x=-Math.PI/2;card.castShadow=false;
                }
            }else{
                const swatch=box(g,[235,1.5,40],[-55,1,175],paper,.5);
                for(let n=0;n<5;n++)box(g,[28,.5,22],[-140+n*43,2,175],material(['#b06e4e','#caad72','#829480','#6b7f88','#d2c7b1'][n]),.5);
                swatch.name='Hand-painted colour mixing strip';
                rod(g,[-150,4,125],[-25,4,120],3,ink);rod(g,[-25,4,120],[12,4,119],2,aluminum);
            }
        }
    }
    return {
        apply(phase){
            const index=Math.max(0,phases.indexOf(phase));
            // Materials may be cloned by LED spill; always address the live mesh.
            canvas.material.map=studyMaps[index];brief.material.map=recordMaps[index];
            if(setting)setting.children.forEach((o,i)=>{o.visible=i===index;});
            if(palettePaint)palettePaint.visible=index===1||index===2;
        }
    };
}
