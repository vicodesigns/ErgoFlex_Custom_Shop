function () {
  const E = window.ErgoFlex, m = E.loadedModel;
  let root = m; while (root.parent) root = root.parent;
  const hex = c => c ? '#' + c.getHexString() : null;
  const r3 = v => typeof v === 'number' ? +v.toFixed(4) : v;
  const desc = mat => ({
    uuid: mat.uuid.slice(0, 8), name: mat.name, type: mat.type, color: hex(mat.color), metalness: r3(mat.metalness), roughness: r3(mat.roughness),
    envMapIntensity: r3(mat.envMapIntensity), envMap: mat.envMap ? mat.envMap.uuid.slice(0, 8) : null, clearcoat: r3(mat.clearcoat),
    emissive: hex(mat.emissive), emissiveIntensity: r3(mat.emissiveIntensity), map: !!mat.map, ior: r3(mat.ior),
    userData: Object.fromEntries(Object.entries(mat.userData || {}).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, r3(v)]))
  });
  const pathOf = o => { const p = []; for (let x = o; x; x = x.parent) p.unshift(x.name || x.type); return p.join(' > '); };
  const collect = (obj, limit = 400) => {
    const mats = new Map();
    obj.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      let vis = true; for (let x = o; x; x = x.parent) if (!x.visible) { vis = false; break; }
      if (!vis) return;
      for (const mat of [].concat(o.material)) {
        if (!mat) continue;
        const e = mats.get(mat) || { ...desc(mat), meshes: 0, sample: [] };
        e.meshes++; if (e.sample.length < 4) e.sample.push(o.name);
        mats.set(mat, e);
      }
    });
    return [...mats.values()].slice(0, limit);
  };
  const out = {
    room: E.roomScene, deskPath: pathOf(m),
    sceneEnv: root.environment ? root.environment.uuid.slice(0, 8) : null, environmentIntensity: r3(root.environmentIntensity),
    desk: collect(m)
  };
  // the dumbbell prop(s) and anything aluminium-named in the room
  const props = [];
  root.traverse(o => { if (/dumbbell/i.test(o.name) && !o.isMesh && props.length < 6) props.push({ name: o.name, path: pathOf(o), materials: collect(o, 20) }); });
  out.props = props;
  return out;
}
