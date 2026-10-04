// Source-derived FX34/35/36, reviewed against the leds lane's 56 RGBW frames.
// Output stage: post-channel-brightness, pre-gamma/transition/current-limit.
const layers = [0, 1, 1, 2, 3, 3, 3, 4];
const tail = [255, 215, 175, 128, 81, 53, 23, 15];
const tau = 6.28318;
const mod = (a, n) => ((a % n) + n) % n;
export function sampleMovementInto(frame, {fx, ix, sx, elapsedMs, brightness = 255, colors, reverseRotation = false}) {
    if (![34,35,36].includes(fx) || (fx === 36 ? ix < 1 || ix > 10 : ![0,128].includes(ix)) ||
        !Number.isInteger(ix) || ![sx,brightness].every(v => Number.isInteger(v) && v >= 0 && v <= 255) ||
        !Number.isFinite(elapsedMs) || elapsedMs < 0 || frame.length !== 8 ||
        !colors?.every(c => c.length === 4 && c.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) || colors.length !== 3)
        throw new RangeError('Invalid movement frame parameters');
    const seconds = elapsedMs / 1000;
    // Preview correction requested after visual testing. Keep physical direction
    // IDs intact; only reverse the rotation comet's travel on the virtual strips.
    const rotationIx = reverseRotation && fx === 36 && (ix === 5 || ix === 6) ? 11-ix : ix;
    const phase = mod(seconds * (fx === 34 ? .12 + sx/255*.28 : fx === 35 ? .25 + sx/255*.75 : .4 + sx/255*1.1), 1);
    for (let id = 0; id < 8; id++) {
        const row = frame[id], count = row.length / 4;
        let kind = 'comet', reverse = false;
        if (fx === 36) {
            if (ix <= 2) {kind = [1,4,5,6].includes(id) ? 'warn' : 'comet'; reverse = ix === 2;}
            else if (ix <= 4) {kind = [5,6].includes(id) ? 'comet' : [0,7].includes(id) ? 'red' : 'alternate'; reverse = ix === 4;}
            else if (ix <= 6) {kind = [1,4].includes(id) ? 'warn' : 'comet'; reverse = rotationIx === 5 ? id === 5 : id !== 5;}
            else {kind = [1,4].includes(id) ? 'warn' : 'comet'; reverse = [5,6].includes(id) ? [8,10].includes(ix) : ix >= 9;}
        }
        for (let p = 0; p < count; p++) {
            let gain, color = colors[0];
            if (fx === 34) {
                const travel = phase*5, head = ix < 128 ? mod(4-travel+5,5) : travel;
                const raw = Math.abs(layers[id]-head), d = Math.min(raw,5-raw);
                const layer = d < 1 ? Math.floor(.5*(1+Math.cos(d*Math.PI))*brightness) : 0;
                gain = Math.floor(layer*(1-.15*p/Math.max(count-1,1)));
            } else if (fx === 35) {
                let pos = (Math.sin(phase*tau+id*Math.PI/14)+1)/2;
                if (ix >= 128) pos = 1-pos;
                const d = Math.abs(p-pos*(count-1));
                gain = Math.floor((d >= 2.5 ? 0 : d <= .5 ? 1 : Math.max(0,1-(d-.5)/1.5)**2)*brightness);
            } else if (kind === 'comet') {
                const headPhase = Math.floor(phase*count)%count, head = reverse ? count-1-headPhase : headPhase;
                const d = mod(reverse ? p-head : head-p,count);
                gain = d < Math.min(count,8) ? (tail[d]*brightness)>>8 : 0;
            } else if (kind === 'warn') {
                color = colors[2].some(v => v) ? colors[2] : colors[0];
                gain = Math.floor((Math.sin(mod(seconds*1.1,1)*tau)+1)/2*brightness);
            } else {
                if (kind === 'alternate' && Math.floor(seconds*.55)%2 === 1) color = colors[2].some(v => v) ? colors[2] : colors[0];
                gain = Math.floor((1-Math.cos(mod(seconds*.55,1)*tau))/2*brightness);
            }
            for (let c = 0; c < 4; c++) row[p*4+c] = (color[c]*gain)>>8;
        }
    }
    return frame;
}

const liftUp = [0,0,255,0], liftDown = [255,0,0,0], extend = [255,255,0,0], retract = [150,0,255,0];
const config = (fx, ix, name, sound, color) => ({fx,ix,sx:fx === 36 ? 180 : 160,name,sound,
    reverseRotation:fx === 36 && (ix === 5 || ix === 6),
    colors:[color,color,fx === 36 ? [255,70,0,0] : [0,0,0,0]]});
export function wheelDirection(forward, right, yaw) {
    if (Math.abs(yaw) > 1e-6) return yaw > 0 ? 6 : 5; // positive Three.js Y rotation is CCW viewed from above
    const x = Math.abs(forward), z = Math.abs(right);
    if (x < 1e-6 && z < 1e-6) return 0;
    if (x < z*.3) return right < 0 ? 1 : 2;
    if (z < x*.3) return forward > 0 ? 3 : 4;
    return right < 0 ? (forward > 0 ? 7 : 8) : (forward > 0 ? 9 : 10);
}
const wheelNames = ['', 'Strafe left','Strafe right','Forward','Back','Clockwise','Counterclockwise','Left forward','Left back','Right forward','Right back'];

export class LedMotion {
    constructor() {this.reset();}
    reset(pose = null) {this.previous = pose; this.axes = {}; this.sequence = 0; this.owner = null; this.completionUntil = 0; this.cancelled = false;}
    cancel(pose) {this.reset(pose);}
    observe(pose, now, {liftReached = false, tiltReached = false, enabled = true} = {}) {
        if (now >= this.completionUntil) this.completionUntil = 0;
        if (!this.previous || !enabled) {this.reset(pose); return null;}
        const prev = this.previous;
        const dx = pose.x-prev.x, dz = pose.z-prev.z, yaw = pose.yaw-prev.yaw;
        const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
        const wheel = wheelDirection(c*dx-s*dz, s*dx+c*dz, yaw);
        const dl = pose.lift-prev.lift, dt = pose.tilt-prev.tilt;
        const changes = {
            lift: Math.abs(dl) > 1e-5 ? config(34,dl>0?0:128,dl>0?'Lift up':'Lift down',dl>0?'movement_lift_up':'movement_lift_down',dl>0?liftUp:liftDown) : null,
            tilt: Math.abs(dt) > 1e-5 ? config(35,dt<0?0:128,dt<0?'Tilt extend':'Tilt retract',dt<0?'movement_tilt_extend':'movement_tilt_retract',dt<0?extend:retract) : null,
            wheels: wheel ? config(36,wheel,wheelNames[wheel],'movement_wheels',liftDown) : null
        };
        const old = this.owner;
        for (const axis of ['lift','tilt','wheels']) {
            const next = changes[axis], active = this.axes[axis];
            if (!next) {delete this.axes[axis]; continue;}
            if (!active || active.fx !== next.fx || active.ix !== next.ix) {
                this.axes[axis] = {...next,axis,started:now,sequence:++this.sequence};
                this.completionUntil = 0;
            }
        }
        this.owner = Object.values(this.axes).sort((a,b) => b.sequence-a.sequence)[0] || null;
        if (old && !this.owner && ((old.axis === 'lift' && liftReached) || (old.axis === 'tilt' && tiltReached))) this.completionUntil = now+5000;
        this.previous = pose;
        return this.owner;
    }
    sample(frame, now, reduced = false) {
        if (this.owner) {
            sampleMovementInto(frame,{...this.owner,elapsedMs:reduced ? 1000 : Math.max(0,now-this.owner.started)});
            return true;
        }
        if (now < this.completionUntil) {for (const row of frame) for (let p=0;p<row.length;p+=4) row.set([0,254,0,0],p); return true;}
        return false;
    }
    get status() {return this.owner?.name || (this.completionUntil ? 'Target reached' : 'Base effect');}
}
