"""Build the small static 3D viewer bundle for the live LA Tech Week page."""

from pathlib import Path
import shutil
import zipfile


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'divi-editor' / 'site-upload' / 'ergoflex-demo'
FILES = (
    'product-demo.html', 'product-demo.css', 'product-demo.js',
    'studio.js', 'studio.css', 'app-remote.css',
    'catalog.mjs', 'project-io.mjs', 'validation.mjs', 'motion-limits.mjs',
    'workspace-3d.mjs', 'workspace-icons.mjs', 'bir.jpg',
)

OUT.mkdir(parents=True, exist_ok=True)
for name in FILES:
    shutil.copy2(ROOT / name, OUT / name)
for folder in ('assets/app-icons', 'assets/wood', 'assets/trim', 'assets/motion'):
    shutil.copytree(ROOT / folder, OUT / folder, dirs_exist_ok=True)

# The page's only scene is Product. Its 3D model is already hosted at the public
# URL in catalog.mjs, so the large local model and room props are not bundled.
(OUT / '.htaccess').write_text('AddType text/javascript .mjs\n')
(OUT / 'README.txt').write_text(
    'ErgoFlex LA Tech Week 3D viewer\n\n'
    'Extract this ZIP inside wp-content/uploads/2026/promo in your hosting File Manager.\n'
    'It creates the ergoflex-demo subfolder.\n'
    'Then check https://ergoflexdesk.com/wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html\n'
    'The LA Tech Week Divi button must use /wp-content/uploads/2026/promo/ergoflex-demo/product-demo.html\n'
    'for its Hosted 3D viewer URL.\n\n'
    'The base model is fetched from the existing public Store/model/full.glb URL.\n'
    'The trim and Extended desktop GLBs are included in assets/trim.\n'
    'The animated touchscreen and LED GLBs are included in assets/motion.\n'
    'The player lets viewers switch between Standard 48-inch and Extended 60-inch\n'
    'desktops, with red trim and the updated birch finish.\n'
    'The shared Studio code also includes live grain visibility and sheen controls.\n'
    'This bundle bakes the Studio tilt group with 32 moving parts.\n'
    'The app keeps its wide layout on mobile and fits the full panel to the screen.\n'
    'View larger opens full-size controls with horizontal scrolling.\n'
    'Lift and tilt default to Fast. The clearance envelope limits tilt at low heights.\n'
    'If the Studio tilt rig changes again, rebuild this bundle and upload again.\n'
)

archive = OUT.parent / 'ergoflex-demo-wide-app-fit-upload.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in OUT.rglob('*'):
        if path.is_file():
            z.write(path, path.relative_to(OUT.parent))
print(f'Built {archive} ({archive.stat().st_size:,} bytes)')

# For an existing installation, extract this archive *inside* ergoflex-demo.
# Include every changed runtime file and trim asset: a three-file layout-only
# update would leave the size toggle without its matching geometry.
flat_update = OUT.parent / 'ergoflex-demo-current-update.zip'
with zipfile.ZipFile(flat_update, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in OUT.rglob('*'):
        if path.is_file():
            z.write(path, path.relative_to(OUT))
print(f'Built {flat_update} ({flat_update.stat().st_size:,} bytes)')
