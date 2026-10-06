"""Package source-grounded Flutter visualization handoff without changing the app."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
APP = Path('/home/ergo/ErgoFlex_Desk_Stack/Polish-Features/ergoflex_app')
NATIVE = APP.parent
OUT = ROOT / 'docs/flutter-visualizer-handoff-20261006'
RELEASE = 'desktop-tilt-reach-20261006'
SITE = ROOT / 'divi-editor/site-upload/ergoflex-explore-3d-tilt-lighting-20261006.zip'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n')

def head(root):
    return subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()

OUT.mkdir(parents=True, exist_ok=True)
reference = OUT / 'browser-reference'
with zipfile.ZipFile(SITE) as z:
    assert z.testzip() is None
    build = json.loads(z.read('BUILD.json'))
    assert build['release'] == RELEASE
    for name, digest in build['files'].items():
        assert hashlib.sha256(z.read(name)).hexdigest() == digest, name
    z.extractall(reference)
shutil.copy2(ROOT / 'package.json', reference / 'package.json')
for test in sorted((ROOT / 'tests').glob('led-*-test.*')):
    target = reference / 'tests' / test.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(test, target)
fixtures = reference / 'tests/fixtures'
fixtures.mkdir(parents=True, exist_ok=True)
shutil.copy2(ROOT / 'tests/fixtures/led-movement-reference-v1.json', fixtures)

native_files = [
    'desk_viewer/desk-viewer.js', 'desk_viewer/led/led-pixel-renderer.mjs',
    'desk_viewer/led/led-strip-map.mjs', 'desk_viewer/led/led-showcase-effects.mjs',
    'desk_viewer/led/led-movement.mjs', 'desk_viewer/motion-limits.mjs',
    'lib/widgets/desk_model_view.dart',
    'lib/services/desk_viewer/desk_led_message.dart',
    'lib/services/desk_viewer/desk_pose.dart',
    'lib/services/desk_viewer/desk_viewer_transport.dart',
    'lib/services/desk_viewer/webview_desk_viewer_transport.dart',
    'lib/services/desk_viewer/desk_viewer_asset_server.dart',
    'test/services/desk_viewer/desk_led_test.dart',
]
native_records = []
for name in native_files:
    source = APP / name
    target = OUT / 'native-source' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    native_records.append({'source': str(source), 'snapshot': str(target.relative_to(OUT)), 'sha256': sha(source)})
# Pure rendering authorities for the follow-up engineering questions. These are
# reference snapshots, not a standalone firmware build or a JavaScript port.
for name in [
    'src/EffectEngine.h', 'src/PaletteEngine.h', 'src/palette/UserPalette.hpp',
    'src/state/MusicConfig.hpp', 'src/ambient/Ambient.hpp', 'src/ambient/AmbientDiag.hpp',
]:
    source = NATIVE / 'Firmware/ergoled_firmware' / name
    target = OUT / 'native-source/Firmware/ergoled_firmware' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    native_records.append({'source': str(source), 'snapshot': str(target.relative_to(OUT)), 'sha256': sha(source)})
config = NATIVE / 'Firmware/ergoled_firmware/src/config.h'
lines = config.read_text().splitlines()
selected = [i for i, line in enumerate(lines, 1) if any(key in line for key in [
    'BTF-LIGHTING FCOB', '71.42mm', '#define NUM_SEGMENTS', '#define LEDS_PER_PIXEL',
    'const uint8_t STRIP_PINS', 'const uint16_t STRIP_LENGTHS',
    'verified wire order', '#define RGBW_ARG_INDEX_'])]
hardware = '\n'.join(f'{i}: {lines[i-1]}' for i in selected) + '\n'
(OUT / 'native-source/hardware-led-reference.txt').write_text(
    'Selected LED identity and addressing excerpts from reviewed local config.h\n'
    f'Source SHA-256: {sha(config)}\n' + hardware)

evidence = OUT / 'evidence'
evidence.mkdir(exist_ok=True)
for size in ['48x30', '60x30']:
    for tilt in [-5, 0, 15]:
        source = Path(f'/tmp/led-tilt-{size}-{tilt}.png')
        target = evidence / f'tilt-{size}-{tilt}.png'
        if source.exists():
            shutil.copy2(source, target)
        else:
            assert target.exists(), f'Missing preserved comparison image: {target}'
owner_images = {
    'owner-minus5.png': 'Screenshot from 2026-10-06 13-13-07.png',
    'owner-level-before-polish.png': 'Screenshot from 2026-10-06 13-13-30.png',
    'owner-studio-surfaces.png': 'Screenshot from 2026-10-06 13-17-55.png',
    'owner-reggae-bands.png': 'Screenshot from 2026-10-05 17-01-00.png',
}
for name, original in owner_images.items():
    shutil.copy2(Path('/home/ergo/Pictures/Screenshots') / original, evidence / name)

defaults_match = re.search(r'const LED_SURFACE_DEFAULTS = Object.freeze\(\{(.*?)\}\);', (reference / 'studio.js').read_text(), re.S)
defaults = {key: float(value) if '.' in value else int(value) for key, value in re.findall(r'(\w+):\s*([\d.]+)', defaults_match[1])}
strip_names = ['Top Shelf Top', 'Top Shelf Bottom Back', 'Top Shelf Bottom Front', 'Second Shelf', 'Desk Top Center', 'Desktop Left', 'Desktop Right', 'Foot Rest']
counts = [14, 14, 15, 14, 14, 11, 11, 13]
contract = {
    'schemaVersion': 1, 'referenceRelease': RELEASE,
    'purpose': 'Rendering parity contract; no hardware command API',
    'hardwareReference': {'profile': 'Desk 02', 'stripType': 'BTF-LIGHTING FCOB WS2814', 'voltage': 24, 'channels': ['r','g','b','w'], 'physicalLedsPerCluster':56, 'clusterPitchMm':71.42, 'freshHardwareVerification':False, 'sizeSpecificCountsVerified':False},
    'strips': [dict(id=i, name=strip_names[i], count=counts[i], gpio=[27,2,33,12,5,25,4,15][i], mesh=[40,41,42,39,2,1,0,38][i], axis='x' if i in [5,6] else 'z', rig='base' if i==7 else 'tilt' if i>=4 else 'lift', reverse=i in [0,1,2,3,7], visibleAddresses=None, verified=False) for i in range(8)],
    'defaults': defaults,
    'brightness': {'uiFullGlow':123.25, 'demoInitialFraction':.75, 'stripPowerFactor':3.6, 'receiverStrengthDivisor':10000, 'units':'appearance gain, not hardware power'},
    'desktopBands': [{'sourceId':3,'centerX':-171,'width':.85,'gain':1}, {'sourceId':2,'centerX':-164,'width':1,'gain':.8}, {'sourceId':1,'centerX':-157,'width':1.15,'gain':.65}],
    'desktopTilt': {'input':'physical degrees', 'rearAnchorX':-177.3, 'segments':[{'minDeg':-5,'maxDeg':0,'scaleIncrement':.25},{'minDeg':0,'maxDeg':15,'scaleIncrement':.6}], 'baseScale':1, 'maximumScale':1.85, 'curve':'smoothstep', 'photometricCalibration':False},
    'receivers': {'desktop':[3,2,1], 'powerModules':[3,2,1], 'lowerShelf':[1,2], 'topShelf':[0], 'baseShelf':[7], 'floor':[7], 'leftWingOuter':[5], 'rightWingOuter':[6], 'wingInner':[4], 'crossbar':[4], 'cage':[4], 'actuators':[4], 'legs':[4,5,6], 'uprightCompartments':[3,1,0]},
    'encoding': {'logicalOrder':['r','g','b','w'], 'displayWhiteMix':'min(255, RGB+W)', 'normalInput':'srgb-display-byte-approximation', 'gameInput':'raw-linear-rgbw-drive', 'gameUploadLinear':True, 'atlasFilter':'nearest', 'localNeighborhoodSamples':3},
    'priority':['diagnostic','movement/completion','game','music/autoDJ','saved-look','decorative','base'],
    'musicEffects':[28,29,30,31,32,33,37,38,39,40],
    'musicBandEdgesHz':[20,60,150,400,1000,2500,5000,10000,20000],
    'game': json.loads((reference / 'assets/led/game/manifest.json').read_text()),
    'integrationStatus':'proposed Flutter port; app unchanged',
}
write_json('VISUALIZER_CONTRACT.json', contract)
write_json('TEST_EVIDENCE.json', {
    'date':'2026-10-06', 'testedRelease':RELEASE,
    'completed':[
        {'test':'led-tilt-reflection-test.cjs','scope':'Source and unpacked canonical website ZIP','result':'passed'},
        {'test':'led-pixels-test.cjs','scope':'Custom Shop source viewer','result':'passed'},
        *[{'test':name,'scope':'Delivered browser-reference directory','result':'passed'} for name in [
            'led-game-horizontal-test.mjs','led-auto-dj-test.mjs',
            'led-music-effects-test.mjs','led-custom-presets-test.mjs',
        ]],
    ],
    'isolatedGpuFrontRedSamples': {'48x30':{'-5':1,'0':43,'5':101,'15':167,'65':167},'60x30':{'-5':0,'0':8,'5':44,'15':147,'65':147}},
    'sampleUnits':'framebuffer byte values, not physical light percentages or lux',
    'flutterPortTested':False, 'freshPhysicalMappingTested':False,
    'foldMicrophone':'owner confirmed lights respond during previous Fold 5 test',
})
symbols = {
    'browser-reference/studio.js':['LED_SURFACE_DEFAULTS','updateLedEffectFrame','bindLedPixels','setLedsEnabled','updateDesktopReflectionTilt','addLedSurfaceSpill','addLedWingSpill','addLedUprightSpill','addFootLedFloorGlow','loadLedOverlay','syncLedSizeGeometry','applyTiltConfig','createStudioEnvironment','applyRoomLighting','applySurfaceFinish'],
    'browser-reference/led-pixel-renderer.mjs':['LedPixelRenderer','upload','bindStrip','bindSpill','bindReflectionBands'],
    'browser-reference/led-showcase-effects.mjs':['DECORATIVE_EFFECTS','MUSIC_EFFECTS','MusicSampler','analyseMusic'],
    'browser-reference/led-music-mode.mjs':['LedMusicMode','useLiveAudio','renderRecipe','sample','startDJ'],
    'browser-reference/led-auto-dj.mjs':['DJ_PROGRAMS','normalizeDJSettings','AutoDJ','stripEffects','tick'],
    'browser-reference/led-dj-overlay.mjs':['DJOverlay','prepare','paint'],
    'browser-reference/led-custom-presets.mjs':['normalizeCustomLook','normalizeCustomPalette','sampleCustomPalette','CustomLookSampler'],
    'browser-reference/led-game-frames.mjs':['validateGameManifest','sampleGameBank'],
    'browser-reference/led-game-mode.mjs':['LedGameMode','selectVariant','sample','syncMonitor'],
    'native-source/desk_viewer/desk-viewer.js':['applyPose','setupGlow','patchSurfaceForGlow','updateGlowUniforms','updateLeds','setLedLook','tick','receive'],
}
index = []
for name, names in symbols.items():
    source_lines = (OUT / name).read_text().splitlines()
    for symbol in names:
        patterns = [rf'\bfunction {re.escape(symbol)}\s*\(', rf'\bclass {re.escape(symbol)}\b', rf'\bconst {re.escape(symbol)}\b', rf'^\s*(?:async\s+)?{re.escape(symbol)}\s*\(']
        hits = [i for i, line in enumerate(source_lines,1) if any(re.search(pattern,line) for pattern in patterns)]
        assert hits, (name,symbol)
        index.append({'file':name,'symbol':symbol,'line':hits[0]})
write_json('SOURCE_INDEX.json', index)
(OUT / 'README.txt').write_text(
    'ErgoFlex Flutter visualizer lighting handoff - 6 October 2026\n\n'
    'Read HANDOFF.md first. VISUALIZER_CONTRACT.json contains exact tuning.\n'
    'browser-reference is the verified latest website reference plus tests.\n'
    'native-source is an inspected snapshot, not a modified Flutter app.\n'
    'SOURCE_INDEX.json locates code; MANIFEST.json hashes the delivered files.\n'
    'Serve browser-reference over HTTP and open product-demo.html. Its Three.js\n'
    'CDN import map needs internet; use bundled modules in the production app.\n'
)
write_json('MANIFEST.json', {
    'date':'2026-10-06', 'release':RELEASE,
    'browserGitHead':head(ROOT), 'nativeGitHead':head(NATIVE),
    'workingTreeSnapshots':True,
    'websiteZip':{'name':SITE.name,'sha256':sha(SITE)},
    'nativeReviewedFiles':native_records,
    'hardwareSource':{'file':str(config),'sha256':sha(config),'included':'selected identity/addressing excerpts only'},
    'files':{str(p.relative_to(OUT)):sha(p) for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='MANIFEST.json'},
})
archive = OUT.parent / 'ergoflex-flutter-visualizer-handoff-20261006.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file(): z.write(p,p.relative_to(OUT.parent))
print(f'Built {archive} ({archive.stat().st_size:,} bytes)')
print(f'Handoff: {OUT / "HANDOFF.md"}')
