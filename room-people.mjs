// People who live and work in the rooms (Studio "People" toggle, film `people`).
//
// The models are posed, static library props (category "people", built by
// tools/people/build.py). This module decides who is in which room and keeps
// the person at the featured desk honest: a seated typist is only there while
// the desk is at sitting height, a standing one while it is raised, and both
// follow the desk when it glides. Poses are built for measured furniture
// (tools/people/cast.py), so every desk user brings the task chair the pose was
// built on, and the room's own chair at that spot steps aside.
//
// Placements, in room millimetres:
//   { id, desk: 'sit' | 'stand' | 'wheel' }           at the featured desk, while its height suits the model
//                                                     (the model's library entry carries person.deskHeight, inches)
//   { id, station: '<id>', desk: ... }                at one of the room's other ErgoFlex desks (layout.stations)
//   { id, beside: [dx, dz] }                          near the featured desk (its own frame), facing it
//   { id, on: '<prop id>' | ['<prop id>', n] }        seated on that piece of furniture, facing the way it faces
//                                                     (`turn` degrees to correct a model; `along` / `depth` mm to slide)
//   { id, near: [x, z], face: [x, z] }                seated on the chair nearest that spot, facing a point (a table)
//   { id, by: '<prop id>', reach }                    standing in front of that furniture, facing it
//   { id, at: [x, z], turn }                          standing at a spot
//   seat: mm                                          the seat height the pose was built for; the person is raised or
//                                                     lowered (a little) onto the real seat
//   layout: '<layout id>'                             only in that room layout;  modes: [...] only in those dayparts
// Not scene assets: the Studio's Rearrange mode and saved room edits leave them
// alone. The film moves or hides them by name ('Person:<id>') or adds its own
// through sceneEdits `add`.
import * as THREE from 'three';

// How far in front of a desk's anchor the person's pelvis is (mm): keyboard edge to wrists to pelvis.
const REACH = { sit: 945, wheel: 935, stand: 890 };
const HEIGHT_FIT = 1.4;                       // inches either side of the height a desk pose was built for
const TASK_CHAIR = 'steelcase-leap-v2';       // seat 435 mm: what the seated desk poses were built on
const CHAIRS = /chair|stool/i;

export const ROOM_PEOPLE = {
    home: [
        { id: 'people-maya-sit-type', desk: 'sit' }, { id: 'people-maya-stand-type', desk: 'stand' },
        { id: 'people-grace-sit-read', on: 'armchair-poppi', seat: 420 }
    ],
    gaming: [
        { id: 'people-sam-sit-game', desk: 'sit' }, { id: 'people-sam-stand-type', desk: 'stand' },
        { id: 'people-kai-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: -330, depth: -60 }
    ],
    music: [
        { id: 'people-andre-sit-type', desk: 'sit' }, { id: 'people-andre-stand-type', desk: 'stand' }
    ],
    creative: [
        { id: 'people-lin-stand-paint', by: 'artist-easel', reach: 640 },
        { id: 'people-maya-stand-type', desk: 'stand' }, { id: 'people-maya-sit-type', desk: 'sit' },
        { id: 'people-grace-sit-read', on: 'kenney-furniture-lounge-sofa', seat: 420, along: 380 }
    ],
    gym: [
        { id: 'people-priya-stretch', by: 'training-zone', reach: 0, turn: 180 },
        { id: 'people-maya-stand-type', desk: 'stand' }, { id: 'people-maya-sit-type', desk: 'sit' }
    ],
    workshop: [
        { id: 'people-jo-stand-work', at: [560, -790], turn: 180 },
        { id: 'people-andre-stand-phone', beside: [1050, 520] }
    ],
    highschool: [
        { id: 'people-maya-stand-type', desk: 'stand' }, { id: 'people-maya-sit-type', desk: 'sit' },
        { id: 'people-kai-wheel-type', station: 'accessible-student', desk: 'wheel' },
        { id: 'people-zoe-stand-type', station: 'student-standing', desk: 'stand' },
        { id: 'people-mia-sit-type', station: 'window-research', desk: 'sit' },
        { id: 'people-noah-sit-type', station: 'research-desk', desk: 'sit' },
        { id: 'people-leo-sit-raise', on: 'student-chair-0-1-0', seat: 450, turn: 180 },
        { id: 'people-ava-sit-write', on: 'student-chair-0-0-1', seat: 450, turn: 180 },
        { id: 'people-eli-sit-listen', on: 'student-chair-0-2-0', seat: 450, turn: 180 },
        { id: 'people-sofia-sit-laptop', on: 'student-chair-1-1-1', seat: 450, turn: 180 },
        { id: 'people-hale-stand-present', layout: 'house', at: [2600, -3250], turn: 0 }
    ],
    occmedialab: [
        { id: 'people-maya-sit-type', desk: 'sit' }, { id: 'people-maya-stand-type', desk: 'stand' },
        { id: 'people-andre-sit-type', station: 'sound-mix-02', desk: 'sit' },
        { id: 'people-lin-sit-type', station: 'digital-art-03', desk: 'sit' },
        { id: 'people-omar-wheel-type-28', station: 'accessible-edit-04', desk: 'wheel' },
        { id: 'people-noah-sit-laptop', on: ['ergoflex-designer-chair', 0], seat: 450 },
        { id: 'people-sofia-sit-laptop', on: ['ergoflex-designer-chair', 3], seat: 450 },
        { id: 'people-zoe-walk', layout: 'house', at: [1900, 4300], turn: -90 }
    ],
    library: [
        { id: 'people-rosa-stand-type-low', layout: 'humboldt', desk: 'stand', reach: 830 },
        { id: 'people-andre-stand-type', layout: 'humboldt', desk: 'stand' },
        { id: 'people-lin-sit-phone', layout: 'humboldt', on: 'electric-wheelchair', seat: 420 },
        { id: 'people-leo-sit-write', layout: 'humboldt', near: [-800, -5970], face: [-800, -5200], seat: 450 },
        { id: 'people-zoe-sit-laptop', layout: 'humboldt', near: [-814, -4428], face: [-814, -5200], seat: 450 },
        { id: 'people-eli-sit-listen', layout: 'humboldt', near: [550, 2945], face: [550, 3700], seat: 450 },
        { id: 'people-zoe-walk', layout: 'humboldt', at: [2500, 1500], turn: 90 },
        { id: 'people-ben-white-cane', layout: 'humboldt', at: [-2800, 2600], turn: 180 },
        { id: 'people-grace-cane-stand', layout: 'humboldt', at: [3600, 5500], turn: 200 }
    ]
};

const down = new THREE.Vector3(0, -1, 0);
const frontOf = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

export class RoomPeople {
    constructor(room, library) {
        this.room = room; this.library = library; this.enabled = false; this.built = null; this.people = []; this.hidden = new Map(); this.filter = null;
        this.ray = new THREE.Raycaster();
    }
    specs() { const layout = this.room.roomLayout?.id; return (ROOM_PEOPLE[this.room.id] || []).filter(s => !s.layout || s.layout === layout); }
    // filter: { only: [ids], except: [ids] } narrows who is shown (the film leaves out people whose pose a chapter's
    // desk moves would break).
    setFilter(filter) { this.filter = filter || null; }
    allowed(id) { const f = this.filter; return !f || ((!f.only || f.only.includes(id)) && !(f.except || []).includes(id)); }
    get available() { return this.specs().length > 0; }
    // Loading is deferred to the first time the toggle is on: nobody pays for models they never see.
    async setEnabled(on) {
        this.enabled = !!on;
        if (this.enabled && !this.built) this.built = this.build();
        await this.built;
        if (!this.enabled) { for (const object of this.people) this.show(object, false); this.restoreChairs(); }
        else this.update(this.room.peopleState?.());
    }
    async build() {
        const room = this.room, token = room.token, root = room.root, specs = this.specs();
        await room.ready; await this.library.loadIndex();
        const load = async id => { try { return await this.library.instance(id); } catch (error) { console.warn('[people] ' + id + ' did not load:', error?.message || error); return null; } };
        const loaded = await Promise.all(specs.map(async spec => ({ spec, object: await load(spec.id), chair: spec.desk === 'sit' ? await load(TASK_CHAIR) : null })));
        if (token !== room.token || root !== room.root) return;
        for (const { spec, object, chair } of loaded) {
            if (!object) continue;
            object.name = 'Person:' + spec.id; object.userData.person = spec; object.userData.personFit = this.library.entry(spec.id)?.person?.deskHeight ?? null; object.visible = false;
            if (chair) { chair.name = 'Person chair:' + spec.id; chair.visible = false; root.add(chair); object.userData.personChair = chair; }
            root.add(object); this.people.push(object);
            if (spec.station) this.atStation(object, spec);
            else if (!spec.desk && !spec.beside) this.settle(object, spec);
        }
    }
    props(id) { return this.room.assets().filter(o => o.userData.propId === id || o.userData.decorUpgrade === id); }
    centreOf(object) { return this.room.root.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())); }
    // At one of the room's other desks: fixed, if that desk's height suits the model.
    atStation(object, spec) {
        const station = this.room.roomLayout?.stations?.find(s => s.id === spec.station), fit = object.userData.personFit;
        if (!station || (fit !== null && Math.abs((station.height ?? 28) - fit) > HEIGHT_FIT)) { object.userData.personMissing = true; return; }
        const yaw = THREE.MathUtils.degToRad(station.turn || 0);
        object.position.set(station.at[0], 0, station.at[1]).addScaledVector(frontOf(yaw), spec.reach ?? REACH[spec.desk]); object.rotation.y = yaw + Math.PI;
    }
    // A fixed placement: on a seat, by a piece of furniture, or at a spot.
    settle(object, spec) {
        let anchor = null;
        if (spec.on || spec.by) { const [id, n] = [].concat(spec.on || spec.by); anchor = this.props(id)[n || 0] || null; }
        else if (spec.near) {
            const spot = new THREE.Vector3(spec.near[0], 0, spec.near[1]);
            anchor = this.room.assets().filter(o => CHAIRS.test((o.userData.propId || '') + ' ' + (o.userData.decorUpgrade || ''))).map(o => ({ o, d: this.centreOf(o).setY(0).distanceTo(spot) })).filter(c => c.d < 450).sort((a, b) => a.d - b.d)[0]?.o || null;
        }
        if ((spec.on || spec.by || spec.near) && !anchor) { object.userData.personMissing = true; return; }
        const turn = THREE.MathUtils.degToRad(spec.turn || 0);
        if (spec.on || spec.near) {
            const centre = this.centreOf(anchor); let yaw = anchor.rotation.y + turn;
            if (spec.face) yaw = Math.atan2(spec.face[0] - centre.x, spec.face[1] - centre.z);
            const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            object.position.copy(centre).addScaledVector(side, spec.along || 0).addScaledVector(frontOf(yaw), spec.depth ?? 60); object.position.y = 0; object.rotation.y = yaw;
        } else if (spec.by) {
            const yaw = anchor.rotation.y; object.position.copy(anchor.position).addScaledVector(frontOf(yaw), spec.reach ?? 600); object.position.y = 0;
            object.rotation.y = yaw + Math.PI + turn - Math.PI * (spec.turn ? 1 : 0);
        } else { object.position.set(spec.at[0], 0, spec.at[1]); object.rotation.y = turn; }
        if (spec.seat) object.position.y = this.seatLift(object, spec, anchor);
    }
    // How far the person moves up or down so the pose's seat height meets the real seat under the pelvis.
    seatLift(object, spec, anchor) {
        const root = this.room.root; root.updateWorldMatrix(true, true);
        this.ray.set(root.localToWorld(new THREE.Vector3(object.position.x, 1500, object.position.z)), down.clone().transformDirection(root.matrixWorld));
        const hit = this.ray.intersectObject(anchor, true).map(h => root.worldToLocal(h.point.clone()).y).find(y => y > 250 && y < 700);
        return hit === undefined ? 0 : THREE.MathUtils.clamp(hit - spec.seat, -40, 70);
    }
    show(object, on) {
        object.visible = on;
        const chair = object.userData.personChair;
        if (chair) { chair.visible = on; if (on) { chair.position.set(object.position.x, 0, object.position.z); chair.rotation.y = object.rotation.y - Math.PI; } }
    }
    // state: { height (inches), mode, pose: { x, z, yaw } } of the featured desk; called every frame while enabled.
    update(state) {
        if (!this.enabled || !this.people.length) return;
        const height = state?.height ?? 28, pose = state?.pose, mode = state?.mode; let working = false;
        for (const object of this.people) {
            const spec = object.userData.person, fit = object.userData.personFit;
            let on = !object.userData.personMissing && this.allowed(spec.id) && (!spec.modes || spec.modes.includes(mode));
            if (spec.desk && !spec.station) {
                on = on && !!pose && !working && (fit === null || Math.abs(height - fit) <= HEIGHT_FIT);
                if (on) { const yaw = pose.yaw || 0; object.position.set(pose.x - 6, 0, pose.z).addScaledVector(frontOf(yaw), spec.reach ?? REACH[spec.desk]); object.rotation.y = yaw + Math.PI; working = true; }
            } else if (spec.beside && pose) {
                const yaw = pose.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), [dx, dz] = spec.beside;
                object.position.set(pose.x + dx * c + dz * s, 0, pose.z - dx * s + dz * c);
                object.rotation.y = Math.atan2(pose.x - object.position.x, pose.z + 350 - object.position.z);   // toward the desk's working edge
            } else if (spec.beside) on = false;
            this.show(object, on);
        }
        this.clearChairs();
    }
    // The room's own chairs make way wherever someone is working at a desk (they brought the chair the pose fits,
    // stand where the chair was, or roll in on their own wheels).
    clearChairs() {
        const spots = this.people.filter(o => o.visible && o.userData.person.desk).map(o => o.position);
        for (const chair of this.room.assets()) {
            if (!CHAIRS.test((chair.userData.propId || '') + ' ' + (chair.userData.decorUpgrade || '')) || /student-chair|bar|artist/.test(chair.userData.propId || '')) continue;
            const centre = this.centreOf(chair).setY(0), blocked = spots.some(p => Math.hypot(p.x - centre.x, p.z - centre.z) < 850);
            if (blocked && !this.hidden.has(chair)) { this.hidden.set(chair, chair.visible); chair.visible = false; }
            else if (!blocked && this.hidden.has(chair)) { chair.visible = this.hidden.get(chair); this.hidden.delete(chair); }
        }
    }
    restoreChairs() { for (const [chair, visible] of this.hidden) chair.visible = visible; this.hidden.clear(); }
    dispose() {
        this.restoreChairs();
        for (const object of this.people) { object.userData.personChair?.removeFromParent(); object.removeFromParent(); }
        this.people = []; this.built = null;
    }
}
