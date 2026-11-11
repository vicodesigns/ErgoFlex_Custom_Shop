#!/usr/bin/env node
// Desk versions pass helper (build-round8-director.py run_pass): stdin {subshots:[...], versions:[...], film?:{...}}
// -> stdout {subshots:[...], film:{subshots, presets}}. The same code the Director resolves its live stage with
// (experience/desk-versions-edit.mjs), so the film and the live view cannot drift.
import {cleanDeskVersionList,resolveSubshots,resolveFilm} from '../../experience/desk-versions-edit.mjs';
let text='';for await(const c of process.stdin)text+=c;
const {subshots,versions,film={}}=JSON.parse(text),list=cleanDeskVersionList(versions);
if(!list)throw Error('desk versions: invalid list');
const slots=new Set(subshots.map(s=>s.subshot));
if(list.length!==slots.size||!list.every(v=>slots.has(v.n)))throw Error(`desk versions: slots ${list.map(v=>v.n)} do not match the film's ${[...slots]}`);
const {subshots:map,presets}=resolveFilm(film,list);
process.stdout.write(JSON.stringify({subshots:resolveSubshots(subshots,list),film:{subshots:map,presets}}));
