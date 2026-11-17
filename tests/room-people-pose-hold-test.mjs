// The Director's pose mode drags a bone of someone who is drawn by a solver every frame. Every draw of a person's
// pose in room-people.mjs must stand back while a bone is dragged (hold = window.__directorDragging), or the drag snaps
// back and the pose measured from the redrawn bones is no change at all (Vico, 17 Nov 2026: Andre in the middle of a
// posture change, storage chapter). Draws that are never on screen while a bone is dragged are listed here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = readFileSync(new URL('../room-people.mjs', import.meta.url), 'utf8').split('\n');
const NEVER_DRAGGED = [
    /solveWalk\(life\.rig, plan, [^)]*\); drawPose\(life\.rig, drawn, 0, null\)/,      // (the walk's own measuring of a stance, no one on it)
    /solveChange\(change\.rig, key, key, 0\); drawPose\(change\.rig, o\.userData\.personRig, 0, poseNow\(o\.userData\.person\)\)/    // (endChange: after the change)
];
let seen = 0;
src.forEach((line, i) => {
    if (!line.includes('drawPose(') || /^\s*(\/\/|import)/.test(line)) return;
    for (const m of line.matchAll(/drawPose\(([^;]*?)\)(;|\s*\})/g)) {
        seen++;
        const args = m[1], top = []; let depth = 0, cur = '';
        for (const ch of args) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && depth === 0) { top.push(cur); cur = ''; } else cur += ch; }
        top.push(cur);
        if (top.length >= 5) continue;
        assert.ok(NEVER_DRAGGED.some(re => re.test(line)), `room-people.mjs:${i + 1} draws a pose without hold: ${line.trim().slice(0, 140)}`);
    }
});
// The skeleton is also posed directly (RoomPeople.pose) from keyPoses for people no solver draws: it must stand back too.
const kp = src.slice(src.findIndex(l => l.includes('keyPoses(time) {')), src.findIndex(l => l.includes('actorPose(actor, time) {')));
const poseCalls = kp.filter(l => /this\.pose\(object, ?spec\)/.test(l));
assert.ok(poseCalls.length >= 2, 'found the keyPoses pose calls');
for (const l of poseCalls) assert.ok(/!held/.test(l), 'keyPoses pose call without the drag hold: ' + l.trim().slice(0, 120));
assert.ok(seen >= 8, 'found the drawPose calls (' + seen + ')');
console.log('PASS room people pose hold: every pose draw stands back while a bone is dragged (' + seen + ' draws)');
