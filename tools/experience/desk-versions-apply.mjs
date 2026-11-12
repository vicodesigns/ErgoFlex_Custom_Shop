#!/usr/bin/env node
// Desk versions pass helper (build-round8-director.py run_pass): stdin {subshots:[...], versions:[...], library?:[...], film?:{...}}
// -> stdout {subshots:[...], film:{subshots, presets}, library:[...]}. The same code the Director resolves its live stage with
// (experience/desk-versions-edit.mjs), so the film and the live view cannot drift.
// The list is the whole chapter: one sub-shot per version, in time order (1 to 12; ids the film does not have yet are
// versions added in the Director: copies of their model's sub-shot). library: the bundles of film sub-shots whose model
// the list no longer shows, kept so a later list gets the film's dressing for that model back.
import {cleanDeskVersionList,resolveSubshots,resolveFilm,libraryEntry} from '../../experience/desk-versions-edit.mjs';
let text='';for await(const c of process.stdin)text+=c;
const {subshots,versions,film={},library=[]}=JSON.parse(text),list=cleanDeskVersionList(versions);
if(!list)throw Error('desk versions: invalid list');
if(!Array.isArray(subshots)||!subshots.some(s=>s&&typeof s.subshot==='string'))throw Error('desk versions: the film has no sub-shots to resolve them from');
const out=resolveSubshots(subshots,list,library);
if(out.length!==list.length)throw Error(`desk versions: ${list.length} versions resolved to ${out.length} sub-shots`);
const shown=new Set(out.map(s=>s.preset)),dropped=subshots.filter((s,i)=>s&&typeof s.subshot==='string'&&!shown.has(s.preset)&&subshots.findIndex(x=>x?.preset===s.preset)===i);
const {subshots:map,presets}=resolveFilm(film,list);
process.stdout.write(JSON.stringify({subshots:out,film:{subshots:map,presets},library:[...(Array.isArray(library)?library:[]).filter(e=>!dropped.some(d=>d.preset===e?.preset)),...dropped.map(libraryEntry)]}));
