import {screenTiming} from './screen-timing.mjs';
// Texture screens: a screens entry that paints a clip (or a still) into an existing material's own picture instead of
// fitting a new picture mesh over a glass. Film-only (render harness, through film-fx.mjs; the Director's live preview
// runs film-fx too, so it shows there as well); a shot without such an entry never reaches this module, and everything
// it changes is put back by restore().
//
//   screens:[{target:'texture', src, mesh?:'<regex on the mesh name>', material?:'<regex on the material name>',
//             person?:'<who>', within?:'desk', offset=0, rate=1, loop=true, flipX=false, flipY=false, rotate=0}]
//   flipX / flipY / rotate:180 turn the picture on the texture (not on the clip): a phone held out toward a camera
//   on the far side of the person has its own UVs upside down to that camera; the texture is oriented for the shot
//   that reads it and the clip stays authored the right way up (Nov 14, S11: the storage insert).
//
// The matching materials get the clip as their colour map, and as their emissive map when they had one (a lit screen
// stays lit), with the original map's UV settings (flipY, wrap, repeat, offset, rotation), so a picture authored at the
// original texture's aspect lands exactly where the original did. The canvas takes the original image's aspect.
// Matching runs every frame (people are rigged and swapped while the shot plays: each posture is its own GLB with its
// own phone); a material is swapped the first time it is seen and restored at the end.
//   person: only meshes under a person whose people id starts with people-<who>- (userData.person.id, room-people.mjs).
//   within:'desk': only meshes of the featured desk (the drafting sheet of its own kit, not another kit in the room).
// The matches are cached and looked up again every RESCAN frames (people's postures are separate GLBs, all built when
// the shot is prepared; a rig swap hands a posture a new mesh) or when a cached mesh has left the scene. A spec that
// has matched nothing after its first look-up logs a warning (once); match counts are in items[].matched.
// Uses (Nov 14 2026, stream S6):
//   - the phone in Andre's hand (storage): {target:'texture', material:'^Held\\.phone screen', person:'andre', src:'…/11-phone.mp4'}
//   - the drafting board's paper (create): {target:'texture', mesh:'^Architect floor plan$', src:'…/03-floor-plan.png'}
import * as THREE from 'three';

export const isTextureTarget = spec => spec?.target === 'texture';

const re = s => s instanceof RegExp ? s : s ? new RegExp(s, 'i') : null;
const personOf = o => { for (let p = o; p; p = p.parent) if (p.userData?.person) return p.userData.person; return null; };

// Every [mesh, material slot index] in the scene that a spec names.
export function matches(root, spec) {
  const meshRe = re(spec.mesh), matRe = re(spec.material), who = spec.person ? 'people-' + String(spec.person).toLowerCase() + '-' : null, out = [];
  if (!meshRe && !matRe) return out;
  root.traverse(o => {
    if (!o.isMesh || o.userData.filmFx) return;
    if (meshRe && !meshRe.test(o.name || '')) return;
    if (who) { const p = personOf(o); if (!p || !String(p.id || '').toLowerCase().startsWith(who)) return; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => { if (m && (!matRe || matRe.test(m.name || ''))) out.push([o, i]); });
  });
  return out;
}

const UV_FIELDS = ['flipY', 'wrapS', 'wrapT', 'channel'];
function textureFor(canvas, like) {
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  if (like) {
    for (const k of UV_FIELDS) if (like[k] !== undefined) t[k] = like[k];
    t.offset.copy(like.offset); t.repeat.copy(like.repeat); t.center.copy(like.center); t.rotation = like.rotation;
    if (like.matrixAutoUpdate === false) { t.matrixAutoUpdate = false; t.matrix.copy(like.matrix); }
  }
  return t;
}

// specs: the shot's texture entries; media: their loaded media (video / image), in the same order.
// makeCanvas(w, h) lets the test run without a DOM.
export const RESCAN = 30;
const inScene = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
export function installTextureScreens(root, specs, media, { makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }), desk = null, warn = m => console.warn(m) } = {}) {
  if (!specs?.length) return null;
  const items = specs.map((spec, i) => ({ spec, media: media[i], canvas: null, ctx: null, texture: null, drawn: false, swapped: new Map(), hits: [], matched: 0, warned: false }));
  let frames = 0;
  const size = (item, like) => {
    const img = like?.image, sw = item.media.videoWidth || item.media.naturalWidth || item.media.width || 1024, sh = item.media.videoHeight || item.media.naturalHeight || item.media.height || 1024;
    const aw = img?.width || sw, ah = img?.height || sh, long = Math.min(2048, Math.max(512, Math.max(sw, sh)));
    return aw >= ah ? [long, Math.max(2, Math.round(long * ah / aw))] : [Math.max(2, Math.round(long * aw / ah)), long];
  };
  function swap(item, mesh, slot) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material], m = mats[slot];
    if (item.swapped.has(m)) return;
    if (!item.texture) {
      const [w, h] = size(item, m.map || m.emissiveMap);
      item.canvas = makeCanvas(w, h); item.ctx = item.canvas.getContext('2d');
      item.texture = textureFor(item.canvas, m.map || m.emissiveMap);
      item.drawn = false;
    }
    item.swapped.set(m, { map: m.map, emissiveMap: m.emissiveMap });
    m.map = item.texture; if (m.emissiveMap) m.emissiveMap = item.texture; m.needsUpdate = true;
  }
  function paint(item) {
    const { ctx, canvas, media: v } = item; if (!ctx) return;
    const { flipX, flipY, rotate } = item.spec, turn = (Number(rotate) || 0) % 360 === 180, sx = (flipX ? -1 : 1) * (turn ? -1 : 1), sy = (flipY ? -1 : 1) * (turn ? -1 : 1);
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    if (sx < 0 || sy < 0) ctx.setTransform?.(sx, 0, 0, sy, sx < 0 ? canvas.width : 0, sy < 0 ? canvas.height : 0);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height); ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    item.texture.needsUpdate = true; item.drawn = true;
  }
  return {
    items,
    // seekTo(media, seconds): the caller's frame-exact seek (film-fx seek()); not called for stills.
    async frame(chapterSeconds, seekTo) {
      const look = frames++ % RESCAN === 0;
      for(const item of [...items].reverse())if(!screenTiming(item.spec,chapterSeconds).visible){
        for(const [m,was] of item.swapped){m.map=was.map;m.emissiveMap=was.emissiveMap;m.needsUpdate=true;}item.swapped.clear();
      }
      for (const item of items) {
        const clip=screenTiming(item.spec,chapterSeconds);
        if(!clip.visible){
          for(const [m,was] of item.swapped){m.map=was.map;m.emissiveMap=was.emissiveMap;m.needsUpdate=true;}
          item.swapped.clear();continue;
        }
        const base = item.spec.within === 'desk' ? desk : root;
        if (look || !item.hits.length || item.hits.some(([m]) => !inScene(m, root))) {
          item.hits = base ? matches(base, item.spec) : [];
          item.matched = item.hits.length;
          if (!item.matched && !item.warned) { item.warned = true; warn(`[film-fx] texture screen matches nothing: ${JSON.stringify({mesh: item.spec.mesh, material: item.spec.material, person: item.spec.person, within: item.spec.within})}`); }
        }
        for (const [mesh, slot] of item.hits) swap(item, mesh, slot);
        if (!item.texture) continue;
        const v = item.media, isVideo = Number.isFinite(v.duration) && v.duration > 0;
        if (!isVideo) { if (!item.drawn) paint(item); continue; }
        const raw = clip.seconds, d = v.duration;
        const time = item.spec.loop === false ? Math.min(Math.max(raw, 0), Math.max(0, d - .02)) : ((raw % d) + d) % d;
        if (seekTo) await seekTo(v, Math.min(time + .0015, Math.max(0, d - .001)));
        paint(item);
      }
    },
    restore() {
      for (const item of items) {
        for (const [m, was] of item.swapped) { m.map = was.map; m.emissiveMap = was.emissiveMap; m.needsUpdate = true; }
        item.swapped.clear(); item.texture?.dispose(); item.texture = null;
        const v = item.media;   // release a clip's decoder (film-fx's own screens do the same on clear)
        if (v && typeof v.removeAttribute === 'function' && Number.isFinite(v.duration)) { v.removeAttribute('src'); v.load?.(); }
      }
    },
  };
}
