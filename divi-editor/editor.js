(() => {
  'use strict';
  const original = document.querySelector('#original-source').innerHTML.trim();
  const fields = document.querySelector('#fields');
  const preview = document.querySelector('#preview');
  const values = {};
  let source = original;
  let clips = [];
  let timer;

  const groups = [
    ['Navigation and hero', [
      ['brandUrl','Brand website','url','.ef-brand','href'],
      ['navVideos','Videos menu label','text','.ef-nav-links a:nth-child(1)'],
      ['navFormats','Formats menu label','text','.ef-nav-links a:nth-child(2)'],
      ['navContact','Contact menu label','text','.ef-nav-contact'],
      ['heroKicker','Small headline','text','.ef-hero .ef-kicker'],
      ['heroTitle','Main headline','textarea','.ef-hero h1'],
      ['heroLead','Intro paragraph','textarea','.ef-hero .ef-lead'],
      ['heroButton','Main button text','text','.ef-hero-actions .ef-button-primary','firstText'],
      ['heroButtonUrl','Main button link','url','.ef-hero-actions .ef-button-primary','href'],
      ['heroSecondary','Second button text','text','.ef-hero-actions .ef-button-outline','firstText'],
      ['heroMicro','Host line','textarea','.ef-hero .ef-micro'],
      ['heroStamp','Video badge','text','.ef-hero-stamp'],
      ['heroCaption','Video caption','text','.ef-hero-figure figcaption']
    ]],
    ['Highlights', [
      ['proof1Title','Highlight 1 title','text','.ef-proof-item:nth-child(1) strong'],
      ['proof1Body','Highlight 1 description','textarea','.ef-proof-item:nth-child(1) span'],
      ['proof2Title','Highlight 2 title','text','.ef-proof-item:nth-child(2) strong'],
      ['proof2Body','Highlight 2 description','textarea','.ef-proof-item:nth-child(2) span'],
      ['proof3Title','Highlight 3 title','text','.ef-proof-item:nth-child(3) strong'],
      ['proof3Body','Highlight 3 description','textarea','.ef-proof-item:nth-child(3) span'],
      ['platformKicker','Product section eyebrow','text','#ef-tech-platform .ef-kicker'],
      ['platformTitle','Product section headline','textarea','#ef-tech-platform-title'],
      ['platformIntro','Product section intro','textarea','#ef-tech-platform .ef-section-head p:last-child'],
      ...[1,2,3].flatMap(n => [
        [`platform${n}Tag`,`Product ${n} tag`,'text',`#ef-tech-platform .ef-fit-card:nth-child(${n}) .ef-num`],
        [`platform${n}Title`,`Product ${n} title`,'text',`#ef-tech-platform .ef-fit-card:nth-child(${n}) h3`],
        [`platform${n}Body`,`Product ${n} description`,'textarea',`#ef-tech-platform .ef-fit-card:nth-child(${n}) p`]
      ])
    ]],
    ['Video section', [
      ['interactiveTitle','3D experience title','text','.ef-interactive-title'],
      ['interactiveCopy','3D experience description','textarea','.ef-interactive-copy'],
      ['interactiveButton','3D button label','text','.ef-load-demo'],
      ['interactiveUrl','Hosted 3D viewer URL','url','.ef-load-demo','data-viewer-url'],
      ['interactiveNote','3D experience note','textarea','.ef-interactive-note'],
      ['videosKicker','Small headline','text','#ef-tech-videos .ef-section-head .ef-kicker'],
      ['videosTitle','Section headline','textarea','#ef-tech-videos-title'],
      ['videosIntro','Intro paragraph','textarea','#ef-tech-videos .ef-section-head p:last-child'],
      ['videoNote','Note below video','textarea','.ef-video-note']
    ]],
    ['Event formats', [
      ['formatsKicker','Small headline','text','#ef-tech-formats .ef-section-head .ef-kicker'],
      ['formatsTitle','Section headline','textarea','#ef-tech-formats-title'],
      ['formatsIntro','Intro paragraph','textarea','#ef-tech-formats .ef-section-head p:last-child'],
      ...[1,2,3].flatMap(n => [
        [`format${n}Tag`,`Format ${n} tag`,'text',`#ef-tech-formats .ef-fit-card:nth-child(${n}) .ef-num`],
        [`format${n}Title`,`Format ${n} title`,'text',`#ef-tech-formats .ef-fit-card:nth-child(${n}) h3`],
        [`format${n}Body`,`Format ${n} description`,'textarea',`#ef-tech-formats .ef-fit-card:nth-child(${n}) p`]
      ]),
      ['formatsClose','Closing note','textarea','.ef-fit-close']
    ]],
    ['Hosting and footer', [
      ['hostKicker','Small headline','text','.ef-host .ef-kicker'],
      ['hostTitle','Section headline','textarea','#ef-tech-host-title'],
      ['hostLead','Hosting paragraph','textarea','.ef-host-lead'],
      ['hostButton','Contact button text','text','.ef-host .ef-button','firstText'],
      ['hostButtonUrl','Contact button link','url','.ef-host .ef-button','href'],
      ['hostSmall','Text below button','textarea','.ef-host-small'],
      ['footprintLabel','Footprint label','text','.ef-host-list li:nth-child(1)>strong'],
      ['footprint','Minimum footprint measurement','text','.ef-size'],
      ['footprintDetail','Footprint detail','textarea','.ef-host-list li:nth-child(1)>span','lastText'],
      ['placementLabel','Placement label','text','.ef-host-list li:nth-child(2)>strong'],
      ['placement','Placement detail','textarea','.ef-host-list li:nth-child(2)>span'],
      ['onsiteLabel','On-site label','text','.ef-host-list li:nth-child(3)>strong'],
      ['onsite','On-site detail','textarea','.ef-host-list li:nth-child(3)>span'],
      ['bestMomentLabel','Best moment label','text','.ef-host-list li:nth-child(4)>strong'],
      ['bestMoment','Best moment detail','textarea','.ef-host-list li:nth-child(4)>span'],
      ['footerLeft','Footer line','text','.ef-footer-inner>span:first-child'],
      ['footerSite','Footer site text','text','.ef-footer-inner>span:last-child a:nth-child(1)'],
      ['footerSiteUrl','Footer site URL','url','.ef-footer-inner>span:last-child a:nth-child(1)','href'],
      ['footerEmail','Footer email text','text','.ef-footer-inner>span:last-child a:nth-child(2)'],
      ['footerEmailUrl','Footer email link','url','.ef-footer-inner>span:last-child a:nth-child(2)','href']
    ]],
    ['Images and hero video', [
      ['heroPoster','Hero poster image URL','media','#ef-tech-hero-video','poster'],
      ['heroVideo','Hero video URL','url','#ef-tech-hero-video source','src']
    ]],
    ['Size and colors', [
      ['width','Content width (px)','number','1220'],
      ['sectionPad','Section vertical spacing (px)','number','86'],
      ['heroPad','Hero vertical spacing (px)','number','70'],
      ['headingSize','Main headline maximum (px)','number','68'],
      ['bodySize','Body text (px)','number','17'],
      ['heroRatio','Hero video width ÷ height','number','1.7778'],
      ['night','Host section background','color','#211526'],
      ['deep','Hero and footer background','color','#100d12'],
      ['lime','Accent color','color','#f078ff'],
      ['background','Page background','color','#faf6fb']
    ]]
  ];
  const textDefs = groups.flatMap(g => g[1]).filter(d => !['number','color','media'].includes(d[2]) && !d[0].startsWith('heroVideo'));
  const sizeDefs = groups.at(-1)[1];

  function getDoc() { return new DOMParser().parseFromString(source, 'text/html'); }
  function getClips(doc) {
    const script = doc.querySelector('script');
    const match = script?.textContent.match(/const clips=(\[[\s\S]*?\]);const video=/);
    if (!match) throw new Error('Could not find the five video settings in this HTML file.');
    return JSON.parse(match[1]);
  }
  function getValue(node, mode) {
    if (!node) return '';
    if (mode === 'data-viewer-url') return node.getAttribute(mode) || '';
    if (mode === 'href' || mode === 'src' || mode === 'poster') return node.getAttribute(mode) || '';
    if (mode === 'firstText') return node.firstChild?.textContent.trim() || '';
    if (mode === 'lastText') return node.lastChild?.textContent.trim() || '';
    return node.textContent.trim();
  }
  function setValue(node, mode, value) {
    if (!node) return;
    if (mode === 'data-viewer-url') { node.setAttribute(mode,value); return; }
    if (mode === 'href' || mode === 'src' || mode === 'poster') node.setAttribute(mode, value);
    else if (mode === 'firstText') node.firstChild.textContent = value + ' ';
    else if (mode === 'lastText') node.lastChild.textContent = value;
    else node.textContent = value;
  }
  function field(id, label, type, value, note) {
    const wrapper = document.createElement('label');
    wrapper.className = 'field';
    const title = document.createElement('span');
    title.className = 'field-label';
    title.textContent = label;
    wrapper.append(title);
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type === 'media' ? 'text' : type;
    input.id = id;
    input.value = (type === 'media' || type === 'url') && value.startsWith('data:') ? '' : value;
    if (value.startsWith('data:')) input.placeholder = type === 'media'
      ? 'Original image is embedded. Enter a new URL or choose a file.'
      : 'Original video is embedded. Enter a new video URL.';
    if (type === 'number') { input.min = id === 'heroRatio' ? '.5' : '0'; input.step = id === 'heroRatio' ? '.01' : '1'; }
    input.addEventListener('input', () => { values[id] = input.value; schedule(); });
    wrapper.append(input);
    if (type === 'media') {
      const upload = document.createElement('input');
      upload.type = 'file'; upload.accept = 'image/*'; upload.setAttribute('aria-label',`Choose ${label}`);
      upload.addEventListener('change', () => {
        const file = upload.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { values[id] = reader.result; input.value = ''; input.placeholder = `Selected: ${file.name}`; schedule(); };
        reader.readAsDataURL(file);
      });
      wrapper.append(upload);
    }
    if (note) { const small = document.createElement('small'); small.textContent = note; wrapper.append(small); }
    return wrapper;
  }
  function load(html) {
    source = html;
    const doc = getDoc();
    if (!doc.querySelector('#ef-tech') || !doc.querySelector('style')) throw new Error('This is not the ErgoFlex Divi module HTML.');
    clips = getClips(doc);
    const saved = doc.querySelector('#ef-editor-settings')?.textContent.match(/\/\* settings:(\{.*?\}) \*\//);
    const settings = saved ? JSON.parse(saved[1]) : {};
    fields.replaceChildren();
    for (const [groupName, defs] of groups) {
      const details = document.createElement('details');
      details.open = groupName === 'Navigation and hero';
      const summary = document.createElement('summary'); summary.textContent = groupName; details.append(summary);
      const body = document.createElement('div'); body.className = 'group-body'; details.append(body);
      for (const [id,label,type,selector,mode] of defs) {
        let value;
        if (type === 'number' || type === 'color') value = settings[id] ?? selector;
        else value = getValue(doc.querySelector(selector), mode);
        values[id] = value;
        body.append(field(id,label,type,value));
      }
      fields.append(details);
    }
    const clipGroup = document.createElement('details');
    const clipSummary = document.createElement('summary'); clipSummary.textContent = 'Five video clips'; clipGroup.append(clipSummary);
    const clipBody = document.createElement('div'); clipBody.className = 'group-body'; clipGroup.append(clipBody);
    clips.forEach((clip, i) => {
      for (const [key,label,type] of [['tag','Category','text'],['title','Title','text'],['description','Description','textarea'],['src','Video URL','url'],['poster','Poster image','media']]) {
        const id = `clip${i}_${key}`; values[id] = clip[key];
        clipBody.append(field(id,`Clip ${i+1}: ${label}`,type,clip[key]));
      }
    });
    fields.insertBefore(clipGroup, fields.children[3]);
    schedule();
  }
  function safeUrl(value, fallback) {
    if (!value) return fallback;
    if (/^(https?:|mailto:|#|data:image\/|data:video\/|\/(?!\/))/i.test(value.trim())) return value.trim();
    return fallback;
  }
  function exportHtml(forPreview = false) {
    const doc = getDoc();
    const root = doc.querySelector('#ef-tech');
    for (const [id,,type,selector,mode] of textDefs) {
      const node = doc.querySelector(selector); if (!node) continue;
      let value = values[id];
      if (mode === 'href' || mode === 'src' || mode === 'data-viewer-url') value = safeUrl(value,getValue(node,mode));
      setValue(node,mode,value);
    }
    for (const [id,,type,selector,mode] of groups[5][1]) {
      const node = doc.querySelector(selector); if (!node) continue;
      const value = values[id];
      if (type === 'media' && !value) continue;
      setValue(node,mode,safeUrl(value,getValue(node,mode)));
    }
    const nextClips = clips.map((clip,i) => {
      const next = {...clip};
      for (const key of ['tag','title','description','src','poster']) {
        const v = values[`clip${i}_${key}`];
        next[key] = ['src','poster'].includes(key) ? safeUrl(v || clip[key],clip[key]) : v;
      }
      const button = root.querySelector(`[data-clip="${i}"]`);
      button.querySelector('small').textContent = `${String(i+1).padStart(2,'0')} / ${next.tag}`;
      button.querySelector('strong').textContent = next.title;
      button.querySelector('img').src = next.poster;
      const ns = root.querySelectorAll('noscript li')[i];
      if (ns) { const a = ns.querySelector('a'); a.href = next.src; a.textContent = next.title; }
      return next;
    });
    const first = nextClips[0];
    root.querySelector('#ef-tech-player').poster = first.poster;
    root.querySelector('#ef-tech-player').toggleAttribute('muted',Boolean(first.muted));
    root.querySelector('#ef-tech-player').setAttribute('aria-label',first.title);
    root.querySelector('#ef-tech-title').textContent = first.title;
    root.querySelector('#ef-tech-description').textContent = first.description;
    root.querySelector('#ef-tech-direct').href = first.src;
    root.querySelector('#ef-tech-play').setAttribute('aria-label',`Play ${first.title}`);
    const script = doc.querySelector('script:not([id])');
    script.textContent = script.textContent.replace(/const clips=\[[\s\S]*?\];const video=/,`const clips=${JSON.stringify(nextClips)};const video=`);
    const number = (id,min,max) => Math.min(max,Math.max(min,Number(values[id]) || min));
    const settings = Object.fromEntries(sizeDefs.map(([id]) => [id,values[id]]));
    const override = document.createElement('style'); override.id = 'ef-editor-settings';
    override.textContent = `/* settings:${JSON.stringify(settings)} */\n`+
      `#ef-tech{--night:${values.night};--deep:${values.deep};--lime:${values.lime};background:${values.background};font-size:${number('bodySize',12,30)}px}`+
      `#ef-tech .ef-wrap{max-width:${number('width',500,2000)}px}`+
      `#ef-tech .ef-section{padding-top:${number('sectionPad',0,220)}px;padding-bottom:${number('sectionPad',0,220)}px}`+
      `#ef-tech .ef-hero{padding-top:${number('heroPad',0,220)}px;padding-bottom:${number('heroPad',0,220)}px}`+
      `#ef-tech h1{font-size:clamp(36px,5vw,${number('headingSize',36,120)}px)}`+
      `#ef-tech .ef-hero-figure video{aspect-ratio:${number('heroRatio',.5,3)}}`;
    if (forPreview) {
      for (const [id,,,selector] of textDefs) {
        const node = root.querySelector(selector);
        if (node && !node.hasAttribute('data-ef-field')) node.setAttribute('data-ef-field',id);
      }
      for (const [id,,,selector] of groups[5][1]) root.querySelector(selector)?.setAttribute('data-ef-field',id);
      nextClips.forEach((_,i) => {
        const button = root.querySelector(`[data-clip="${i}"]`);
        button.querySelector('small').setAttribute('data-ef-field',`clip${i}_tag`);
        button.querySelector('strong').setAttribute('data-ef-field',`clip${i}_title`);
        button.querySelector('img').setAttribute('data-ef-field',`clip${i}_poster`);
        button.setAttribute('data-ef-group','Five video clips');
      });
      for (const [selector,id] of [
        ['#ef-tech-player','clip0_src'],['#ef-tech-title','clip0_title'],
        ['#ef-tech-description','clip0_description'],['#ef-tech-direct','clip0_src'],
        ['#ef-tech-play','clip0_src']
      ]) root.querySelector(selector)?.setAttribute('data-ef-field',id);
      for (const [selector,group] of [
        ['.ef-top','Navigation and hero'],['.ef-proof','Highlights'],
        ['#ef-tech-videos','Video section'],['#ef-tech-formats','Event formats'],
        ['#ef-tech-host','Hosting and footer'],['.ef-footer','Hosting and footer'],
        ['.ef-playlist','Five video clips']
      ]) root.querySelector(selector)?.setAttribute('data-ef-group',group);
    }
    return [doc.querySelector('style').outerHTML,override.outerHTML,root.outerHTML,script.outerHTML].join('\n');
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(render,400); }
  function previewClicks() {
    document.addEventListener('click', event => {
      const target = event.target;
      const item = target.closest('[data-ef-field]');
      const section = target.closest('[data-ef-group]');
      if (!item && !section) return;
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage({kind:'ergoflex-select',field:item?.dataset.efField || '',group:section?.dataset.efGroup || ''},'*');
    },true);
  }
  function render() {
    const style = '<style>[data-ef-field],[data-ef-group]{cursor:pointer} [data-ef-field]:hover{outline:3px solid #e0f36b!important;outline-offset:3px} [data-ef-group]:hover:not(:has([data-ef-field]:hover)){outline:2px dashed #007788;outline-offset:-2px}</style>';
    const script = '<scr'+'ipt>('+previewClicks.toString()+')()</scr'+'ipt>';
    preview.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body style="margin:0">${exportHtml(true)}${script}</body></html>`;
  }
  window.addEventListener('message', event => {
    if (event.source !== preview.contentWindow || event.data?.kind !== 'ergoflex-select') return;
    let input = event.data.field ? document.getElementById(event.data.field) : null;
    if (!input && event.data.group) {
      const group = [...fields.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === event.data.group);
      input = group?.querySelector('input,textarea');
    }
    if (!input) return;
    fields.querySelectorAll('details').forEach(d => { d.open = d.contains(input); });
    input.scrollIntoView({behavior:'smooth',block:'center'});
    input.focus({preventScroll:true});
    if (input.type !== 'color' && input.type !== 'file' && input.type !== 'number') input.select();
  });
  function toast(message) { const el = document.querySelector('#status'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'),3500); }
  document.querySelector('#download-button').addEventListener('click', () => {
    const blob = new Blob([exportHtml()],{type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ergoflex-divi-code-module-edited.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    toast('Downloaded. Paste the file contents into your Divi Code module.');
  });
  document.querySelector('#copy-button').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(exportHtml()); toast('Divi code copied. Paste it into your Code module.'); }
    catch { toast('Clipboard unavailable here. Use Download Divi code.'); }
  });
  const fileInput = document.querySelector('#import-file');
  document.querySelector('#import-button').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    try { load(await file.text()); toast('HTML loaded for editing.'); }
    catch (e) { toast(e.message); }
    fileInput.value = '';
  });
  const wrap = document.querySelector('#preview-frame-wrap');
  document.querySelector('#desktop-button').addEventListener('click',e => { wrap.classList.remove('phone'); e.target.classList.add('selected'); document.querySelector('#mobile-button').classList.remove('selected'); });
  document.querySelector('#mobile-button').addEventListener('click',e => { wrap.classList.add('phone'); e.target.classList.add('selected'); document.querySelector('#desktop-button').classList.remove('selected'); });
  try { load(original); } catch(e) { toast(e.message); }
})();
