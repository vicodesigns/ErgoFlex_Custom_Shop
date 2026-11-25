// A wheelchair user's arms, frame by frame, against the drawn body (tests/people-omar-lap-test.mjs and what it shares): the pose
// the film draws at a second (the posture, the change between two postures, the pose keys' turns, then what keeps the hands out of
// the thighs, people-lap.mjs) and how deep the hand (fingers too), the forearm and the elbow are in the thigh, the knee and the trunk.
// (The film's own change, with the roll it starts from, is room-people.mjs lapChange: tests/lib/people-film-run.mjs runs it.)
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PersonRig, solveStill, solveChange, changeArms } from '../../room-people-motion.mjs';
import { blendPoses } from '../../people-pose-keys.mjs';
import { lapPose, lapPlan, armBones, handsAt, turnHands, handTurnAt } from '../../people-lap.mjs';
import { bodyPoints, posed, intoSkin, nearest, facingOut, ROOT } from './people-surface.mjs';

export const rigOf = who => new PersonRig(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/props/people-rigs', who + '.json'), 'utf8')));
export const FINGERS = /^(thumb|index|middle|ring|pinky)_0\d_/;
const q = new THREE.Quaternion();
// The turns of a pose (drawPose's last argument) on the rig's bones, as the stage does.
export function turned(rig, pose) {
    if (pose) for (const [name, d] of Object.entries(pose)) { const i = rig.index.get(name); if (i !== undefined) rig.lq[i].multiply(q.fromArray(d)).normalize(); }
    rig.fk();
}
export class Lap {
    // to: the posture after the roll ('wheel-watch', or a typing one: 'wheel-type-28'); rest: whether it is lifted out of the lap at rest
    // (a watcher's hands are, a typist's stay on the keys: people-lap.mjs lapRest). fine: the second placement's pose keys' turns (one
    // pose, as the film has it), or null.
    constructor(who, { fine = null, lap = true, to = 'wheel-watch', rest = to === 'wheel-watch' } = {}) {
        this.who = who; this.lap = lap; this.rig = rigOf(who); this.fine = fine; this.rest = rest; this.toId = `people-${who}-${to}`;
        this.roll = this.rig.key(`people-${who}-wheel-roll`); this.watch = this.rig.key(this.toId); this.arms = armBones(this.rig); this.plans = new Map();
    }
    async load() { this.points = await bodyPoints(this.toId); return this; }
    // The change's pose at w as the film makes it before the lift (room-people.mjs lapChange: the keys' turns with the arms, the hands
    // turned early): the rig left in it, the turns on top returned.
    posed(w, arms = null) {
        const rig = this.rig; solveChange(rig, this.roll, this.watch, w, arms);
        const pose = this.fine ? blendPoses(null, this.fine, changeArms(w, arms), this.arms) : null;
        return this.lap ? turnHands(rig, pose, this.arms, this.handsTo(arms), w < 1 ? handTurnAt(w, arms) : 0) : pose;
    }
    handsTo(arms) { const k = 'h' + JSON.stringify(arms); if (!this.plans.has(k)) { solveChange(this.rig, this.roll, this.watch, 1, arms); this.plans.set(k, handsAt(this.rig, this.fine)); } return this.plans.get(k); }
    plan(arms = null) { const k = 'p' + JSON.stringify(arms); if (!this.plans.has(k)) this.plans.set(k, lapPlan(this.rig, u => this.posed(u, arms), { ends: { from: false, to: this.rest } })); return this.plans.get(k); }
    // The pose a change gives at w: the rig is left in it.
    change(w, { arms = null } = {}) {
        const rig = this.rig, plan = this.lap ? this.plan(arms) : null, pose = this.posed(w, arms);
        const final = this.lap ? lapPose(rig, pose, plan ? plan.at(w) : { l: 0, r: 0 }) : pose; turned(rig, final); return final;
    }
    // The posture after the change with life in it at a time of the chapter.
    still(time, seed, life = 1) {
        const rig = this.rig; solveStill(rig, this.watch, { time, seed, life }); rig.fk();
        const final = this.lap && this.rest ? lapPose(rig, this.fine) : this.fine; turned(rig, final); return final;
    }
    // How deep the hands (fingers too) and forearms are in the body now, metres, by the skin's normals: { hand, fore } in the thighs, knees
    // and shins, the pelvis and the trunk (the arm's own bones, the head and the wheelchair are not skin to be in; nor the inner faces of
    // pocket flaps: people-surface.mjs facingOut).
    depth({ step = 2 } = {}) {
        const rig = this.rig, P = this.points, out = { hand: 0, fore: 0, at: {}, gap: [] };
        const body = facingOut(rig, posed(rig, P, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'])), legs = ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'];
        const legSkin = body.filter(p => legs.includes(p[3]));
        for (const s of ['l', 'r']) {
            const fingers = rig.names.filter(n => FINGERS.test(n) && n.endsWith('_' + s));
            const hand = posed(rig, P, ['hand_' + s, ...fingers]).filter((_, i) => i % step === 0).map(p => p.slice(0, 3)), fore = posed(rig, P, ['lowerarm_' + s]).filter((_, i) => i % step === 0).map(p => p.slice(0, 3));
            out.gap.push(nearest(legSkin, hand));       // (how far the hand is from the legs' skin: resting on a thigh is near, hanging in the air is not)
            for (const [name, probe] of [['hand', hand], ['fore', fore]]) { const d = intoSkin(body, probe); if (d.depth > out[name]) { out[name] = d.depth; out.at[name] = d.at; } }
        }
        return out;
    }
    // The wrists, the tips of the middle fingers and the elbows (rig frame, metres).
    arm() { const p = n => this.rig.wp[this.rig.index.get(n)].clone(); return ['l', 'r'].flatMap(s => { const m3 = p('middle_03_' + s); return [p('hand_' + s), m3.clone().add(m3.clone().sub(p('middle_02_' + s))), p('lowerarm_' + s)]; }); }
}
