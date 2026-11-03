import assert from 'node:assert/strict';
import fs from 'node:fs';
import { repairLibraryArtwork, LIBRARY_ARTWORK_REPAIR } from '../library-artwork-link.mjs';
import { applyLibraryProductBuild } from '../library-product-build.mjs';
import { cleanBuildPresets } from '../build-presets.mjs';
import { cleanSceneDeskData } from '../scene-desk-data.mjs';
const recovery = JSON.parse(fs.readFileSync(new URL('../assets/artwork/saved-college-graphics-20261014.json', import.meta.url))).entries.library;
for (const size of ['48x30','60x30']) {
    const entry = cleanBuildPresets(null).entries.library;
    const state = {size, objects:{}, pose:{x:8240,z:-1850,yaw:-Math.PI/2}, height:33, tilt:24.1, phases:{}, style:{trimColor:'#123456'}, artwork:{version:1,surfaces:{}}, productBuild:{id:'library',size,revision:0}};
    assert.equal(applyLibraryProductBuild(state,entry),false);
    assert.equal(repairLibraryArtwork(state,entry,recovery),true,'repair despite unchanged Product revision');
    assert.deepEqual(state.artwork,recovery[size].artwork);
    assert.equal(state.style.trimColor,'#123456'); assert.equal(state.tilt,24.1);
    const restored=cleanSceneDeskData({rooms:{'library/humboldt':{desks:{main:state}}}}).rooms['library/humboldt'].desks.main;
    assert.equal(restored.productBuild.artworkRepair,LIBRARY_ARTWORK_REPAIR);
    restored.artwork={version:1,surfaces:{}};
    assert.equal(repairLibraryArtwork(restored,entry,recovery),false,'later deliberate deletion survives reload');
    const custom=structuredClone(recovery[size].artwork);custom.surfaces.desktop.logo.x=23;
    const draft=entry.config.size===size?entry:entry.sizeSetups[size];draft.config.artwork=custom;
    const fresh={size,objects:{}};applyLibraryProductBuild(fresh,entry);
    assert.deepEqual(fresh.artwork,custom,'matching-width Product artwork takes priority');
    const edited={size,artwork:custom,productBuild:{id:'library',size,revision:0}};
    assert.equal(repairLibraryArtwork(edited,entry,recovery),false);assert.deepEqual(edited.artwork,custom);
}
console.log('PASS Library artwork repair: both widths, same-revision empty link, saved recovery, exact Product placements, room edits, and later deliberate deletions.');
