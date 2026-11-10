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
//   { id, at: [x, z], turn, y }                       at a spot (y mm lifts a seated pose onto a seat that is not a prop)
//   scale: n                                          a factor on the model's size (any placement; 1 = as built)
//   colors: { top, bottom, shoes, hair: '#rrggbb' }   recolours those parts of the model (the fabric's shading is kept)
//   seat: mm                                          the seat height the pose was built for; the person is raised or
//                                                     lowered (a little) onto the real seat
//   layout: '<layout id>'                             only in that room layout;  modes: [...] only in those dayparts
//   key: '<name>'                                     a name for this placement when one model is used twice
// Not scene assets: the Studio's Rearrange mode and saved room edits leave them
// alone. The film casts each chapter through a filter (setFilter): who is in, who is moved, extra people of its
// own, and the seconds of the chapter each one is there for.
import * as THREE from 'three';

// How far in front of a desk's anchor the person's pelvis is (mm), for a keyboard on the pull-out tray, and how far
// behind the keyboard's centre it is wherever the keyboard really sits (tray or desktop).
const REACH = { sit: 945, wheel: 935, stand: 890 };
const BEHIND_KEYS = { sit: 470, wheel: 460, stand: 415 };
const HEIGHT_FIT = 1.4;                       // inches either side of the height a desk pose was built for
const HEIGHT_SOLID = .45;                     // within this the person is fully there; beyond it they fade out to HEIGHT_FIT
const TASK_CHAIR = 'steelcase-leap-v2';       // seat 435 mm: what the seated desk poses were built on
const CHAIRS = /chair|stool|steelcase-leap|aeron/i;
// Which part of a person a material is (MakeHuman names: 'Human.<asset>'); null = skin, eyes, teeth, things held.
const NOT_WORN = /^(body|low-poly|teeth|tongue|eyebrow|eyelashes|eyes)/i, PARTS = { glasses: /glasses/i, shoes: /shoe|flats|boot|sneaker/i, bottom: /pants|skirt|jeans|shorts|trousers/i, hair: /hair|ponytail|afro|bob|braid|bun|^short\d|^long\d|mohawk|pigtail/i };
export const partOf = name => { if (!/^Human\./.test(name || '')) return null; const n = name.slice(6); if (NOT_WORN.test(n)) return null; for (const [part, re] of Object.entries(PARTS)) if (re.test(n)) return part; return 'top'; };
const lumCache = new WeakMap();
// The average brightness of a garment's texture (linear), so a new colour keeps the weave and the folds at their contrast.
function textureLuminance(map) {
    const image = map?.image; if (!image || typeof document === 'undefined') return .2;
    if (lumCache.has(image)) return lumCache.get(image);
    let value = .2;
    try {
        const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data, lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const l = .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); if (l > .004 && l < .97) { sum += l; n++; } }
        if (n > 20) value = sum / n;
    } catch { /* a texture the canvas cannot read keeps the default */ }
    lumCache.set(image, value); return value;
}

export const ROOM_PEOPLE = {
    home: [
        { id: 'people-maya-sit-type', desk: 'sit' }, { id: 'people-maya-sit-type-30', desk: 'sit' }, { id: 'people-maya-stand-type', desk: 'stand' },
        { id: 'people-grace-sit-read', on: 'armchair-poppi', seat: 420 }
    ],
    gaming: [
        { id: 'people-sam-sit-game', desk: 'sit' }, { id: 'people-sam-sit-game-30', desk: 'sit' }, { id: 'people-sam-stand-type', desk: 'stand' },
        { id: 'people-kai-sit-controller', on: 'kenney-furniture-lounge-sofa', seat: 420, along: -330, depth: -60 }
    ],
    music: [
        { id: 'people-andre-sit-type', desk: 'sit' }, { id: 'people-andre-sit-type-30', desk: 'sit' }, { id: 'people-andre-stand-type', desk: 'stand' }
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
        { id: 'people-maya-sit-type', desk: 'sit' }, { id: 'people-maya-sit-type-30', desk: 'sit' }, { id: 'people-maya-stand-type', desk: 'stand' },
        { id: 'people-andre-sit-type', station: 'sound-mix-02', desk: 'sit' },
        { id: 'people-lin-sit-type', station: 'digital-art-03', desk: 'sit' },
        { id: 'people-omar-wheel-type-28', station: 'accessible-edit-04', desk: 'wheel' },
        { id: 'people-noah-sit-laptop', on: ['ergoflex-designer-chair', 0], seat: 450 },
        { id: 'people-sofia-sit-laptop', on: ['ergoflex-designer-chair', 3], seat: 450 },
        { id: 'people-zoe-walk', layout: 'house', at: [1900, 4300], turn: -90 }
    ],
    library: [
        { id: 'people-rosa-stand-type-low', layout: 'humboldt', desk: 'stand', reach: 830 },
        { id: 'people-rosa-stand-type-30', layout: 'humboldt', desk: 'stand', reach: 830 },
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

// Rooms without a cast of their own still get someone at the featured desk, seated or standing with its height.
// Children's rooms are left out: these are adults and teenagers, and those desks are set for children.
const DESK_CREW = {
    maya: ['people-maya-sit-type', 'people-maya-sit-type-30', 'people-maya-stand-type'],
    andre: ['people-andre-sit-type', 'people-andre-sit-type-30', 'people-andre-stand-type'],
    lin: ['people-lin-sit-type', 'people-lin-sit-type-30', 'people-lin-stand-type'],
    noah: ['people-noah-sit-type', 'people-noah-sit-type-30', 'people-noah-stand-type'],
    mia: ['people-mia-sit-type', 'people-mia-sit-type-30', 'people-mia-stand-type']
};
const crew = who => DESK_CREW[who].map(id => ({ id, desk: /stand/.test(id) ? 'stand' : 'sit' }));
const DEFAULT_CREW = {
    office: 'andre', coworking: 'lin', bedroom: 'mia', lounge: 'noah', kitchen: 'maya', study: 'noah', gallery: 'lin', library: 'mia', scifi: 'andre',
    middleschool: 'mia', college: 'noah', university: 'lin', hospital: 'lin', laboratory: 'andre', mobileit: 'noah', government: 'andre', police: 'maya', security: 'andre'
};
const castFor = (id, layout) => { const own = (ROOM_PEOPLE[id] || []).filter(s => !s.layout || s.layout === layout); return own.length ? own : DEFAULT_CREW[id] ? crew(DEFAULT_CREW[id]) : []; };

const down = new THREE.Vector3(0, -1, 0);
const frontOf = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

export class RoomPeople {
    constructor(room, library) {
        this.room = room; this.library = library; this.enabled = false; this.built = null; this.people = []; this.hidden = new Map(); this.filter = null;
        this.ray = new THREE.Raycaster();
    }
    specs() { return [...castFor(this.room.id, this.room.roomLayout?.id), ...(this.filter?.cast || []).map(spec => ({ ...spec, extra: true }))]; }
    // filter, for one use of the room (a film chapter):
    //   only: [keys], except: [keys]          who of the room's cast is shown (a key is a placement's `key`, or its id)
    //   place: { '<key>': { at: [x, z], turn, y } }   moves someone (clear of a camera path, onto a prop the film moved)
    //   cast: [placements]                    extra people, placed like the room's own (always shown)
    //   when: { '<key>': [[t0, t1], ...] }    the seconds (state.time) that person is there; fades over `fade` seconds
    //                                         (default .5; 0 cuts). Without a time (the Studio) everyone is simply there.
    //   chair: { back, side, turn }           the featured desk's task chair stays in the room when its user is not
    //                                         seated: pushed back and aside (mm, the desk's frame) and turned (degrees)
    // Only a change of who is in the cast (model, key, desk role) rebuilds; moving, turning, scaling or re-timing an
    // extra person re-places the model that is already there (the Director edits these live).
    setFilter(filter) {
        const cast = JSON.stringify((filter?.cast || []).map(c => [c.key || c.id, c.id, c.desk || '', c.station || ''])) + JSON.stringify(Object.keys(filter?.when || {}));
        if (this.built && cast !== this.castKey) this.dispose();
        this.castKey = cast; this.filter = filter || null; this.placed = false;
    }
    // The size a placement asks for, on top of the size the model was loaded at.
    resize(object, spec) {
        const base = object.userData.personBase ||= object.scale.clone(), k = Number.isFinite(spec.scale) && spec.scale > 0 ? spec.scale : 1;
        object.scale.copy(base).multiplyScalar(k); object.userData.personChair?.scale.copy(object.userData.personChairBase ||= object.userData.personChair.scale.clone()).multiplyScalar(k);
    }
    // spec.colors: each named part takes the new colour, shaded by the brightness of its own texture.
    recolor(object, spec) {
        const colors = spec.colors || null; if (!colors && !object.userData.personTinted) return;
        if (!object.userData.personMaterials) this.ownMaterials(object);
        object.userData.personTinted = !!colors;
        for (const m of object.userData.personMaterials) {
            const hex = colors?.[partOf(m.name)];
            if (!m.userData.tint) {
                if (!hex) continue;
                const tint = m.userData.tint = { color: { value: new THREE.Vector4(1, 1, 1, .2) }, on: { value: 0 } };
                m.onBeforeCompile = shader => {
                    shader.uniforms.personTint = tint.color; shader.uniforms.personTintOn = tint.on;
                    shader.fragmentShader = 'uniform vec4 personTint;\nuniform float personTintOn;\n' + shader.fragmentShader.replace('#include <map_fragment>',
                        '#include <map_fragment>\n\tif (personTintOn > .5) { float pl = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)); diffuseColor.rgb = personTint.rgb * clamp(pl / max(personTint.a, .01), 0., 2.4); }');
                };
                m.customProgramCacheKey = () => 'person-tint'; m.needsUpdate = true;
            }
            const tint = m.userData.tint; tint.on.value = hex ? 1 : 0;
            if (hex) { const c = new THREE.Color(hex); tint.color.value.set(c.r, c.g, c.b, textureLuminance(m.map)); }
        }
    }
    // The person shown under that key (a film's own entry wins over a room person of the same name it has replaced).
    byKey(key) { const all = this.people.filter(o => this.keyOf(o.userData.person) === key); return all.find(o => this.allowed(o.userData.person)) || all[0] || null; }
    // Who is in the room now (for the Director's People tab), room millimetres and degrees.
    list() {
        return this.people.map(o => { const s = o.userData.person; return { key: this.keyOf(s), id: s.id, extra: !!s.extra, desk: s.desk || null, station: s.station || null,
            at: [Math.round(o.position.x), Math.round(o.position.z)], y: Math.round(o.position.y), turn: Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10, scale: s.scale || 1,
            allowed: this.allowed(s), missing: !!o.userData.personMissing, visible: o.visible, amount: o.userData.personAmount ?? 1 }; });
    }
    // The cast as plain placements a film can keep: desk and station people as they are (they follow their desk),
    // everyone else at the spot and facing they have settled into (`on`, `by`, `near` resolved).
    resolved() {
        return this.people.filter(o => this.allowed(o.userData.person) && !o.userData.personMissing).map(o => {
            const s = o.userData.person, out = { key: this.keyOf(s), id: s.id };
            if (s.desk) { out.desk = s.desk; if (s.station) out.station = s.station; if (s.reach !== undefined) out.reach = s.reach; }
            else if (s.beside && !s.at) out.beside = s.beside;
            else { out.at = [Math.round(o.position.x), Math.round(o.position.z)]; out.turn = Math.round(THREE.MathUtils.radToDeg(o.rotation.y) * 10) / 10; if (Math.abs(o.position.y) > .5) out.y = Math.round(o.position.y); }
            if (s.scale && s.scale !== 1) out.scale = s.scale;
            if (s.colors) out.colors = { ...s.colors };
            return out;
        });
    }
    keyOf(spec) { return spec.key || spec.id; }
    allowed(spec) { const f = this.filter, k = this.keyOf(spec), has = list => list.includes(k) || list.includes(spec.id); return !f || spec.extra || ((!f.only || has(f.only)) && !has(f.except || [])); }
    // 0..1: how much of the person is there at this second of the film.
    present(spec, time) {
        const spans = this.filter?.when?.[this.keyOf(spec)]; if (!spans || !Number.isFinite(time)) return 1;
        const fade = this.filter.fade ?? .5; let amount = 0;
        for (const [t0, t1, fin = fade, fout = fade] of spans) {
            if (time < t0 || time > t1) continue;
            amount = Math.max(amount, Math.min(fin > 0 && t0 > 0 ? (time - t0) / fin : 1, fout > 0 ? (t1 - time) / fout : 1, 1));
        }
        return THREE.MathUtils.smoothstep(amount, 0, 1);
    }
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
            if ((spec.desk && !spec.station) || this.filter?.when?.[this.keyOf(spec)]) this.ownMaterials(object);
            root.add(object); this.people.push(object); this.resize(object, spec); this.recolor(object, spec);
            if (spec.station) this.atStation(object, spec);
            else if (!spec.desk && !spec.beside) this.settle(object, spec);
        }
    }
    // The featured desk's people fade with the desk height, so they need materials of their own (textures stay shared).
    ownMaterials(object) {
        const copies = new Map(); object.userData.personMaterials = [];
        object.traverse(o => { if (!o.isMesh) return; o.material = [].concat(o.material).map(m => { if (!copies.has(m)) { const c = m.clone(); c.userData.sharedTextures = true; c.userData.solid = { transparent: m.transparent, opacity: m.opacity }; copies.set(m, c); object.userData.personMaterials.push(c); } return copies.get(m); })[0]; });
    }
    fade(object, amount) {
        if (object.userData.personFade === amount) return; object.userData.personFade = amount;
        for (const m of object.userData.personMaterials || []) { const solid = amount >= 1; m.transparent = solid ? m.userData.solid.transparent : true; m.opacity = m.userData.solid.opacity * amount; m.needsUpdate = true; }
        const chair = object.userData.personChair; if (chair) chair.visible = object.visible && amount > .5;
        object.traverse(o => { if (o.isMesh) o.castShadow = amount > .5; });
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
        } else { object.position.set(spec.at[0], spec.y || 0, spec.at[1]); object.rotation.y = turn; }
        if (spec.seat && anchor) object.position.y = this.seatLift(object, spec, anchor);
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
        // the chair faces the way its user faces: toward the desk (it was turned half round, backrest against the user's chest)
        if (chair) { chair.visible = on; if (on) { chair.position.set(object.position.x, 0, object.position.z); chair.rotation.y = object.rotation.y; } }
    }
    // filter.chair: one task chair that stays. It is under the seated desk user while they are there (`seated` 0..1)
    // and slides back from the desk when they are not.
    stayChair(state, seated, yaw) {
        const park = this.filter?.chair, chairs = this.people.filter(o => o.userData.personChair && o.userData.person.desk === 'sit' && !o.userData.person.station && this.allowed(o.userData.person));
        if (!park || !chairs.length || !state?.pose) return;
        const keep = chairs[0].userData.personChair, front = frontOf(yaw), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const base = state.keyboard ? new THREE.Vector3(state.keyboard.x, 0, state.keyboard.z).addScaledVector(front, BEHIND_KEYS.sit) : new THREE.Vector3(state.pose.x - 6, 0, state.pose.z).addScaledVector(front, REACH.sit);
        const away = 1 - THREE.MathUtils.smoothstep(seated, 0, 1);
        for (const o of chairs) o.userData.personChair.visible = false;
        keep.visible = true; keep.position.copy(base).addScaledVector(front, (park.back ?? 620) * away).addScaledVector(side, (park.side ?? 0) * away);
        keep.rotation.y = yaw + Math.PI + THREE.MathUtils.degToRad((park.turn ?? 0) * away);
        this.chairSpot = keep.position; this.chairHome = base;
    }
    // state: { height (inches), mode, pose: { x, z, yaw }, keyboard: { x, z } | null, time } of the featured desk, room
    // millimetres; called every frame while enabled. With a keyboard the person lines up on it, not on the desk anchor.
    // time: seconds into a film chapter (null in the Studio), for the filter's `when`.
    update(state) {
        if (!this.enabled || !this.people.length) return;
        const height = state?.height ?? 28, pose = state?.pose, mode = state?.mode, time = state?.time ?? null; let working = false, seated = 0;
        if (!this.placed) {
            this.placed = true;
            for (const object of this.people) {
                // an extra person takes the placement the filter has for it now (it may have been moved since it was built)
                const now = object.userData.person.extra && (this.filter?.cast || []).find(c => this.keyOf(c) === this.keyOf(object.userData.person));
                if (now) {
                    const spec = object.userData.person = { ...now, extra: true }; object.userData.personMissing = false; this.resize(object, spec); this.recolor(object, spec);
                    if (spec.station) this.atStation(object, spec); else if (!spec.desk && !spec.beside) this.settle(object, spec);
                }
                const spot = this.filter?.place?.[this.keyOf(object.userData.person)] || this.filter?.place?.[object.userData.person.id]; if (!spot) continue;
                object.position.set(spot.at[0], spot.y ?? 0, spot.at[1]); object.rotation.y = THREE.MathUtils.degToRad(spot.turn || 0); object.userData.personMissing = false;
                if (Number.isFinite(spot.scale)) this.resize(object, { scale: spot.scale });
            }
        }
        for (const object of this.people) {
            const spec = object.userData.person, fit = object.userData.personFit;
            const there = this.present(spec, time);
            let on = !object.userData.personMissing && this.allowed(spec) && there > 0 && (!spec.modes || spec.modes.includes(mode));
            object.userData.personAmount = there;
            if (spec.desk && !spec.station) {
                const off = fit === null ? 0 : Math.abs(height - fit);
                on = on && !!pose && !working && off <= HEIGHT_FIT;
                if (on) {
                    object.userData.personAmount = there * (1 - THREE.MathUtils.smoothstep(off, HEIGHT_SOLID, HEIGHT_FIT));
                    const yaw = pose.yaw || 0, front = frontOf(yaw), keys = state.keyboard, short = (spec.reach ?? REACH[spec.desk]) - REACH[spec.desk];
                    if (keys) object.position.set(keys.x, 0, keys.z).addScaledVector(front, BEHIND_KEYS[spec.desk] + short);
                    else object.position.set(pose.x - 6, 0, pose.z).addScaledVector(front, REACH[spec.desk] + short);
                    object.rotation.y = yaw + Math.PI; working = true;
                }
            } else if (spec.beside && (this.filter?.place?.[this.keyOf(spec)] || this.filter?.place?.[spec.id])) {
                // placed for this use: stays where it was put
            } else if (spec.beside && pose) {
                const yaw = pose.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw), [dx, dz] = spec.beside;
                object.position.set(pose.x + dx * c + dz * s, 0, pose.z - dx * s + dz * c);
                object.rotation.y = Math.atan2(pose.x - object.position.x, pose.z + 350 - object.position.z);   // toward the desk's working edge
            } else if (spec.beside) on = false;
            this.show(object, on);
            if (on && object.userData.personMaterials) this.fade(object, object.userData.personAmount ?? 1);
            if (on && spec.desk === 'sit' && !spec.station) seated = Math.max(seated, object.userData.personAmount ?? 1);
        }
        this.chairSpot = this.chairHome = null;
        if (this.filter?.chair) this.stayChair(state, seated, pose?.yaw || 0);
        this.clearChairs();
    }
    // The room's own chairs make way wherever someone is working at a desk (they brought the chair the pose fits,
    // stand where the chair was, or roll in on their own wheels).
    clearChairs() {
        const spots = this.people.filter(o => o.visible && o.userData.person.desk).map(o => o.position);
        if (this.chairSpot) spots.push(this.chairSpot, this.chairHome);   // the room's own desk chair stays out while the film's is in the room
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
        for (const object of this.people) { object.userData.personChair?.removeFromParent(); object.removeFromParent(); for (const m of object.userData.personMaterials || []) m.dispose(); }
        this.people = []; this.built = null;
    }
}
