// "Same setup as another desk" (experience/desk-kit.mjs, the Desks tab): the keyboard tray, single monitor arm, monitor and the
// WHITE ErgoFlex keyboard and mouse copied onto a room desk (Oilers: Fern's white desk, standing at 43.5 in), the placement maths,
// the build schema that carries it (desk-build.mjs: accessoryFinishes + objects) and Export cut / film paths keeping it. Plain node.
//   node tests/desk-kit-test.mjs
import assert from 'node:assert/strict';
import {cleanDeskBuild,withDeskBuild,buildOf,cleanBuildAccessories} from '../experience/desk-build.mjs';
import {cleanDeskEdit,cleanDeskEdits,mergeDeskEdits,effectiveDeskEdits,describeDeskEdit} from '../experience/desk-edits.mjs';
import {copySetup,kitEdit,hbhsObjects,monitorOffset,eyeOf,heightsAt,finishFor,KIT_PARTS,HBHS_KIT,EYE_REF_ABOVE_DESKTOP,MONITOR_CLEARANCE,MONITOR_HALF,deskTopMm,lowestMonitorY,PANEL_EDGE_CLEARANCE,SHELF_FRAME_ABOVE_DESKTOP,FRAME_SCALE} from '../experience/desk-kit.mjs';
import {cleanShot,makeCut,cleanCut,encodeCut,decodeCut} from '../experience/cuts.mjs';
import {accessory} from '../catalog.mjs';

// the black featured desk as the stage reads it (readSetup): the HBHS build and its placements
const featured={id:'featured',size:'60x30',baseFinish:'Black',accessories:[{id:'monitor-arm',slot:'shelf'},{id:'flat-monitor',slot:'shelf'},{id:'keyboard-tray',slot:'desktop'},{id:'ergo-keyboard',slot:'desktop'},{id:'logitech-mx-master',slot:'desktop'},{id:'obsbot-tiny-2',slot:'shelf'}],
  accessoryFinishes:{'keyboard-tray':'steel'},objects:hbhsObjects()};
// Fern's white room desk as the room has it: a compact recipe (Apple keyboard and mouse, a dell monitor on the arm)
const white={size:'60x30',baseFinish:'White',heightIn:28,accessories:[{id:'apple-keyboard',slot:'desktop'},{id:'magic-mouse',slot:'desktop'},{id:'monitor-arm',slot:'shelf'},{id:'dell-u2724d',slot:'shelf'},{id:'shelf-organizer',slot:'base-shelf'}]};
const ids=b=>b.accessories.map(a=>a.id);

// ---- the catalogue has the white variants this relies on
assert.deepEqual(accessory('ergo-keyboard').finishes,['black','white']);
assert.deepEqual(accessory('logitech-mx-master').finishes,['black','white']);
assert.ok(accessory('keyboard-tray').finishes.includes('steel'));
assert.equal(accessory('monitor-arm').name,'Single monitor arm');

// ---- the copy: white desk, standing at 43.5 in, Fern (1432 mm)
const eye=eyeOf(1432);assert.equal(eye,1332);
const r=copySetup(featured,{...white,heightIn:43.5},{finish:'auto',eyeMm:eye});
assert.equal(r.finish,'white');assert.deepEqual(r.parts,HBHS_KIT);
for(const id of Object.values(HBHS_KIT))assert.ok(ids(r.build).includes(id),id+' on the desk');
assert.ok(!ids(r.build).includes('apple-keyboard')&&!ids(r.build).includes('magic-mouse')&&!ids(r.build).includes('dell-u2724d'),'replaced by the kit');
assert.ok(ids(r.build).includes('shelf-organizer'),"the desk's other accessories stay");
assert.ok(!ids(r.build).includes('obsbot-tiny-2'),'only the five parts');
assert.deepEqual(r.build.accessoryFinishes,{'ergo-keyboard':'white','logitech-mx-master':'white','keyboard-tray':'steel'},'WHITE ErgoFlex keyboard and mouse on the tray');
const slotOf=id=>r.build.accessories.find(a=>a.id===id).slot;
assert.equal(slotOf('keyboard-tray'),'desktop');assert.equal(slotOf('ergo-keyboard'),'desktop');assert.equal(slotOf('logitech-mx-master'),'desktop');
assert.equal(slotOf('monitor-arm'),'shelf');assert.equal(slotOf('flat-monitor'),'shelf');
// placements: the featured desk's own for tray / keyboard / mouse / arm (the hands land where the poses were built to put them)
const hb=hbhsObjects(),o=r.build.objects;
for(const k of ['keyboard-tray','ergo-keyboard','logitech-mx-master','monitor-arm']){
  for(const a of ['x','y','z'])assert.ok(Math.abs(o['accessory-'+k].transform.p[a]-hb['accessory-'+k].transform.p[a])<.01,k+' '+a);
  assert.equal(o['accessory-'+k].role,hb['accessory-'+k].role);
}
assert.ok(o['accessory-keyboard-tray'].transform.p.y<0,'the tray hangs under the desktop');
assert.ok(o['accessory-ergo-keyboard'].transform.p.z>o['accessory-monitor-arm'].transform.p.z+400,'keyboard in front, arm at the rear edge');
assert.ok(o['accessory-monitor-arm'].transform.p.z<0,'the arm clamps behind the middle, at the rear edge');
assert.ok(Math.abs(o['accessory-flat-monitor'].transform.p.x)<30,'the monitor is centred in front of her');
assert.equal(o['accessory-logitech-mx-master'].transform.q.y,1);   // as the HBHS desk turns it

// ---- the monitor at her eyes: lower for a short standing user, never into the desktop, none when the user is an adult
assert.equal(monitorOffset({monitor:'flat-monitor',heightIn:43.5,eyeMm:1650}),Math.round((1650-deskTopMm(43.5)-EYE_REF_ABOVE_DESKTOP)*10)/10);
assert.equal(monitorOffset({monitor:'flat-monitor',heightIn:43.5,eyeMm:deskTopMm(43.5)+EYE_REF_ABOVE_DESKTOP}),0);
const low=monitorOffset({monitor:'flat-monitor',heightIn:43.5,eyeMm:eye});
assert.equal(low,MONITOR_HALF['flat-monitor']+MONITOR_CLEARANCE-EYE_REF_ABOVE_DESKTOP,'clamped to a clear hand above the desktop');
// the eye math alone says -340 mm for Fern at 43.5 in, which put the panel's lower edge 100 mm under the desktop (measured in the oilers
// film): the arm-hung panel is now kept PANEL_EDGE_CLEARANCE above it (258 mm shelf frame, 1.06 frame scale)
assert.equal(hb['accessory-flat-monitor'].transform.p.y+low,-340);
assert.equal(o['accessory-flat-monitor'].transform.p.y,lowestMonitorY(),'Fern: raised to the clear-edge floor, not -340');
assert.ok(SHELF_FRAME_ABOVE_DESKTOP+FRAME_SCALE*o['accessory-flat-monitor'].transform.p.y>=PANEL_EDGE_CLEARANCE-1e-6,'panel edge above the desktop');
assert.ok(Math.abs(lowestMonitorY()+220)<.5,'about -220 mm (the oilers fix)');
assert.ok(SHELF_FRAME_ABOVE_DESKTOP+FRAME_SCALE*(-340)<0,'-340 was under the desktop');
assert.ok(r.notes.some(n=>/eye height/.test(n)));
assert.equal(monitorOffset({monitor:'flat-monitor',heightIn:28,eyeMm:1500}),Math.round((1500-deskTopMm(28)-EYE_REF_ABOVE_DESKTOP)*10)/10);
// no eye height known: copied as it is
const plain=copySetup(featured,{...white,heightIn:43.5},{finish:'white'});
assert.equal(plain.build.objects['accessory-flat-monitor'].transform.p.y,hb['accessory-flat-monitor'].transform.p.y);

// ---- everything follows the desk's height: slot frames are fixed to the desktop, so every height is the desk's plus the part's own
const at28=heightsAt(o,28),at435=heightsAt(o,43.5);
for(const k of Object.keys(o))assert.ok(Math.abs((at435[k]-at28[k])-15.5*25.4)<.11,k+' rises 15.5 in with the desk');
assert.ok(Math.abs(at435['accessory-keyboard-tray']-(43.5*25.4-28))<.11,'the tray hangs 28 mm under a 43.5 in desktop');
assert.ok(Math.abs(at435['accessory-ergo-keyboard']-(43.5*25.4-47.701))<.11);

// ---- finishes
assert.equal(finishFor('auto','White'),'white');assert.equal(finishFor('auto','Pearl White'),'white');assert.equal(finishFor('auto','Black'),'black');
assert.equal(finishFor('black','White'),'black');assert.equal(finishFor('white','Black'),'white');assert.equal(finishFor('source','White'),'source');
const blk=copySetup(featured,white,{finish:'black'});assert.deepEqual(blk.build.accessoryFinishes,{'keyboard-tray':'steel'},'black inputs are the default, not written');
const src=copySetup(featured,white,{finish:'source'});assert.deepEqual(src.build.accessoryFinishes,{'keyboard-tray':'steel'});
// a white copy forces the two white-capable inputs even when the source has others (a mechanical keyboard, a Lift mouse)
const other={...featured,accessories:featured.accessories.map(a=>a.id==='ergo-keyboard'?{id:'mechanical-keyboard',slot:'desktop'}:a.id==='logitech-mx-master'?{id:'logitech-lift',slot:'desktop'}:a)};
const forced=copySetup(other,white,{finish:'white'});assert.ok(ids(forced.build).includes('ergo-keyboard')&&ids(forced.build).includes('logitech-mx-master')&&!ids(forced.build).includes('mechanical-keyboard'));
assert.equal(forced.build.accessoryFinishes['ergo-keyboard'],'white');
// a source that has none of the parts gives the HBHS desk's
const empty=copySetup({size:'60x30',accessories:[],objects:{}},white,{finish:'white'});
assert.deepEqual(empty.parts,HBHS_KIT);assert.equal(Object.keys(empty.build.objects).length,5);assert.equal(empty.notes.length,5);
// a dual arm is not the single arm
const dual=copySetup({...featured,accessories:featured.accessories.map(a=>a.id==='monitor-arm'?{id:'monitor-arm-2',slot:'shelf'}:a)},white,{finish:'white'});
assert.equal(dual.parts.arm,'monitor-arm');assert.ok(dual.notes.some(n=>/dual arm/.test(n)));

// ---- the other desk width: x scales like the studio's own size switch
const narrow=copySetup(featured,{...white,size:'48x30',heightIn:43.5},{finish:'white'});
assert.ok(Math.abs(narrow.build.objects['accessory-logitech-mx-master'].transform.p.x-hb['accessory-logitech-mx-master'].transform.p.x*.8)<.01);
const wide=copySetup({...featured,size:'48x30',objects:narrow.build.objects},{...white,size:'60x30'},{finish:'white'});
assert.ok(Math.abs(wide.build.objects['accessory-logitech-mx-master'].transform.p.x-hb['accessory-logitech-mx-master'].transform.p.x)<.05,'48 -> 60 undoes 60 -> 48');

// ---- the desk edit: standing start (43.5 in, flat: the posture's own height) and the build
const edit=kitEdit({desk:'station-project-review',name:'APA set and costume design review desk',size:'60x30',initial:{height:43.5,tilt:25}},r,{stand:true,size:'60x30'});
assert.deepEqual(edit.initial,{height:43.5,tilt:0});assert.equal(edit.desk,'station-project-review');
const clean=cleanDeskEdit(edit);assert.deepEqual(clean.initial,{height:43.5,tilt:0});assert.deepEqual(clean.build,r.build,'the desk edit keeps the build as it is');
assert.match(describeDeskEdit(clean,{}),/keyboard tray setup/);

// ---- the schema: cleaned, stable, nothing invented
assert.deepEqual(cleanDeskBuild(r.build),r.build,'idempotent');
const dirty=structuredClone(r.build);
dirty.accessoryFinishes['apple-keyboard']='white';dirty.accessoryFinishes['ergo-keyboard']='neon';dirty.accessoryFinishes.nonsense='white';dirty.accessoryFinishes['logitech-mx-master']='black';
dirty.objects['accessory-flat-monitor'].role='desktop';                  // not the slot the build gives it
dirty.objects['accessory-obsbot-tiny-2']=structuredClone(dirty.objects['accessory-monitor-arm']);   // not on the build
dirty.objects['accessory-keyboard-tray'].transform.p.x=NaN;
dirty.objects['accessory-monitor-arm'].transform.q={x:0,y:0,z:0,w:0};
const cd=cleanDeskBuild(dirty);
assert.deepEqual(cd.accessoryFinishes,{'keyboard-tray':'steel'},'only real finishes of listed accessories');
assert.ok(!cd.objects['accessory-flat-monitor']&&!cd.objects['accessory-obsbot-tiny-2']&&!cd.objects['accessory-keyboard-tray']&&!cd.objects['accessory-monitor-arm']);
assert.ok(cd.objects['accessory-ergo-keyboard']&&cd.objects['accessory-logitech-mx-master']);
const trimmed=cleanDeskBuild({...r.build,accessories:r.build.accessories.filter(a=>a.id!=='ergo-keyboard')});
assert.ok(!trimmed.accessoryFinishes['ergo-keyboard']&&!trimmed.objects['accessory-ergo-keyboard'],'a removed accessory takes its finish and place with it');
assert.equal(cleanDeskBuild({accessoryFinishes:{'ergo-keyboard':'white'}}).accessoryFinishes['ergo-keyboard'],'white','without a list: the room\'s own accessories keep the finish');
assert.equal(cleanDeskBuild({woodFinish:'White Birch'}).accessoryFinishes,undefined,'an old build is unchanged');
assert.deepEqual(cleanDeskBuild({woodFinish:'White Birch',accessories:[{id:'flat-monitor',slot:'shelf'}]}),{woodFinish:'White Birch',accessories:[{id:'flat-monitor',slot:'shelf'}]});
const q=cleanDeskBuild(r.build).objects['accessory-ergo-keyboard'].transform.q;assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<2e-3);

// ---- Undo: a desk edit is the Director's own list; the copy is one entry, the list before it is what Undo brings back
const before=[{desk:'station-project-review',name:'x',size:'60x30',initial:{height:28,tilt:0}}];
const after=withDeskBuild(before,'station-project-review','x',r.build);
assert.equal(after.length,1);assert.deepEqual(buildOf({deskEdits:after},'station-project-review'),r.build);
assert.deepEqual(before[0].initial,{height:28,tilt:0},'the earlier list is untouched (Undo restores it)');
assert.equal(buildOf({deskEdits:withDeskBuild(after,'station-project-review','x',null)},'station-project-review'),null);

// ---- Export cut / the film: the shot keeps the edit through the cut's own cleaner, a link and the film's sceneDeskEdits
const shot={room:'highschool',layout:'house',seconds:15,deskEdits:[clean]};
const kept=cleanShot(shot);assert.deepEqual(kept.deskEdits,[clean]);
const cut=makeCut('Oilers desk kit',[shot]);assert.deepEqual(cleanCut(JSON.parse(JSON.stringify(cut))).shots[0].deskEdits,[clean],'Export cut file round trip');
assert.deepEqual(decodeCut(encodeCut(cut)).shots[0].deskEdits,[clean],'link round trip');
assert.deepEqual(mergeDeskEdits({},kept).sceneDeskEdits,[clean],"the film shot's sceneDeskEdits (tools/experience/film-desk-edits.mjs applyBuild)");
assert.deepEqual(effectiveDeskEdits({},kept),[clean]);
assert.deepEqual(cleanDeskEdits({deskEdits:[clean]}).deskEdits,[clean]);
assert.deepEqual(KIT_PARTS,['tray','arm','monitor','keyboard','mouse']);
assert.deepEqual(cleanBuildAccessories(r.build.accessories),r.build.accessories);
console.log("desk-kit-test: ok (white keyboard and mouse on the steel tray, single arm and monitor copied from the featured desk, placement follows the desk height and the user's eyes, schema cleaning, undo list, Export cut and film paths)");

// ---- docs/oilers-desk-kit.json (the restore-point data for Vico's Oilers chapter): every entry survives the Director's own cleaners
import fs from 'node:fs';
import {cleanPropEdit} from '../experience/prop-edits.mjs';
const doc=JSON.parse(fs.readFileSync(new URL('../docs/oilers-desk-kit.json',import.meta.url),'utf8'));
for(const e of doc.deskEdits)assert.deepEqual(cleanDeskEdit(e),e,'desk edit is already clean');
assert.equal(doc.deskEdits[0].desk,'station-project-review');assert.deepEqual(doc.deskEdits[0].initial,{height:43.5,tilt:0});
// (the front desk as Vico's cut has it, 19 Nov 2026: 48x30 at his place; the build is the 48 in copy, not the 60 in one)
assert.equal(doc.deskEdits[0].size,'48x30');assert.deepEqual(doc.deskEdits[0].pose,{x:-4080,z:1149.4,yaw:0});
assert.deepEqual(doc.deskEdits[0].build,copySetup(featured,{size:'48x30',baseFinish:'White',heightIn:43.5,accessories:[]},{finish:'white',eyeMm:eyeOf(1432)}).build,'the build is copySetup for the 48 in desk');
assert.ok(!doc.propEdits.some(e=>/tall-office-chair/.test(e.match)),'no chair edit (Vico hides that chair himself)');
assert.match(doc.how,/MERGE, never replace/);
assert.equal(doc.deskEdits[0].build.accessoryFinishes['ergo-keyboard'],'white');assert.equal(doc.deskEdits[0].build.accessoryFinishes['logitech-mx-master'],'white');
for(const e of [...doc.propEdits,...doc.propEditsFallbackIfTheRoomHasNoPendulumNames])assert.deepEqual(cleanPropEdit(e),e,'prop edit is already clean: '+e.match);
assert.ok(doc.propEdits.some(e=>e.hide===true&&new RegExp(e.match,'i').test('Pendulum bob')&&new RegExp(e.match,'i').test('Pendulum string')&&!new RegExp(e.match,'i').test('Pendulum mount')));
// the room names the pendulum, so the match finds it (a source check: the names are in the room's code)
assert.match(fs.readFileSync(new URL('../institutional-education.mjs',import.meta.url),'utf8'),/\.name = 'Pendulum bob'/);
console.log('desk-kit-test: restore-point data ok');
