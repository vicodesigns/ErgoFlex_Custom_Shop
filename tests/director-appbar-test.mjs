// P1b calm shell (17 Nov 2026): the app bar holds each global command once, names the undo step, and every action it
// offers is one director.mjs runs; the classic layout still renders the old rows.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appBarHtml,statusBarHtml} from '../experience/director-appbar.mjs';
const src=readFileSync(new URL('../experience/director.mjs',import.meta.url),'utf8');
const html=appBarHtml({picker:'<div data-film-picker></div>',name:'My cut',undo:{n:2,label:'Moved Maya'},redo:{n:0,label:''},studio:'',playing:false,busy:false,sound:true,lowres:false,film:true,history:['Moved Maya','Added a prop'],titles:true,chapters:false,inspector:true,timeline:true});
const actions=[...html.matchAll(/data-action="([a-z0-9-]+)"/g)].map(m=>m[1]);
for(const id of ['undo','redo','save-export','chapter-toggle','keys-panel'])assert.equal(actions.filter(a=>a===id).length,1,`${id} once`);
assert.match(html,/aria-label="Undo Moved Maya"/,'the tooltip names the step');
assert.match(html,/data-action="redo"[^>]*disabled/,'nothing to redo');
assert.match(html,/data-ab-undo="2"[^>]*>Added a prop/,'history: undo back to a step');
assert.match(html,/final-render/,'a film cut offers the final render');
assert.doesNotMatch(appBarHtml({name:'x',film:false,lowres:null}),/final-render|Low-res/,'not for a client cut; low-res only where offered');
assert.match(html,/aria-checked="false"[^>]*><span>  Chapter strip/,'menu checks show the state');
const handled=a=>new RegExp(`name==='${a}'|case '${a}'`).test(src)||/^(lens|pe|pp|sl)-/.test(a);
for(const a of new Set(actions))assert.ok(handled(a),`director.mjs runs "${a}"`);
for(const p of ['sound','preview-quality','director'])assert.match(html,new RegExp(`data-ab-proxy="${p}"`));
// the status pills: Snap always, the rest only while on
const pills=statusBarHtml('',[{id:'snap',label:'Snap 0.1 s',on:true,always:true},{id:'loop',label:'Loop',on:false},{id:'free',label:'Free view',on:true,warn:true}]);
assert.match(pills,/Snap 0\.1 s/);assert.doesNotMatch(pills,/Loop/);assert.match(pills,/sb-pill on warn" data-sb-pill="free"/);
// classic: the panel keeps its heading and global row; the shell drops them (one Export, one Undo)
assert.match(src,/panel\.innerHTML=\(shellOn\(\)\?'':`\s*<div class="director-heading">/);
assert.match(src,/\$\{shell\?'':`<div class="timeline-toolbar">/,'the timeline\'s project row is classic only');
assert.match(src,/<div class="workbench-toolbar">\$\{shell\?transportHtml:''\}/,'the transport joins the one row');
console.log('director-appbar-test: ok');
