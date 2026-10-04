from pathlib import Path
folder=Path(__file__).resolve().parent
root=folder.parent
html=(root/'index.html').read_text()
html=html.replace('</head>','<link rel="stylesheet" href="./product-demo.css"></head>')
html=html.replace('</body>','<script src="./product-demo.js"></script></body>')
(root/'product-demo.html').write_text(html)
p=folder/'tech-week-divi-code-module.html'
s=p.read_text()
assert 'ef-interactive' not in s
block='''<div class="ef-interactive" style="margin:0 0 36px;padding:20px;border:1px solid var(--line);border-radius:12px;background:#fff"><h3 class="ef-interactive-title">Take ErgoFlex for a spin.</h3><p class="ef-interactive-copy">Explore the workstation in 3D. Adjust the height and tilt, try its movement, and choose a backdrop.</p><button type="button" class="ef-button ef-button-primary ef-load-demo" data-viewer-url="/product-demo.html" style="border:0;cursor:pointer;margin-top:12px">Explore in 3D</button><iframe class="ef-product-frame" title="Interactive ErgoFlex workstation" hidden style="width:100%;height:700px;border:0;margin-top:12px" loading="lazy" allow="fullscreen; xr-spatial-tracking"></iframe><p class="ef-interactive-note" style="font-size:13px;color:var(--muted);margin-top:12px">A 3D preview of the workstation. Watch the videos below to see the real desk in action.</p></div>'''
s=s.replace('<div class="ef-video-grid">',block+'<div class="ef-video-grid">',1)
needle="if(!root)return;"
logic="""const demoButton=root.querySelector('.ef-load-demo');if(demoButton)demoButton.addEventListener('click',()=>{const frame=root.querySelector('.ef-product-frame');let url=demoButton.dataset.viewerUrl;if(location.protocol==='file:'&&url.startsWith('/'))url='http://127.0.0.1:3000'+url;frame.src=url;frame.hidden=false;demoButton.hidden=true;});"""
s=s.replace(needle,needle+logic,1)
p.write_text(s)
