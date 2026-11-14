// The pure options of the Director e2e (tests/director-e2e-options.mjs), without a browser or a server:
//   node tests/director-e2e-options-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {e2eOptions,cutLine,peopleCheck,harnessServer,MASTER,DEFAULT_CUT} from './director-e2e-options.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// the cut: --cut, else HQ, else the alternate cut; the first line says which and where it came from
assert.deepEqual(e2eOptions([],{}),{cut:DEFAULT_CUT,from:'default',shared:false,expectPeople:true});
assert.deepEqual(e2eOptions(['--cut','exports/cinematic-intro-20261110-people/'],{HQ:MASTER}),{cut:'exports/cinematic-intro-20261110-people',from:'--cut',shared:false,expectPeople:true});
assert.deepEqual(e2eOptions([],{HQ:MASTER}),{cut:MASTER,from:'HQ',shared:false,expectPeople:false});
assert.equal(e2eOptions(['--cut','.\\exports\\x'],{}).cut,'exports/x');
assert.equal(e2eOptions(['--shared-state'],{}).shared,true);assert.equal(e2eOptions([],{SHARED_STATE:'1'}).shared,true);assert.equal(e2eOptions([],{SHARED_STATE:'0'}).shared,false);
assert.equal(cutLine(e2eOptions([],{})),`cut: ${DEFAULT_CUT} (default)`);
assert.equal(cutLine(e2eOptions(['--shared-state'],{HQ:MASTER})),`cut: ${MASTER} (HQ) · shared state: the harness's own scratch server`);
// the default cut really casts people at the room desks in oilers (the master does not)
const oilers=c=>JSON.parse(fs.readFileSync(path.join(root,c,'review-cut.json'),'utf8')).shots.find(s=>s.id==='oilers');
assert.ok((oilers(DEFAULT_CUT).people?.cast||[]).some(p=>p.station),'the alternate cut seats people at room desks in oilers');
assert.ok(!oilers(MASTER).people,'the master cut has no cast in oilers');
assert.ok(fs.existsSync(path.join(root,DEFAULT_CUT,'director-chapters.json')),'the default cut has Director chapter pages');
// the people check: PASS / FAIL for a cut that should have people / SKIP only for the master
assert.deepEqual(peopleCheck(2,e2eOptions([],{})),{result:'PASS'});
assert.equal(peopleCheck(0,e2eOptions([],{})).result,'FAIL');assert.match(peopleCheck(0,e2eOptions([],{})).why,/expected to cast people/);
assert.equal(peopleCheck(0,e2eOptions([],{HQ:MASTER})).result,'SKIP');assert.match(peopleCheck(0,e2eOptions([],{HQ:MASTER})).why,/master cut/);
// the harness server: its own port, a scratch state, never :3000 or the committed state; shared starts EMPTY (no copy)
const h=harnessServer({root,port:41001,stateFile:'/tmp/x/studio-state.json',shared:true});
assert.deepEqual(h.args.slice(1),['--port','41001','--host','127.0.0.1','--state','/tmp/x/studio-state.json','--no-watch','--root',root]);
assert.equal(h.copyState,false,'shared: the scratch state starts empty (no drafts of anyone\'s)');
assert.equal(harnessServer({root,port:41001,stateFile:'/tmp/x/s.json',shared:false}).copyState,true,'not shared: as before (a temp copy, the page cut off from it)');
assert.throws(()=>harnessServer({root,port:3000,stateFile:'/tmp/x/s.json',shared:true}),/refusing port 3000/);
assert.throws(()=>harnessServer({root,port:41001,stateFile:path.join(root,'studio-state.json'),shared:true}),/committed/);
// the harness wires it: no interception in shared mode, BASE refused with it
const src=fs.readFileSync(path.join(root,'tests','director-e2e-harness.mjs'),'utf8');
assert.match(src,/if\(shared&&base\)throw Error/);assert.match(src,/if\(!shared\)await cdp\.send\('Fetch\.enable'/);assert.match(src,/plan\.copyState&&fs\.existsSync/);
console.log('Director e2e options: cut choice, people check, harness server rules: pass.');
