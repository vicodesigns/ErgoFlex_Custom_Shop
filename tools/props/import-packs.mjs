#!/usr/bin/env node
// Import the supplied October 2026 glTF packs without Blender or remote uploads.
// Sources must already be extracted in models/packs/. IDs are stable and prefixed.
// node tools/props/import-packs.mjs [--only id,id]
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const root = path.resolve(import.meta.dirname, '../..');
const arg = process.argv.indexOf('--only'), only = arg < 0 ? null : new Set(process.argv[arg+1].split(','));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const packs = [
    {folder:'kenney-furniture',collection:'Kenney Furniture',prefix:'kenney-furniture',extension:'.glb',scale:2,license:'CC0-1.0',attribution:'Kenney (www.kenney.nl)',category:'furniture',scenes:['home','office','lounge','kitchen','bedroom']},
    {folder:'kenney-factory',collection:'Kenney Factory',prefix:'kenney-factory',extension:'.glb',scale:1.5,license:'CC0-1.0',attribution:'Kenney (www.kenney.nl)',category:'industrial',scenes:['creative','scifi']},
    {folder:'kenney-space',collection:'Kenney Space',prefix:'kenney-space',extension:'.glb',scale:.75,license:'CC0-1.0',attribution:'Kenney (www.kenney.nl)',category:'space',scenes:['scifi']},
    {folder:'decorations',collection:'Decorations',prefix:'decor',extension:'.gltf',scale:1,license:'unconfirmed',attribution:null,category:'decor',scenes:['home','creative','lounge']},
    {folder:'pickups-and-objects',collection:'Pickups & Objects',prefix:'pickup',extension:'.gltf',scale:1,license:'unconfirmed',attribution:null,category:'gaming',scenes:['gaming','scifi']},
    {folder:'quaternius',collection:'Quaternius Guitar',prefix:'quaternius',extension:'.glb',scale:1,license:'unconfirmed',attribution:'Quaternius; supplied by user',category:'music',scenes:['home','music','creative']}
];
const slug = value => value.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/_/g,'-').toLowerCase();
const title = value => value.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const indexPath=path.join(root,'assets/props/index.json'),manifestPath=path.join(root,'tools/props/manifest.json');
const index=JSON.parse(fs.readFileSync(indexPath)),manifest=JSON.parse(fs.readFileSync(manifestPath));
const entries=new Map(index.props.map(p=>[p.id,p])), jobs=new Map(manifest.props.map(p=>[p.id,p]));
const reports=[];
function specFor(pack,name,dimensions) {
    const id=`${pack.prefix}-${slug(name.replace(/^Decoration_/,''))}`;
    const spec={id,name:title(name.replace(/^Decoration_/,'')),collection:pack.collection,category:pack.category,scenes:pack.scenes,anchor:'floor',unitScale:pack.scale,converter:'gltf-pack',license:pack.license,attribution:pack.attribution};
    if(pack.folder==='kenney-furniture') {
        if(/computer|laptop|television|speaker|radio|ceilingFan/i.test(name))spec.category='electronics';
        if(/plant|pillow|books|rug|bear/i.test(name))spec.category='decor';
        if(/lamp/.test(name))spec.category='lighting';
        if(/floor|wall|doorway|stairs|paneling/.test(name))spec.category='architecture';
        if(/lampWall|Mirror|coatRack$/.test(name))spec.anchor='wall';
        if(/Ceiling|ceilingFan/.test(name))spec.anchor='ceiling';
        const exact={laptop:['x',350],computerKeyboard:['x',440],computerMouse:['max',115],kitchenCoffeeMachine:['max',320],radio:['x',320],books:['y',230],lampRoundTable:['y',480],lampSquareTable:['y',480]};
        if(exact[name])spec.fit={axis:exact[name][0],mm:exact[name][1]};
        spec.sizeNote='Design estimates: pack uses a shared 2× scale (920 mm chair height), with measured fit overrides for small objects. Architecture keeps the same module scale.';
    } else if(pack.folder==='kenney-factory') {
        spec.sizeNote='Shared module scale: 1.5 m floor tile and 2.4 m door. Design estimate; modules keep their relative dimensions.';
    } else if(pack.folder==='kenney-space') {
        spec.sizeNote='Shared module scale: 3 m floor tile and 3.19 m small-room ceiling. Design estimate; modules keep their relative dimensions.';
    } else if(pack.folder==='decorations') {
        const fits={Bamboo:['y',1750],Bell:['x',700],Carpet:['z',2000],Fish:['x',500],Light:['y',400],Painting:['x',900],Painting_Small:['x',420],Plant1:['y',300],Plant2:['y',850],SakuraFlower:['max',250],SakuraTree:['y',2200],Sign:['x',1000],Sign_2:['x',800],Sign_3:['y',800],WallLight:['y',450]};
        const short=name.replace(/^Decoration_/,'');const fit=fits[short];if(!fit)throw new Error('No size decision for '+name);spec.fit={axis:fit[0],mm:fit[1]};
        if(/Painting|Fish|WallLight|Sign$/.test(short))spec.anchor='wall';
        if(/Light|Bell/.test(short))spec.category='lighting';
        spec.sizeNote='Decorative size estimate for room use, not a manufacturer dimension. Atlas texture preserved.';
    } else if(pack.folder==='pickups-and-objects') {
        spec.fit={axis:'max',mm:/Tank|Lootbox/.test(name)?450:250};spec.sizeNote='Stylized display prop, sized for a shelf or floor display.';
    } else {
        spec.name='Guitar by Quaternius';spec.rotateX=90;spec.rotateY=0;spec.fit={axis:'y',mm:1050};spec.sizeNote='1050 mm overall guitar length; design estimate. Rotated upright with front facing +Z.';
    }
    return spec;
}
for(const pack of packs) {
    const sources=files(path.join(root,'models/packs',pack.folder)).filter(f=>path.extname(f)===pack.extension).sort();
    for(const source of sources) {
        const name=path.basename(source,pack.extension),document=await io.read(source);
        document.setLogger(new Logger(Logger.Verbosity.ERROR));
        const docRoot=document.getRoot(),scene=docRoot.getDefaultScene()||docRoot.listScenes()[0];
        if(!scene||docRoot.listSkins().length)throw new Error('Unsupported scene/skin: '+source);
        const sourceBounds=getBounds(scene),spec=specFor(pack,name,sourceBounds.max.map((v,i)=>v-sourceBounds.min[i]));
        if(only&&!only.has(spec.id))continue;
        const wrapper=document.createNode(spec.name);const children=scene.listChildren();children.forEach(n=>{scene.removeChild(n);wrapper.addChild(n);});scene.addChild(wrapper);
        const ax=(spec.rotateX||0)*Math.PI/360,ay=(spec.rotateY||0)*Math.PI/360;
        wrapper.setRotation([Math.cos(ay)*Math.sin(ax),Math.sin(ay)*Math.cos(ax),-Math.sin(ay)*Math.sin(ax),Math.cos(ay)*Math.cos(ax)]);
        let b=getBounds(scene),scale=spec.unitScale;
        if(spec.fit){const size=b.max.map((v,i)=>v-b.min[i]),extent=spec.fit.axis==='max'?Math.max(...size):size['xyz'.indexOf(spec.fit.axis)];if(!(extent>0))throw new Error('Invalid bounds for '+spec.id);scale=spec.fit.mm/1000/extent;}
        wrapper.setScale([scale,scale,scale]);b=getBounds(scene);
        const offset=[-(b.max[0]+b.min[0])/2,-b.min[1],-(b.max[2]+b.min[2])/2];
        if(spec.anchor==='ceiling')offset[1]=-b.max[1];
        if(spec.anchor==='wall'){offset[1]=-(b.max[1]+b.min[1])/2;offset[2]=-b.min[2];}
        wrapper.setTranslation(offset);b=getBounds(scene);
        let tris=0;scene.traverse(n=>{for(const p of n.getMesh()?.listPrimitives()||[]){if(p.getMode()!==4)throw new Error('Nontriangle primitive in '+spec.id);tris+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;}});
        if(!tris||!b.min.every(Number.isFinite)||!b.max.every(Number.isFinite))throw new Error('Empty or invalid model: '+spec.id);
        const file=`assets/props/${spec.id}.glb`;await io.write(path.join(root,file),document);
        const sourcePath=path.relative(path.join(root,'models'),source);
        jobs.set(spec.id,{...spec,source:sourcePath,budget:Math.ceil(tris),textureSize:1024});
        const entry={id:spec.id,name:spec.name,collection:spec.collection,category:spec.category,scenes:spec.scenes,file,source:'models/'+sourcePath,anchor:spec.anchor,size:b.max.map((v,i)=>Math.round((v-b.min[i])*1e5)/100),min:b.min.map(v=>Math.round(v*1e5)/100),max:b.max.map(v=>Math.round(v*1e5)/100),tris,bytes:fs.statSync(path.join(root,file)).size,license:spec.license,attribution:spec.attribution,sizeNote:spec.sizeNote,animations:docRoot.listAnimations().length};
        entries.set(entry.id,entry);reports.push(entry);
    }
    console.log(`${pack.collection}: ${reports.filter(p=>p.collection===pack.collection).length} imported`);
}
if(only)for(const id of only)if(!reports.some(p=>p.id===id))throw new Error('Unknown pack model '+id);
index.props=[...entries.values()];index.generated=new Date().toISOString();manifest.props=[...jobs.values()];
fs.writeFileSync(indexPath,JSON.stringify(index,null,1)+'\n');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,1)+'\n');
fs.writeFileSync('/tmp/ef-imported-packs.json',JSON.stringify(reports,null,2));
console.log(`${reports.length} models, ${reports.reduce((sum,p)=>sum+p.tris,0)} triangles, ${(reports.reduce((sum,p)=>sum+p.bytes,0)/1048576).toFixed(2)} MB; ${index.props.length} total library entries.`);
