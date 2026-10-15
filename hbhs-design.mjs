export const HBHS_ORANGE = '#e8702a';
export const HBHS_CLASSROOM_VERSION = 'hbhs-mixed-classroom-v1';
export function hbhsPalette(tone = 'black') {
    return { woodFinish: tone === 'white' ? 'White Birch' : 'Black Birch',
        baseFinish: tone === 'white' ? 'White' : 'Black', trimColor: HBHS_ORANGE, sheen: 'satin' };
}
export function highschoolDeskTone(id) {
    return /demonstration-desk|accessible-student|project-review/.test(id) ? 'white' : 'black';
}
export function upgradeHighschoolDesk(state, id, name) {
    if (state.classroomDesign === HBHS_CLASSROOM_VERSION) return false;
    state.style = hbhsPalette(highschoolDeskTone(id));
    // Only original role labels change; user-named desks retain their names.
    if (name && /^(Main desk|Physics demonstration desk|Student standing desk|Research nook desk|Poster and project review desk|Research and data desk)$/.test(state.name || '')) state.name = name;
    state.classroomDesign = HBHS_CLASSROOM_VERSION;
    return true;
}

const defaultName = name => / role detail$/.test(name || '') ? 'role detail' : String(name || '').trim().toLowerCase();
// The classroom's new frame, easel and drawing tablet shifted old mount indices.
// Reuse a saved default only when it describes the same object, not merely the
// same array slot. In particular, a 1:1 procedural group's scale cannot be
// applied to a GLB that requires a 1000:1 metres-to-mm scale.
export function matchingHighschoolDefault(defaults, claimed, id, role, name) {
    const matches = ([key, value]) => key.startsWith('default-' + role + '-') && !claimed.has(key)
        && defaultName(value.label) === defaultName(name);
    const direct = defaults[id] && [id, defaults[id]];
    const found = direct && matches(direct) ? direct : Object.entries(defaults).find(matches);
    if (!found) return null;
    claimed.add(found[0]);
    return { ...structuredClone(found[1]), label: name };
}

export function migrateHighschoolFixtureTransform(obj, saved, layout) {
    if (!saved || !layout) return saved;
    const id=obj.userData.sceneAssetKey?.match(/:fixture:([^:]+)$/)?.[1] || obj.userData.propId;
    const table=id?.match(/^student-table-([0-2])-([01])$/);
    const old=table ? [Number(table[2]) ? 1700 : -150,0,-1700+Number(table[1])*1450] : {
        'research-gallery':[-2700,1660,layout.back+55],
        'acoustic-panels':[layout.width/2-45,1850,-1120],
        'resource-shelf':[-300,0,layout.back+340],
        'room-sign':[0,2520,layout.back+50]
    }[id];
    if(!old || !['x','y','z'].every((a,i)=>Math.abs(saved.p[a]-old[i])<.01 && Math.abs(saved.s[a]-1)<.00001))return saved;
    // Automatically captured original placements follow the upgraded room.
    // A deliberately moved, rotated or scaled fixture retains the owner's edit.
    if(!['x','y','z','w'].every(a=>Math.abs(saved.q[a]-obj.quaternion[a])<.00001))return saved;
    return {p:{x:obj.position.x,y:obj.position.y,z:obj.position.z},
        q:{x:obj.quaternion.x,y:obj.quaternion.y,z:obj.quaternion.z,w:obj.quaternion.w},s:{x:obj.scale.x,y:obj.scale.y,z:obj.scale.z}};
}
