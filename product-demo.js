// Reuse the configurator's real 3D canvas and its ErgoFlex app remote.
// Other controls stay in the DOM for the shared studio engine.
const demo = document.createElement('section');
demo.id = 'event-demo';
demo.innerHTML = `<div class="demo-top"><strong>Explore ErgoFlex in 3D</strong><div class="demo-top-controls"><div class="demo-size" role="group" aria-label="Desktop size"><span>Desktop</span><button type="button" data-demo-size="48x30" aria-pressed="false" disabled>48″ Standard</button><button type="button" data-demo-size="60x30" aria-pressed="true" disabled>60″ Extended</button></div><label>Backdrop <select id="demo-backdrop"><option value="gallery">Gallery</option><option value="warm">Warm studio</option><option value="slate" selected>Slate studio</option></select></label></div></div><div id="demo-stage"><div id="demo-viewer"></div><div id="demo-remote" role="region" tabindex="0" aria-label="Interactive ErgoFlex app controls"></div></div><p class="demo-note" role="status">Loading the workstation…</p>`;
document.body.append(demo);
demo.querySelector('#demo-backdrop').insertAdjacentHTML('beforeend', '<option value="led">LED studio</option>');
demo.querySelector('.demo-top-controls').insertAdjacentHTML('beforeend',
  '<button class="demo-action" data-led-toggle type="button" aria-pressed="false" disabled>LEDs off</button><label class="demo-led-glow">Brightness <input type="range" data-led-glow aria-label="LED brightness" min="0" max="100" value="75" disabled><output data-led-brightness-value>75%</output></label><div class="demo-led-color-stack"><div class="led-palette" role="group" aria-label="Quick LED colors"></div><label class="demo-led-color">LED color <input type="color" data-led-color aria-label="LED color" value="#f10404" disabled></label></div><button class="demo-action" data-touchscreen-toggle type="button" aria-pressed="false" disabled>Extend screen</button><button class="demo-action" data-ar-launch type="button" title="Place the current desk in your room at full size" disabled>AR/XR · See in your space</button>');
document.querySelector('#demo-viewer').append(document.querySelector('#viewer-shell'));
const effectControls = document.createElement('div');
effectControls.className = 'demo-led-effects led-effects-controls';
demo.querySelector('.demo-top-controls').append(effectControls);
const mappingControls = document.createElement('div');
mappingControls.className = 'demo-led-mapping';
demo.querySelector('.demo-top-controls').append(mappingControls);
const playbackControls = document.createElement('div');
playbackControls.className = 'demo-led-playback';
demo.querySelector('.demo-top-controls').append(playbackControls);
const start = Date.now();
const ready = setInterval(() => {
  const api = window.ErgoFlex;
  const dock = document.querySelector('#motion-dock');
  if (!api?.loadedModel || !api?.wheelRigs.length || !dock || getComputedStyle(document.querySelector('#loader')).display !== 'none') {
    if (Date.now()-start > 90000) {clearInterval(ready);demo.querySelector('.demo-note').textContent='The 3D model could not load. You can still watch the desk demonstrations below.';}
    return;
  }
  clearInterval(ready);
  api.setRoomScene('product',false);
  api.setAutoRotate(false);
  api.setRemoteTheme('dark');
  document.querySelector('#demo-remote').append(dock);
  dock.dataset.mode = 'docked';
  dock.dataset.sized = 'true';
  dock.style.setProperty('--dock-w', '100%');
  dock.style.setProperty('--dock-h', '100%');
  dock.style.setProperty('--remote-scale', '1');
  const slot = document.querySelector('#demo-remote');
  const fitRemote = () => {
    if (dock.closest('#ef-ar-overlay')) return;
    const narrow = slot.clientWidth < 760;
    const scale = narrow ? slot.clientWidth / 760 : 1;
    dock.dataset.shape = 'landscape';
    dock.style.setProperty('--remote-unit', '3.9px');
    dock.style.setProperty('--demo-app-scale', String(scale));
    slot.style.height = `${390 * scale}px`;
    slot.style.overflowX = 'hidden';
    slot.scrollLeft = 0;
  };
  fitRemote();
  window.addEventListener('resize', fitRemote);
  if (dock.classList.contains('collapsed')) document.querySelector('#motion-dock-toggle')?.click();
  for (const id of ['lift-speed', 'tilt-speed']) {
    const speed = document.getElementById(id);
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const backdrop = document.querySelector('#demo-backdrop');
  backdrop.value=document.querySelector('#studio-environment').value;
  backdrop.onchange=()=>{const original=document.querySelector('#studio-environment');original.value=backdrop.value;original.dispatchEvent(new Event('change'));};
  // Persist only this first on/off cycle; later LED changes leave the backdrop alone.
  const ledBackdropKey = 'ergoflex.demoFirstLedBackdropV1';
  let ledBackdropPhase = 'ready';
  try { ledBackdropPhase = localStorage.getItem(ledBackdropKey) || 'ready'; } catch {}
  let previousLEDState = api.ledsEnabled;
  document.addEventListener('ergoflex-led-state', event => {
    const enabled = event.detail.enabled;
    if (enabled === previousLEDState) return;
    previousLEDState = enabled;
    if (enabled && ledBackdropPhase === 'ready') {
      backdrop.value = 'led'; backdrop.onchange(); ledBackdropPhase = 'waiting-off';
    } else if (!enabled && ledBackdropPhase === 'waiting-off') {
      backdrop.value = 'slate'; backdrop.onchange(); ledBackdropPhase = 'done';
    }
    try { localStorage.setItem(ledBackdropKey, ledBackdropPhase); } catch {}
  });
  const sizeSelect = document.getElementById('size-select');
  const sizeButtons = [...demo.querySelectorAll('[data-demo-size]')];
  sizeButtons.forEach(button => { button.disabled = false; });
  const syncDemoSize = () => sizeButtons.forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.demoSize === sizeSelect.value)));
  sizeButtons.forEach(button => button.addEventListener('click', () => {
    if (sizeSelect.value === button.dataset.demoSize) return;
    sizeSelect.value = button.dataset.demoSize;
    sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('fit-view')?.click();
  }));
  sizeSelect.addEventListener('change', syncDemoSize);
  syncDemoSize();
  const ledButton = demo.querySelector('[data-led-toggle]');
  const ledPicker = demo.querySelector('[data-led-color]');
  const glowSlider = demo.querySelector('[data-led-glow]');
  const brightnessValue = demo.querySelector('[data-led-brightness-value]');
  const screenButton = demo.querySelector('[data-touchscreen-toggle]');
  ledButton.disabled = false;
  api.mountLedPalette(demo.querySelector('.led-palette'));
  api.mountLedEffects(effectControls);
  api.mountLedPlayback(playbackControls);
  api.mountLedDiagnostic(mappingControls);
  ledPicker.disabled = false;
  ledPicker.value = api.ledColor;
  glowSlider.disabled = false;
  api.setLedGlow(api.ledFullBrightness * 0.75, false);
  glowSlider.value = String(Math.round(api.ledGlow / api.ledFullBrightness * 100));
  brightnessValue.value = `${glowSlider.value}%`;
  screenButton.disabled = false;
  const arButton = demo.querySelector('[data-ar-launch]');
  arButton.disabled = false;
  arButton.addEventListener('click', () => api.launchAR());
  const syncActions = () => {
    ledButton.setAttribute('aria-pressed', String(api.ledsEnabled));
    ledButton.textContent = api.ledsEnabled ? 'LEDs on' : 'LEDs off';
    screenButton.setAttribute('aria-pressed', String(api.touchscreenOpen));
    screenButton.textContent = api.touchscreenOpen ? 'Stow screen' : 'Extend screen';
  };
  ledButton.addEventListener('click', () => { api.setLedsEnabled(!api.ledsEnabled); syncActions(); });
  ledPicker.addEventListener('input', () => api.setLedColor(ledPicker.value, false));
  glowSlider.addEventListener('input', () => {
    api.setLedGlow(Number(glowSlider.value) * api.ledFullBrightness / 100, false);
    brightnessValue.value = `${glowSlider.value}%`;
  });
  screenButton.addEventListener('click', () => { api.setTouchscreenOpen(!api.touchscreenOpen); syncActions(); });
  syncActions();
  setInterval(syncActions, 250);
  demo.querySelector('.demo-note').textContent='Drag the desk to rotate · Scroll or pinch to zoom · Use the ErgoFlex app controls to move the 3D workstation.';
  const fitFrame = () => {
    try {
      if (window.frameElement) window.frameElement.style.setProperty('height', `${Math.ceil(demo.getBoundingClientRect().height) + 12}px`, 'important');
    } catch {}
  };
  fitFrame();
  if (window.ResizeObserver) new ResizeObserver(fitFrame).observe(demo);
  window.dispatchEvent(new Event('resize'));
  requestAnimationFrame(()=>document.querySelector('#fit-view')?.click());
},150);
