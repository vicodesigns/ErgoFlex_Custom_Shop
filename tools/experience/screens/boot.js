// Sets up the canvas for the requested clip and exposes window.render(t).
(function () {
  const clipInfo = SHOT.clip, canvas = document.getElementById('c');
  canvas.width = clipInfo.w; canvas.height = clipInfo.h;
  canvas.style.width = clipInfo.w + 'px'; canvas.style.height = clipInfo.h + 'px';
  g = canvas.getContext('2d', {alpha: false});
  const portrait = clipInfo.h > clipInfo.w;
  const k = portrait ? clipInfo.w / 1080 : clipInfo.h / 1080;
  W = clipInfo.w / k; H = clipInfo.h / k;
  const scene = SCENES[clipInfo.scene];
  if (!scene) console.error('unknown scene ' + clipInfo.scene);
  window.__ready = (async () => {
    await Promise.all([400, 500, 600, 700].map(w => document.fonts.load(`${w} 40px Poppins`)));
    await loadImage('logo', SHOT.root + '/exports/cinematic-intro-20261030/post/logo-white.svg');
    if (scene && scene.init) await scene.init();
  })();
  window.render = async (t) => {
    if (scene && scene.prefetch) await Promise.all(scene.prefetch(t).map(([key, idx]) => needFrame(key, idx)));
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (scene) scene.draw(t, clipInfo.opts || {});
    const dim = scene && scene.dim ? scene.dim(t) : 0;
    if (dim > 0) { g.globalAlpha = 1; g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(0, 0, W, H); }
    return true;
  };
})();
