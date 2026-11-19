// Which of a desk user's models the film draws over a chapter, for the Director's pose mode (19 Nov 2026: Vico posed
// Ava's seated model at 28 in; at 4.35 s her desk passes 29 in and the film draws her 30 in model, which had no
// correction of its own, so her pose looked reset). Corrections belong to one model each (people-postures.mjs); this
// only says which model shows when, so the pose mode can name the ones without a correction and offer an explicit copy.
//
// The same choice as room-people-motion.mjs DeskActor.drive: of the members of the stance the person is in (standing
// once tau >= swapAt, for someone who both sits and stands), the one whose deskHeight is nearest the desk's height.
// Read only: it reads the actor's own simulation of the chapter's desk track (actor.sim, which drive builds from the
// film's track), and drives or changes nothing. No simulation (a desk held off its track): no timeline.
// Returns [{ id, member, from, to }] in seconds, one entry per stretch of time a model is drawn.
export function shownTimeline(actor, step = .05) {
    const sim = actor?.sim, track = sim?.track, members = actor?.members || [];
    if (!sim || typeof sim.at !== 'function' || typeof track?.heightAt !== 'function' || !members.length) return [];
    const seconds = Number.isFinite(track.seconds) ? track.seconds : sim.seconds;
    if (!(seconds >= 0)) return [];
    const out = [];
    for (let i = 0; ; i++) {
        const t = Math.min(seconds, Math.round(i * step * 1e6) / 1e6), height = track.heightAt(t);
        const stance = actor.mobile ? (sim.at(t).tau >= actor.swapAt ? 'stand' : 'sit') : null;
        const of = members.filter(m => stance === null || (m.role === 'stand') === (stance === 'stand'));
        const m = of.sort((a, b) => Math.abs((a.key?.deskHeight ?? height) - height) - Math.abs((b.key?.deskHeight ?? height) - height))[0];
        if (m) { const last = out.at(-1); if (last && last.id === m.id) last.to = t; else { if (last) last.to = t; out.push({ id: m.id, member: m, from: t, to: t }); } }
        if (t >= seconds) break;
    }
    return out;
}
// A correction: a pose, pose keys or a moved held thing (people-postures.mjs postureRecord).
export const hasCorrection = r => !!(r && ((r.pose && Object.keys(r.pose).length) || r.poseKeys?.length || (r.held && Object.keys(r.held).length)));
// The same posture built for another desk height (Ava's sit-type and sit-type-30): models: id -> {character, pose, deskHeight}.
export function heightSibling(models, a, b) {
    const x = models?.[a], y = models?.[b];
    return !!x && !!y && a !== b && x.character === y.character && x.pose === y.pose && Number.isFinite(x.deskHeight) && Number.isFinite(y.deskHeight) && x.deskHeight !== y.deskHeight;
}
// The stretches of a timeline one model has, as text: "4.35–5.35 s" (several joined by ", ").
export const spansOf = (timeline, id) => timeline.filter(s => s.id === id).map(s => `${fmt(s.from)}–${fmt(s.to)} s`).join(', ');
export const fmt = t => String(Math.round(t * 100) / 100);
