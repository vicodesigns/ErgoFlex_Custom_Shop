// Pure options for the Director e2e tests (no browser, no puppeteer): which cut, whether it is expected to have people,
// and the harness' own scratch server for the opt-in shared-state runs. Tested by tests/director-e2e-options-test.mjs.
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {serverArgs}=require('./studio-layers-desks-e2e.cjs');   // the refusal rules: never port 3000, never the committed state

export const MASTER='exports/cinematic-intro-20261104-hq14';             // the master cut: oilers has no people of its own
export const DEFAULT_CUT='exports/cinematic-intro-20261110-alt';         // casts the room's people at their stations in oilers
// argv: --cut <dir> | --shared-state; env: HQ, SHARED_STATE=1. -> {cut, from, shared, expectPeople}
export function e2eOptions(argv=[],env={}){
  const at=argv.indexOf('--cut'),arg=at>=0?argv[at+1]:null;
  const cut=String(arg||env.HQ||DEFAULT_CUT).replace(/\\/g,'/').replace(/\/+$/,'').replace(/^\.\//,'');
  const from=arg?'--cut':env.HQ?'HQ':'default';
  const shared=argv.includes('--shared-state')||env.SHARED_STATE==='1';
  return {cut,from,shared,expectPeople:cut!==MASTER};
}
export const cutLine=o=>`cut: ${o.cut} (${o.from})${o.shared?' · shared state: the harness\'s own scratch server':''}`;
// The check "a room desk has a person at it": PASS, FAIL, or SKIP (only for the master cut, which has no cast).
export function peopleCheck(withUser,o){
  if(withUser>0)return {result:'PASS'};
  return o.expectPeople?{result:'FAIL',why:`${o.cut} is expected to cast people at the room desks in oilers, and none sits at one`}:{result:'SKIP',why:`${o.cut} is the master cut: oilers has no people of its own`};
}
// The harness' server: its own port and a scratch state file (refused: port 3000, the committed studio-state.json).
// shared: the scratch state starts EMPTY (no drafts, no Studio edits of anyone's): copyState false.
export function harnessServer({root,port,stateFile,shared}){
  const args=[...serverArgs({repo:root,port,stateFile}),'--root',root];
  return {args,copyState:!shared};
}
export {serverArgs};
export const repoPath=(root,p)=>path.resolve(root,p);
