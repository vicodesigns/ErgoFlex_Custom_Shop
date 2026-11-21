// Escape in a field never leaves the Director (21 Nov 2026, Windows e2e on rise: Escape in the Inspector's name field
// reached player.mjs, which closed the whole Director; the body lost "directing", the timeline went to 0 px and every later
// step ran on the bare film page). escape-rule.mjs decides; player.mjs follows it.
//   node tests/escape-field-test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {escapeAction,isField} from '../experience/escape-rule.mjs';
const el=(tagName,extra={})=>({nodeType:1,tagName,isContentEditable:false,...extra});
// ---- 1 what counts as a field
for(const [e,want,what] of [
  [el('INPUT',{type:'text'}),true,'a text input (the key name)'],[el('INPUT',{type:''}),true,'an input with no type'],
  [el('INPUT',{type:'number'}),true,'a number input'],[el('INPUT',{type:'range'}),true,'a slider'],[el('INPUT',{type:'checkbox'}),true,'a checkbox'],
  [el('TEXTAREA'),true,'a textarea'],[el('SELECT'),true,'a select'],[el('DIV',{isContentEditable:true}),true,'an editable title'],
  [el('INPUT',{type:'button'}),false,'an input button'],[el('INPUT',{type:'submit'}),false,'a submit'],
  [el('BUTTON'),false,'a button (a camera key)'],[el('BODY'),false,'the page'],[el('DIV'),false,'a lane'],[null,false,'nothing'],[{nodeType:3},false,'a text node'],
])assert.equal(isField(e),want,what);
// ---- 2 the rule
const A=o=>escapeAction(o);
assert.equal(A({directorOpen:true,inField:true}),'blur','in the Inspector\'s name field: only leave the field (before: the Director closed)');
assert.equal(A({directorOpen:true,inField:false}),'close-director','nothing in the Director took it: it closes, as before');
assert.equal(A({directorOpen:true,inField:true,dialog:true}),'none','a dialog closes itself');
assert.equal(A({directorOpen:true,handled:true}),'none','a handler that used the key (deselect, still view, menu) is the end of it');
assert.equal(A({directorOpen:false,inField:true}),'blur','a field on the film page: leave it');
assert.equal(A({app:true}),'close-app','the desk app over the film closes');
assert.equal(A({}),'exit','the film: skip the intro, as before');
// ---- 3 player.mjs follows it, the field case first
const src=readFileSync(new URL('../experience/player.mjs',import.meta.url),'utf8').replace(/\r/g,'');
assert.match(src,/import \{escapeAction,isField\} from '\.\/escape-rule\.mjs\?v=[^']+';/,'player.mjs imports the rule');
const h=/document\.addEventListener\('keydown',e=>\{if\(e\.key==='Escape'\)\{([^]*?)\n  if\(e\.code==='Space'/.exec(src)?.[1]||'';assert.ok(h,'the Escape handler is there');
assert.match(h,/escapeAction\(\{dialog:!!document\.querySelector\('dialog\[open\]'\),handled:e\.defaultPrevented,inField:isField\(e\.target\),directorOpen,app:!!app\}\)/,'it asks the rule with the focus target');
assert.match(h,/if\(act==='blur'\)\{e\.preventDefault\(\);e\.target\.blur\(\);return;\}/,'in a field: blur, and nothing else');
assert.ok(h.indexOf("act==='blur'")<h.indexOf('director.close()'),'before anything can close the Director');
assert.match(h,/if\(act==='close-director'\)\{e\.preventDefault\(\);director\.close\(\);return;\}/,'the Director closes only on the rule\'s word');
assert.doesNotMatch(src,/if\(directorOpen\)\{e\.preventDefault\(\);director\.close\(\);return;\}/,'the old unconditional close is gone');
// the handler played with fake events: the Director stays open from a field, closes from the page
{
  // (the Escape branch's own body, without its closing brace)
  const body=h.replace(/^const act=/,'act=').replace(/\}\s*$/,'');let closed=0,blurred=0,exited=0;
  const run=new Function('e','director','escapeAction','isField','directorOpen','app','exit','stage','document',`let act;${body}`);
  const doc={querySelector:()=>null},ev=target=>({key:'Escape',defaultPrevented:false,target,preventDefault(){this.defaultPrevented=true;}});
  const director={close:()=>closed++},field=el('INPUT',{type:'text',blur:()=>blurred++});
  run(ev(field),director,escapeAction,isField,true,null,()=>exited++,()=>({}),doc);assert.deepEqual([closed,blurred,exited],[0,1,0],'Escape in the name field: blurred, the Director open');
  run(ev(el('BODY')),director,escapeAction,isField,true,null,()=>exited++,()=>({}),doc);assert.deepEqual([closed,blurred,exited],[1,1,0],'Escape on the page: the Director closes (as before)');
}
console.log('escape-field-test: ok (Escape in a field only leaves the field; the Director closes only when nothing in it took the key)');
