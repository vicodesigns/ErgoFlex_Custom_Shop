// A wheelchair user's arms, frame by frame, against the drawn body (tests/people-omar-lap-test.mjs and what it shares): the pose
// the film draws at a second (the posture, the change between two postures, the pose keys' turns, then what keeps the hands out of
// the thighs, people-lap.mjs) and how deep the hand, the forearm and the elbow are in the thigh, the knee and the trunk.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PersonRig, solveStill, solveChange, changeArms } from '../../room-people-motion.mjs';
import { blendPoses } from '../../people-pose-keys.mjs';
import { lapPose, armBones } from '../../people-lap.mjs';
import { bodyPoints, posed, intoSkin, nearest, ROOT } from './people-surface.mjs';

export const rigOf = who => new PersonRig(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/props/people-rigs', who + '.json'), 'utf8')));
const q = new THREE.Quaternion();
// The turns of a pose (drawPose's last argument) on the rig's bones, as the stage does.
export function turned(rig, pose) {
    if (pose) for (const [name, d] of Object.entries(pose)) { const i = rig.index.get(name); if (i !== undefined) rig.lq[i].multiply(q.fromArray(d)).normalize(); }
    rig.fk();
}
export class Lap {
    constructor(who, { fine = null, lap = true } = {}) {
        this.who = who; this.lap = lap; this.rig = rigOf(who); this.fine = fine;      // fine: the watch placement's pose keys' turns (one pose, as the film has it), or null
        this.roll = this.rig.key(`people-${who}-wheel-roll`); this.watch = this.rig.key(`people-${who}-wheel-watch`); this.arms = armBones(this.rig);
    }
    async load() { this.points = await bodyPoints(`people-${this.who}-wheel-watch`); return this; }
    // The pose a change gives at w: the rig is left in it.
    change(w, { arms = null } = {}) {
        const rig = this.rig; solveChange(rig, this.roll, this.watch, w, arms);
        const k = changeArms(w, arms), pose = this.fine ? blendPoses(null, this.fine, k, this.arms) : null;
        const final = this.lap ? lapPose(rig, pose) : pose; turned(rig, final); return final;
    }
    // The watching posture with life in it at a time of the chapter.
    still(time, seed, life = 1) {
        const rig = this.rig; solveStill(rig, this.watch, { time, seed, life }); rig.fk();
        const final = this.lap ? lapPose(rig, this.fine) : this.fine; turned(rig, final); return final;
    }
    // How deep the hands and forearms are in the body now, metres, by the skin's normals: { hand, fore } in the thighs, knees and shins, the
    // pelvis and the trunk (the arm's own bones, the head and the wheelchair are not skin to be in).
    depth({ step = 2 } = {}) {
        const rig = this.rig, P = this.points, out = { hand: 0, fore: 0, at: {}, gap: [] };
        const body = posed(rig, P, ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r']), legs = ['thigh_l', 'thigh_r', 'calf_l', 'calf_r'];
        const legSkin = body.filter(p => legs.includes(p[3]));
        for (const s of ['l', 'r']) {
            const fingers = rig.names.filter(n => /^(thumb|index|middle|ring|pinky)_0d_/.test(n) && n.endsWith('_' + s));
            const hand = posed(rig, P, ['hand_' + s, ...fingers]).filter((_, i) => i % step === 0).map(p => p.slice(0, 3)), fore = posed(rig, P, ['lowerarm_' + s]).filter((_, i) => i % step === 0).map(p => p.slice(0, 3));
            out.gap.push(nearest(legSkin, hand));       // (how far the hand is from the legs' skin: resting on a thigh is near, hanging in the air is not)
            for (const [name, probe] of [['hand', hand], ['fore', fore]]) { const d = intoSkin(body, probe); if (d.depth > out[name]) { out[name] = d.depth; out.at[name] = d.at; } }
        }
        return out;
    }
}
