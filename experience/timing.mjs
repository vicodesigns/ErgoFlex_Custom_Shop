// Absolute time keeps motion continuous when browser refresh rates vary.
export class ShotClock {
  constructor() { this.reset(0); }
  reset(now, running = false) { this.elapsed = 0; this.at = now; this.running = running; }
  seconds(now) { return this.elapsed + (this.running ? Math.max(0, now - this.at) / 1000 : 0); }
  setRunning(running, now) {
    this.elapsed = this.seconds(now); this.at = now; this.running = running;
  }
  progress(now, duration) { return Math.min(1, Math.max(0, this.seconds(now) / duration)); }
  seek(seconds, now) { this.elapsed=Math.max(0,seconds);this.at=now; }
}

// Weight route segments by distance, rather than spending equal time on a
// tiny adjustment and a long traverse. Rotation contributes its swept arc.
export function measureRoute(points, radius = 400) {
  let total = 0;
  const segments = points.slice(1).map((b,i) => {
    const a = points[i], yaw = Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
    const length = Math.hypot(b.x-a.x,b.z-a.z,Math.abs(yaw)*radius);
    const segment = {a,b,yaw,from:total,length}; total += length; return segment;
  });
  return {points,segments,total};
}
export function routePose(route, progress) {
  if (!route?.points.length) return null;
  if (!route.total) return {...route.points[0]};
  const distance = Math.min(1,Math.max(0,progress))*route.total;
  const s = route.segments.find(s=>s.length && distance<=s.from+s.length) || route.segments.at(-1);
  const u = s.length ? Math.min(1,Math.max(0,(distance-s.from)/s.length)) : 1;
  return {x:s.a.x+(s.b.x-s.a.x)*u,z:s.a.z+(s.b.z-s.a.z)*u,yaw:s.a.yaw+s.yaw*u};
}
