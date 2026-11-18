// The Props lane and the "On screen" panel follow what the stage draws (17 Nov 2026, Vico, create in his 2nd cut: the
// painter shelf "really comes in at 12.7" while the lane said "the whole chapter"). The film times some desk
// accessories itself with film-fx accessories.add[].visible keys (the shelf is held hidden until 12.6 s); the desk's
// auto-stow puts the easel and painter shelf away while the tilt is between 9 and 50 deg. A retime keeps the film's end.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filmVisibleKeys,forcedAt,shownStretches,keyedWindow} from '../experience/prop-stow-window.mjs';
import {keyedFadeWindow,filmFadeKeys,combineFilmFade,showOverFilm,showFactor,cleanPropEdit} from '../experience/prop-edits.mjs';
import {legacyMotionToClips,sampleClipMotion} from '../experience/desk-clips.mjs';
const create=JSON.parse(fs.readFileSync(new URL('../exports/cinematic-intro-20261104-hq14/director-film/create.json',import.meta.url))),T=create.seconds;
const tilt=(()=>{const m=legacyMotionToClips(create.motion,T);return t=>sampleClipMotion(m,t).tilt;})();
const win=match=>{const k=filmVisibleKeys(create.accessories,match),f=filmFadeKeys(create,match);return keyedWindow(k,f?keyedFadeWindow(f,0,T):null,0,T);};

// 1. which item the keys are for: the accessory's own id, not a longer name that ends the same way
assert.deepEqual(filmVisibleKeys(create.accessories,'^Accessory:painter-shelf$'),[[0,0],[12.6,1]]);
assert.deepEqual(filmVisibleKeys(create.accessories,'painter-shelf Accessory:painter-shelf'),[[0,0],[12.6,1]],'by the learned accessory id too');
assert.equal(filmVisibleKeys(create.accessories,'ergoflex-painter-shelf'),null,'a brush of the shelf (path ergoflex-painter-shelf) is not the shelf');
assert.equal(filmVisibleKeys(create.accessories,'^Prop:painted-mug$'),null);
assert.equal(forcedAt([[0,0],[12.6,1]],12.59),false);assert.equal(forcedAt([[0,0],[12.6,1]],12.6),true);assert.equal(forcedAt([[7.4,0]],3),null,'before the first key the desk decides');

// 2. THE BUG: the painter shelf's bar and "On screen" are 12.6 s to the end, not the whole chapter
assert.deepEqual(win('^Accessory:painter-shelf$'),{from:12.6,to:T,fadeIn:0,fadeOut:0,keyed:true});
const bar=combineFilmFade({from:0,to:T,fadeIn:0,fadeOut:0,ease:null,timed:false},win('^Accessory:painter-shelf$'),false);
assert.deepEqual([bar.from,bar.to,bar.timed],[12.6,T,false],'the bar starts where the shelf comes in');
assert.deepEqual(shownStretches({text:'^Accessory:painter-shelf$',recipe:'artist',tiltAt:tilt,keys:[[0,0],[12.6,1]],lo:0,hi:T}),[{from:12.6,to:T}],'the keys hold over the tilt rule (the drafting tilt is 40 deg at 12.6 s)');
// the other film-timed items of create: easel 17.5 s on (its keyed fade from 17.5, 1.8 s), drafting kit and easel rail 7.0 to 18.7 s
assert.deepEqual(win('^Accessory:artist-easel$'),{from:17.5,to:T,fadeIn:1.8,fadeOut:0,keyed:true});
assert.deepEqual(win('^Accessory:drafting-kit$'),{from:7,to:18.7,fadeIn:.4,fadeOut:1.8,keyed:true});
assert.deepEqual(win('^Accessory:easel-rail$'),{from:7,to:18.7,fadeIn:.4,fadeOut:1.8,keyed:true});
assert.deepEqual(win('^Prop:atelier-artist-pen-display-oak$'),{from:0,to:7.4,fadeIn:0,fadeOut:.4,keyed:true});
assert.equal(win('^Prop:painted-mug$'),null,'an item the film does not time: no window');

// 3. a retime keeps the film's other end (closed there, never open: an open start would let film-edits keep the shelf up
// from 7.3 s, where the tilt passes 9 deg and the stow marks it, before the film's key shows it at 12.6 s)
const shelf=win('^Accessory:painter-shelf$'),leave=showOverFilm(shelf,0,T,{from:12.6,to:20,fadeIn:0,fadeOut:.5});
assert.deepEqual([leave.from,leave.to,leave.fadeIn,leave.fadeOut],[12.6,20,0,.5],'Leaves at 20 s with a fade: it still comes in at 12.6 s');
for(const t of [0,7.5,10,12.5])assert.equal(showFactor(leave,t),0,'not drawn at '+t+' s');
assert.equal(showFactor(leave,15),1);assert.equal(showFactor(leave,20.5),0);
const later=showOverFilm(shelf,0,T,{from:14,to:T,fadeIn:.5,fadeOut:0});
assert.deepEqual([later.from,later.fadeIn,later.to],[14,.5,T],'Appears at 14 s: in later, to the end');
const kit=win('^Accessory:drafting-kit$'),kitEnd=showOverFilm(kit,0,T,{from:7,to:15,fadeIn:.4,fadeOut:1});
assert.deepEqual([kitEnd.from,kitEnd.fadeIn,kitEnd.to,kitEnd.fadeOut],[7,0,15,1],'the kit: in at the film\'s 7 s (the film\'s own .4 s ramp, not a second one)');

// 4. a retime keeps every other setting of the edit (Vico's entry 32: the shelf's local place and turn)
const e32={match:'^Accessory:painter-shelf$',path:'^Room:creative > Cinematic demonstration desk · ErgoFlex desk > Desk dressing:desktop > Accessory:painter-shelf$',label:'Accessory:painter-shelf',space:'local',position:[0,-.127,-.135],rotation:[31.9,0,0],director:true};
const kept=cleanPropEdit({...e32,show:{from:leave.from,to:leave.to,fadeOut:leave.fadeOut}});
assert.deepEqual([kept.position,kept.rotation,kept.space,kept.match,kept.show],[[0,-.127,-.135],[31.9,0,0],'local','^Accessory:painter-shelf$',{from:12.6,to:20,fadeOut:.5}]);

// 5. an item only the tilt rule decides (no keys): one stretch per time it is drawn, not "the whole chapter"
const fold=t=>t<11.25?0:t>21.25?65:(t-11.25)/10*65;   // storage-like: 0 -> 65 deg over 11.25 - 21.25 s
const st=shownStretches({text:'Accessory:painter-shelf',recipe:'artist',tiltAt:fold,lo:0,hi:25});
assert.equal(st.length,2,JSON.stringify(st));assert.ok(Math.abs(st[0].to-12.63)<.02&&st[0].from===0&&Math.abs(st[1].from-18.94)<.02&&st[1].to===25,JSON.stringify(st));
assert.deepEqual(shownStretches({text:'Accessory:task-light',recipe:'artist',tiltAt:fold,lo:0,hi:25}),[{from:0,to:25}],'no rule: the whole time');
assert.deepEqual(shownStretches({text:'Accessory:painter-shelf',recipe:'artist',tiltAt:()=>30,lo:0,hi:25}),[],'never drawn');
console.log('prop-film-visible-test: ok');
