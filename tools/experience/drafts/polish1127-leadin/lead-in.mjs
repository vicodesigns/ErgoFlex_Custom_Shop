#!/usr/bin/env node
// Helper for apply-leadin.py: the desk-version list for a lead-in. stdin {versions, by, total, look} -> stdout the new list:
// every desk slid right by `by` seconds (a group move, experience/desk-versions-edit.mjs shiftVersions) and a desk of `look` added
// in front of the first one (addVersionAtStart), id = the next free letter.
import {cleanDeskVersionList,shiftVersions,addVersionAtStart,nextVersionId} from '../../../../experience/desk-versions-edit.mjs';
let text='';for await(const c of process.stdin)text+=c;
const {versions,by,total,look,used=[]}=JSON.parse(text),list=cleanDeskVersionList(versions);
if(!list)throw Error('lead-in: invalid desk version list');
const moved=shiftVersions(list,new Set(list.map(v=>v.n)),by,total);
const id=nextVersionId([...list.map(v=>v.n),...used]);
const out=addVersionAtStart(moved,0,id,total,{look});
if(!out)throw Error('lead-in: the new desk did not fit');
process.stdout.write(JSON.stringify(out));
