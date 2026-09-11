import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PRODUCT_CONFIG, defaultConfig, money, configurationPrice, priceBreakdown, validConfig, cleanConfig,
         WOOD_SPECIES, woodSpecies, SURFACE_TREATMENTS,
         ACCESSORIES, PRESETS, accessory, accessoryFits, incompatibleAccessories } from './catalog.mjs';
import { PROJECT_FORMAT_VERSION, validateProjectFile, hardProblems, softProblems } from './project-io.mjs';
import { validateBuild, blockingFindings, validationCacheKey } from './validation.mjs';
import { WorkspaceAccessories, WorkspaceRoom, ROOM_SCENES, ROOM_ATMOSPHERES, PROP_LIBRARY } from './workspace-3d.mjs';
import { accessoryIllustration } from './workspace-icons.mjs';

// Configuration

const STARTING_POS = { x: 4.8, y: 3.4, z: 4.2 };
const STARTING_TARGET = { x: -0.1, y: 0.9, z: 0.0 };

const TELESCOPING_PARTS = [
    "Lift_Column_Center_1",
    "Lift_Column_Center"
];

// Specific World Coordinate Overrides for parts at 28" Height (LIFT_MIN)
const PART_BAKE_DATA = {
    "Lift_Column_Center": {
        "position": { "x": 6.283983309254151, "y": -0.7430694811477421, "z": 12.6278441313198 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 0.03859392694789662, "y": 0.03859392694789662, "z": 0.03859392694789662 }
    },
    "Lift_Column_Center_1": {
        "position": { "x": 6.283983309254151, "y": -0.7430694811477421, "z": 12.6278441313198 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 0.03859392694789662, "y": 0.03859392694789662, "z": 0.03859392694789662 }
    }
};

const INITIAL_ANIMATED_PARTS = [
    "Power", "Power_1", "Power_2", "Desktop", "Desktop_1", "Desktop_2", "Desktop_3", "Power_3", "Power_4", "Power_5", "Power_6", "Power_7", "Lift_Column_Top", "Lift_Column_Top_1", "Lift_Column_Top_2", "Lift_Column_Top_3", "Lift_Column_Top_4", "Lift_Column_Top_5", "Lift_Column_Top_6", "Lift_Column_Top_7", "Lift_Column_Top_8", "Lift_Column_Top_9", "Lift_Column_Top_10", "Lift_Column_Top_11", "Lift_Column_Top_12", "Lift_Column_Top_13", "Lift_Column_Top_14", "Lift_Column_Top_15", "L_A_Hardware_Top", "L_A_Hardware_Top_1", "L_A_Hardware_Top_2", "L_A_Hardware_Top_3", "Linear_Actuators", "Linear_Actuators_1", "Linear_Actuators_2", "Linear_Actuators_3", "Linear_Actuators_4", "Linear_Actuators_5", "Linear_Actuators_6", "Linear_Actuators_7", "Linear_Actuators_8", "Linear_Actuators_9", "Lift_Column_Top_16", "Lift_Column_Top_17", "L_A_Hardware_Top_4", "L_A_Hardware_Top_5", "L_A_Hardware_Top_6", "L_A_Hardware_Top_7", "Leds", "Leds_1", "Leds_2", "Revolve2", "Plates_Hardware", "Plates_Hardware_1", "Plates_Hardware_2", "Plates_Hardware_3", "Plates_Hardware_4", "Plates_Hardware_5", "Plates_Hardware_6", "Plates_Hardware_7", "Plates_Hardware_8", "Plates_Hardware_9", "Plates_Hardware_10", "Plates_Hardware_11", "Plates_Hardware_12", "Plates_Hardware_13", "Plates_Hardware_14", "Plates_Hardware_15", "Plates_Hardware_16", "Plates_Hardware_17", "Plates_Hardware_18", "Plates_Hardware_19", "Plates_Hardware_20", "Plates_Hardware_21", "Plates_Hardware_22", "Plates_Hardware_23", "Plates_Hardware_24", "Plates_Hardware_25", "Plates_Hardware_26", "Plates_Hardware_27", "Plates_Hardware_28", "Plates_Hardware_29", "Plates_Hardware_30", "Plates_Hardware_31", "Plates_Hardware_32", "Plates_Hardware_33", "Plates_Hardware_34", "Plates_Hardware_35", "Plates_Hardware_36", "Plates_Hardware_37", "Plates_Hardware_38", "Plates_Hardware_39", "Plates_Hardware_40", "Plates_Hardware_41", "Plates_Hardware_42", "Plates_Hardware_43", "Plates_Hardware_44", "Plates_Hardware_45", "Plates_Hardware_46", "Plates_Hardware_47", "Plates_Hardware_48", "Plates_Hardware_49", "Plates_Hardware_50", "Plates_Hardware_51", "Plates_Hardware_52", "Plates_Hardware_53", "Plates_Hardware_54", "Plates_Hardware_55", "Plates_Hardware_56", "Plates_Hardware_57", "Plates_Hardware_58", "Plates_Hardware_59", "Plates_Hardware_60", "Plates_Hardware_61", "Plates_Hardware_62", "Plates_Hardware_63", "Plates_Hardware_64", "Plates_Hardware_65", "Plates_Hardware_66", "Plates_Hardware_67", "Plates_Hardware_68", "Plates_Hardware_69", "Plates_Hardware_70", "Plates_Hardware_71", "Plates_Hardware_72", "Plates_Hardware_73", "Plates_Hardware_74", "Plates_Hardware_75", "Plates_Hardware_76", "Plates_Hardware_77", "Plates_Hardware_78", "Plates_Hardware_79", "Plates_Hardware_80", "Plates_Hardware_81", "Plates_Hardware_82", "Plates_Hardware_83", "Plates_Hardware_84", "Plates_Hardware_85", "Plates_Hardware_86", "Plates_Hardware_87", "Plates_Hardware_88", "Plates_Hardware_89", "Plates_Hardware_90", "Plates_Hardware_91", "Plates_Hardware_92", "Plates_Hardware_93", "Plates_Hardware_94", "Plates_Hardware_95", "Plates_Hardware_96", "Plates_Hardware_97", "Plates_Hardware_98", "Plates_Hardware_99", "Plates_Hardware_100", "Plates_Hardware_101", "Plates_Hardware_102", "Plates_Hardware_103", "Plates_Hardware_104", "Plates_Hardware_105", "Plates_Hardware_106", "Plates_Hardware_107", "Plates_Hardware_108", "Plates_Hardware_109", "Plates_Hardware_110", "Plates_Hardware_111", "Plates_Hardware_112", "Plates_Hardware_113", "Plates_Hardware_114", "Plates_Hardware_115", "Plates_Hardware_116", "Plates_Hardware_117", "Plates_Hardware_118", "Plates_Hardware_119", "Plates_Hardware_120", "Plates_Hardware_121", "Plates_Hardware_122", "Plates_Hardware_123", "Plates_Hardware_124", "Plates_Hardware_125", "Plates_Hardware_126", "Plates_Hardware_127", "Plates_Hardware_128", "Plates_Hardware_129", "Plates_Hardware_130", "Plates_Hardware_131", "Plates_Hardware_132", "Plates_Hardware_133", "Plates_Hardware_134", "Plates_Hardware_135", "Plates_Hardware_136", "Plates_Hardware_137", "Plates_Hardware_138", "Plates_Hardware_139", "Plates_Hardware_140", "Plates_Hardware_141", "Plates_Hardware_142", "Plates_Hardware_143", "Plates_Hardware_144", "Plates_Hardware_145", "Plates_Hardware_146", "Plates_Hardware_147", "Plates_Hardware_148", "Plates_Hardware_149", "Plates_Hardware_150", "Plates_Hardware_151", "Plates_Hardware_152", "Plates_Hardware_153", "Plates_Hardware_154", "Plates_Hardware_155", "Plates_Hardware_156", "Plates_Hardware_157", "Plates_Hardware_158", "Plates_Hardware_159", "Plates_Hardware_160", "Plates_Hardware_161", "Plates_Hardware_162", "Plates_Hardware_163", "Plates_Hardware_164", "Plates_Hardware_165", "Plates_Hardware_166", "Plates_Hardware_167", "Plates_Hardware_168", "Plates_Hardware_169", "Plates_Hardware_170", "Plates_Hardware_171", "Plates_Hardware_172", "Plates_Hardware_173", "Plates_Hardware_174", "Plates_Hardware_175", "Plates_Hardware_176", "Plates_Hardware_177", "Plates_Hardware_178", "Plates_Hardware_179", "Plates_Hardware_180", "Plates_Hardware_181", "Plates_Hardware_182", "Plates_Hardware_183", "Plates_Hardware_184", "Plates_Hardware_185", "Plates_Hardware_186", "Plates_Hardware_187", "Plates_Hardware_188", "Plates_Hardware_189", "Plates_Hardware_190", "Plates_Hardware_191", "Plates_Hardware_192", "Plates_Hardware_193", "Plates_Hardware_194", "Plates_Hardware_195", "Plates_Hardware_196", "Plates_Hardware_197", "Plates_Hardware_198", "Plates_Hardware_199", "Plates_Hardware_200", "Combine1", "Revolve2_1", "Combine1_1", "mesh_471", "mesh_472", "mesh_473", "mesh_474", "mesh_475", "mesh_476", "mesh_477", "Leds_3", "Combine1_2", "Revolve2_2", "mesh_481", "mesh_482", "mesh_483", "mesh_484", "Combine1_3", "Revolve2_3", "mesh_487", "mesh_488", "mesh_489", "mesh_490", "Plates_Hardware_201", "Plates_Hardware_202", "Plates_Hardware_203", "Plates_Hardware_204", "Plates_Hardware_205", "Plates_Hardware_206", "Plates_Hardware_207", "Plates_Hardware_208", "Plates_Hardware_209", "Plates_Hardware_210", "Plates_Hardware_211", "Plates_Hardware_212", "Plates_Hardware_213", "Plates_Hardware_214", "Plates_Hardware_215", "Plates_Hardware_216", "Plates_Hardware_217", "Plates_Hardware_218", "Plates_Hardware_219", "Plates_Hardware_220", "Plates_Hardware_221", "Plates_Hardware_222", "Plates_Hardware_223", "Plates_Hardware_224", "Plates_Hardware_225", "Plates_Hardware_226", "Plates_Hardware_227", "Plates_Hardware_228", "Plates_Hardware_229", "Plates_Hardware_230", "Plates_Hardware_231", "Plates_Hardware_232", "Plates_Hardware_233", "Plates_Hardware_234", "Plates_Hardware_235", "Plates_Hardware_236", "Plates_Hardware_237", "Plates_Hardware_238", "Plates_Hardware_239", "Plates_Hardware_240", "Plates_Hardware_241", "Plates_Hardware_242", "Plates_Hardware_243", "Plates_Hardware_244", "Plates_Hardware_245", "Plates_Hardware_246", "Plates_Hardware_247", "Plates_Hardware_248", "Plates_Hardware_249", "Plates_Hardware_250", "Plates_Hardware_251", "Plates_Hardware_252", "Plates_Hardware_253", "Plates_Hardware_254", "Plates_Hardware_255", "Plates_Hardware_256", "Plates_Hardware_257", "Plates_Hardware_258", "Plates_Hardware_259", "Plates_Hardware_260", "Plates_Hardware_261", "Plates_Hardware_262", "Plates_Hardware_263", "Plates_Hardware_264", "Plates_Hardware_265", "Plates_Hardware_266", "Plates_Hardware_267", "Plates_Hardware_268", "Plates_Hardware_269", "Plates_Hardware_270", "Plates_Hardware_271", "Plates_Hardware_272", "Plates_Hardware_273", "Plates_Hardware_274", "Plates_Hardware_275", "Plates_Hardware_276", "Plates_Hardware_277", "Plates_Hardware_278", "Plates_Hardware_279", "Plates_Hardware_280", "Plates_Hardware_281", "Plates_Hardware_282", "Plates_Hardware_283", "Plates_Hardware_284", "Plates_Hardware_285", "Plates_Hardware_286", "Plates_Hardware_287", "Plates_Hardware_288", "Plates_Hardware_289", "Plates_Hardware_290", "Plates_Hardware_291", "Touch_Screen", "Touch_Screen_1", "Touch_Screen_2", "Touch_Screen_3", "mesh_624", "mesh_625", "mesh_626", "Leds_4", "Leds_5", "Leds_6", "Leds_7", "Leds_8", "Leds_9", "Leds_10", "Leds_11", "Leds_12", "Leds_13", "Leds_14", "Leds_15", "Leds_16", "Leds_17", "Leds_18", "Leds_19", "Leds_20", "Leds_21", "Leds_22", "Leds_23", "Leds_24", "Leds_25", "Leds_26", "Leds_27", "Leds_28", "Leds_29", "Leds_30", "Leds_31", "Leds_32", "Leds_33", "Leds_34", "Leds_35", "Leds_36", "Leds_37", "Leds_38", "Joinery_6", "Joinery_7", "Joinery_8", "Joinery_9", "Joinery_10", "Joinery_11", "Joinery_12", "Joinery_13", "Joinery_14", "Joinery_15", "Joinery_16", "Joinery_17", "Joinery_18", "Plates_Hardware_292", "Plates_Hardware_293", "Plates_Hardware_294", "Plates_Hardware_295", "mesh_679", "mesh_680", "mesh_681", "mesh_682", "Touch_Screen_4", "Touch_Screen_5", "Touch_Screen_6", "Touch_Screen_7", "Leds_40", "Leds_41", "Leds_42", "Leds_43", "mesh_692", "Screws_24", "Screws_25", "Screws_26", "Screws_27", "Screws_28", "Screws_29", "Screws_30", "Screws_31", "Screws_32", "Screws_33", "Screws_34", "Screws_35", "Screws_36", "Screws_37", "Screws_38", "Screws_39", "Screws_40", "Screws_41", "Screws_42", "Screws_43", "Screws_44", "Screws_45", "Screws_46", "Screws_47", "Screws_48", "Screws_49", "Screws_50", "Screws_51", "Screws_52", "Screws_53", "Screws_54", "Screws_55", "Screws_56", "Screws_57", "Screws_58", "Screws_59", "Screws_60", "Screws_61", "Screws_62", "Screws_63", "Screws_64", "Screws_65", "Screws_66", "Screws_67", "Screws_68", "Screws_69", "Screws_70", "Screws_71", "Screws_72", "Screws_73", "Screws_74", "Screws_75", "Screws_76", "Screws_77", "Screws_78", "Screws_79", "Screws_80", "Screws_81", "Screws_82", "Screws_83", "Screws_84", "Screws_85", "Screws_86", "Screws_87", "Screws_88", "Screws_89", "Screws_90", "Screws_91", "Screws_92", "Screws_93", "Screws_94", "Screws_95", "Screws_96", "Screws_97", "Screws_98", "Screws_99", "Screws_100", "Screws_101", "Screws_102", "Screws_103", "Screws_104", "Screws_105", "Screws_106", "Screws_107", "Screws_108", "Screws_109", "Screws_110", "Screws_111", "Screws_112", "Screws_113", "Screws_114", "Screws_115", "Screws_116", "Screws_117", "Screws_118", "Screws_119", "Screws_120", "Screws_121", "Screws_122", "Screws_123", "Screws_124", "Screws_125", "Screws_126", "Screws_127", "Top_Shelf", "Top_Shelf_1", "Top_Shelf_2", "Top_Shelf_3", "Top_Shelf_4"
];

let currentConfig = defaultConfig();
let cartItems = [];
// V2 keys: the configuration gained an accessories list. V1 keys are still read
// once, as a migration, and never written again.
const SAVED_BUILD_KEY = 'ergoflexSavedBuildV2';
const CART_KEY = 'ergoflexCartV2';
let cartIdCounter = 0;
const nextCartId = () => `item-${Date.now()}-${cartIdCounter++}`;

// Constants for mathematically mapping 3D space to physical inches
const LIFT_MIN = -19.25;
const LIFT_MAX = 6.53;
const HEIGHT_MIN = 28.0;
const HEIGHT_MAX = 52.5;

// Telescoping ratio: how much center columns move relative to full lift
const TELESCOPING_RATIO = 0.5;

// Animation & Selection Variables
let isStanding = false;
let currentLift = LIFT_MIN;
let targetLift = LIFT_MIN;
let manualLiftOverride = false;
let movingObjects = []; // Editor selection; independent of lift membership.
const liftObjects = new Map();
let telescopingObjects = [];
let interactableObjects = [];
let boxHelpers = new Map();
let isSelectionMode = false;

// Phase 2.0: Stable Editor IDs + Part Registry
let editorIdCounter = 0;
const partRegistry = new Map(); // editorId -> { obj, name, editorId, isClone }
const sceneAssetRegistry = new Map(); // editorId -> one whole room/desk-dressing prop
const sceneAssetStates = new Map();   // room id -> removed defaults, additions and local transforms
let sceneAssetCounter = 0;
let sceneAssetHydrationToken = 0;
const SCENE_ASSET_STATE_KEY = 'ergoflex.sceneAssets.v1';

function editorEntry(editorId) {
    return partRegistry.get(editorId) || sceneAssetRegistry.get(editorId);
}

function sceneAssetState(sceneId = selectedRoomScene) {
    if (!sceneAssetStates.has(sceneId)) {
        sceneAssetStates.set(sceneId, { removed: new Set(), added: new Map(), transforms: new Map() });
    }
    return sceneAssetStates.get(sceneId);
}

function plainLocalTransform(obj) {
    return {
        p: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        q: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
        s: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    };
}

function applyPlainLocalTransform(obj, transform) {
    if (!transform) return;
    obj.position.set(transform.p.x, transform.p.y, transform.p.z);
    obj.quaternion.set(transform.q.x, transform.q.y, transform.q.z, transform.q.w);
    obj.scale.set(transform.s.x, transform.s.y, transform.s.z);
    obj.updateMatrixWorld(true);
}

function serializeSceneAssetStates() {
    captureActiveSceneAssetTransforms();
    return Object.fromEntries([...sceneAssetStates].map(([sceneId, state]) => [sceneId, {
        removed: [...state.removed],
        added: [...state.added.values()],
        transforms: Object.fromEntries(state.transforms)
    }]));
}

function restoreSceneAssetStates(value) {
    sceneAssetStates.clear();
    if (!value || typeof value !== 'object') return;
    for (const [sceneId, saved] of Object.entries(value)) {
        const state = sceneAssetState(sceneId);
        for (const id of saved.removed || []) state.removed.add(id);
        for (const addition of saved.added || []) {
            if (addition?.editorId && addition?.propId) state.added.set(addition.editorId, addition);
        }
        for (const [id, transform] of Object.entries(saved.transforms || {})) state.transforms.set(id, transform);
    }
}

function persistSceneAssetStates() {
    try { localStorage.setItem(SCENE_ASSET_STATE_KEY, JSON.stringify(serializeSceneAssetStates())); } catch (_) {}
}

try { restoreSceneAssetStates(JSON.parse(localStorage.getItem(SCENE_ASSET_STATE_KEY) || '{}')); } catch (_) {}

// --- Custom part names ---------------------------------------------------------
// editorId is immutable — baked tilt configs, actuator rigs and saved groups all key
// off it, and obj.name is what the loader's TELESCOPING_PARTS / INITIAL_ANIMATED_PARTS
// lookups match on. So a "rename" stores a display label alongside, and every export
// carries editorId + model name + label so a renamed part is still unambiguous.
const partLabels = new Map(); // editorId -> custom label
let lastSelectedEditorId = null;

function partLabel(eid) {
    if (!eid) return '';
    return partLabels.get(eid) || editorEntry(eid)?.name || eid;
}

function objLabel(obj) {
    return obj ? partLabel(obj.userData?.editorId) : '';
}

function persistPartLabels() {
    try { localStorage.setItem('ergoflexPartLabels', JSON.stringify([...partLabels])); } catch (e) {}
}

function restorePartLabels() {
    try {
        const saved = JSON.parse(localStorage.getItem('ergoflexPartLabels') || '[]');
        if (Array.isArray(saved)) saved.forEach(([k, v]) => { if (k && v) partLabels.set(k, v); });
    } catch (e) {}
}

function setPartLabel(eid, label) {
    if (!eid) return;
    const clean = (label || '').trim();
    const modelName = editorEntry(eid)?.name;
    if (clean && clean !== modelName) partLabels.set(eid, clean);
    else partLabels.delete(eid);
    persistPartLabels();
    refreshSelectedPartUI();
    buildSceneTree();
    const search = document.getElementById('part-search-input');
    if (search && search.value) onPartSearch(search.value);
    rebuildRigUI();
}

function sceneAssetEditorId(obj) {
    const key = obj?.userData?.sceneAssetKey;
    return key ? `scene:${key}` : null;
}

function sceneAssetName(obj) {
    const catalogName = PROP_LIBRARY.entry(obj?.userData?.propId)?.name;
    return catalogName || obj?.userData?.propId || obj?.name || 'Scene asset';
}

function selectionTarget(obj) {
    for (let node = obj; node; node = node.parent) {
        if (node.userData?.sceneAsset) return node;
    }
    return obj;
}

function registerSceneAsset(obj) {
    const editorId = sceneAssetEditorId(obj);
    if (!editorId || sceneAssetRegistry.has(editorId)) return;
    obj.userData.editorId = editorId;
    const entry = {
        obj, editorId, name: sceneAssetName(obj), kind: 'sceneAsset',
        propId: obj.userData.propId, isCustom: Boolean(obj.userData.sceneAssetCustom)
    };
    sceneAssetRegistry.set(editorId, entry);
    obj.traverse(child => {
        if (child.isMesh && !interactableObjects.includes(child)) interactableObjects.push(child);
    });
}

function unregisterSceneAsset(obj) {
    toggleMovingObject(obj, false, true);
    obj.traverse(child => {
        const index = interactableObjects.indexOf(child);
        if (index > -1) interactableObjects.splice(index, 1);
    });
    const editorId = obj.userData?.editorId || sceneAssetEditorId(obj);
    if (editorId) sceneAssetRegistry.delete(editorId);
}

function clearSceneAssetRegistration() {
    // Deselect first so the transform proxy returns assets to their real parent
    // before the old room and its mount groups are removed.
    [...sceneAssetRegistry.values()].forEach(entry => unregisterSceneAsset(entry.obj));
    sceneAssetRegistry.clear();
    updateTransformProxy();
    refreshSelectedPartUI();
}

function discardSceneAssetUndoEntries() {
    const clean = stack => stack.flatMap(entry => {
        if (entry.type === 'scene-assets') return [];
        if (entry.type !== 'transform') return [entry];
        const items = entry.items.filter(item => !item.obj.userData?.sceneAsset);
        return items.length ? [{ ...entry, items }] : [];
    });
    undoStack.splice(0, undoStack.length, ...clean(undoStack));
    redoStack.splice(0, redoStack.length, ...clean(redoStack));
    updateUndoBtn();
}

function canonicalTransformPlain(obj) {
    const transform = canonicalTransform(obj);
    return transform ? {
        p: { x: transform.p.x, y: transform.p.y, z: transform.p.z },
        q: { x: transform.q.x, y: transform.q.y, z: transform.q.z, w: transform.q.w },
        s: { x: transform.s.x, y: transform.s.y, z: transform.s.z }
    } : plainLocalTransform(obj);
}

function captureActiveSceneAssetTransforms() {
    if (!sceneAssetRegistry.size) return;
    const state = sceneAssetState();
    sceneAssetRegistry.forEach(entry => state.transforms.set(entry.editorId, canonicalTransformPlain(entry.obj)));
}

async function hydrateSceneAssets(sceneId, token = sceneAssetHydrationToken) {
    if (sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) return;
    const state = sceneAssetState(sceneId);
    const defaults = [...(workspaceRoom?.assets() || []), ...(workspaceAccessories?.dressAssets() || [])];
    for (const obj of defaults) {
        const editorId = sceneAssetEditorId(obj);
        if (state.removed.has(editorId)) { obj.removeFromParent(); continue; }
        applyPlainLocalTransform(obj, state.transforms.get(editorId));
        registerSceneAsset(obj);
    }
    for (const addition of state.added.values()) {
        if (sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) return;
        const key = addition.editorId.replace(/^scene:/, '');
        const object = await workspaceRoom?.addAsset(addition.propId, key, addition.position || [0, 0, 800]);
        if (!object || sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) continue;
        applyPlainLocalTransform(object, state.transforms.get(addition.editorId));
        registerSceneAsset(object);
    }
    buildSceneTree();
    renderSceneAssetList();
    updateSceneLibraryStatus();
}

let selectedPartUIQueued = false;
function queueSelectedPartUI() {
    if (selectedPartUIQueued) return;
    selectedPartUIQueued = true;
    requestAnimationFrame(() => { selectedPartUIQueued = false; refreshSelectedPartUI(); });
}

function refreshSelectedPartUI() {
    const idEl = document.getElementById('selected-part-id');
    const emptyEl = document.getElementById('selected-part-empty');
    const bodyEl = document.getElementById('selected-part-body');
    if (!idEl || !emptyEl || !bodyEl) return;

    // Fall back to whatever is still selected if the tracked part was deselected
    let eid = lastSelectedEditorId;
    if (!eid || !editorEntry(eid) || !movingObjects.some(i => i.obj.userData.editorId === eid)) {
        const last = movingObjects[movingObjects.length - 1];
        eid = last ? last.obj.userData.editorId : null;
        lastSelectedEditorId = eid;
    }

    if (!eid) {
        idEl.textContent = '—';
        emptyEl.classList.remove('hidden');
        bodyEl.classList.add('hidden');
        bodyEl.classList.remove('flex');
        return;
    }

    const entry = editorEntry(eid);
    idEl.textContent = eid;
    emptyEl.classList.add('hidden');
    bodyEl.classList.remove('hidden');
    bodyEl.classList.add('flex');
    document.getElementById('selected-part-modelname').textContent = entry ? entry.name : '(missing)';
    const input = document.getElementById('selected-part-label');
    if (input && document.activeElement !== input) input.value = partLabels.get(eid) || '';
}

// Parent references live in Maps, NOT in userData: three.js deep-copies
// userData as JSON during clone()/export, and an Object3D reference there
// is a circular structure (crashes clone and the AR exporter).
const proxyOriginalParents = new Map(); // obj -> parent before transform-proxy attach
const animOriginalParents = new Map();  // obj -> parent before tilt/rig wrapper attach

// Phase 2.1: Named Groups
// Baked default groups — always available in the dropdown, survive everything.
// (Tilt_Desktop recovered from the group_Tilt_DeskTop.json export, all IDs verified.)
const BAKED_GROUPS = {
    "Tilt_Desktop": [
        "Desktop_1_4", "Desktop_2_5", "Desktop_3", "Desktop_3_6",
        "L_A_Hardware_Top_1_33", "L_A_Hardware_Top_3_35", "L_A_Hardware_Top_4_255",
        "L_A_Hardware_Top_6_257", "L_A_Hardware_Top_7_258", "mesh_692_692",
        "Power_1_1", "Power_2_2", "Power_4_8", "Power_7_11"
    ]
};
let savedGroups = {}; // groupName -> array of editorIds

// Phase 2.5: Debug panel collapse state

// Use vector distance to separate precise clicks from mouse movements
let mouseDownPos = new THREE.Vector2();
let isDraggingTransform = false; // Tracks if the 3D gizmo is actively being dragged
let blockCanvasClick = false; // Blocks selection toggle if interacting with the gizmo

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let scene, camera, renderer, controls, transformControl, transformProxy, loadedModel, floorMesh;
let workspaceAccessories = null, workspaceRoom = null, selectedRoomScene = 'product';
let sceneLights = null;
const roomLightSettings = {};
let accessoryCategory = 'Desktop';
let sharedBirchMaterial = null;
let sharedBasePaintMaterial = null;
let sharedPolishedAluminumMaterial = null;
let sharedBlackPlasticMaterial = null;
let sharedBlackMetalMaterial = null;

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const BIRCH_COLORS = ["eaeda2", "ebee87", "ffff00", "bbff00"];
const BASE_PAINT_COLORS = ["4fa5bd", "51b8d3", "51d0ef", "d4b3e6", "ffbbff", "689bad"];
const POLISHED_ALUMINUM_COLORS = ["e8e800", "7ec7f9", "ce8ca4", "000000", "4db6c1", "e7e7e7", "00ffff", "ff0000", "6288aa", "bbffe0", "babb95", "a5f1d0"];
const BLACK_PLASTIC_COLORS = ["0000ff", "e6dabd"];
const BLACK_METAL_COLORS = ["7c5f5f", "75b4bd"];

const canvas = document.getElementById('model-canvas');
const loader = document.getElementById('loader');
const woodFinishesGrid = document.getElementById('wood-finishes');
const baseFinishesGrid = document.getElementById('base-finishes');
const sizeSelect = document.getElementById('size-select');
const totalPrice = document.getElementById('total-price');
const cartPrice = document.getElementById('cart-price');
const addToCartBtn = document.getElementById('add-to-cart');
const cartCount = document.getElementById('cart-count');

// Desk Height Slider Elements
let deskHeightSlider, toggleHeightBtn, selectionModeToggle, selectedPartsCount, copyPartsBtn, clearPartsBtn;

function liftToHeight(l) {
    return HEIGHT_MIN + ((l - LIFT_MIN) / (LIFT_MAX - LIFT_MIN)) * (HEIGHT_MAX - HEIGHT_MIN);
}

function heightToLift(h) {
    return LIFT_MIN + ((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * (LIFT_MAX - LIFT_MIN);
}

// One collapse mechanism. The app had four — this accordion, the debug panel's
// display:none toggle, the scene tree's inline style toggle, and a native
// <details> — so a fifth for the motion dock would have been the wrong move.
//
// `storageKey` is optional; when given, the state is remembered per section.
// `onToggle` lets a caller react, which the motion dock needs because
// syncViewerSize derives the canvas height from the dock's height.
const collapsibles = new Map();

function setCollapsed(sectionId, collapsed, { persist = true } = {}) {
    const entry = collapsibles.get(sectionId);
    const content = document.getElementById(entry?.contentId || `${sectionId}-content`);
    const arrow = document.getElementById(entry?.arrowId || `${sectionId}-arrow`);
    if (!content) return;
    // Two modes on purpose. The store accordion animates a max-height, which is
    // right for short sections; a tall panel like the debug tools would be
    // clipped by that ceiling, so it toggles display instead.
    if (entry?.mode === 'display') content.style.display = collapsed ? 'none' : '';
    else content.classList.toggle('expanded', !collapsed);
    if (arrow) arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    const header = document.querySelector(`[aria-controls="${sectionId}-content"]`);
    if (header) header.setAttribute('aria-expanded', String(!collapsed));
    if (entry) {
        entry.collapsed = collapsed;
        if (persist && entry.storageKey) {
            try { localStorage.setItem(entry.storageKey, String(collapsed)); } catch {}
        }
        entry.onToggle?.(collapsed);
    }
}

function makeCollapsible(sectionId, { storageKey = null, defaultCollapsed = false, onToggle = null,
                                      mode = 'max-height', contentId = null, arrowId = null } = {}) {
    let collapsed = defaultCollapsed;
    if (storageKey) {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored !== null) collapsed = stored === 'true';
        } catch {}
    }
    collapsibles.set(sectionId, { storageKey, onToggle, collapsed, mode, contentId, arrowId });
    setCollapsed(sectionId, collapsed, { persist: false });
    return () => setCollapsed(sectionId, !collapsibles.get(sectionId).collapsed);
}

window.toggleSection = function(sectionId) {
    const entry = collapsibles.get(sectionId);
    const content = document.getElementById(`${sectionId}-content`);
    const collapsed = entry ? entry.collapsed : content?.classList.contains('expanded');
    setCollapsed(sectionId, !collapsed);
}

// Custom studio environment: softbox panels around a dark shell.
// Gives shaped, product-shot reflections (long highlights on the desktop,
// crisp gradients on metal) instead of RoomEnvironment's flat gray sheen.
function createStudioEnvironment() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1e1f22);

    const panel = (w, h, intensity, x, y, z) => {
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        mat.color.setScalar(intensity);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        envScene.add(mesh);
        return mesh;
    };

    panel(14, 7, 3.2, 0, 9, 0.01);   // main overhead softbox
    panel(4, 10, 2.6, -9, 3, 2);     // tall key-side strip (left)
    panel(4, 8, 1.4, 9, 2.5, 3);     // soft fill card (right)
    panel(10, 2.5, 3.0, 0, 4, -9);   // back rim strip for edge highlights
    panel(12, 12, 0.55, 0, -6, 0);   // dim floor bounce for undersides

    return envScene;
}

// Three.js renders translate, rotate and scale as separate gizmos. This wrapper
// layers the three handle families around one object, arbitrates overlapping
// hit targets, and exposes the same small API the rest of the editor already
// uses. A gesture can therefore move, rotate OR scale while producing one undo
// transaction, without a mode switch in between.
class UnifiedTransformGumball extends THREE.Group {
    constructor(camera, domElement) {
        super();
        this.type = 'UnifiedTransformGumball';
        this.mode = 'unified';
        this._object = undefined;
        this._active = null;
        this._sizes = { translate: 1.45, rotate: 1.05, scale: 0.78 };
        // Scale pickers get first refusal where their cubes cross a translation
        // shaft; the longer arrowheads remain an unambiguous move target.
        this.controls = ['scale', 'rotate', 'translate'].map(mode => {
            const control = new TransformControls(camera, domElement);
            control.setMode(mode);
            control.setSize(this._sizes[mode]);
            control.addEventListener('objectChange', () => {
                if (!this._active || this._active === control) this.dispatchEvent({ type: 'objectChange', mode });
            });
            control.addEventListener('dragging-changed', event => this.onDraggingChanged(control, mode, event.value));
            this.add(control);
            return control;
        });
        this._capturePointerDown = event => {
            if (!this._object || this._active || this.mode !== 'unified' || event.button !== 0) return;
            const rect = domElement.getBoundingClientRect();
            const pointer = {
                x: (event.clientX - rect.left) / rect.width * 2 - 1,
                y: -(event.clientY - rect.top) / rect.height * 2 + 1,
                button: event.button
            };
            this.controls.forEach(control => { control.enabled = true; control.pointerHover(pointer); });
            const winner = this.controls.find(control => control.axis !== null);
            if (winner) this.controls.forEach(control => {
                if (control !== winner) { control.enabled = false; control.axis = null; }
            });
        };
        domElement.addEventListener('pointerdown', this._capturePointerDown, true);
        this._resolveHover = () => {
            if (this._active || this.mode !== 'unified') return;
            const hovered = this.controls.find(control => control.enabled && control.axis !== null);
            if (hovered) this.controls.forEach(control => { if (control !== hovered) control.axis = null; });
        };
        // Runs after the child controls' hover listeners, leaving exactly one
        // highlighted handle when invisible picker volumes overlap.
        domElement.addEventListener('pointermove', this._resolveHover);
        this.domElement = domElement;
    }

    onDraggingChanged(control, mode, dragging) {
        if (dragging) {
            if (this._active && this._active !== control) return;
            this._active = control;
            this.controls.forEach(other => {
                if (other !== control) { other.enabled = false; other.axis = null; }
            });
            this.dispatchEvent({ type: 'dragging-changed', value: true, mode });
            return;
        }
        if (this._active !== control) return;
        this.dispatchEvent({ type: 'dragging-changed', value: false, mode });
        this._active = null;
        // Defer until every TransformControls pointerup listener on the shared
        // canvas has finished handling the current event.
        setTimeout(() => this.syncEnabledModes(), 0);
    }

    syncEnabledModes() {
        const enabledModes = this.mode === 'unified' ? new Set(['translate', 'rotate', 'scale']) : new Set([this.mode]);
        this.controls.forEach(control => {
            const on = Boolean(this._object) && enabledModes.has(control.mode);
            control.enabled = on;
            control.visible = on;
            if (!on) control.axis = null;
        });
    }

    attach(object) {
        this._object = object;
        this.controls.forEach(control => control.attach(object));
        this.syncEnabledModes();
        return this;
    }

    detach() {
        this._object = undefined;
        this._active = null;
        this.controls.forEach(control => { control.detach(); control.enabled = false; });
        return this;
    }

    setMode(mode) {
        this.mode = ['translate', 'rotate', 'scale'].includes(mode) ? mode : 'unified';
        this.syncEnabledModes();
        return this;
    }

    setSize(size) {
        const factor = size / 1.5;
        this.controls.forEach(control => control.setSize(this._sizes[control.mode] * factor));
        return this;
    }

    setSpace(space) { this.controls.forEach(control => control.setSpace(space)); return this; }
    setTranslationSnap(value) { this.controls.forEach(control => control.setTranslationSnap(value)); return this; }
    setRotationSnap(value) { this.controls.forEach(control => control.setRotationSnap(value)); return this; }
    setScaleSnap(value) { this.controls.forEach(control => control.setScaleSnap(value)); return this; }

    controlFor(mode) { return this.controls.find(control => control.mode === mode); }
    get object() { return this._object; }
    get dragging() { return Boolean(this._active?.dragging); }
    get axis() { return this._active?.axis || this.controls.find(control => control.axis !== null)?.axis || null; }
    get space() { return this.controlFor('translate').space; }
    get translationSnap() { return this.controlFor('translate').translationSnap; }
    get rotationSnap() { return this.controlFor('rotate').rotationSnap; }
    get scaleSnap() { return this.controlFor('scale').scaleSnap; }

    dispose() {
        this.domElement.removeEventListener('pointermove', this._resolveHover);
        this.domElement.removeEventListener('pointerdown', this._capturePointerDown, true);
        this.controls.forEach(control => control.dispose());
    }
}

function initThreeJS() {
    const container = canvas.parentElement;
    scene = new THREE.Scene();

    // Transparent canvas — the CSS studio-gradient backdrop shows through
    scene.background = null;

    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(STARTING_POS.x, STARTING_POS.y, STARTING_POS.z);

    // WebGL can be unavailable (GPU process crash, hardware acceleration off).
    // Fail gracefully instead of dying with an endless spinner.
    try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
        console.error('[ErgoFlex] WebGL context creation failed:', e);
        showWebGLError();
        return;
    }
    renderer.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        showContextLostOverlay();
    }, false);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.001;
    controls.target.set(STARTING_TARGET.x, STARTING_TARGET.y, STARTING_TARGET.z);

    // Gentle idle spin (enabled once the model loads), stops on first interaction
    controls.autoRotateSpeed = 0.9;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    // Master Group to easily manipulate multiple selected parts from their combined center
    transformProxy = new THREE.Group();
    scene.add(transformProxy);

    // Initialize TransformControls
    transformControl = new UnifiedTransformGumball(camera, renderer.domElement);
    transformControl.setSize(1.5); // Make the gizmo large and easy to grab
    transformControl.addEventListener('objectChange', () => {
        if (pivotGizmoOn && transformControl.object === pivotMarker) {
            syncPivotInputs(pivotFromMarker());
        }
    });

    transformControl.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
        isDraggingTransform = event.value;

        // Snapshot world matrices at drag start, commit at drag end. commitTransform
        // is the single place an edit is recorded — it pushes the undo entry, stores
        // the canonical transform, and re-derives the lift baseline. Numeric fields
        // and alignment tools go through the same call.
        if (event.value) {
            pendingTransformSnapshot = [...transformProxy.children].map(obj => {
                obj.updateWorldMatrix(true, false);
                return { obj: obj, before: obj.matrixWorld.clone() };
            });
        } else if (pendingTransformSnapshot) {
            commitTransform(pendingTransformSnapshot);
            pendingTransformSnapshot = null;
        }
    });
    scene.add(transformControl);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(createStudioEnvironment(), 0.06).texture;
    scene.environmentIntensity = 1.15;
    pmremGenerator.dispose();

    // Shadow-catcher floor: renders ONLY the soft shadow over the CSS backdrop
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.24 });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Studio setup: hemisphere ambience + warm key + cool fill + rim
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd1d6, 0.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff9f0, 1.5);
    keyLight.position.set(4.5, 8, 5.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.setScalar(2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.normalBias = 0.004;
    keyLight.shadow.radius = 8;
    keyLight.shadow.blurSamples = 16;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.35);
    fillLight.position.set(-6, 3.5, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(-4, 5.5, -7.5);
    scene.add(rimLight);
    sceneLights = { key: keyLight, fill: fillLight, rim: rimLight, hemi: hemiLight };

    // Pointer events for ultra-reliable click detection
    renderer.domElement.addEventListener('pointerdown', (e) => {
        // If the user is clicking on or dragging the 3D Gizmo, block the canvas selection logic!
        if (transformControl && (transformControl.axis !== null || isDraggingTransform)) {
            blockCanvasClick = true;
            return;
        }
        blockCanvasClick = false;
        mouseDownPos.set(e.clientX, e.clientY);
    });

    // Shift/Alt + left-drag (or plain left-drag in sticky mode) starts a
    // rubber-band box select instead of orbiting the camera.
    //
    // This has to run in the CAPTURE phase on window: OrbitControls and
    // TransformControls both listen on the canvas itself, and same-element
    // listeners fire in registration order — they were registered first, so a
    // canvas-level handler here would let an orbit start before we could stop
    // it. Capturing on an ancestor gets us ahead of all of them, and
    // stopPropagation keeps the drag from reaching them at all.
    window.addEventListener('pointerdown', (e) => {
        if (e.target !== renderer.domElement) return;
        if (e.button !== 0 || !isSelectionMode) return;
        if (transformControl && (transformControl.axis !== null || isDraggingTransform)) return;
        if (!wantsMarquee(e)) return;

        beginMarquee(e);
        e.stopPropagation();
    }, true);

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (marquee.active) { updateMarquee(e); return; }
        if (isPickModeActive()) updatePickHover(e);
    });

    renderer.domElement.addEventListener('pointerleave', () => {
        if (isPickModeActive()) clearHoverHighlight();
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (marquee.active) {
            endMarquee(e);
            return;
        }
        if (blockCanvasClick) return; // Do not fire selection logic if we just used the gizmo

        const mouseUpPos = new THREE.Vector2(e.clientX, e.clientY);
        if (mouseDownPos.distanceTo(mouseUpPos) < 5) {
            onCanvasClick(e);
        }
    });

    renderer.domElement.addEventListener('pointercancel', () => {
        if (marquee.active) cancelMarquee();
    });

    loadModel();

    window.addEventListener('resize', syncViewerSize);

    // The viewer changes size without a window resize (entering/leaving setup
    // mode, dragging the sidebar splitter), so watch the container directly.
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
        // The panel floats inside this box, so a change in its shape is exactly
        // when a saved panel position can fall outside the usable area.
        new ResizeObserver(() => { syncViewerSize(); clampDockPosition(); }).observe(canvas.parentElement);
    }

    animate();
}

// --- Undo system for setup edits ---
// Undoable: transform gizmo drags, part clones, tilt config saves.
const undoStack = [];
const redoStack = [];
const UNDO_LIMIT = 50;
let pendingTransformSnapshot = null;

function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    // A new edit invalidates the redo branch, as everywhere else.
    redoStack.length = 0;
    updateUndoBtn();
}

function updateUndoBtn() {
    const btn = document.getElementById('undo-btn');
    if (btn) {
        btn.disabled = undoStack.length === 0;
        btn.textContent = undoStack.length ? 'Undo (' + undoStack.length + ')' : 'Undo';
    }
    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.textContent = redoStack.length ? 'Redo (' + redoStack.length + ')' : 'Redo';
    }
    refreshTransformInspector();
}

// Restores a world-space matrix onto an object regardless of its current parent
// (original parent, transform proxy, or tilt wrapper).
function setWorldMatrix(obj, matrix) {
    if (!obj.parent) return;
    obj.parent.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(obj.parent.matrixWorld).invert().multiply(matrix);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld(true);
}

// --- Canonical edit transforms ---------------------------------------------
//
// A part's canonical transform is its local TRS in the parent it actually
// belongs to in the model, independent of where the editor has temporarily
// parented it. Selection reparents onto transformProxy and rigs reparent into
// wrapper groups, so obj.position is routinely expressed in some other space.
//
// This matters most for baseY. updateMovingObjectsPosition writes
//   obj.position.y = baseY + liftOffset
// so baseY has to be a local Y in the part's settled parent. Reading
// obj.position.y at drag-commit time would read a proxy-local value, which is
// why the old code declined to update baseY at all — and why a vertical edit to
// a lift member used to be silently overwritten by the stale baseY on the next
// height change.

// The pristine local TRS of every part, captured once at load before any rig
// builds. Sizing recomputes from this, never from the live scene, so repeated
// resizes cannot accumulate drift. User edits are composed on top of it.
const assetBaseline = new Map();   // editorId -> canonical TRS as authored

const editTransforms = new Map();  // editorId -> canonical TRS after user edits
let editRevision = 0;              // bumped by every edit; a validation cache key
let suppressTransactions = false;  // set while neutralising, so housekeeping is not an edit

const _canonM = new THREE.Matrix4();
const _canonP = new THREE.Vector3();
const _canonQ = new THREE.Quaternion();
const _canonS = new THREE.Vector3();

// Walks out through the transform proxy and any animation wrapper. The anim
// entry wins when both exist: a selected part inside a tilt wrapper has
// proxyOriginalParents pointing at the wrapper and animOriginalParents pointing
// at the model parent, and the model parent is the canonical one.
function canonicalParent(obj) {
    const parent = animOriginalParents.get(obj)
        || proxyOriginalParents.get(obj)
        || (obj.parent === transformProxy ? null : obj.parent);
    return parent || loadedModel || obj.parent;
}

function canonicalTransform(obj) {
    const parent = canonicalParent(obj);
    if (!parent) return null;
    obj.updateWorldMatrix(true, false);
    parent.updateWorldMatrix(true, false);
    _canonM.copy(parent.matrixWorld).invert().multiply(obj.matrixWorld);
    _canonM.decompose(_canonP, _canonQ, _canonS);
    return { p: _canonP.clone(), q: _canonQ.clone(), s: _canonS.clone() };
}

// Re-derives the lift baseline from the canonical transform. Mutates the entry
// in place: movingObjects and liftObjects share entry objects for parts that
// joined at load time, and replacing one would desynchronise the other.
function refreshLiftBaseline(obj) {
    const canon = canonicalTransform(obj);
    if (!canon) return;
    const liftOffset = currentLift - LIFT_MIN;
    const lift = liftObjects.get(obj);
    if (lift) lift.baseY = canon.p.y - liftOffset;
    const tele = telescopingObjects.find(item => item.obj === obj);
    if (tele) tele.baseY = canon.p.y - liftOffset * TELESCOPING_RATIO;
}

// Records one part's edit. Every edit path ends here.
function captureAssetBaseline(obj) {
    const editorId = obj.userData?.editorId;
    if (!editorId || obj.userData?.sceneAsset || assetBaseline.has(editorId)) return;
    const canon = canonicalTransform(obj);
    if (canon) assetBaseline.set(editorId, canon);
}

function recordCanonicalEdit(obj) {
    const editorId = obj.userData?.editorId;
    if (editorId && obj.userData?.sceneAsset) {
        sceneAssetState().transforms.set(editorId, canonicalTransformPlain(obj));
        persistSceneAssetStates();
    } else if (editorId) {
        editTransforms.set(editorId, canonicalTransform(obj));
    }
    refreshLiftBaseline(obj);
}

// The single commit point for transform edits: gizmo drags, numeric fields and
// alignment tools all call this, so they produce identical undo entries and
// identical bookkeeping. Returns whether anything actually moved.
function commitTransform(items) {
    if (!items || !items.length) return false;
    const changed = items.filter(item => {
        item.obj.updateWorldMatrix(true, false);
        return !item.obj.matrixWorld.equals(item.before);
    });
    if (!changed.length) return false;
    changed.forEach(item => { item.after = item.obj.matrixWorld.clone(); });
    transaction({ type: 'transform', items: changed });
    changed.forEach(item => recordCanonicalEdit(item.obj));
    return true;
}

// Undoable mutation. pushUndo is the raw stack push; this is what callers use,
// so that every recorded edit also advances the revision counter.
function transaction(entry) {
    if (suppressTransactions) return;
    editRevision++;
    pushUndo(entry);
    scheduleAutosave();
}

// A mutation that changed the scene without pushing its own undo entry
// (undo and redo themselves, imports, resizes).
function markEdited() {
    if (suppressTransactions) return;
    editRevision++;
}

// --- Neutral pose ----------------------------------------------------------
//
// Lift, tilt, glide and wheel spin all write into part transforms, so anything
// that captures or compares geometry has to establish a rest pose first.
// buildActuatorRig already does this for tilt when capturing rest state; this
// generalises it to every motion source.
//
// Two guards matter. Motion is paused so a requestAnimationFrame tick cannot
// advance the lift mid-capture, and transactions are suppressed so neutralising
// does not register as a user edit. Restore runs in a finally block: a
// half-neutralised scene left behind by a throw is worse than a failed save.
let motionPaused = false;

function withNeutralPose(fn) {
    const saved = {
        currentLift, targetLift, manualLiftOverride,
        tilt: tiltConfigs.map(c => c.currentDeg),
        glide: glideOffset.clone(),
        glideTarget: glideTarget.clone(),
        spins: wheelRigs.map(r => r.spin),
        suppressed: suppressTransactions,
        paused: motionPaused
    };
    motionPaused = true;
    suppressTransactions = true;
    try {
        if (glideOffset.lengthSq() > 0) applyGlideOffset(new THREE.Vector3(0, 0, 0));
        wheelRigs.forEach(rig => { rig.spin = 0; rig.wrapper.rotation.z = 0; });
        tiltConfigs.forEach(config => { config.currentDeg = 0; applyTiltConfig(config); });
        manualLiftOverride = true;
        currentLift = LIFT_MIN;
        targetLift = LIFT_MIN;
        updateMovingObjectsPosition();
        return fn();
    } finally {
        currentLift = saved.currentLift;
        targetLift = saved.targetLift;
        manualLiftOverride = saved.manualLiftOverride;
        updateMovingObjectsPosition();
        tiltConfigs.forEach((config, i) => {
            if (saved.tilt[i] !== undefined) { config.currentDeg = saved.tilt[i]; applyTiltConfig(config); }
        });
        applyGlideOffset(saved.glide);
        glideTarget.copy(saved.glideTarget);
        wheelRigs.forEach((rig, i) => {
            if (saved.spins[i] !== undefined) { rig.spin = saved.spins[i]; rig.wrapper.rotation.z = rig.spin; }
        });
        suppressTransactions = saved.suppressed;
        motionPaused = saved.paused;
    }
}

// Undo and redo run the same code in opposite directions. Each entry knows how
// to reverse itself and returns the entry that would reverse THAT, which is
// pushed onto the other stack — so a redo is just an undo of an undo.
function invertEntry(entry) {
    switch (entry.type) {
        case 'transform':
            return { ...entry, items: entry.items.map(i => ({ obj: i.obj, before: i.after, after: i.before })) };
        case 'clone':
            return { ...entry, type: 'clone-restore' };
        case 'clone-restore':
            return { ...entry, type: 'clone' };
        case 'tilt-save':
            return { type: 'rig-restore', kind: 'tilt', definition: entry.definition };
        case 'rig-save':
            return { type: 'rig-restore', kind: 'actuator', definition: entry.definition };
        case 'rig-restore':
            return { type: entry.kind === 'tilt' ? 'tilt-save' : 'rig-save',
                     name: entry.definition?.name, definition: entry.definition };
        case 'lift-membership':
            return { ...entry, added: !entry.added };
        case 'tilt-parts':
            return { ...entry, added: !entry.added };
        case 'scene-assets':
            return { ...entry, present: !entry.present };
        default:
            return null;
    }
}

function applyEntry(entry) {
    if (entry.type === 'transform') {
        // Restoring the world matrix alone would leave baseY holding the value
        // derived from the undone edit, reintroducing the same overwrite one step
        // into the past. Re-record the canonical state exactly as a fresh commit does.
        entry.items.forEach(item => { setWorldMatrix(item.obj, item.before); recordCanonicalEdit(item.obj); });
        markEdited();
        boxHelpers.forEach(h => h.update());
        updateTransformProxy();
    } else if (entry.type === 'clone') {
        // Detach, but keep the objects: redo re-adds these very instances, so the
        // editorIds that groups, rigs and later undo entries refer to stay valid.
        entry.clones.forEach(clone => {
            liftObjects.delete(clone);
            toggleMovingObject(clone, false, true);
            const idx = interactableObjects.indexOf(clone);
            if (idx > -1) interactableObjects.splice(idx, 1);
            if (clone.userData.editorId) partRegistry.delete(clone.userData.editorId);
            entry.parents = entry.parents || new Map();
            if (clone.parent) { entry.parents.set(clone, clone.parent); clone.parent.remove(clone); }
        });
        updateTransformProxy();
        if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        buildSceneTree();
    } else if (entry.type === 'clone-restore') {
        entry.clones.forEach(clone => {
            const parent = entry.parents?.get(clone) || loadedModel || scene;
            parent.add(clone);
            partRegistry.set(clone.userData.editorId,
                { obj: clone, name: clone.name, editorId: clone.userData.editorId, isClone: true });
            interactableObjects.push(clone);
        });
        updateTransformProxy();
        buildSceneTree();
        markEdited();
    } else if (entry.type === 'tilt-save') {
        const idx = tiltConfigs.findIndex(c => c.name === entry.name);
        if (idx > -1) {
            // Capture the definition before removing, so redo can rebuild it.
            entry.definition = entry.definition || serializeTiltConfigs()[idx];
            removeTiltConfig(idx, { recordUndo: false });
        }
    } else if (entry.type === 'rig-save') {
        const idx = actuatorRigs.findIndex(r => r.name === entry.name);
        if (idx > -1) {
            entry.definition = entry.definition || serializeActuatorRigs()[idx];
            removeActuatorRig(idx, { recordUndo: false });
        }
    } else if (entry.type === 'rig-restore') {
        if (entry.definition) deletedBakedRigs[entry.kind]?.delete(entry.definition.name);
        if (entry.definition && entry.kind === 'tilt') {
            const parts = entry.definition.groupEditorIds.map(eid => partRegistry.get(eid)?.obj).filter(Boolean);
            createTiltConfig({ ...entry.definition, parts });
            persistTiltConfigs();
            rebuildTiltUI();
        } else if (entry.definition && entry.kind === 'actuator') {
            buildActuatorRig(entry.definition);
            persistActuatorRigs();
            rebuildRigUI();
        }
        markEdited();
    } else if (entry.type === 'lift-membership') {
        if (entry.added) {
            entry.objects.forEach(item => liftObjects.delete(item.obj || item));
        } else {
            entry.objects.forEach(item => {
                const obj = item.obj || item;
                const canon = canonicalTransform(obj);
                liftObjects.set(obj, { obj, baseY: item.baseY ?? (canon ? canon.p.y - (currentLift - LIFT_MIN) : obj.position.y) });
            });
        }
        markEdited();
    } else if (entry.type === 'tilt-parts') {
        const config = tiltConfigs.find(c => c.name === entry.name);
        if (config) {
            const parts = entry.editorIds.map(eid => partRegistry.get(eid)?.obj).filter(Boolean);
            if (entry.added) detachPartsFromTilt(config, parts);
            else attachPartsToTilt(config, parts);
            if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
            updateTransformProxy();
            persistTiltConfigs();
            rebuildTiltUI();
        }
    } else if (entry.type === 'scene-assets') {
        entry.records.forEach(record => setSceneAssetPresence(record, entry.present));
        persistSceneAssetStates();
        updateTransformProxy();
        buildSceneTree();
        renderSceneAssetList();
        updateSceneLibraryStatus();
        markEdited();
    }
}

function performUndo() {
    const entry = undoStack.pop();
    if (!entry) return;
    const wasSuppressed = suppressTransactions;
    suppressTransactions = true;
    try {
        applyEntry(entry);
        const inverse = invertEntry(entry);
        if (inverse) redoStack.push(inverse);
    } finally { suppressTransactions = wasSuppressed; }
    updateUndoBtn();
}

function performRedo() {
    const entry = redoStack.pop();
    if (!entry) return;
    const wasSuppressed = suppressTransactions;
    suppressTransactions = true;
    try {
        applyEntry(entry);
        const inverse = invertEntry(entry);
        if (inverse) undoStack.push(inverse);
    } finally { suppressTransactions = wasSuppressed; }
    updateUndoBtn();
}

// Chrome's GPU process can crash mid-session (observed on this machine).
// Catch the WebGL context loss and offer one-click recovery instead of a
// silent freeze — groups and tilt configs persist, so a reload is lossless.
function showContextLostOverlay() {
    if (document.getElementById('ctx-lost-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ctx-lost-overlay';
    overlay.className = 'absolute inset-0 z-20 flex items-center justify-center';
    overlay.style.background = 'rgba(245,245,247,0.92)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.innerHTML = `
        <div class="flex flex-col items-center p-6 text-center max-w-sm">
            <svg class="w-10 h-10 text-amber-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"></path></svg>
            <p class="text-sm text-gray-900 font-semibold mb-1">3D view interrupted</p>
            <p class="text-xs text-gray-600 leading-relaxed mb-4">The browser's graphics process was interrupted. Your groups and tilt configs are saved — reloading brings everything back.</p>
            <button class="btn-primary px-6 py-2.5 text-sm" onclick="location.reload()">Reload 3D View</button>
        </div>
    `;
    canvas.parentElement.appendChild(overlay);
}

function showWebGLError() {
    if (!loader) return;
    loader.innerHTML = `
        <div class="flex flex-col items-center p-6 text-center max-w-sm">
            <svg class="w-10 h-10 text-amber-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"></path></svg>
            <p class="text-sm text-gray-900 font-semibold mb-1">3D preview unavailable</p>
            <p class="text-xs text-gray-600 leading-relaxed">Your browser couldn't start WebGL. This is usually fixed by fully restarting the browser, or enabling hardware acceleration (chrome://settings/system). You can still configure your desk using the options panel.</p>
        </div>
    `;
}

// Centers the 3D Gizmo perfectly on the selection
function updateTransformProxy() {
    if (!transformProxy || !transformControl) return;
    // While the pivot marker owns the gizmo, selection changes must not steal it back
    if (pivotGizmoOn) return;

    // 1. Detach current children back to their original parents to preserve world transforms
    [...transformProxy.children].forEach(child => {
        const origParent = proxyOriginalParents.get(child);
        if (origParent) {
            origParent.attach(child);
            proxyOriginalParents.delete(child);
        } else {
            scene.attach(child);
        }
    });

    const tMode = document.querySelector('input[name="transform_mode"]:checked');
    if (!isSelectionMode || !tMode || tMode.value === 'none' || movingObjects.length === 0) {
        transformControl.detach();
        return;
    }

    // 2. Calculate bounding box of all selected objects
    const box = new THREE.Box3();
    movingObjects.forEach(item => {
        item.obj.updateMatrixWorld(true);
        box.expandByObject(item.obj);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);

    // If a tilt pivot has been picked, anchor the gizmo on the pivot part's
    // geometry instead of the selection center — Rotate then previews exactly
    // how the saved tilt config will move.
    if (tiltPivotEditorId) {
        const pivotEntry = partRegistry.get(tiltPivotEditorId);
        if (pivotEntry) {
            pivotEntry.obj.updateMatrixWorld(true);
            const pivotBox = new THREE.Box3().setFromObject(pivotEntry.obj);
            pivotBox.getCenter(center);
        }
    }

    // 3. Move proxy to centroid
    transformProxy.position.copy(center);
    transformProxy.rotation.set(0,0,0);
    transformProxy.scale.set(1,1,1);
    transformProxy.updateMatrixWorld();

    // 4. Attach all moving objects to the proxy
    movingObjects.forEach(item => {
        const obj = item.obj;
        if (!proxyOriginalParents.has(obj)) {
            proxyOriginalParents.set(obj, obj.parent);
        }
        transformProxy.attach(obj);
    });

    // 5. Attach TransformControls to proxy
    transformControl.attach(transformProxy);
}

function toggleMovingObject(obj, forceState = null, skipUpdate = false) {
    const existingIndex = movingObjects.findIndex(item => item.obj === obj);
    const currentlySelected = existingIndex > -1;
    // A locked part can always be deselected, never selected.
    if (!currentlySelected && forceState !== false && isLocked(obj)) return;

    let shouldSelect = forceState !== null ? forceState : !currentlySelected;

    if (!shouldSelect && currentlySelected) {
        movingObjects.splice(existingIndex, 1);
        if (boxHelpers.has(obj.uuid)) {
            scene.remove(boxHelpers.get(obj.uuid));
            boxHelpers.delete(obj.uuid);
        }
    } else if (shouldSelect && !currentlySelected) {
        // Add to moving list — baseY is position at LIFT_MIN, offset relative to LIFT_MIN
        movingObjects.push({
            obj: obj,
            baseY: obj.position.y - (currentLift - LIFT_MIN)
        });

        const helper = new THREE.BoxHelper(obj, 0x30d158);
        scene.add(helper);
        boxHelpers.set(obj.uuid, helper);
        helper.visible = isSelectionMode;
    }

    if (shouldSelect && obj.userData.editorId) lastSelectedEditorId = obj.userData.editorId;
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    queueSelectedPartUI();
    if (obj.userData?.sceneAsset) renderSceneAssetList();
    if (!skipUpdate) updateTransformProxy();
}


// --- Box (marquee) selection -------------------------------------------------
// Hold Shift or Alt and drag across the canvas to rubber-band select parts.
// Screen positions are projected once when the drag starts (the camera is
// frozen for the duration), so dragging itself is just cheap rectangle math
// even with a few thousand meshes in the scene.
const marquee = {
    active: false,
    startX: 0, startY: 0, curX: 0, curY: 0,
    pointerId: null,
    candidates: [],
    hits: []
};
let marqueeBoxEl = null, marqueeCountEl = null;

function wantsMarquee(e) {
    const sticky = document.getElementById('box-select-sticky');
    const modifier = e.shiftKey || e.altKey;
    // Sticky mode inverts the roles: plain drag box-selects, modifier+drag orbits.
    // (Without the inversion a sticky left-drag would leave no way to rotate.)
    return (sticky && sticky.checked) ? !modifier : modifier;
}

function getBoxSelectMode() {
    const input = document.querySelector('input[name="box_mode"]:checked');
    return input ? input.value : 'enclose';
}

// An object only counts if it and every ancestor is visible.
function isRenderable(obj) {
    let node = obj;
    while (node) {
        if (!node.visible) return false;
        node = node.parent;
    }
    return true;
}

// Projects every interactable mesh's world bounding box into canvas pixel
// space and caches the resulting 2D AABB.
function buildMarqueeCandidates() {
    const rect = canvas.getBoundingClientRect();
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const out = [];

    camera.updateMatrixWorld();

    const selectionObjects = new Set(interactableObjects.map(selectionTarget));
    for (const obj of selectionObjects) {
        if (!obj.parent || !isRenderable(obj)) continue;

        obj.updateWorldMatrix(true, false);
        box.setFromObject(obj);
        if (box.isEmpty()) continue;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let behind = 0;

        for (let i = 0; i < 8; i++) {
            v.set(
                (i & 1) ? box.max.x : box.min.x,
                (i & 2) ? box.max.y : box.min.y,
                (i & 4) ? box.max.z : box.min.z
            );
            v.project(camera);
            if (v.z > 1) behind++;
            const x = (v.x * 0.5 + 0.5) * rect.width;
            const y = (-v.y * 0.5 + 0.5) * rect.height;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        if (behind === 8) continue; // entirely behind the camera
        out.push({ obj, minX, minY, maxX, maxY });
    }

    return out;
}

function beginMarquee(e) {
    const rect = canvas.getBoundingClientRect();
    marquee.active = true;
    marquee.pointerId = e.pointerId;
    marquee.startX = marquee.curX = e.clientX - rect.left;
    marquee.startY = marquee.curY = e.clientY - rect.top;
    marquee.candidates = buildMarqueeCandidates();
    marquee.hits = [];

    // Freeze the camera so the drag doesn't orbit underneath the rubber band
    if (controls) {
        controls.enabled = false;
        controls.autoRotate = false;
    }
    blockCanvasClick = true;

    if (!marqueeBoxEl) {
        marqueeBoxEl = document.getElementById('marquee-box');
        marqueeCountEl = document.getElementById('marquee-count');
    }
    if (marqueeBoxEl) marqueeBoxEl.classList.remove('hidden');

    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    drawMarquee();
}

function marqueeRect() {
    return {
        left: Math.min(marquee.startX, marquee.curX),
        right: Math.max(marquee.startX, marquee.curX),
        top: Math.min(marquee.startY, marquee.curY),
        bottom: Math.max(marquee.startY, marquee.curY)
    };
}

function drawMarquee() {
    if (!marqueeBoxEl) return;
    const r = marqueeRect();
    marqueeBoxEl.style.left = (r.left + canvas.offsetLeft) + 'px';
    marqueeBoxEl.style.top = (r.top + canvas.offsetTop) + 'px';
    marqueeBoxEl.style.width = (r.right - r.left) + 'px';
    marqueeBoxEl.style.height = (r.bottom - r.top) + 'px';
    if (marqueeCountEl) {
        marqueeCountEl.textContent = marquee.hits.length + (marquee.hits.length === 1 ? ' part' : ' parts');
    }
}

function computeMarqueeHits() {
    const r = marqueeRect();
    const touch = getBoxSelectMode() === 'touch';
    const hits = [];
    for (const c of marquee.candidates) {
        const inside = touch
            ? (c.maxX >= r.left && c.minX <= r.right && c.maxY >= r.top && c.minY <= r.bottom)
            : (c.minX >= r.left && c.maxX <= r.right && c.minY >= r.top && c.maxY <= r.bottom);
        if (inside) hits.push(c.obj);
    }
    return hits;
}

function updateMarquee(e) {
    const rect = canvas.getBoundingClientRect();
    marquee.curX = e.clientX - rect.left;
    marquee.curY = e.clientY - rect.top;
    marquee.hits = computeMarqueeHits();
    drawMarquee();
}

function endMarquee(e) {
    if (e) updateMarquee(e);
    const hits = marquee.hits;
    const r = marqueeRect();
    const dragged = (r.right - r.left) > 3 || (r.bottom - r.top) > 3;

    teardownMarquee(e);

    if (dragged && hits.length) applyMarqueeSelection(hits);
}

function cancelMarquee() {
    teardownMarquee(null);
}

function teardownMarquee(e) {
    marquee.active = false;
    marquee.candidates = [];
    marquee.hits = [];
    if (marqueeBoxEl) marqueeBoxEl.classList.add('hidden');
    if (controls) controls.enabled = true;
    if (e && marquee.pointerId !== null) {
        try { canvas.releasePointerCapture(marquee.pointerId); } catch (_) {}
    }
    marquee.pointerId = null;
    // Let the next plain click through again
    setTimeout(() => { blockCanvasClick = false; }, 0);
}

// Selected parts get reparented onto the transform proxy, so obj.parent is not
// a reliable stand-in for "the assembly this mesh belongs to".
function resolveSelectionParent(obj) {
    let parent = obj.parent;
    if (parent === transformProxy) parent = proxyOriginalParents.get(obj) || parent;
    return parent;
}

function applyMarqueeSelection(hits) {
    const modeInput = document.querySelector('input[name="select_mode"]:checked');
    const mode = modeInput ? modeInput.value : 'single';

    const actionInput = document.querySelector('input[name="click_action"]:checked');
    const action = actionInput ? actionInput.value : 'toggle';

    const interactableSet = new Set(interactableObjects);
    const targets = new Set();

    hits.forEach(obj => {
        if (mode === 'parent' && !obj.userData?.sceneAsset) {
            const parent = resolveSelectionParent(obj);
            if (parent && parent.type !== 'Scene') {
                parent.traverse(child => {
                    if (child.isMesh && interactableSet.has(child)) targets.add(child);
                });
                return;
            }
        }
        targets.add(obj);
    });

    targets.forEach(obj => {
        const isSelected = movingObjects.some(item => item.obj === obj);
        let state;
        if (action === 'select') state = true;
        else if (action === 'deselect') state = false;
        else state = !isSelected;
        toggleMovingObject(obj, state, true); // batch — proxy updated once below
    });

    updateTransformProxy();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
}

// --- Setup workspace layout ---------------------------------------------------
// Setup mode becomes a full-viewport split: builder + configurator in a scrollable
// left sidebar, 3D viewer filling everything to the right of it. Only #anim-debugger
// and #config-column are reparented; the viewer (and its WebGL canvas) is repositioned
// with CSS alone so the GL context survives the switch.
let setupLayoutOn = false;
let setupChromeBuilt = false;
const layoutSlots = new Map(); // node -> placeholder comment marking its home position

const SIDEBAR_W_KEY = 'ergoflex.setupSidebarWidth';
const SIDEBAR_W_MIN = 300;

function setSidebarWidth(px) {
    const max = Math.max(SIDEBAR_W_MIN, window.innerWidth - 420);
    const w = Math.round(Math.max(SIDEBAR_W_MIN, Math.min(max, px)));
    document.documentElement.style.setProperty('--setup-sidebar-w', w + 'px');
    return w;
}

function buildSetupChrome() {
    if (setupChromeBuilt) return;
    setupChromeBuilt = true;

    const backdrop = document.createElement('div');
    backdrop.id = 'setup-backdrop';

    const sidebar = document.createElement('aside');
    sidebar.id = 'setup-sidebar';
    sidebar.dataset.tab = 'editor';
    sidebar.innerHTML = `<div class="studio-sidebar-header"><div class="eyebrow">ERGOFLEX / DESIGN STUDIO</div><h2>Your workspace. Refined.</h2><div class="studio-tabs"><button data-sidebar-tab="editor" aria-pressed="true">Editor tools</button><button data-sidebar-tab="finishes" aria-pressed="false">Product & finishes</button></div></div>`;
    sidebar.querySelectorAll('[data-sidebar-tab]').forEach(button => button.addEventListener('click', () => { sidebar.dataset.tab = button.dataset.sidebarTab; sidebar.querySelectorAll('[data-sidebar-tab]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); }));

    const resizer = document.createElement('div');
    resizer.id = 'setup-resizer';
    resizer.title = 'Drag to resize the panel';

    const exitBtn = document.createElement('button');
    exitBtn.id = 'setup-exit-btn';
    exitBtn.className = 'bg-white/90 hover:bg-white border border-gray-200 shadow-sm text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg';
    exitBtn.textContent = 'Store preview ↗';
    exitBtn.addEventListener('click', () => setSetupLayout(false));

    document.body.append(backdrop, sidebar, resizer, exitBtn);

    let stored = null;
    try { stored = parseInt(localStorage.getItem(SIDEBAR_W_KEY), 10); } catch (_) {}
    setSidebarWidth(Number.isFinite(stored) ? stored : 420);

    let draggingSplitter = false;
    resizer.addEventListener('pointerdown', (e) => {
        draggingSplitter = true;
        resizer.classList.add('dragging');
        try { resizer.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
    });
    resizer.addEventListener('pointermove', (e) => {
        if (!draggingSplitter) return;
        setSidebarWidth(e.clientX);
        syncViewerSize();
    });
    const stopSplitter = (e) => {
        if (!draggingSplitter) return;
        draggingSplitter = false;
        resizer.classList.remove('dragging');
        try { resizer.releasePointerCapture(e.pointerId); } catch (_) {}
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--setup-sidebar-w'), 10);
        if (Number.isFinite(w)) { try { localStorage.setItem(SIDEBAR_W_KEY, String(w)); } catch (_) {} }
        syncViewerSize();
    };
    resizer.addEventListener('pointerup', stopSplitter);
    resizer.addEventListener('pointercancel', stopSplitter);

    window.addEventListener('resize', () => {
        if (!setupLayoutOn) return;
        const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--setup-sidebar-w'), 10);
        if (Number.isFinite(w)) setSidebarWidth(w); // re-clamp against the new window width
    });
}

function stashHome(node) {
    if (!node || layoutSlots.has(node) || !node.parentNode) return;
    const slot = document.createComment('layout-home');
    node.parentNode.insertBefore(slot, node);
    layoutSlots.set(node, slot);
}

function returnHome(node) {
    const slot = layoutSlots.get(node);
    if (slot && slot.parentNode) slot.parentNode.insertBefore(node, slot);
}

function setSetupLayout(on) {
    const animDebugger = document.getElementById('anim-debugger');
    const configColumn = document.getElementById('config-column');

    if (on) {
        buildSetupChrome();
        const sidebar = document.getElementById('setup-sidebar');
        [animDebugger, configColumn].forEach(node => {
            if (!node) return;
            stashHome(node);
            sidebar.appendChild(node);
        });
        if (animDebugger) animDebugger.style.display = '';
        document.body.classList.add('setup-layout');
        placeRemoteForMode();
        ['setup-backdrop', 'setup-sidebar', 'setup-resizer', 'setup-exit-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    } else {
        [animDebugger, configColumn].forEach(node => { if (node) returnHome(node); });
        if (animDebugger) animDebugger.style.display = 'none';
        document.body.classList.remove('setup-layout');
        placeRemoteForMode();
        ['setup-backdrop', 'setup-sidebar', 'setup-resizer', 'setup-exit-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    if (!on) {
        isSelectionMode = false;
        if (selectionModeToggle) selectionModeToggle.checked = false;
        document.querySelector('input[name="transform_mode"][value="none"]').checked = true;
        if (transformProxy) updateTransformProxy();
        boxHelpers.forEach(helper => helper.visible = false);
        showAllParts();
        updateBoxSelectHint();
    }
    setupLayoutOn = on;
    controls && (controls.autoRotate = false);
    requestAnimationFrame(syncViewerSize);
}

function updateBoxSelectHint() {
    const hint = document.getElementById('boxselect-hint');
    if (hint) hint.classList.toggle('hidden', !isSelectionMode);
}

function onCanvasClick(event) {
    if (rigPickMode) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, false);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (rigPickMode === 'base') {
                obj.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(obj);
                const c = box.getCenter(new THREE.Vector3());
                loadedModel.updateMatrixWorld(true);
                loadedModel.worldToLocal(c);
                c.y -= (currentLift - LIFT_MIN); // normalize to 28" reference
                rigDraft.baseLocal = { x: c.x, y: c.y, z: c.z };
                rigDraft.baseName = obj.userData.editorId || obj.name;
                setRigPickHelper('base', obj);
                rigPickMode = null;
                clearHoverHighlight();
                canvas.style.cursor = '';
                updateRigPickButtons();
                updateRigStatus();
                openPivotEditor(-1); // show the pivot straight away so it can be corrected
                return;
            }
            rigDraft.targetEditorId = obj.userData.editorId;
            rigDraft.targetName = obj.userData.editorId || obj.name;
            setRigPickHelper('target', obj);
        }
        rigPickMode = null;
        clearHoverHighlight();
        canvas.style.cursor = '';
        updateRigPickButtons();
        updateRigStatus();
        return;
    }

    if (isPickingPivot) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, false);
        if (intersects.length > 0) {
            const clickedObj = intersects[0].object;
            const editorId = clickedObj.userData.editorId;
            if (editorId) {
                setPivotPart(editorId);
            }
        }
        isPickingPivot = false;
        clearHoverHighlight();
        canvas.style.cursor = '';
        updatePickPivotBtnState();
        return;
    }

    if (!isSelectionMode) return;
    if (transformControl && transformControl.dragging) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, false);

    if (intersects.length > 0) {
        const clickedObj = selectionTarget(intersects[0].object);

        const modeInput = document.querySelector('input[name="select_mode"]:checked');
        const mode = modeInput ? modeInput.value : 'single';

        const actionInput = document.querySelector('input[name="click_action"]:checked');
        const action = actionInput ? actionInput.value : 'toggle';

        let targetState = null;
        if (action === 'select') targetState = true;
        if (action === 'deselect') targetState = false;

        const clickedParent = resolveSelectionParent(clickedObj);
        if (mode === 'parent' && !clickedObj.userData?.sceneAsset && clickedParent && clickedParent.type !== 'Scene') {
            const parent = clickedParent;
            const isSelected = movingObjects.some(item => item.obj === clickedObj);
            const finalState = action === 'toggle' ? !isSelected : targetState;

            parent.traverse((child) => {
                if (child.isMesh && interactableObjects.includes(child)) {
                    // Skip proxy update until all children are processed
                    toggleMovingObject(child, finalState, true);
                }
            });
            updateTransformProxy();
        } else {
            const finalState = action === 'toggle' ? null : targetState;
            toggleMovingObject(clickedObj, finalState);
        }
    }
}

// The identity of the asset a project was authored against. Hashing the GLB
// bytes is the only check that catches a mesh whose geometry changed under an
// unchanged name — a summary of names, vertex counts and bounding boxes misses
// a moved hole or a retopologised surface, which is exactly when restored
// transforms and rig pivots go quietly wrong.
let modelFingerprint = null;

async function fetchModelWithFingerprint(url) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Model request failed: ${response.status}`);

    // Stream so the existing percentage readout keeps working.
    const total = Number(response.headers.get('content-length')) || 0;
    const statusEl = document.getElementById('loader-status');
    const chunks = [];
    let loaded = 0;
    const reader = response.body?.getReader();
    if (reader) {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (statusEl && total) {
                statusEl.textContent = 'Loading 3D workspace... ' + Math.min(100, Math.round((loaded / total) * 100)) + '%';
            }
        }
    }
    let buffer;
    if (reader) {
        const bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
    } else {
        buffer = await response.arrayBuffer();
    }

    let fingerprint = null;
    try {
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        fingerprint = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        // crypto.subtle is unavailable over plain HTTP on some origins. A project
        // saved without a fingerprint imports with a weaker check rather than none.
        console.warn('[ErgoFlex] Could not fingerprint the model:', error);
    }
    return { buffer, fingerprint };
}

function loadModel() {
    const onLoaded = (gltf) => {
        workspaceAccessories?.dispose();
        workspaceAccessories = null;
        if (loadedModel) scene.remove(loadedModel);

        sharedBirchMaterial = null;
        woodMaterials.clear();
        loadBirchPhoto();
        sharedBasePaintMaterial = null;
        sharedPolishedAluminumMaterial = null;
        sharedBlackPlasticMaterial = null;
        sharedBlackMetalMaterial = null;

        movingObjects = [];
        liftObjects.clear();
        telescopingObjects = [];
        interactableObjects = [];
        boxHelpers.forEach(h => scene.remove(h));
        boxHelpers.clear();
        editorIdCounter = 0;
        partRegistry.clear();
        proxyOriginalParents.clear();
        animOriginalParents.clear();
        if(transformControl) transformControl.detach();
        if(transformProxy) {
            [...transformProxy.children].forEach(c => scene.attach(c));
        }

        loadedModel = gltf.scene;

        loadedModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat, index) => {
                    if (!mat) return;
                    const colorHex = mat.color ? mat.color.getHexString().toLowerCase() : 'ffffff';
                    let newMaterial = mat;

                    if (BIRCH_COLORS.includes(colorHex)) newMaterial = getOrCreateWoodMaterial(woodRoleFor(child));
                    else if (BASE_PAINT_COLORS.includes(colorHex)) newMaterial = getOrCreateBasePaintMaterial();
                    else if (POLISHED_ALUMINUM_COLORS.includes(colorHex)) newMaterial = getOrCreatePolishedAluminumMaterial();
                    else if (BLACK_PLASTIC_COLORS.includes(colorHex)) newMaterial = getOrCreateBlackPlasticMaterial();
                    else if (BLACK_METAL_COLORS.includes(colorHex)) newMaterial = getOrCreateBlackMetalMaterial();

                    if (Array.isArray(child.material)) child.material[index] = newMaterial;
                    else child.material = newMaterial;
                });
            }
        });

        const box = new THREE.Box3().setFromObject(loadedModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxSize = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / maxSize;
        loadedModel.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(loadedModel);
        loadedModel.position.x = -center.x * scale;
        loadedModel.position.y = -scaledBox.min.y + 0.005;
        loadedModel.position.z = -center.z * scale;

        scene.add(loadedModel);
        loadedModel.updateMatrixWorld(true);

        // Apply PART_BAKE_DATA: set world positions for telescoping parts before capturing baseY
        for (const [partName, bakeData] of Object.entries(PART_BAKE_DATA)) {
            loadedModel.traverse((child) => {
                if (child.isMesh && child.name === partName) {
                    const worldPos = new THREE.Vector3(bakeData.position.x, bakeData.position.y, bakeData.position.z);
                    // Convert world position to local space of the parent
                    if (child.parent) {
                        child.parent.updateMatrixWorld(true);
                        child.parent.worldToLocal(worldPos);
                    }
                    child.position.copy(worldPos);
                    child.updateMatrixWorld(true);
                }
            });
        }

        controls.update();

        // Build interactable list, assign editorIds, and populate initial selection
        loadedModel.traverse((child) => {
            if (child.isMesh) {
                // Phase 2.0: Assign stable editorId
                const editorId = child.name + '_' + (editorIdCounter++);
                child.userData.editorId = editorId;
                partRegistry.set(editorId, { obj: child, name: child.name, editorId: editorId, isClone: false });

                interactableObjects.push(child);

                if (TELESCOPING_PARTS.includes(child.name)) {
                    // baseY captured AFTER bake data applied = position at LIFT_MIN
                    telescopingObjects.push({
                        obj: child,
                        baseY: child.position.y
                    });
                } else if (INITIAL_ANIMATED_PARTS.includes(child.name)) {
                    // Raw GLB position = position at lift=0, NOT LIFT_MIN.
                    // baseY must be position at LIFT_MIN, so: baseY = rawY + LIFT_MIN
                    movingObjects.push({
                        obj: child,
                        baseY: child.position.y + LIFT_MIN
                    });
                    liftObjects.set(child, movingObjects[movingObjects.length - 1]);
                    const helper = new THREE.BoxHelper(child, 0x30d158);
                    scene.add(helper);
                    boxHelpers.set(child.uuid, helper);
                    helper.visible = isSelectionMode;
                }
            }
        });

        updateTransformProxy();

        // Apply initial position at LIFT_MIN (28") so model doesn't start at raw ~45"
        updateMovingObjectsPosition();

        // Pristine baseline, captured after PART_BAKE_DATA and before any rig
        // reparents anything. Sizing and project restore both recompute from
        // this rather than from the live scene.
        assetBaseline.clear();
        editTransforms.clear();
        partRegistry.forEach(entry => captureAssetBaseline(entry.obj));

        restorePartLabels();

        // Rebuild tilt rigs: baked production configs + any saved this session
        restoreTiltConfigs();

        // Actuator rigs restore AFTER tilts so rest state is captured correctly
        restoreActuatorRigs();

        // Auto-rig the omni wheels from part naming, remember the home position
        buildWheelRigs();
        glideBase.copy(loadedModel.position);
        const millimetreScale = loadedModel.scale.x * (LIFT_MAX - LIFT_MIN) / (HEIGHT_MAX - HEIGHT_MIN) / 25.4;
        withNeutralPose(() => { workspaceAccessories = new WorkspaceAccessories(scene, partRegistry, millimetreScale, loadedModel); });
        applyAccessoryVisibility();
        if (!workspaceRoom) workspaceRoom = new WorkspaceRoom(scene, millimetreScale);
        setRoomScene(selectedRoomScene, false);
        applySurfaceFinish();   // now that surfaceInches can measure the real model
        syncBuildSummary();
        document.getElementById('scene-status').textContent = 'LIVE 3D · READY';
        syncViewerSize();
        focusObjects([loadedModel]);

        // Phase 1.4: Material smoke check
        if (!woodMaterials.size) {
            console.warn('[ErgoFlex] No wood materials after model load — wood finish swatches will not work.');
        }
        if (!sharedBasePaintMaterial) {
            console.warn('[ErgoFlex] sharedBasePaintMaterial is null after model load — base finish swatches will not work.');
        }

        // Phase 1.3: Temporary instrumentation — log column positions at min height
        console.log('[ErgoFlex] Model loaded at LIFT_MIN (' + HEIGHT_MIN + '"). Telescoping column positions:');
        telescopingObjects.forEach(item => {
            const wp = new THREE.Vector3();
            item.obj.getWorldPosition(wp);
            console.log('  ' + item.obj.name + ' localY=' + item.obj.position.y.toFixed(6) + ' worldY=' + wp.y.toFixed(6));
        });

        // Hide selection boxes initially and detach tools
        boxHelpers.forEach(helper => helper.visible = false);
        if(transformControl) transformControl.detach();

        // Restore saved groups: baked defaults + anything saved on this machine.
        // localStorage (not sessionStorage) so closing the tab loses nothing.
        try {
            const stored = localStorage.getItem('ergoflexGroups');
            savedGroups = Object.assign({}, BAKED_GROUPS, stored ? JSON.parse(stored) : {});
        } catch(e) { savedGroups = Object.assign({}, BAKED_GROUPS); }
        rebuildGroupDropdown();

        // Debug panel collapse state (read from localStorage by makeCollapsible)
        initDebugPanelCollapse();

        // Selecting parts never changes the production lift assembly.
        if (clearPartsBtn) clearPartsBtn.click();
        // Build scene tree
        buildSceneTree();

        controls.autoRotate = false;

        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);

    };

    const onError = (error) => {
        console.error('Error loading model:', error);
        if (loader) {
            loader.innerHTML = `
                <div class="flex flex-col items-center p-4 text-center">
                    <svg class="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-sm text-gray-800 font-medium">Model Load Error</p>
                </div>
            `;
        }
    };

    // Fetch the bytes ourselves so they can be hashed, then hand the same buffer
    // to the parser — one download, not two.
    const url = PRODUCT_CONFIG.modelUrl;
    fetchModelWithFingerprint(url).then(({ buffer, fingerprint }) => {
        modelFingerprint = fingerprint;
        const basePath = url.slice(0, url.lastIndexOf('/') + 1);
        gltfLoader.parse(buffer, basePath, onLoaded, onError);
    }).catch(error => {
        // A CORS-restricted host will not hand over the body. Fall back to the
        // loader's own request; the project fingerprint is simply absent.
        console.warn('[ErgoFlex] Falling back to unhashed model load:', error);
        modelFingerprint = null;
        gltfLoader.load(url, onLoaded, (xhr) => {
            const statusEl = document.getElementById('loader-status');
            if (statusEl && xhr.total) {
                statusEl.textContent = 'Loading 3D workspace... ' + Math.min(100, Math.round((xhr.loaded / xhr.total) * 100)) + '%';
            }
        }, onError);
    });
}

// --- Project save and restore ----------------------------------------------

const PROJECT_AUTOSAVE_KEY = 'ergoflexProjectAutosaveV1';
const PROJECT_AUTOSAVE_SLOTS = 5;
const PROJECT_AUTOSAVE_BUDGET = 4 * 1024 * 1024;

const v3 = v => ({ x: v.x, y: v.y, z: v.z });
const v4 = v => ({ x: v.x, y: v.y, z: v.z, w: v.w });

// The transform a part would have at the current size with no user edits.
// Sizing (Phase 2) will compose its own transformation here; until then a part's
// sized baseline is its asset baseline. Edits are stored as a delta against this
// value, never as an absolute, so that a part edited at one size keeps its edit
// relative to wherever a different size puts it rather than snapping back.
function sizedBaseline(editorId) {
    return assetBaseline.get(editorId) || null;
}

// Delta from `base` to `edited`, in the part's canonical parent space.
function transformDelta(base, edited) {
    return {
        p: { x: edited.p.x - base.p.x, y: edited.p.y - base.p.y, z: edited.p.z - base.p.z },
        q: v4(base.q.clone().invert().multiply(edited.q)),
        s: { x: edited.s.x / base.s.x, y: edited.s.y / base.s.y, z: edited.s.z / base.s.z }
    };
}

// Recompose in a fixed order — scale, then rotation, then translation. TRS
// composition does not commute, so both ends must agree on one order.
function applyTransformDelta(obj, base, delta) {
    obj.scale.set(base.s.x * delta.s.x, base.s.y * delta.s.y, base.s.z * delta.s.z);
    obj.quaternion.copy(base.q).multiply(new THREE.Quaternion(delta.q.x, delta.q.y, delta.q.z, delta.q.w));
    obj.position.set(base.p.x + delta.p.x, base.p.y + delta.p.y, base.p.z + delta.p.z);
    obj.updateMatrixWorld(true);
}

function serializeProject() {
    // Motion is read BEFORE neutralising, or it would record the rest pose the
    // capture itself just imposed rather than the pose the desk is actually in.
    const motion = {
        heightInches: liftToHeight(currentLift),
        tilt: Object.fromEntries(tiltConfigs.map(c => [c.name, c.currentDeg])),
        // The target, not the current offset: glide eases toward its target over
        // several frames, so saving the offset would capture wherever the desk
        // happened to be mid-transit rather than the position that was asked for.
        glide: { x: glideTarget.x, z: glideTarget.z }
    };

    return withNeutralPose(() => {
        const clones = [];
        partRegistry.forEach(entry => {
            if (!entry.isClone) return;
            const canon = canonicalTransform(entry.obj);
            const parent = canonicalParent(entry.obj);
            clones.push({
                editorId: entry.editorId,
                sourceEditorId: entry.obj.userData?.sourceEditorId || null,
                parentEditorId: parent?.userData?.editorId || 'model',
                transform: canon ? { p: v3(canon.p), q: v4(canon.q), s: v3(canon.s) } : undefined
            });
        });

        const transforms = [];
        editTransforms.forEach((edited, editorId) => {
            const base = sizedBaseline(editorId);
            if (!base || !partRegistry.has(editorId)) return;
            const delta = transformDelta(base, edited);
            // Only record edits that actually moved something.
            const moved = Math.abs(delta.p.x) + Math.abs(delta.p.y) + Math.abs(delta.p.z) > 1e-9
                || Math.abs(1 - delta.q.w) > 1e-9
                || Math.abs(delta.s.x - 1) + Math.abs(delta.s.y - 1) + Math.abs(delta.s.z - 1) > 1e-9;
            if (moved) transforms.push({ editorId, delta });
        });

        const liftMembers = [];
        liftObjects.forEach((_, obj) => { if (obj.userData?.editorId) liftMembers.push(obj.userData.editorId); });

        return {
            formatVersion: PROJECT_FORMAT_VERSION,
            savedAt: new Date().toISOString(),
            model: {
                url: PRODUCT_CONFIG.modelUrl,
                partCount: partRegistry.size,
                contentFingerprint: modelFingerprint
            },
            customerConfig: cleanConfig(currentConfig),
            // Only what affects the rendered product. Sidebar width and panel
            // collapse are this browser's preferences and stay in their own keys —
            // a project shared between machines should not rearrange the editor.
            presentation: {
                surfaceFinish,
                grainEnabled,
                environment: document.getElementById('studio-environment')?.value || 'gallery',
                roomScene: selectedRoomScene,
                sceneAssets: serializeSceneAssetStates(),
                sceneAssetLabels: [...partLabels].filter(([editorId]) => editorId.startsWith('scene:')),
                sceneAssetLocked: [...lockedParts].filter(editorId => editorId.startsWith('scene:')),
                exposure: renderer ? renderer.toneMappingExposure : 1.02,
                camera: camera && controls
                    ? { position: v3(camera.position), target: v3(controls.target) }
                    : null
            },
            motion,
            parts: {
                labels: [...partLabels].filter(([editorId]) => partRegistry.has(editorId)),
                clones,
                transforms,
                liftMembers,
                locked: [...lockedParts].filter(editorId => partRegistry.has(editorId)),
                groups: JSON.parse(JSON.stringify(savedGroups))
            },
            rigs: {
                tilt: serializeTiltConfigs(),
                actuator: serializeActuatorRigs(),
                // Wheel rigs are derived from part naming and bounding boxes, so they
                // are rebuilt rather than restored. Recorded for diagnosis only.
                wheels: wheelRigs.map(r => ({ prefix: r.prefix, latSign: r.latSign, radius: r.radius }))
            },
            deletedBaked: {
                tilt: [...deletedBakedRigs.tilt],
                actuator: [...deletedBakedRigs.actuator]
            }
        };
    });
}

// Which baked rigs the user has deliberately deleted. Without this a baked
// default resurrects itself on the next load and the deletion looks like a bug.
const deletedBakedRigs = { tilt: new Set(), actuator: new Set() };
const lockedParts = new Set();

// A snapshot of everything applyProject is about to overwrite, so a failed
// import can be undone. Held in memory rather than only in the autosave ring,
// because recovery has to work when the storage write is what failed.
function captureRollback() {
    try { return serializeProject(); } catch (error) {
        console.warn('[ErgoFlex] Could not capture a rollback snapshot:', error);
        return null;
    }
}

function assetEditorIds() {
    const ids = new Set();
    partRegistry.forEach(entry => { if (!entry.isClone) ids.add(entry.editorId); });
    return ids;
}

/**
 * Apply a validated project. Returns { ok, problems }.
 *
 * Nothing is mutated until validation has passed, and on any failure the
 * pre-import snapshot is restored. An import REPLACES project state: rigs,
 * groups, labels, clones, lift membership and edits. Legacy per-key localStorage
 * merging is a separate path, not folded in here, so a rig the user deleted
 * stays deleted.
 */
function applyProject(project, { confirmSoft = null, isRollback = false } = {}) {
    const result = validateProjectFile(project, {
        assetIds: assetEditorIds(),
        modelUrl: PRODUCT_CONFIG.modelUrl,
        modelFingerprint
    });
    const hard = hardProblems(result.problems);
    if (!result.ok || hard.length) {
        return { ok: false, problems: result.problems };
    }
    const soft = softProblems(result.problems);
    if (soft.length && confirmSoft && !confirmSoft(soft)) {
        return { ok: false, cancelled: true, problems: result.problems };
    }

    const rollback = isRollback ? null : captureRollback();
    try {
        withNeutralPose(() => {
            clearProjectState();
            const parts = project.parts || {};

            // 1. labels
            partLabels.clear();
            for (const [editorId, label] of parts.labels || []) partLabels.set(editorId, label);

            // 2. clones, in dependency order, before anything resolves ids
            for (const clone of result.cloneOrder) {
                const source = partRegistry.get(clone.sourceEditorId);
                if (!source) continue;
                const parent = clone.parentEditorId && clone.parentEditorId !== 'model'
                    ? partRegistry.get(clone.parentEditorId)?.obj : null;
                const made = makeClone(source.obj, clone.editorId, { parent, offsetX: 0, joinLift: false });
                if (clone.transform) {
                    made.position.set(clone.transform.p.x, clone.transform.p.y, clone.transform.p.z);
                    made.quaternion.set(clone.transform.q.x, clone.transform.q.y, clone.transform.q.z, clone.transform.q.w);
                    made.scale.set(clone.transform.s.x, clone.transform.s.y, clone.transform.s.z);
                    made.updateMatrixWorld(true);
                }
                if (/_clone_(\d+)$/.test(clone.editorId)) {
                    editorIdCounter = Math.max(editorIdCounter, Number(RegExp.$1) + 1);
                }
            }

            // 3. edits, composed onto the sized baseline
            for (const { editorId, delta } of parts.transforms || []) {
                const entry = partRegistry.get(editorId);
                const base = sizedBaseline(editorId);
                if (!entry || !base) continue;
                applyTransformDelta(entry.obj, base, delta);
                editTransforms.set(editorId, canonicalTransform(entry.obj));
            }

            // 4. groups and locks
            savedGroups = Object.assign({}, parts.groups || {});
            for (const editorId of parts.locked || []) lockedParts.add(editorId);

            // 5. lift membership, after edits so baseY derives from the edited pose
            liftObjects.clear();
            for (const editorId of parts.liftMembers || []) {
                const entry = partRegistry.get(editorId);
                if (!entry) continue;
                const canon = canonicalTransform(entry.obj);
                liftObjects.set(entry.obj, { obj: entry.obj, baseY: canon ? canon.p.y : entry.obj.position.y });
            }

            // 6. rigs. Wrappers use attach(), which preserves world transform, so
            //    they pick up the edited positions applied in step 3.
            const rigs = project.rigs || {};
            for (const config of rigs.tilt || []) {
                const rigParts = (config.groupEditorIds || []).map(id => partRegistry.get(id)?.obj).filter(Boolean);
                if (rigParts.length) createTiltConfig({ ...config, parts: rigParts });
            }
            for (const rig of rigs.actuator || []) buildActuatorRig(rig);
            buildWheelRigs();
            if (loadedModel) glideBase.copy(loadedModel.position);

            deletedBakedRigs.tilt = new Set(project.deletedBaked?.tilt || []);
            deletedBakedRigs.actuator = new Set(project.deletedBaked?.actuator || []);
        });

        // 7. motion, applied AFTER the neutral-pose scope — inside it, the restore
        //    in the finally block would immediately overwrite whatever we set.
        applyProjectMotion(project.motion);
        applyProjectPresentation(project);

        rebuildTiltUI();
        rebuildRigUI();
        rebuildGroupDropdown();
        buildSceneTree();
        markEdited();
        return { ok: true, problems: result.problems };
    } catch (error) {
        console.error('[ErgoFlex] Import failed, rolling back:', error);
        if (rollback) {
            try { applyProject(rollback, { isRollback: true }); }
            catch (rollbackError) { console.error('[ErgoFlex] Rollback also failed:', rollbackError); }
        }
        return { ok: false, problems: [...result.problems, { severity: 'hard', code: 'apply-failed', message: error.message }] };
    }
}

// Tear down everything an import replaces, so nothing from the previous project
// survives into the new one.
function clearProjectState() {
    for (let i = tiltConfigs.length - 1; i >= 0; i--) removeTiltConfig(i, { recordUndo: false });
    for (let i = actuatorRigs.length - 1; i >= 0; i--) removeActuatorRig(i, { recordUndo: false });

    // Clones are the previous project's, and the incoming file brings its own.
    [...partRegistry.values()].filter(entry => entry.isClone).forEach(entry => {
        liftObjects.delete(entry.obj);
        toggleMovingObject(entry.obj, false, true);
        const idx = interactableObjects.indexOf(entry.obj);
        if (idx > -1) interactableObjects.splice(idx, 1);
        if (entry.obj.parent) entry.obj.parent.remove(entry.obj);
        partRegistry.delete(entry.editorId);
        assetBaseline.delete(entry.editorId);
    });

    // Reset every asset part to its pristine baseline before the incoming edits
    // are composed on top.
    editTransforms.forEach((_, editorId) => {
        const entry = partRegistry.get(editorId);
        const base = assetBaseline.get(editorId);
        if (!entry || !base) return;
        entry.obj.position.copy(base.p);
        entry.obj.quaternion.copy(base.q);
        entry.obj.scale.copy(base.s);
        entry.obj.updateMatrixWorld(true);
    });
    editTransforms.clear();
    lockedParts.clear();
    savedGroups = {};
}

function applyProjectMotion(motion) {
    if (!motion) return;
    if (Number.isFinite(motion.heightInches)) {
        manualLiftOverride = true;
        currentLift = targetLift = heightToLift(THREE.MathUtils.clamp(motion.heightInches, HEIGHT_MIN, HEIGHT_MAX));
        updateMovingObjectsPosition();
        showHeight(liftToHeight(currentLift));
    }
    for (const [name, deg] of Object.entries(motion.tilt || {})) {
        const config = tiltConfigs.find(c => c.name === name);
        if (config) { config.currentDeg = THREE.MathUtils.clamp(deg, config.minDeg, config.maxDeg); applyTiltConfig(config); }
    }
    if (motion.glide && Number.isFinite(motion.glide.x) && Number.isFinite(motion.glide.z)) {
        glideTarget.set(THREE.MathUtils.clamp(motion.glide.x, -1, 1), 0, THREE.MathUtils.clamp(motion.glide.z, -1, 1));
        applyGlideOffset(glideTarget);
    }
}

// Pushes currentConfig into the DOM and the shared materials. The swatch grids
// are rebuilt by populateFinishOptions, which reads currentConfig, so a project
// import can reuse exactly the path a page load takes.
// The markup's <option> labels and data-price attributes were hardcoded and
// unread, so they could disagree with PRODUCT_CONFIG. Generate them instead.
function populateSizeOptions() {
    if (!sizeSelect) return;
    sizeSelect.replaceChildren();
    for (const [key, size] of Object.entries(PRODUCT_CONFIG.sizes)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = size.name + (size.price ? ` · +${money(size.price)}` : '');
        sizeSelect.append(option);
    }
    sizeSelect.value = currentConfig.size;
}

function applyConfigToUI() {
    if (sizeSelect) sizeSelect.value = currentConfig.size;
    const woodName = document.getElementById('selected-wood-name');
    const baseName = document.getElementById('selected-base-name');
    if (woodName) woodName.textContent = currentConfig.woodFinish;
    if (baseName) baseName.textContent = currentConfig.baseFinish;
    const wood = PRODUCT_CONFIG.woodFinishes.find(f => f.name === currentConfig.woodFinish);
    const base = PRODUCT_CONFIG.baseFinishes.find(f => f.name === currentConfig.baseFinish);
    if (wood) applyWoodSpecies(wood);
    if (base && sharedBasePaintMaterial) {
        sharedBasePaintMaterial.color.set(base.color);
        sharedBasePaintMaterial.metalness = frameMetalness(base);
    }
    document.querySelectorAll('#wood-finishes [data-finish], #base-finishes [data-material]').forEach(el => {
        const selected = el.dataset.finish === currentConfig.woodFinish || el.dataset.material === currentConfig.baseFinish;
        el.classList.toggle('selected', selected);
    });
    updatePrice();
}

function applyProjectPresentation(project) {
    const presentation = project.presentation || {};
    if (validConfig(project.customerConfig)) {
        currentConfig = cleanConfig(project.customerConfig);
        applyConfigToUI();
        applyAccessoryVisibility();
        renderAccessories();
    }
    if (presentation.surfaceFinish) {
        surfaceFinish = presentation.surfaceFinish;
        const el = document.getElementById('surface-finish');
        if (el) el.value = surfaceFinish;
    }
    if (typeof presentation.grainEnabled === 'boolean') {
        grainEnabled = presentation.grainEnabled;
        const el = document.getElementById('wood-grain');
        if (el) el.checked = grainEnabled;
    }
    applySurfaceFinish();
    clearSceneAssetRegistration();
    restoreSceneAssetStates(presentation.sceneAssets || {});
    for (const [editorId, label] of presentation.sceneAssetLabels || []) partLabels.set(editorId, label);
    for (const editorId of presentation.sceneAssetLocked || []) lockedParts.add(editorId);
    persistSceneAssetStates();
    setRoomScene(presentation.roomScene || 'product', false);
    const environment = document.getElementById('studio-environment');
    if (environment && presentation.environment) {
        environment.value = presentation.environment;
        environment.dispatchEvent(new Event('change'));
    }
    if (renderer && Number.isFinite(presentation.exposure)) {
        (roomLightSettings[selectedRoomScene] ||= {}).exposure = presentation.exposure;
        applyRoomLighting();
    }
    if (presentation.camera && camera && controls) {
        camera.position.set(presentation.camera.position.x, presentation.camera.position.y, presentation.camera.position.z);
        controls.target.set(presentation.camera.target.x, presentation.camera.target.y, presentation.camera.target.z);
        controls.update();
    }
}

// Collapsing the options panel hands the whole grid row to the viewer. Uses the
// same makeCollapsible mechanism as the store accordion and the movement dock.
function initConfigColumnCollapse() {
    const button = document.getElementById('config-collapse');
    const grid = document.getElementById('store-grid');
    const column = document.getElementById('viewer-column');
    if (!button || !grid || !column) return;
    const toggle = makeCollapsible('config-column', {
        storageKey: 'ergoflex.configColumnCollapsed',
        mode: 'display',
        onToggle: collapsed => {
            button.textContent = collapsed ? 'Show options' : 'Hide options';
            button.setAttribute('aria-expanded', String(!collapsed));
            document.getElementById('config-column')?.classList.toggle('collapsed', collapsed);
            // Not a Tailwind class swap: the CDN JIT only generates classes it
            // finds in the markup, and lg:col-span-4 appears nowhere, so adding
            // it did nothing. Toggle a real rule in studio.css instead.
            grid.classList.toggle('options-hidden', collapsed);
            syncViewerSize();
            requestAnimationFrame(syncViewerSize);
            setTimeout(syncViewerSize, 60);
        }
    });
    button.onclick = toggle;
}

// --- Build validation -------------------------------------------------------
//
// Advisory. Findings are shown, never enforced, until a rule's limit comes from
// a real product specification. blockingFindings returns nothing today, and the
// order button is only disabled if that changes.

// Problems the app detects while building rigs. These used to go to the console
// only, where nobody saw them.
const sceneWarnings = [];
function reportSceneWarning(code, message, parts) {
    if (sceneWarnings.some(w => w.code === code && w.message === message)) return;
    sceneWarnings.push({ code, message, parts });
    scheduleValidation();
}

let validationCache = { key: null, findings: [] };
let validationTimer = null;

function rigSignature() {
    return tiltConfigs.map(c => c.name).join(',') + '|' + actuatorRigs.map(r => r.name).join(',');
}

// Measures the scene for the rules. Sampling the lift alone would measure almost
// nothing, because the solver moves the actuator base with the lift and the
// target is itself a lift member — so both endpoints travel together. Tilt is
// what changes the geometry, so this walks the lift x tilt grid.
function sampleSceneForValidation() {
    if (!loadedModel || !actuatorRigs.length) return { actuators: [], overlaps: [], warnings: sceneWarnings };

    const heights = [HEIGHT_MIN, (HEIGHT_MIN + HEIGHT_MAX) / 2, HEIGHT_MAX];
    const tiltSteps = tiltConfigs.length
        ? [tiltConfigs[0].minDeg, (tiltConfigs[0].minDeg + tiltConfigs[0].maxDeg) / 2, tiltConfigs[0].maxDeg]
        : [0];
    const lengths = new Map(actuatorRigs.map(rig => [rig.name, []]));

    const savedLift = currentLift, savedTarget = targetLift, savedOverride = manualLiftOverride;
    const savedTilts = tiltConfigs.map(c => c.currentDeg);
    const wasSuppressed = suppressTransactions;
    const wasPaused = motionPaused;
    suppressTransactions = true;
    motionPaused = true;
    try {
        for (const height of heights) {
            manualLiftOverride = true;
            currentLift = targetLift = heightToLift(height);
            for (const deg of tiltSteps) {
                tiltConfigs.forEach(config => {
                    config.currentDeg = THREE.MathUtils.clamp(deg, config.minDeg, config.maxDeg);
                });
                updateMovingObjectsPosition();
                tiltConfigs.forEach(applyTiltConfig);
                updateActuatorRigs();
                for (const rig of actuatorRigs) {
                    const base = new THREE.Vector3(rig.baseLocal.x, rig.baseLocal.y + (currentLift - LIFT_MIN), rig.baseLocal.z);
                    const tip = rig.targetLocalCenter.clone();
                    rig.targetObj.updateWorldMatrix(true, false);
                    rig.targetObj.localToWorld(tip);
                    loadedModel.worldToLocal(tip);
                    lengths.get(rig.name).push(tip.sub(base).length());
                }
            }
        }
    } finally {
        currentLift = savedLift; targetLift = savedTarget; manualLiftOverride = savedOverride;
        tiltConfigs.forEach((config, i) => { config.currentDeg = savedTilts[i] ?? 0; });
        updateMovingObjectsPosition();
        tiltConfigs.forEach(applyTiltConfig);
        updateActuatorRigs();
        suppressTransactions = wasSuppressed;
        motionPaused = wasPaused;
    }

    return {
        actuators: actuatorRigs.map(rig => ({ name: rig.name, lengths: lengths.get(rig.name) })),
        overlaps: sampleCoarseOverlaps(),
        warnings: sceneWarnings
    };
}

// Per-assembly boxes, not per-mesh: 830 meshes cannot be pair-tested
// interactively, and the result is a candidate list either way.
function assemblyRole(name) {
    if (/^Desktop/.test(name)) return 'desktop';
    if (/^Top_Shelf/.test(name)) return 'shelf';
    if (/^Lift_Column/.test(name)) return 'column';
    if (/^(Linear_Actuators|L_A_Hardware)/.test(name)) return 'actuator';
    if (/^Wheel_/.test(name)) return 'wheel';
    if (/^(Plates_Hardware|Screws|Joinery|Power|Leds|Touch_Screen|Foot_Rest)/.test(name)) return 'hardware';
    return 'other';
}

function sampleCoarseOverlaps() {
    const boxes = new Map();
    partRegistry.forEach(entry => {
        const role = assemblyRole(entry.name);
        if (role === 'other' || !entry.obj.visible) return;
        entry.obj.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(entry.obj);
        if (boxes.has(role)) boxes.get(role).union(box);
        else boxes.set(role, box);
    });
    const roles = [...boxes.keys()];
    const overlaps = [];
    for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
            const a = boxes.get(roles[i]), b = boxes.get(roles[j]);
            if (!a.intersectsBox(b)) continue;
            const overlap = a.clone().intersect(b).getSize(new THREE.Vector3());
            overlaps.push({ a: roles[i], b: roles[j], aRole: roles[i], bRole: roles[j],
                            amount: Math.min(overlap.x, overlap.y, overlap.z) });
        }
    }
    return overlaps;
}

function runValidation() {
    const key = validationCacheKey({
        fingerprint: modelFingerprint, size: currentConfig.size,
        editRevision, rigSignature: rigSignature(), accessories: currentConfig.accessories,
        warningRevision: sceneWarnings.length
    });
    if (validationCache.key === key) return validationCache.findings;
    const findings = validateBuild(currentConfig, sampleSceneForValidation());
    validationCache = { key, findings };
    renderValidation(findings);
    return findings;
}

function scheduleValidation() {
    clearTimeout(validationTimer);
    const run = () => runValidation();
    validationTimer = setTimeout(() =>
        (window.requestIdleCallback || window.setTimeout)(run, { timeout: 1500 }), 300);
}

function renderValidation(findings) {
    const panel = document.getElementById('validation-panel');
    if (!panel) return;
    panel.replaceChildren();

    const blocking = blockingFindings(findings);
    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warning');

    const summary = document.createElement('p');
    summary.className = 'validation-summary';
    summary.textContent = findings.length
        ? `${errors.length} to resolve · ${warnings.length} to check`
        : 'No issues found in this configuration.';
    panel.append(summary);

    for (const item of findings) {
        const row = document.createElement('div');
        row.className = 'validation-row severity-' + item.severity;
        const label = document.createElement('span');
        label.textContent = item.message;
        row.append(label);
        panel.append(row);
    }

    if (findings.length) {
        const note = document.createElement('p');
        note.className = 'studio-note';
        note.textContent = blocking.length
            ? 'Ordering is blocked until the items above are resolved.'
            : 'These are geometric checks against unconfirmed limits, so they are advisory and do not block ordering.';
        panel.append(note);
    }

    // Only a promoted rule can disable the order button, and none are promoted
    // while the product specification is missing.
    const addToCart = document.getElementById('add-to-cart');
    if (addToCart) {
        addToCart.disabled = blocking.length > 0;
        addToCart.title = blocking.length ? blocking[0].message : '';
    }
}

function buildValidationPanel() {
    if (document.getElementById('validation-panel')) return;
    const anchorEl = document.getElementById('price-breakdown');
    if (!anchorEl) return;
    const wrapper = document.createElement('details');
    wrapper.className = 'validation-block';
    wrapper.innerHTML = '<summary>Build checks <span>Design preview</span></summary><div id="validation-panel"></div>';
    anchorEl.after(wrapper);
    scheduleValidation();
}

// --- Guided configurations --------------------------------------------------

function toggleAccessory(id) {
    if (!accessoryFits(id, currentConfig.size)) {
        const item = accessory(id);
        return notifyUser(item?.note || `${item?.name || 'That accessory'} is not available for this size.`);
    }
    const index = currentConfig.accessories.indexOf(id);
    if (index > -1) currentConfig.accessories.splice(index, 1);
    else {
        const group = accessory(id).exclusiveGroup;
        const previous = group && currentConfig.accessories.find(other => accessory(other)?.exclusiveGroup === group);
        currentConfig = cleanConfig({ ...currentConfig, accessories: [...currentConfig.accessories, id] });
        if (previous) notifyUser(`${accessory(id).name} replaces ${accessory(previous).name.toLowerCase()}.`);
    }
    applyAccessoryVisibility();
    renderAccessories();
    updatePrice();
}

// Native options and generated reference models share the same selected IDs.
function applyAccessoryVisibility() {
    for (const item of ACCESSORIES) {
        if (!item.node) continue;
        const on = currentConfig.accessories.includes(item.id);
        partRegistry.forEach(entry => {
            if (entry.name === item.node || entry.name.startsWith(item.node + '_')) entry.obj.visible = on;
        });
    }
    workspaceAccessories?.sync(currentConfig);
}

function renderAccessories() {
    const list = document.getElementById('accessory-list');
    if (!list) return;
    const focusedId = list.contains(document.activeElement) ? document.activeElement.id : null;
    list.replaceChildren();
    document.querySelectorAll('[data-accessory-category]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.accessoryCategory === accessoryCategory));
        if (button.dataset.accessoryCategory === 'Selected') button.textContent = `Selected (${currentConfig.accessories.length})`;
    });
    for (const item of ACCESSORIES) {
        const fits = accessoryFits(item.id, currentConfig.size);
        const on = currentConfig.accessories.includes(item.id);
        const row = document.createElement('article');
        row.className = 'accessory-row' + (fits ? '' : ' unavailable') + (on ? ' is-selected' : '');
        row.hidden = accessoryCategory === 'Selected' ? !on : item.category !== accessoryCategory;
        row.dataset.accessory = item.id;
        const illustration = document.createElement('div'); illustration.className = 'accessory-art';
        illustration.innerHTML = accessoryIllustration(item.visual || (item.id === 'led-strip' ? 'led' : 'foot'));
        const info = document.createElement('div'); info.className = 'accessory-info';
        const brand = document.createElement('span'); brand.className = 'accessory-brand'; brand.textContent = item.brand || 'ERGOFLEX · ACCESSORIES';
        const name = document.createElement('label'); name.className = 'accessory-name'; name.htmlFor = `accessory-${item.id}`; name.textContent = item.name;
        const detail = document.createElement('p'); detail.className = 'accessory-description'; detail.textContent = !fits ? item.note : item.description;
        info.append(brand, name, detail);
        const action = document.createElement('label'); action.className = 'accessory-add';
        const box = document.createElement('input'); box.type = 'checkbox'; box.id = name.htmlFor;
        box.checked = on && fits; box.disabled = !fits;
        box.setAttribute('aria-label', `${item.name}, ${money(item.price)} estimated`);
        box.onchange = () => toggleAccessory(item.id);
        const label = document.createElement('span'); label.textContent = on ? 'Added' : 'Add to build';
        const price = document.createElement('span'); price.className = 'accessory-price'; price.textContent = money(item.price) + '*';
        action.append(box, label, price);
        row.append(illustration, info, action);
        if (item.source) {
            const source = document.createElement('a'); source.href = item.source; source.target = '_blank'; source.rel = 'noopener noreferrer';
            source.className = 'accessory-source'; source.textContent = 'Product specifications ↗'; source.setAttribute('aria-label', `${item.name} manufacturer specifications (opens a new tab)`); row.append(source);
        }
        list.append(row);
    }
    if (accessoryCategory === 'Selected' && !currentConfig.accessories.length) {
        const empty = document.createElement('p'); empty.className = 'accessory-empty'; empty.textContent = 'Your workspace starts here. Explore Desktop or Support to add accessories.'; list.append(empty);
    }
    if (focusedId) {
        const input = document.getElementById(focusedId);
        const target = input?.closest('.accessory-row')?.hidden
            ? document.querySelector('[data-accessory-category="Selected"]') : input;
        target?.focus({ preventScroll: true });
    }
}

function renderPriceBreakdown() {
    const container = document.getElementById('price-breakdown');
    if (!container) return;
    container.replaceChildren();
    const lines = priceBreakdown(currentConfig);
    let provisional = false;
    for (const line of lines) {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        const label = document.createElement('span');
        label.textContent = line.label + (line.provisional ? '*' : '');
        if (line.provisional) provisional = true;
        const value = document.createElement('span');
        value.textContent = money(line.price);
        row.append(label, value);
        container.append(row);
    }
    const total = document.createElement('div');
    total.className = 'breakdown-row breakdown-total';
    const label = document.createElement('span');
    label.textContent = 'Estimate';
    const value = document.createElement('span');
    value.textContent = money(lines.reduce((n, l) => n + l.price, 0));
    total.append(label, value);
    container.append(total);
    if (provisional) {
        const note = document.createElement('p');
        note.className = 'studio-note';
        note.textContent = '* Accessory pricing is indicative and needs confirmation.';
        container.append(note);
    }
}

function applyPreset(preset) {
    currentConfig = cleanConfig(preset);
    applyConfigToUI();
    applyAccessoryVisibility();
    renderAccessories();
    if (preset.cameraPreset) {
        const select = document.getElementById('camera-view');
        if (select) { select.value = preset.cameraPreset; select.dispatchEvent(new Event('change')); }
    }
    notifyUser(`${preset.name} applied.`);
}

function buildGuidedConfiguration() {
    const column = document.getElementById('config-column-content');
    if (!column || document.getElementById('preset-list')) return;
    // Top level, not inside an accordion: these are how you START a
    // configuration, and they must not disappear when Desk Size is collapsed.
    const anchorEl = column;

    const presets = document.createElement('div');
    presets.id = 'preset-list';
    presets.className = 'preset-list';
    presets.innerHTML = '<div class="eyebrow">START FROM</div>';
    for (const preset of PRESETS) {
        const card = document.createElement('button');
        card.className = 'preset-card';
        card.dataset.preset = preset.id;
        card.innerHTML = `<strong>${preset.name}</strong><small>${preset.blurb}</small><em>${money(configurationPrice(cleanConfig(preset)))}</em>`;
        card.onclick = () => applyPreset(preset);
        presets.append(card);
    }
    // Above the accordions, below the product header.
    const header = column.querySelector('.mb-8');
    if (header) header.after(presets); else column.prepend(presets);

    const accessories = document.createElement('div');
    accessories.className = 'accessory-block';
    accessories.innerHTML = `<div class="eyebrow">MAKE IT YOURS</div><h2>Complete your workspace.</h2><p class="accessory-intro">Add a little comfort. See it on your desk.</p><div class="accessory-filters" role="group" aria-label="Accessory categories"><button data-accessory-category="Desktop" aria-pressed="true">Desktop</button><button data-accessory-category="Support" aria-pressed="false">Support</button><button data-accessory-category="Selected" aria-pressed="false">Selected (0)</button></div><div id="accessory-list"></div><p class="studio-note">Original 3D approximations; branded products use manufacturer dimensions. Mounting fit needs confirmation. * Estimated accessory prices; availability unconfirmed.</p>`;
    (document.getElementById('build-actions') || anchorEl.lastElementChild).before(accessories);
    accessories.querySelectorAll('[data-accessory-category]').forEach(button => button.onclick = () => { accessoryCategory = button.dataset.accessoryCategory; renderAccessories(); });

    const breakdown = document.createElement('div');
    breakdown.id = 'price-breakdown';
    breakdown.className = 'price-breakdown';
    document.getElementById('build-actions').prepend(breakdown);

    renderAccessories();
    renderPriceBreakdown();
    buildValidationPanel();
}

// --- Precision editing ------------------------------------------------------
//
// Numeric fields, alignment and locking all commit through commitTransform, so
// a typed value and a gizmo drag produce the same undo entry and the same
// canonical-transform bookkeeping. Anything editing geometry without going
// through it would not be saved.

// Snapshots world matrices, runs a mutation, then commits it as one edit.
function editSelection(mutate) {
    const objects = movingObjects.map(item => item.obj).filter(obj => !isLocked(obj));
    if (!objects.length) { notifyUser('Select at least one unlocked part first.'); return false; }
    const snapshot = objects.map(obj => {
        obj.updateWorldMatrix(true, false);
        return { obj, before: obj.matrixWorld.clone() };
    });
    mutate(objects);
    objects.forEach(obj => obj.updateMatrixWorld(true));
    const committed = commitTransform(snapshot);
    boxHelpers.forEach(h => h.update());
    updateTransformProxy();
    refreshTransformInspector();
    return committed;
}

function isLocked(obj) {
    const editorId = obj?.userData?.editorId;
    return Boolean(editorId && lockedParts.has(editorId));
}

function setLocked(obj, locked) {
    const editorId = obj?.userData?.editorId;
    if (!editorId) return;
    if (locked) {
        lockedParts.add(editorId);
        toggleMovingObject(obj, false, true);   // a locked part leaves the gizmo's grip
    } else {
        lockedParts.delete(editorId);
    }
    markEdited();
}

// The part the numeric fields describe: the last one selected, if it is still
// in the selection.
function inspectorTarget() {
    const entry = lastSelectedEditorId ? editorEntry(lastSelectedEditorId) : null;
    if (entry && movingObjects.some(item => item.obj === entry.obj)) return entry.obj;
    return movingObjects.length ? movingObjects[movingObjects.length - 1].obj : null;
}

let inspectorSuspended = false;

function refreshTransformInspector() {
    const panel = document.getElementById('transform-inspector');
    if (!panel || inspectorSuspended) return;
    const obj = inspectorTarget();
    const fields = panel.querySelectorAll('input[data-axis]');
    const lockButton = document.getElementById('lock-selected');
    if (!obj) {
        panel.dataset.empty = 'true';
        fields.forEach(input => { input.value = ''; input.disabled = true; });
        if (lockButton) lockButton.disabled = true;
        return;
    }
    panel.dataset.empty = 'false';
    const canon = canonicalTransform(obj);
    if (!canon) return;
    const euler = new THREE.Euler().setFromQuaternion(canon.q, 'XYZ');
    const values = {
        position: { x: canon.p.x, y: canon.p.y, z: canon.p.z },
        rotation: { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) },
        scale: { x: canon.s.x, y: canon.s.y, z: canon.s.z }
    };
    const locked = isLocked(obj);
    fields.forEach(input => {
        if (document.activeElement === input) return;   // do not fight a typist
        const value = values[input.dataset.field][input.dataset.axis];
        input.value = input.dataset.field === 'rotation' ? value.toFixed(2) : value.toFixed(4);
        input.disabled = locked;
    });
    if (lockButton) {
        lockButton.disabled = false;
        lockButton.setAttribute('aria-pressed', String(locked));
        lockButton.textContent = locked ? 'Unlock' : 'Lock';
    }
}

function commitInspectorField(input) {
    const obj = inspectorTarget();
    if (!obj || isLocked(obj)) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) { refreshTransformInspector(); return; }
    const parent = canonicalParent(obj);
    if (!parent) return;

    editSelection(() => {
        const canon = canonicalTransform(obj);
        const euler = new THREE.Euler().setFromQuaternion(canon.q, 'XYZ');
        if (input.dataset.field === 'position') canon.p[input.dataset.axis] = value;
        else if (input.dataset.field === 'scale') canon.s[input.dataset.axis] = value || 1e-6;
        else euler[input.dataset.axis] = THREE.MathUtils.degToRad(value);

        // The fields are in canonical parent space, but the object may be
        // parented to the proxy or a rig wrapper, so go via a world matrix.
        parent.updateWorldMatrix(true, false);
        const local = new THREE.Matrix4().compose(canon.p,
            input.dataset.field === 'rotation' ? new THREE.Quaternion().setFromEuler(euler) : canon.q,
            canon.s);
        setWorldMatrix(obj, new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, local));
    });
}

// Bounding boxes are world space, but obj.position is parent space, and the
// model carries a fit-to-view scale — so adding a world delta straight onto
// position moves the part by the wrong amount. Go via the world matrix.
function nudgeWorld(obj, axis, delta) {
    if (!delta) return;
    obj.updateWorldMatrix(true, false);
    const translation = new THREE.Vector3();
    translation[axis] = delta;
    const target = obj.matrixWorld.clone().premultiply(
        new THREE.Matrix4().makeTranslation(translation.x, translation.y, translation.z));
    setWorldMatrix(obj, target);
}

// Align and distribute over the selection's world bounding boxes. One
// transaction per action, so a whole alignment undoes in a single step.
function alignSelection(axis, mode) {
    return editSelection(objects => {
        const boxes = objects.map(obj => new THREE.Box3().setFromObject(obj));
        const bounds = new THREE.Box3();
        boxes.forEach(box => bounds.union(box));
        const anchor = mode === 'min' ? bounds.min[axis]
            : mode === 'max' ? bounds.max[axis]
            : (bounds.min[axis] + bounds.max[axis]) / 2;
        objects.forEach((obj, i) => {
            const box = boxes[i];
            const current = mode === 'min' ? box.min[axis]
                : mode === 'max' ? box.max[axis]
                : (box.min[axis] + box.max[axis]) / 2;
            nudgeWorld(obj, axis, anchor - current);
        });
    });
}

function distributeSelection(axis) {
    if (movingObjects.length < 3) { notifyUser('Select three or more parts to distribute them.'); return false; }
    return editSelection(objects => {
        const entries = objects
            .map(obj => ({ obj, centre: new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())[axis] }))
            .sort((a, b) => a.centre - b.centre);
        const first = entries[0].centre, last = entries[entries.length - 1].centre;
        const step = (last - first) / (entries.length - 1);
        entries.forEach((entry, i) => nudgeWorld(entry.obj, axis, (first + step * i) - entry.centre));
    });
}

function sceneAssetRecord(entry) {
    return {
        sceneId: selectedRoomScene,
        obj: entry.obj,
        parent: canonicalParent(entry.obj),
        entry: { ...entry },
        addition: sceneAssetState().added.get(entry.editorId) || null,
        transform: canonicalTransformPlain(entry.obj)
    };
}

function setSceneAssetPresence(record, present) {
    if (record.sceneId !== selectedRoomScene) return;
    const state = sceneAssetState(record.sceneId);
    const { entry, obj } = record;
    if (present) {
        (record.parent || workspaceRoom?.ensureAssetRoot()).add(obj);
        applyPlainLocalTransform(obj, record.transform);
        if (record.addition) state.added.set(entry.editorId, record.addition);
        else state.removed.delete(entry.editorId);
        state.transforms.set(entry.editorId, record.transform);
        registerSceneAsset(obj);
    } else {
        unregisterSceneAsset(obj);
        obj.removeFromParent();
        if (record.addition) state.added.delete(entry.editorId);
        else state.removed.add(entry.editorId);
    }
}

function deleteSelectedSceneAssets() {
    const entries = movingObjects
        .map(item => sceneAssetRegistry.get(item.obj.userData?.editorId))
        .filter(Boolean);
    if (!entries.length) return notifyUser('Select one or more scene assets to delete.');
    const records = entries.map(sceneAssetRecord);
    records.forEach(record => setSceneAssetPresence(record, false));
    updateTransformProxy();
    persistSceneAssetStates();
    transaction({ type: 'scene-assets', records, present: true });
    buildSceneTree();
    renderSceneAssetList();
    updateSceneLibraryStatus();
    notifyUser(`${records.length} scene asset${records.length === 1 ? '' : 's'} deleted.`);
}

async function addSceneAsset(propId) {
    if (!workspaceRoom) return;
    const entry = PROP_LIBRARY.entry(propId);
    if (!entry) return notifyUser('That library asset is unavailable.');
    const key = `${selectedRoomScene}:custom:${Date.now()}-${sceneAssetCounter++}:${propId}`;
    const editorId = `scene:${key}`;
    const addition = { editorId, propId, position: [0, 0, 800] };
    const state = sceneAssetState();
    state.added.set(editorId, addition);
    updateSceneLibraryStatus('Loading…');
    try {
        const obj = await workspaceRoom.addAsset(propId, key, addition.position);
        if (!obj || !state.added.has(editorId)) return;
        registerSceneAsset(obj);
        state.transforms.set(editorId, plainLocalTransform(obj));
        const record = sceneAssetRecord(sceneAssetRegistry.get(editorId));
        transaction({ type: 'scene-assets', records: [record], present: false });
        persistSceneAssetStates();
        toggleMovingObject(obj, true);
        buildSceneTree();
        renderSceneAssetList();
        updateSceneLibraryStatus();
        notifyUser(`${entry.name} added to ${ROOM_SCENES.find(scene => scene.id === selectedRoomScene)?.name || 'scene'}.`);
    } catch (error) {
        state.added.delete(editorId);
        updateSceneLibraryStatus('Could not load asset');
        console.error('[ErgoFlex] Scene asset could not be added:', error);
    }
}

let sceneAssetLibraryEntries = [];

function updateSceneLibraryStatus(message = '') {
    const status = document.getElementById('scene-library-status');
    if (!status) return;
    status.textContent = message || `${sceneAssetRegistry.size} asset${sceneAssetRegistry.size === 1 ? '' : 's'} in ${ROOM_SCENES.find(scene => scene.id === selectedRoomScene)?.name || 'scene'}`;
}

function renderSceneAssetList() {
    const list = document.getElementById('scene-assets-current');
    if (!list) return;
    list.replaceChildren();
    if (!sceneAssetRegistry.size) {
        const empty = document.createElement('p');
        empty.className = 'studio-note';
        empty.textContent = 'This scene has no placed assets yet.';
        list.append(empty);
        return;
    }
    sceneAssetRegistry.forEach(entry => {
        const button = document.createElement('button');
        button.className = 'scene-current-item';
        button.setAttribute('aria-pressed', String(movingObjects.some(item => item.obj === entry.obj)));
        button.textContent = partLabel(entry.editorId);
        button.title = `Select ${entry.name}`;
        button.onclick = () => { toggleMovingObject(entry.obj); renderSceneAssetList(); buildSceneTree(); };
        list.append(button);
    });
}

function renderSceneAssetLibrary() {
    const grid = document.getElementById('scene-library-grid');
    if (!grid) return;
    const query = (document.getElementById('scene-library-search')?.value || '').trim().toLowerCase();
    const category = document.getElementById('scene-library-category')?.value || 'all';
    const entries = sceneAssetLibraryEntries.filter(entry =>
        (category === 'all' || entry.category === category) &&
        (!query || entry.name.toLowerCase().includes(query) || entry.id.includes(query)));
    grid.replaceChildren();
    entries.forEach(entry => {
        const card = document.createElement('button');
        card.className = 'scene-library-card';
        card.type = 'button';
        const image = document.createElement('img');
        image.src = `./assets/props/thumbs/${entry.id}.png`;
        image.alt = '';
        image.loading = 'lazy';
        const name = document.createElement('span');
        name.textContent = entry.name;
        const meta = document.createElement('small');
        meta.textContent = entry.category;
        card.append(image, name, meta);
        card.onclick = () => addSceneAsset(entry.id);
        grid.append(card);
    });
    if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'studio-note';
        empty.textContent = 'No assets match that search.';
        grid.append(empty);
    }
}

async function buildSceneAssetTools(anchorElement) {
    if (!anchorElement || document.getElementById('scene-asset-tools')) return;
    const panel = document.createElement('section');
    panel.id = 'scene-asset-tools';
    panel.className = 'precision-tools scene-asset-tools';
    panel.innerHTML = `<div class="scene-library-heading"><div><div class="eyebrow">SCENE ASSETS</div><strong>Prop library</strong></div><span id="scene-library-status">Loading library…</span></div>
        <div class="scene-library-filters"><input id="scene-library-search" type="search" placeholder="Search 3D assets…" aria-label="Search scene assets"><select id="scene-library-category" aria-label="Scene asset category"><option value="all">All categories</option></select></div>
        <div id="scene-library-grid" class="scene-library-grid" aria-label="Available scene assets"></div>
        <div class="scene-current-heading"><strong>In this scene</strong><button id="delete-scene-assets" type="button">Delete selected</button></div>
        <div id="scene-assets-current" class="scene-assets-current"></div>
        <p class="studio-note">Click any prop in the viewer or list, then use Move, Rotate, Scale, rename, precision fields, alignment, focus, isolate, lock, undo, and redo.</p>`;
    anchorElement.after(panel);
    panel.querySelector('#scene-library-search').oninput = renderSceneAssetLibrary;
    panel.querySelector('#scene-library-category').onchange = renderSceneAssetLibrary;
    panel.querySelector('#delete-scene-assets').onclick = deleteSelectedSceneAssets;
    try {
        const index = await PROP_LIBRARY.loadIndex();
        sceneAssetLibraryEntries = [...index.props].sort((a, b) => a.name.localeCompare(b.name));
        const categories = [...new Set(sceneAssetLibraryEntries.map(entry => entry.category))].sort();
        const select = panel.querySelector('#scene-library-category');
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category[0].toUpperCase() + category.slice(1);
            select.append(option);
        });
        renderSceneAssetLibrary();
        renderSceneAssetList();
        updateSceneLibraryStatus();
    } catch (error) {
        updateSceneLibraryStatus('Library unavailable');
        console.error('[ErgoFlex] Prop library could not be loaded:', error);
    }
}

function buildPrecisionTools(anchorElement) {
    if (!anchorElement || document.getElementById('transform-inspector')) return;
    const panel = document.createElement('div');
    panel.id = 'transform-inspector';
    panel.className = 'precision-tools transform-inspector';
    panel.dataset.empty = 'true';
    const row = (field, label, step) => `<div class="inspector-row"><span>${label}</span>` +
        ['x', 'y', 'z'].map(axis =>
            `<label><em>${axis.toUpperCase()}</em><input type="number" step="${step}" data-field="${field}" data-axis="${axis}" disabled></label>`).join('') +
        `</div>`;
    panel.innerHTML = `<div class="eyebrow">TRANSFORM</div>
        ${row('position', 'Pos', '0.001')}
        ${row('rotation', 'Rot', '0.5')}
        ${row('scale', 'Scale', '0.01')}
        <div class="inspector-actions">
            <button id="lock-selected" aria-pressed="false" disabled title="Lock the selected parts so they cannot be selected or moved">Lock</button>
            <button id="align-menu-toggle" aria-expanded="false" aria-controls="align-tools">Align…</button>
        </div>
        <div id="align-tools" hidden>
            ${['x', 'y', 'z'].map(axis => `<div class="inspector-row"><span>${axis.toUpperCase()}</span>` +
                ['min', 'center', 'max'].map(mode =>
                    `<button data-align-axis="${axis}" data-align-mode="${mode}">${mode === 'center' ? 'Mid' : mode}</button>`).join('') +
                `<button data-distribute-axis="${axis}" title="Space three or more parts evenly">Even</button></div>`).join('')}
        </div>
        <p class="studio-note">Values are in the part's own parent space, with animation removed. Rotation is in degrees. Typed edits, alignment, and gizmo drags share one undo history.</p>`;
    anchorElement.after(panel);
    buildSceneAssetTools(panel);

    panel.querySelectorAll('input[data-axis]').forEach(input => {
        input.addEventListener('focus', () => { inspectorSuspended = true; });
        input.addEventListener('blur', () => { inspectorSuspended = false; refreshTransformInspector(); });
        input.addEventListener('change', () => commitInspectorField(input));
        input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
    });
    document.getElementById('lock-selected').onclick = () => {
        const obj = inspectorTarget();
        if (!obj) return;
        const locking = !isLocked(obj);
        movingObjects.map(item => item.obj).forEach(target => setLocked(target, locking));
        if (locking) updateTransformProxy();
        refreshTransformInspector();
        notifyUser(locking ? 'Selection locked.' : 'Selection unlocked.');
    };
    const alignToggle = document.getElementById('align-menu-toggle');
    alignToggle.onclick = () => {
        const tools = document.getElementById('align-tools');
        tools.hidden = !tools.hidden;
        alignToggle.setAttribute('aria-expanded', String(!tools.hidden));
    };
    panel.querySelectorAll('[data-align-axis]').forEach(button => {
        button.onclick = () => alignSelection(button.dataset.alignAxis, button.dataset.alignMode);
    });
    panel.querySelectorAll('[data-distribute-axis]').forEach(button => {
        button.onclick = () => distributeSelection(button.dataset.distributeAxis);
    });
}

// --- Project panel ----------------------------------------------------------

// Sits beside the rigs-only "Export Animations" button, which keeps working —
// that exports a definition for baking back into source, this saves the whole
// edited project.
function buildProjectTools(anchorButton) {
    if (!anchorButton || document.getElementById('project-tools')) return;
    const panel = document.createElement('div');
    panel.id = 'project-tools';
    panel.className = 'project-tools';
    panel.innerHTML = `<div class="eyebrow">PROJECT</div>
        <div>
            <button id="project-save">Save project</button>
            <button id="project-load">Load project…</button>
            <button id="project-recover">Recover…</button>
        </div>
        <input id="project-file" type="file" accept="application/json,.json" hidden>
        <p class="studio-note">Saves the whole edited scene: part positions, clones, groups, lift assignments, rigs, finishes, and camera. Autosaves keep the last ${PROJECT_AUTOSAVE_SLOTS} states.</p>
        <div id="project-recovery-list" hidden></div>`;
    anchorButton.parentElement.after(panel);

    document.getElementById('project-save').onclick = () => {
        try {
            const project = serializeProject();
            const stamp = project.savedAt.slice(0, 19).replace(/[:T]/g, '-');
            downloadFile(`ErgoFlex-project-${stamp}.json`, JSON.stringify(project, null, 2), 'application/json');
            notifyUser('Project saved.');
        } catch (error) {
            console.error('[ErgoFlex] Save failed:', error);
            notifyUser('Project could not be saved. See the console for details.');
        }
    };

    const fileInput = document.getElementById('project-file');
    document.getElementById('project-load').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        let parsed;
        try { parsed = JSON.parse(await file.text()); }
        catch { return notifyUser('That file is not readable JSON.'); }
        importProject(parsed);
    };

    document.getElementById('project-recover').onclick = () => {
        const list = document.getElementById('project-recovery-list');
        const ring = readAutosaveRing();
        list.hidden = false;
        list.replaceChildren();
        if (!ring.length) {
            const empty = document.createElement('p');
            empty.className = 'studio-note';
            empty.textContent = 'No autosaves yet. They are written as you edit, and before anything destructive.';
            list.append(empty);
            return;
        }
        ring.forEach((snapshot, index) => {
            const row = document.createElement('div');
            row.className = 'project-recovery-row';
            const when = document.createElement('span');
            when.textContent = new Date(snapshot.savedAt).toLocaleString() + ' · ' + snapshot.label;
            const restore = document.createElement('button');
            restore.textContent = 'Restore';
            restore.dataset.recoverIndex = String(index);
            restore.onclick = () => importProject(snapshot.project);
            row.append(when, restore);
            list.append(row);
        });
    };
}

// Applies a parsed project and reports what happened. Soft problems are put to
// the user before anything is touched; the default is to cancel.
function importProject(parsed) {
    const outcome = applyProject(parsed, {
        confirmSoft: soft => confirm(
            'This project does not match the current model exactly:\n\n' +
            soft.map(p => '• ' + p.message).join('\n') +
            '\n\nImport anyway?')
    });
    if (outcome.ok) {
        const soft = softProblems(outcome.problems);
        notifyUser(soft.length ? `Project loaded with ${soft.length} warning${soft.length === 1 ? '' : 's'}.` : 'Project loaded.');
    } else if (outcome.cancelled) {
        notifyUser('Import cancelled. Nothing was changed.');
    } else {
        const first = hardProblems(outcome.problems)[0];
        notifyUser(first ? first.message : 'That project could not be loaded.');
    }
    return outcome;
}

// --- Versioned recovery -----------------------------------------------------

let autosaveTimer = null;

function readAutosaveRing() {
    try {
        const raw = localStorage.getItem(PROJECT_AUTOSAVE_KEY);
        const ring = raw ? JSON.parse(raw) : [];
        return Array.isArray(ring) ? ring : [];
    } catch { return []; }
}

// Returns whether the write actually happened. Callers must not report a save
// that did not occur.
function writeAutosave(label) {
    let project;
    try { project = serializeProject(); }
    catch (error) { console.warn('[ErgoFlex] Autosave skipped:', error); return false; }

    const ring = [{ savedAt: new Date().toISOString(), label, project }, ...readAutosaveRing()]
        .slice(0, PROJECT_AUTOSAVE_SLOTS);
    while (ring.length) {
        try {
            const payload = JSON.stringify(ring);
            if (payload.length > PROJECT_AUTOSAVE_BUDGET) { ring.pop(); continue; }
            localStorage.setItem(PROJECT_AUTOSAVE_KEY, payload);
            return true;
        } catch {
            ring.pop();   // quota or private mode: shed the oldest and retry
        }
    }
    return false;
}

function scheduleAutosave(label = 'edit') {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => writeAutosave(label), 2000);
}

// --- UI Events ---

document.addEventListener('DOMContentLoaded', () => {

    toggleHeightBtn = document.getElementById('toggle-height-btn');
    selectionModeToggle = document.getElementById('selection-mode-toggle');
    selectedPartsCount = document.getElementById('selected-parts-count');
    copyPartsBtn = document.getElementById('copy-parts-btn');
    clearPartsBtn = document.getElementById('clear-parts-btn');

    // Production mode: the setup/debug panel is hidden unless ?setup is in the URL.
    // Press ` (backtick) at any time to enter/leave the setup workspace.
    const animDebugger = document.getElementById('anim-debugger');
    const SETUP_MODE = new URLSearchParams(window.location.search).has('setup');
    if (animDebugger) animDebugger.style.display = 'none';
    if (SETUP_MODE) setSetupLayout(true);

    // Wire up Transform Tool Mode Switches
    document.querySelectorAll('input[name="transform_mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setPivotGizmo(false); // the gizmo can only serve one owner
            if (transformControl) {
                if (e.target.value === 'none') {
                    transformControl.detach();
                    updateTransformProxy(); // This will put children back
                } else {
                    transformControl.setMode(e.target.value);
                    updateTransformProxy(); // This will center and attach
                }
            }
        });
    });

    if (clearPartsBtn) {
        clearPartsBtn.addEventListener('click', () => {
            // Detach first to preserve current world positions if they moved them
            [...transformProxy.children].forEach(child => {
                const p = proxyOriginalParents.get(child);
                if (p) {
                    p.attach(child);
                    proxyOriginalParents.delete(child);
                }
            });

            movingObjects = [];
            boxHelpers.forEach(h => scene.remove(h));
            boxHelpers.clear();
            updateTransformProxy();
            if (selectedPartsCount) selectedPartsCount.innerText = "0";
            lastSelectedEditorId = null;
            refreshSelectedPartUI();
            renderSceneAssetList();
            buildSceneTree();
        });
    }

    if (selectionModeToggle) {
        selectionModeToggle.addEventListener('change', (e) => {
            isSelectionMode = e.target.checked;
            boxHelpers.forEach(helper => helper.visible = isSelectionMode);
            updateBoxSelectHint();
            if (!isSelectionMode && transformControl) {
                transformControl.detach();
            }
        });
    }

    wireHeightSlider();

    if(copyPartsBtn) {
        copyPartsBtn.addEventListener('click', () => {
            // 1. We must temporarily detach the parts so getWorldPosition reads relative to their true parent
            [...transformProxy.children].forEach(child => {
                const p = proxyOriginalParents.get(child);
                if (p) {
                    p.attach(child);
                    proxyOriginalParents.delete(child);
                }
            });

            // Gather the exact world coordinates for all moved meshes
            const payload = movingObjects.map(item => {
                const obj = item.obj;
                const pos = new THREE.Vector3();
                const rot = new THREE.Quaternion();
                const scl = new THREE.Vector3();

                obj.getWorldPosition(pos);
                obj.getWorldQuaternion(rot);
                obj.getWorldScale(scl);

                const euler = new THREE.Euler().setFromQuaternion(rot);

                return {
                    name: obj.name,
                    label: partLabels.get(obj.userData.editorId) || null,
                    editorId: obj.userData.editorId || obj.name,
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    rotation: { x: euler.x, y: euler.y, z: euler.z },
                    scale: { x: scl.x, y: scl.y, z: scl.z }
                };
            });

            // 2. Put them back into the Transform proxy so the user can keep working
            movingObjects.forEach(item => {
                if (!proxyOriginalParents.has(item.obj)) proxyOriginalParents.set(item.obj, item.obj.parent);
                transformProxy.attach(item.obj);
            });

            // Enhanced export with metadata wrapper
            const exportData = {
                groupName: document.getElementById('group-name-input')?.value || 'Untitled',
                partCount: payload.length,
                timestamp: new Date().toISOString(),
                deskHeight: liftToHeight(currentLift).toFixed(1) + '"',
                parts: payload
            };
            const jsonText = JSON.stringify(exportData, null, 2);

            const el = document.createElement('textarea');
            el.value = jsonText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);

            const originalText = copyPartsBtn.innerText;
            copyPartsBtn.innerText = "COPIED TO CLIPBOARD!";
            setTimeout(() => copyPartsBtn.innerText = originalText, 2000);
        });
    }

    if(toggleHeightBtn) {
        toggleHeightBtn.addEventListener('click', () => {
            manualLiftOverride = false;
            isStanding = !isStanding;

            targetLift = isStanding ? LIFT_MAX : LIFT_MIN;

            toggleHeightBtn.style.color = isStanding ? '#007aff' : '#374151';
            toggleHeightBtn.style.borderColor = isStanding ? '#007aff' : '#e5e7eb';
        });
    }

    // --- Phase 2.1: Named Groups ---
    const saveGroupBtn = document.getElementById('save-group-btn');
    const loadGroupBtn = document.getElementById('load-group-btn');
    const deleteGroupBtn = document.getElementById('delete-group-btn');
    const groupNameInput = document.getElementById('group-name-input');
    const groupSelect = document.getElementById('group-select');

    if (saveGroupBtn) {
        saveGroupBtn.addEventListener('click', () => {
            const name = groupNameInput?.value?.trim();
            if (name) {
                saveCurrentGroup(name);
                groupNameInput.value = '';
            }
        });
    }
    if (loadGroupBtn) {
        loadGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) loadGroup(name);
        });
    }
    if (deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) deleteGroup(name);
        });
    }
    const exportGroupBtn = document.getElementById('export-group-btn');
    if (exportGroupBtn) {
        exportGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) exportGroup(name);
        });
    }

    // --- Phase 2.2: Part Search ---
    const partSearchInput = document.getElementById('part-search-input');
    if (partSearchInput) {
        partSearchInput.addEventListener('input', (e) => {
            onPartSearch(e.target.value.trim());
        });
        // Close results on blur (delayed for click to register)
        partSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const resultsDiv = document.getElementById('part-search-results');
                if (resultsDiv) resultsDiv.classList.add('hidden');
            }, 200);
        });
        partSearchInput.addEventListener('focus', (e) => {
            if (e.target.value.trim().length >= 2) {
                onPartSearch(e.target.value.trim());
            }
        });
    }

    // --- Phase 2.3: Scene Tree toggle ---
    const sceneTreeHeader = document.getElementById('scene-tree-header');
    const sceneTreeContainer = document.getElementById('scene-tree-container');
    const sceneTreeCollapseIcon = document.getElementById('scene-tree-collapse-icon');
    if (sceneTreeHeader) {
        sceneTreeHeader.addEventListener('click', () => {
            const open = sceneTreeContainer.style.display !== 'none';
            sceneTreeContainer.style.display = open ? 'none' : 'block';
            if (sceneTreeCollapseIcon) sceneTreeCollapseIcon.innerHTML = open ? '&#9654;' : '&#9660;';
        });
    }

    // --- Phase 2.5: Collapsible Debug Panel ---
    const debugHeader = document.getElementById('debug-panel-header');
    if (debugHeader) {
        debugHeader.addEventListener('click', () => toggleDebugPanel());
    }

    // Keyboard shortcuts with input-focus guard:
    // ` shows/hides the setup panel, Ctrl/Cmd+Z undoes the last setup edit
    document.addEventListener('keydown', (e) => {
        // A drag can start while a checkbox still has focus; Escape must
        // cancel the gesture before the text-editing shortcut guard.
        if (e.key === 'Escape' && marquee.active) { e.preventDefault(); cancelMarquee(); return; }
        const tag = document.activeElement?.tagName?.toLowerCase();
        const isEditable = document.activeElement?.isContentEditable;
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;
        if (!document.getElementById('cart-modal').classList.contains('hidden')) return;
        if (e.key === '`') {
            e.preventDefault();
            setSetupLayout(!setupLayoutOn);
        } else if (e.key === 'Escape' && marquee.active) {
            e.preventDefault();
            cancelMarquee();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) performRedo(); else performUndo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            performRedo();
        }
    });

    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.addEventListener('click', performUndo);
        const redoBtn = document.createElement('button');
        redoBtn.id = 'redo-btn';
        redoBtn.className = undoBtn.className.replace('ml-auto', '');
        redoBtn.disabled = true;
        redoBtn.title = 'Redo (Ctrl+Shift+Z / Ctrl+Y)';
        redoBtn.textContent = 'Redo';
        redoBtn.addEventListener('click', performRedo);
        undoBtn.after(redoBtn);
    }

    const glideBtn = document.getElementById('glide-btn');
    if (glideBtn) glideBtn.addEventListener('click', () => {
        setMotionTab('glide');
    });

    const arBtn = document.getElementById('ar-btn');
    if (arBtn) arBtn.addEventListener('click', launchAR);

    // --- Phase 2.6: Clone Parts ---
    const clonePartsBtn = document.getElementById('clone-parts-btn');
    if (clonePartsBtn) {
        clonePartsBtn.addEventListener('click', cloneSelectedParts);
    }

    // --- Phase 3: Tilt ---
    const saveTiltBtn = document.getElementById('save-tilt-btn');
    if (saveTiltBtn) {
        saveTiltBtn.addEventListener('click', saveTiltConfig);
    }
    // --- Phase 4: Actuator Rig buttons ---
    const rigPickBaseBtn = document.getElementById('rig-pick-base-btn');
    const rigPickTargetBtn = document.getElementById('rig-pick-target-btn');
    if (rigPickBaseBtn) rigPickBaseBtn.addEventListener('click', () => {
        if (rigPickMode === 'base') clearHoverHighlight();
        rigPickMode = rigPickMode === 'base' ? null : 'base';
        isPickingPivot = false;
        canvas.style.cursor = rigPickMode ? 'crosshair' : '';
        updateRigPickButtons();
        updatePickPivotBtnState();
    });
    if (rigPickTargetBtn) rigPickTargetBtn.addEventListener('click', () => {
        if (rigPickMode === 'target') clearHoverHighlight();
        rigPickMode = rigPickMode === 'target' ? null : 'target';
        isPickingPivot = false;
        canvas.style.cursor = rigPickMode ? 'crosshair' : '';
        updateRigPickButtons();
        updatePickPivotBtnState();
    });
    const rigCaptureCylBtn = document.getElementById('rig-capture-cyl-btn');
    if (rigCaptureCylBtn) rigCaptureCylBtn.addEventListener('click', () => {
        rigDraft.cylinderEditorIds = selectedEditorIds();
        updateRigStatus();
    });
    const rigCaptureRodBtn = document.getElementById('rig-capture-rod-btn');
    if (rigCaptureRodBtn) rigCaptureRodBtn.addEventListener('click', () => {
        rigDraft.rodEditorIds = selectedEditorIds();
        updateRigStatus();
    });
    const saveRigBtn = document.getElementById('save-rig-btn');
    if (saveRigBtn) saveRigBtn.addEventListener('click', saveActuatorRigFromUI);

    const partLabelInput = document.getElementById('selected-part-label');
    const applyRename = () => {
        if (!lastSelectedEditorId || !partLabelInput) return;
        setPartLabel(lastSelectedEditorId, partLabelInput.value);
    };
    const renameBtn = document.getElementById('selected-part-rename-btn');
    if (renameBtn) renameBtn.addEventListener('click', applyRename);
    if (partLabelInput) partLabelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyRename(); }
    });

    const resetNameBtn = document.getElementById('selected-part-reset-btn');
    if (resetNameBtn) resetNameBtn.addEventListener('click', () => {
        if (!lastSelectedEditorId) return;
        if (partLabelInput) partLabelInput.value = '';
        setPartLabel(lastSelectedEditorId, '');
    });

    const copyIdBtn = document.getElementById('selected-part-copy-btn');
    if (copyIdBtn) copyIdBtn.addEventListener('click', () => {
        if (!lastSelectedEditorId) return;
        navigator.clipboard.writeText(lastSelectedEditorId)
            .then(() => { copyIdBtn.textContent = 'Copied!'; setTimeout(() => copyIdBtn.textContent = 'Copy editor ID', 1200); })
            .catch(() => console.log('[ErgoFlex] editorId: ' + lastSelectedEditorId));
    });

    // One payload with every rename in this browser — the thing to paste when
    // describing parts by the names you gave them.
    const copyNamedBtn = document.getElementById('selected-part-copy-named-btn');
    if (copyNamedBtn) copyNamedBtn.addEventListener('click', () => {
        const rows = [...partLabels].map(([eid, label]) => ({
            label, editorId: eid, modelName: editorEntry(eid)?.name || '(missing)'
        }));
        const json = JSON.stringify({ renamedParts: rows.length, parts: rows }, null, 2);
        console.log('[ErgoFlex] Renamed parts:\n' + json);
        navigator.clipboard.writeText(json)
            .then(() => { copyNamedBtn.textContent = 'Copied!'; setTimeout(() => copyNamedBtn.textContent = 'Copy all renamed parts', 1200); })
            .catch(() => {});
    });

    const resetAnimBtn = document.getElementById('reset-anim-btn');
    if (resetAnimBtn) resetAnimBtn.addEventListener('click', () => {
        // Baked definitions live in the source; anything saved here is a local override
        // that takes priority on load. Dropping them is always recoverable.
        try {
            localStorage.removeItem('ergoflexActuatorRigs');
            localStorage.removeItem('ergoflexTiltConfigs');
        } catch (e) {
            console.warn('[ErgoFlex] Could not clear saved animation data:', e);
            return;
        }
        console.log('[ErgoFlex] Cleared saved rigs and tilt configs — reloading from baked definitions.');
        location.reload();
    });

    const pivotGizmoBtn = document.getElementById('rig-pivot-gizmo-btn');
    if (pivotGizmoBtn) pivotGizmoBtn.addEventListener('click', () => setPivotGizmo(!pivotGizmoOn));

    const pivotSelBtn = document.getElementById('rig-pivot-selection-btn');
    if (pivotSelBtn) pivotSelBtn.addEventListener('click', () => {
        const c = selectionCenterLocal();
        if (!c) return console.warn('[ErgoFlex] Select at least one part to snap the pivot to.');
        syncPivotInputs(c);
        showPivotMarker(c);
    });

    const pivotApplyBtn = document.getElementById('rig-pivot-apply-btn');
    if (pivotApplyBtn) pivotApplyBtn.addEventListener('click', applyPivotEdit);

    const pivotCloseBtn = document.getElementById('rig-pivot-close-btn');
    if (pivotCloseBtn) pivotCloseBtn.addEventListener('click', closePivotEditor);

    // Typing a coordinate moves the marker live so the number has a visible meaning
    ['rig-pivot-x', 'rig-pivot-y', 'rig-pivot-z'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const p = readPivotInputs();
            if (p) showPivotMarker(p);
        });
    });

    const exportTiltBtn = document.getElementById('export-tilt-btn');
    if (exportTiltBtn) {
        exportTiltBtn.addEventListener('click', () => {
            const json = JSON.stringify({
                BAKED_TILT_CONFIGS: serializeTiltConfigs(),
                BAKED_ACTUATOR_RIGS: serializeActuatorRigs()
            }, null, 2);
            const el = document.createElement('textarea');
            el.value = json;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            downloadFile('ErgoFlex-animation-rigs.json', json, 'application/json');
            notifyUser('Animation rigs downloaded.');
            const orig = exportTiltBtn.innerText;
            exportTiltBtn.innerText = 'COPIED TO CLIPBOARD!';
            setTimeout(() => exportTiltBtn.innerText = orig, 2000);
        });
    }
    buildProjectTools(exportTiltBtn);
    buildPrecisionTools(document.getElementById('part-search-input')?.parentElement);
    initConfigColumnCollapse();

    const pickPivotBtn = document.getElementById('pick-pivot-btn');
    if (pickPivotBtn) {
        pickPivotBtn.addEventListener('click', () => {
            isPickingPivot = !isPickingPivot;
            canvas.style.cursor = isPickingPivot ? 'crosshair' : '';
            updatePickPivotBtnState();
        });
    }
    const clearPivotBtn = document.getElementById('clear-pivot-btn');
    if (clearPivotBtn) {
        clearPivotBtn.addEventListener('click', clearPivotSelection);
    }
});


function updateMovingObjectsPosition() {
    const liftOffset = currentLift - LIFT_MIN;

    liftObjects.forEach(item => {
        // Ignore height slider updates for parts currently locked in the 3D custom
        // transform tool, and for parts riding inside a tilt wrapper (the wrapper
        // itself is translated below, so its children must keep their local offsets).
        if (item.obj.parent !== transformProxy && !isInTiltWrapper(item.obj)) {
            item.obj.position.y = item.baseY + liftOffset;
        }
    });

    telescopingObjects.forEach(item => {
        item.obj.position.y = item.baseY + (liftOffset * TELESCOPING_RATIO);
    });

    // Tilt wrappers ride the lift as rigid units (pivot stays glued to the desk)
    tiltConfigs.forEach(config => {
        config.wrapperGroup.position.y = config.wrapperBaseY + liftOffset;
        config.wrapperGroup.updateMatrixWorld(true);
    });

    // Actuator rigs re-aim and re-telescope after everything else moved
    updateActuatorRigs();

    if (isSelectionMode) {
        boxHelpers.forEach(helper => helper.update());
    }
    if (pivotHighlightHelper) pivotHighlightHelper.update();
}

// --- Materials & UI Setup ---

// Wood is no longer one shared material. The desktop, the shelf and the plywood
// edge each need their own map — the desktop because its grain repeat is derived
// from its own size in inches, the edge because plywood laminations look nothing
// like a face veneer.
const woodMaterials = new Map();   // role -> MeshPhysicalMaterial
const speciesTextures = new Map(); // `${species}|${role}` -> THREE.Texture

// Procedural grain. Real tileable photography per species is still the right
// answer; this at least gives each species its own ring spacing, contrast and
// colour instead of tinting one birch photograph eight different ways.
function generateGrainTexture(name, role) {
    const key = name + '|' + role;
    if (speciesTextures.has(key)) return speciesTextures.get(key);
    const spec = woodSpecies(name);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');

    context.fillStyle = spec.warm;
    context.fillRect(0, 0, size, size);

    if (role === 'edge') {
        // Plywood edge: stacked laminations across the thickness, not rings.
        // Even, so the light/dark alternation still alternates across the tile
        // seam - an odd count put two warm plies next to each other there.
        const plies = 12;
        for (let i = 0; i < plies; i++) {
            const t = i / plies;
            context.fillStyle = i % 2 ? spec.dark : spec.warm;
            context.globalAlpha = 0.55;
            context.fillRect(0, t * size, size, size / plies);
        }
        context.globalAlpha = 1;
    } else {
        // Face veneer: cathedral-ish rings running along the length, with the
        // ring spacing and figure amplitude coming from the species.
        const image = context.getImageData(0, 0, size, size);
        const data = image.data;
        const warm = hexToRgb(spec.warm), dark = hexToRgb(spec.dark);
        // Every term below is an integer number of cycles across the tile, in
        // normalized coordinates, so the pattern meets itself exactly at the edges.
        // The old version stepped in pixels with periods that did not divide 512 -
        // 512/36 rings across, 512/440 for the wobble - so RepeatWrapping put a
        // hard discontinuity at every tile boundary.
        const TAU = Math.PI * 2;
        const rings = Math.max(1, Math.round(spec.ringsPerTile));
        const waves = Math.max(1, Math.round(spec.figureWaves));
        for (let y = 0; y < size; y++) {
            const v = y / size;
            // Bow the rings so they are not straight lines. Amplitude is a fraction
            // of the tile rather than a pixel count, which previously exceeded a
            // whole ring period and scrambled the pattern instead of bending it.
            const wobble = (Math.sin(TAU * waves * v) * 0.65
                          + Math.sin(TAU * waves * 2 * v + 1.7) * 0.35) * spec.figure * 0.11;
            const fibreY = Math.sin(TAU * 37 * v);
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const ring = Math.sin(TAU * rings * (u + wobble));
                const fibre = (Math.sin(TAU * 53 * v + TAU * 3 * u) + fibreY) * 0.02;
                // Slow tonal drift across the board. Rings alone, at a realistic
                // spacing, read as even corduroy; real boards vary in tone over
                // distances much larger than the ring spacing. Integer cycles, so
                // this stays tileable like everything else here.
                const blotch = (Math.sin(TAU * 2 * v + TAU * u) * 0.6
                              + Math.sin(TAU * 3 * v + 2.1) * 0.4) * 0.09;
                const mix = Math.min(1, Math.max(0,
                    0.5 + (ring * 0.5 + fibre + blotch) * (spec.contrast * 2.0)));
                const i = (y * size + x) * 4;
                data[i]     = warm.r + (dark.r - warm.r) * mix;
                data[i + 1] = warm.g + (dark.g - warm.g) * mix;
                data[i + 2] = warm.b + (dark.b - warm.b) * mix;
                data[i + 3] = 255;
            }
        }
        context.putImageData(image, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    speciesTextures.set(key, texture);
    return texture;
}

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function getOrCreateWoodMaterial(role) {
    if (!woodMaterials.has(role)) {
        // The species tint, the same value applyWoodSpecies sets. Using the
        // swatch colour here instead meant a role created before the first
        // finish change was tinted differently from every role after it.
        const tint = woodSpecies(currentConfig.woodFinish).tint || '#ffffff';
        woodMaterials.set(role, new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(tint),
            metalness: 0.0,
            ior: 1.5,
            clearcoatRoughness: 0.35,
            envMapIntensity: 1.0
        }));
        applySurfaceFinish();
    }
    return woodMaterials.get(role);
}

// Kept for the material smoke check and the swatch handler, which both want
// "the" wood material; the desktop is the representative one.
function getOrCreateBirchMaterial() {
    const material = getOrCreateWoodMaterial('desktop');
    sharedBirchMaterial = material;
    return material;
}

// Which wood role a mesh plays. Measured, not guessed: Desktop_3 is the top
// slab, Desktop/Desktop_1/Desktop_2 are the edge and side pieces
// (see docs/sizing-gate.md).
// An edge strip is thin in cross-section: its middle dimension is a small
// fraction of its longest. The shaped side panels are not - they are 35 x 18in
// faces only 0.7in thick, so two of their three dimensions are broad. Matching
// on the name prefix alone sent those panels to the plywood-lamination
// material, which banded 11 stripes across a 646 sq in visible face.
const EDGE_ASPECT_MAX = 0.2;
function isEdgeStrip(mesh) {
    const geom = mesh.geometry;
    if (!geom) return false;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (!bb) return false;
    const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]
        .sort((a, b) => b - a);
    return dims[0] > 0 && dims[1] / dims[0] <= EDGE_ASPECT_MAX;
}

function woodRoleFor(mesh) {
    const name = mesh.name || '';
    if (name === 'Desktop_3') return 'desktop';
    if (name.startsWith('Desktop')) return isEdgeStrip(mesh) ? 'edge' : 'wing';
    if (name.startsWith('Top_Shelf')) return 'shelf';
    return 'desktop';
}

// Silver is the one frame finish that reads as bare metal. Kept in one place:
// this used to be spelled out at the constructor and at the swatch handler, and
// the two could drift.
function frameMetalness(finish) { return finish?.name === 'Silver' ? 0.75 : 0.1; }

// Species photographs, loaded once each and kept by path so two finishes drawn
// from the same image - Black Birch is birch tinted to a satin black - share one
// upload. Returns undefined until the image arrives; callers fall back to the
// generated grain for that frame and applySurfaceFinish re-runs on load.
function loadSpeciesPhoto(path) {
    if (!path) return undefined;
    if (speciesPhotos.has(path)) return speciesPhotos.get(path);
    speciesPhotos.set(path, undefined);
    textureLoader.load(path, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
        speciesPhotos.set(path, texture);
        applySurfaceFinish();
    }, undefined, () => {
        // Leave it unset: woodTextureFor falls back to generated grain, so a
        // missing file degrades to the old look rather than an untextured slab.
        console.warn('[ErgoFlex] Wood texture failed to load, using generated grain:', path);
        speciesPhotos.delete(path);
    });
    return undefined;
}

function loadBirchPhoto() { loadSpeciesPhoto(woodSpecies('Natural Birch').photo); }

function getOrCreateBasePaintMaterial() {
    if (!sharedBasePaintMaterial) {
        const defaultFinish = PRODUCT_CONFIG.baseFinishes.find(f => f.name === currentConfig.baseFinish);
        sharedBasePaintMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(defaultFinish.color),
            metalness: frameMetalness(defaultFinish),
            roughness: 0.45,
            ior: 1.5,
            clearcoat: 0.1,
            envMapIntensity: 1.1
        });
    }
    return sharedBasePaintMaterial;
}

function getOrCreatePolishedAluminumMaterial() {
    if (!sharedPolishedAluminumMaterial) {
        sharedPolishedAluminumMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#ffffff"),
            metalness: 1.0,
            roughness: 0.14,
            ior: 2.5,
            envMapIntensity: 1.35
        });
    }
    return sharedPolishedAluminumMaterial;
}

function getOrCreateBlackPlasticMaterial() {
    if (!sharedBlackPlasticMaterial) {
        sharedBlackPlasticMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#1a1a1a"),
            metalness: 0.1,
            roughness: 0.55,
            ior: 1.45,
        });
    }
    return sharedBlackPlasticMaterial;
}

function getOrCreateBlackMetalMaterial() {
    if (!sharedBlackMetalMaterial) {
        sharedBlackMetalMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#2a2a2a"),
            metalness: 0.85,
            roughness: 0.3,
            ior: 1.8,
            envMapIntensity: 1.2
        });
    }
    return sharedBlackMetalMaterial;
}

function populateFinishOptions() {
    woodFinishesGrid.innerHTML = '';
    PRODUCT_CONFIG.woodFinishes.forEach(finish => {
        woodFinishesGrid.appendChild(createFinishSwatch(finish, 'wood'));
    });
    baseFinishesGrid.innerHTML = '';
    PRODUCT_CONFIG.baseFinishes.forEach(finish => {
        baseFinishesGrid.appendChild(createFinishSwatch(finish, 'base'));
    });
}

function createFinishSwatch(finish, type) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'finish-swatch';
    swatch.dataset.finish = finish.name;
    swatch.dataset.material = type;
    swatch.setAttribute('aria-label', `${finish.name}, ${finish.price ? '+$' + finish.price : 'included'}`);
    swatch.setAttribute('aria-pressed', String(finish.name === currentConfig[type === 'wood' ? 'woodFinish' : 'baseFinish']));
    swatch.style.backgroundColor = finish.color;
    swatch.title = `${finish.name}${finish.price > 0 ? ` (+${finish.price})` : ''}`;
    if (finish.name === currentConfig[type === 'wood' ? 'woodFinish' : 'baseFinish']) swatch.classList.add('selected');
    swatch.addEventListener('click', () => selectFinish(finish, type, swatch));
    return swatch;
}

function selectFinish(finish, type, element) {
    const container = type === 'wood' ? woodFinishesGrid : baseFinishesGrid;
    container.querySelectorAll('.finish-swatch').forEach(el => { el.classList.remove('selected'); el.setAttribute('aria-pressed', 'false'); });
    element.setAttribute('aria-pressed', 'true');
    element.classList.add('selected');
    if (type === 'wood') {
        currentConfig.woodFinish = finish.name;
        document.getElementById('selected-wood-name').textContent = finish.name + (finish.price ? ' · +$' + finish.price : ' · Included');
        applyWoodSpecies(finish);
    } else {
        currentConfig.baseFinish = finish.name;
        document.getElementById('selected-base-name').textContent = finish.name + (finish.price ? ' · +$' + finish.price : ' · Included');
        if (sharedBasePaintMaterial) { sharedBasePaintMaterial.color.set(finish.color); sharedBasePaintMaterial.metalness = frameMetalness(finish); }
    }
    updatePrice();
}

function updatePrice() {
    // One price formula for the whole app: configurationPrice in catalog.mjs.
    // This used to re-implement the sum with different guards and a different
    // locale, so the headline price could disagree with the cart rows.
    const total = money(configurationPrice(currentConfig));
    totalPrice.textContent = total;
    cartPrice.textContent = total;
    renderPriceBreakdown();
    scheduleValidation();
    syncBuildSummary();
}

function addToCart() {
    // Date.now() collided for two items added in the same millisecond, and
    // remove() filters by id — so removing one deleted both.
    cartItems.push({ id: nextCartId(), ...cleanConfig(currentConfig), price: configurationPrice(currentConfig), quantity: 1 });
    persistCart();
    showCartModal();
}

function updateCartUI() {
    cartCount.textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.classList.toggle('hidden', cartItems.length === 0);
}

function showCartModal() {
    const content = document.getElementById('cart-content');
    content.replaceChildren();
    if (!cartItems.length) content.textContent = 'Your build list is empty. Customize a desk to get started.';
    cartItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-row';
        const description = document.createElement('div');
        description.textContent = `${PRODUCT_CONFIG.sizes[item.size].name} · ${item.woodFinish} · ${item.baseFinish}`;
        const additions = document.createElement('ul'); additions.className = 'cart-accessories';
        for (const id of item.accessories || []) {
            const product = accessory(id);
            if (!product) continue;
            const line = document.createElement('li');
            const name = document.createElement('span'); name.textContent = product.name;
            const amount = document.createElement('span'); amount.textContent = money(product.price) + '*';
            line.append(name, amount); additions.append(line);
        }
        description.append(additions);
        const preview = document.createElement('button'); preview.className = 'cart-preview'; preview.textContent = 'View this build in 3D ↗';
        preview.onclick = () => {
            currentConfig = cleanConfig(item); applyConfigToUI(); applyAccessoryVisibility(); renderAccessories();
            closeDialog(document.getElementById('cart-modal'));
            if (loadedModel) focusObjects([loadedModel], { animate: true });
            canvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
            notifyUser('Build loaded with its selected accessories.');
        };
        description.append(preview);
        const price = document.createElement('strong');
        price.textContent = money(item.price * item.quantity);
        const quantity = document.createElement('input');
        quantity.type = 'number'; quantity.min = '1'; quantity.max = '20'; quantity.value = item.quantity;
        quantity.setAttribute('aria-label', 'Quantity for ' + description.textContent);
        quantity.addEventListener('change', () => {
            item.quantity = Math.max(1, Math.min(20, Math.round(Number(quantity.value) || 1)));
            persistCart(); showCartModal();
        });
        const remove = document.createElement('button');
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => { cartItems = cartItems.filter(i => i.id !== item.id); persistCart(); showCartModal(); });
        row.append(description, price, quantity, remove); content.append(row);
    });
    const total = document.createElement('p'); total.className = 'cart-total';
    total.textContent = 'Estimated total ' + money(cartItems.reduce((n, i) => n + i.price * i.quantity, 0));
    content.append(total);
    if (cartItems.some(item => item.accessories?.length)) {
        const note = document.createElement('p'); note.className = 'studio-note'; note.textContent = '* Accessory estimates shown per desk. Final pricing and availability need confirmation.'; content.append(note);
    }
    openDialog(document.getElementById('cart-modal'));
}

sizeSelect.addEventListener('change', (e) => {
    currentConfig.size = e.target.value;
    // Some accessories need a wider top. Drop the ones that no longer fit and
    // say which, rather than quietly charging for something that cannot ship.
    const dropped = incompatibleAccessories(currentConfig);
    if (dropped.length) {
        currentConfig.accessories = currentConfig.accessories.filter(id => accessoryFits(id, currentConfig.size));
        notifyUser(`${dropped.map(a => a.name).join(', ')} removed: not available at this size.`);
    }
    renderAccessories();
    applyAccessoryVisibility();
    updatePrice();
    scheduleValidation();
});

addToCartBtn.addEventListener('click', addToCart);

document.getElementById('continue-shopping').addEventListener('click', () => {
    closeDialog(document.getElementById('cart-modal'));
});

document.getElementById('reset-view').addEventListener('click', () => {
    if (controls) {
        controls.autoRotate = false;
        // A close-up shortcut lowers the orbit floor; put it back.
        controls.minDistance = DEFAULT_MIN_DISTANCE;
        cameraTween.active = false;
        camera.position.set(STARTING_POS.x, STARTING_POS.y, STARTING_POS.z);
        controls.target.set(STARTING_TARGET.x, STARTING_TARGET.y, STARTING_TARGET.z);
        controls.update();
        if (loadedModel) focusObjects([loadedModel]);
        document.getElementById('camera-view').value = 'hero';
    }
});

document.getElementById('cart-modal').addEventListener('click', (e) => {
    if (e.target.id === 'cart-modal') {
        closeDialog(document.getElementById('cart-modal'));
    }
});

// --- Phase 2.1: Named Groups ---
function saveCurrentGroup(name) {
    if (!name || movingObjects.length === 0) return;
    const editorIds = movingObjects.map(item => item.obj.userData.editorId).filter(editorId => partRegistry.has(editorId));
    if (!editorIds.length) return notifyUser('Named groups are for desk parts. Scene assets stay organized in the scene list.');
    savedGroups[name] = editorIds;
    try { localStorage.setItem('ergoflexGroups', JSON.stringify(savedGroups)); } catch(e) {}
    rebuildGroupDropdown();
}

function loadGroup(name) {
    if (!name || !savedGroups[name]) return;
    // Clear current selection
    if (clearPartsBtn) clearPartsBtn.click();

    const editorIds = savedGroups[name];
    let missingCount = 0;
    editorIds.forEach(eid => {
        const entry = partRegistry.get(eid);
        if (entry) {
            toggleMovingObject(entry.obj, true, true);
        } else {
            missingCount++;
            console.warn('[ErgoFlex] Part [' + eid + '] not found — was it a clone from a previous session?');
        }
    });
    updateTransformProxy();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    if (missingCount > 0) {
        console.warn('[ErgoFlex] ' + missingCount + ' part(s) could not be restored from group "' + name + '"');
    }
}

function deleteGroup(name) {
    if (!name || !savedGroups[name]) return;
    delete savedGroups[name];
    try { localStorage.setItem('ergoflexGroups', JSON.stringify(savedGroups)); } catch(e) {}
    rebuildGroupDropdown();
}

function exportGroup(name) {
    if (!name || !savedGroups[name]) return;
    const editorIds = savedGroups[name];
    const parts = editorIds.map(eid => {
        const entry = partRegistry.get(eid);
        if (!entry) return { editorId: eid, name: '(missing)', path: '' };
        const obj = entry.obj;
        obj.updateMatrixWorld(true);
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        // Build scene path
        const pathParts = [];
        let cur = obj;
        while (cur && cur !== scene) {
            if (cur.name) pathParts.unshift(cur.name);
            cur = cur.parent;
        }
        return {
            editorId: eid,
            name: entry.name || obj.name,
            scenePath: pathParts.join(' > '),
            worldPos: { x: +wp.x.toFixed(4), y: +wp.y.toFixed(4), z: +wp.z.toFixed(4) }
        };
    });
    const data = { groupName: name, partCount: parts.length, parts: parts };
    const json = JSON.stringify(data, null, 2);
    // Copy to clipboard and also offer download
    navigator.clipboard.writeText(json).then(() => {
        console.log('[ErgoFlex] Group "' + name + '" exported to clipboard');
    }).catch(() => {});
    // Trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'group_' + name.replace(/\s+/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function rebuildGroupDropdown() {
    const sel = document.getElementById('group-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Group --</option>';
    Object.keys(savedGroups).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name + ' (' + savedGroups[name].length + ' parts)';
        sel.appendChild(opt);
    });
}

// --- Phase 2.2: Part Search/Filter ---
function onPartSearch(query) {
    const resultsDiv = document.getElementById('part-search-results');
    if (!resultsDiv) return;
    if (!query || query.length < 2) {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
    }
    const lowerQuery = query.toLowerCase();
    const matches = [];
    const searchableEntries = [...partRegistry.values(), ...sceneAssetRegistry.values()];
    searchableEntries.forEach((entry) => {
        const custom = partLabels.get(entry.editorId) || '';
        if (entry.name.toLowerCase().includes(lowerQuery) ||
            custom.toLowerCase().includes(lowerQuery) ||
            entry.editorId.toLowerCase().includes(lowerQuery)) {
            matches.push(entry);
        }
    });
    if (matches.length === 0) {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
    }
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '';
    matches.slice(0, 100).forEach(entry => {
        const div = document.createElement('div');
        div.className = 'px-3 py-1.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center';
        const isSelected = movingObjects.some(item => item.obj === entry.obj);
        const custom = partLabels.get(entry.editorId);
        div.innerHTML = '<span>' + (custom ? '<b>' + custom + '</b> <span class="text-gray-400 text-xs">' + entry.name + '</span>' : entry.name) + '</span>' +
            (isSelected ? '<span class="text-green-500 text-xs font-bold">SEL</span>' : '') +
            (entry.isClone ? '<span class="text-purple-500 text-xs font-bold ml-1">CLONE</span>' : '') +
            (entry.kind === 'sceneAsset' ? '<span class="text-blue-500 text-xs font-bold ml-1">SCENE</span>' : '');
        div.addEventListener('click', () => {
            toggleMovingObject(entry.obj, null);
            lastSelectedEditorId = entry.editorId;
            refreshSelectedPartUI();
            onPartSearch(query); // refresh results
        });
        resultsDiv.appendChild(div);
    });
    if (matches.length > 100) {
        const more = document.createElement('div');
        more.className = 'px-3 py-1.5 text-gray-400 text-xs';
        more.textContent = '...and ' + (matches.length - 100) + ' more';
        resultsDiv.appendChild(more);
    }
}

// --- Phase 2.3: Scene Hierarchy Tree ---
function buildSceneTree() {
    const container = document.getElementById('scene-tree-content');
    if (!container || !loadedModel) return;
    container.innerHTML = '';
    buildTreeNode(container, loadedModel, 0);
    if (sceneAssetRegistry.size) {
        const heading = document.createElement('div');
        heading.className = 'font-semibold text-blue-700 border-t border-gray-200 mt-2 pt-2 px-1';
        heading.textContent = `Scene assets (${sceneAssetRegistry.size})`;
        container.appendChild(heading);
        sceneAssetRegistry.forEach(entry => {
            const row = document.createElement('label');
            row.className = 'scene-tree-asset-row';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = movingObjects.some(item => item.obj === entry.obj);
            input.onchange = () => { toggleMovingObject(entry.obj, input.checked); renderSceneAssetList(); };
            const name = document.createElement('span');
            name.textContent = partLabel(entry.editorId);
            name.title = entry.editorId;
            row.append(input, name);
            container.appendChild(row);
        });
    }
}

function buildTreeNode(parentEl, obj, depth) {
    const div = document.createElement('div');
    div.style.paddingLeft = (depth * 12) + 'px';

    const hasChildren = obj.children && obj.children.length > 0;
    const isMesh = obj.isMesh;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-1 py-0.5 hover:bg-gray-50 rounded';

    if (hasChildren && !isMesh) {
        const toggle = document.createElement('span');
        toggle.className = 'cursor-pointer text-gray-400 select-none w-3 text-center';
        toggle.textContent = '+';
        toggle.style.fontSize = '10px';
        const childContainer = document.createElement('div');
        childContainer.style.display = 'none';

        toggle.addEventListener('click', () => {
            const open = childContainer.style.display !== 'none';
            childContainer.style.display = open ? 'none' : 'block';
            toggle.textContent = open ? '+' : '-';
            // Lazy render children
            if (!childContainer.dataset.built) {
                childContainer.dataset.built = 'true';
                obj.children.forEach(child => buildTreeNode(childContainer, child, depth + 1));
            }
        });
        row.appendChild(toggle);

        const label = document.createElement('span');
        label.className = 'text-gray-600';
        label.textContent = (obj.name || obj.type) + ' (' + obj.children.length + ')';

        // Parent select/deselect all children
        label.className += ' cursor-pointer hover:text-blue-600';
        label.addEventListener('click', () => {
            const meshChildren = [];
            obj.traverse(c => { if (c.isMesh) meshChildren.push(c); });
            const allSelected = meshChildren.every(c => movingObjects.some(m => m.obj === c));
            meshChildren.forEach(c => toggleMovingObject(c, !allSelected, true));
            updateTransformProxy();
            if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        });
        row.appendChild(label);
        div.appendChild(row);
        div.appendChild(childContainer);
    } else if (isMesh) {
        const spacer = document.createElement('span');
        spacer.className = 'w-3';
        spacer.innerHTML = '&nbsp;';
        row.appendChild(spacer);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'accent-green-500';
        cb.checked = movingObjects.some(item => item.obj === obj);
        cb.addEventListener('change', () => {
            toggleMovingObject(obj, cb.checked);
        });
        row.appendChild(cb);

        const label = document.createElement('span');
        label.className = 'cursor-pointer hover:text-blue-600';
        const isSelected = movingObjects.some(item => item.obj === obj);
        if (isSelected) label.className += ' text-green-700 font-bold';
        const custom = partLabels.get(obj.userData.editorId);
        label.textContent = custom || obj.name || 'unnamed';
        if (custom) label.title = obj.name;
        if (obj.userData.editorId) {
            label.title = obj.userData.editorId;
        }
        label.addEventListener('click', () => {
            toggleMovingObject(obj, null);
            buildSceneTree(); // refresh
        });
        row.appendChild(label);
        div.appendChild(row);
    } else if (hasChildren) {
        // Non-mesh group nodes
        const toggle = document.createElement('span');
        toggle.className = 'cursor-pointer text-gray-400 select-none w-3 text-center';
        toggle.textContent = '+';
        toggle.style.fontSize = '10px';
        const childContainer = document.createElement('div');
        childContainer.style.display = 'none';

        toggle.addEventListener('click', () => {
            const open = childContainer.style.display !== 'none';
            childContainer.style.display = open ? 'none' : 'block';
            toggle.textContent = open ? '+' : '-';
            if (!childContainer.dataset.built) {
                childContainer.dataset.built = 'true';
                obj.children.forEach(child => buildTreeNode(childContainer, child, depth + 1));
            }
        });
        row.appendChild(toggle);
        const label = document.createElement('span');
        label.className = 'text-gray-400';
        label.textContent = (obj.name || obj.type);
        row.appendChild(label);
        div.appendChild(row);
        div.appendChild(childContainer);
    }

    parentEl.appendChild(div);
}

// --- Collapsible debug panel ---
// Migrated onto makeCollapsible. The localStorage key is unchanged, so an
// existing preference carries over. It uses display rather than a max-height
// transition, because this panel is tall enough that a ceiling would clip it.
let toggleDebugPanel = () => {};

function initDebugPanelCollapse() {
    toggleDebugPanel = makeCollapsible('debug-panel', {
        storageKey: 'ergoflexDebugCollapsed',
        mode: 'display',
        onToggle: collapsed => {
            const icon = document.getElementById('debug-collapse-icon');
            if (icon) icon.innerHTML = collapsed ? '&#9654;' : '&#9660;';
        }
    });
}

// --- Phase 2.6: Clone/Duplicate Parts ---
// One clone, one place. cloneSelectedParts uses it with a fresh id; project
// import uses it with the id recorded in the file, so a restored clone keeps the
// identity that the saved groups and rigs refer to.
function makeClone(original, editorId, { parent = null, offsetX = 0.05, joinLift = null } = {}) {
    const clone = original.clone(true);
    clone.userData.editorId = editorId;
    clone.userData.sourceEditorId = original.userData?.editorId || null;
    partRegistry.set(editorId, { obj: clone, name: original.name, editorId, isClone: true });

    clone.position.x += offsetX;
    (parent || original.parent || scene).add(clone);

    const shouldJoinLift = joinLift === null ? liftObjects.has(original) : joinLift;
    if (shouldJoinLift) liftObjects.set(clone, { obj: clone, baseY: clone.position.y - (currentLift - LIFT_MIN) });
    interactableObjects.push(clone);

    // A clone participates in sizing like any other part, so it needs its own
    // pristine baseline captured at creation.
    captureAssetBaseline(clone);
    return clone;
}

function cloneSelectedParts() {
    if (movingObjects.length === 0) return;
    const deskParts = movingObjects.filter(item => !item.obj.userData?.sceneAsset);
    const newClones = deskParts.map(item =>
        makeClone(item.obj, item.obj.name + '_clone_' + (editorIdCounter++)));
    if (!newClones.length) return notifyUser('Use Add again in the scene library to duplicate a scene asset.');
    transaction({ type: 'clone', clones: newClones });
    buildSceneTree();
}

// --- Phase 3: Tilt Animation System ---
//
// How it works (mirrors the lift's bake workflow):
//  1. In setup mode (?setup), select the parts that should tilt, optionally Pick Pivot,
//     set axis/min/max and Save Tilt Config. A wrapper THREE.Group is created INSIDE the
//     model hierarchy at the pivot point; the parts are re-parented into it. The wrapper
//     rotates for tilt and is translated by the lift system, so tilt + lift compose.
//  2. Click "Export Tilt Configs (JSON)" and paste the payload into BAKED_TILT_CONFIGS
//     below. Baked configs are rebuilt automatically on every page load, and each one
//     gets a customer-facing slider in the viewer overlay.
//  pivotLocal is stored in model-local coordinates at the 28" reference height.
const BAKED_TILT_CONFIGS = [
    // "tilting" — desktop tilt rig built in the editor (Jul 6, 2026).
    // Rest pose is 0°, tilts to -70° around the Z axis, anchored at the picked
    // pivot part. pivotLocal is model-local at the 28" reference height.
    {
        name: "tilting",
        axis: "z",
        minDeg: -70,
        maxDeg: 0,
        pivotLocal: { x: -175.85000650000003, y: 24.739389450000004, z: -306.42251899999997 },
        groupEditorIds: [
            "Desktop_1_4", "Desktop_2_5", "Desktop_3", "Desktop_3_6",
            "L_A_Hardware_Top_1_33", "L_A_Hardware_Top_3_35", "L_A_Hardware_Top_4_255",
            "L_A_Hardware_Top_6_257", "L_A_Hardware_Top_7_258", "mesh_692_692",
            "Power_1_1", "Power_2_2", "Power_4_8", "Power_7_11"
        ]
    }
];

const tiltConfigs = [];
let tiltPivotEditorId = null; // currently designated pivot part
let isPickingPivot = false;
let pivotHighlightHelper = null;

function isInTiltWrapper(obj) {
    let cur = obj.parent;
    while (cur) {
        if (cur.userData && cur.userData.isTiltWrapper) return true;
        cur = cur.parent;
    }
    return false;
}

function removeFromLift(obj) {
    liftObjects.delete(obj);
    const i = movingObjects.findIndex(item => item.obj === obj);
    if (i > -1) movingObjects.splice(i, 1);
    if (boxHelpers.has(obj.uuid)) {
        scene.remove(boxHelpers.get(obj.uuid));
        boxHelpers.delete(obj.uuid);
    }
}

// Re-adds a part to the lift system with a FRESH baseY. Always drop any existing
// entry first — an entry created while the part sat inside a tilt wrapper holds a
// wrapper-local baseY, which would make the part jump on the next height change.
function rejoinLift(obj) {
    toggleMovingObject(obj, false, true);
    toggleMovingObject(obj, true, true);
    liftObjects.set(obj, { obj, baseY: obj.position.y - (currentLift - LIFT_MIN) });
}

// Attach/detach parts on an EXISTING tilt rig. Both zero the rotation first so
// parts join or leave in the rest pose, then restore the current angle.
function attachPartsToTilt(config, parts) {
    const savedDeg = config.currentDeg;
    config.currentDeg = 0;
    applyTiltConfig(config);
    config.wrapperGroup.updateMatrixWorld(true);
    parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        config.wrapperGroup.attach(obj);
        const eid = obj.userData.editorId;
        if (eid && !config.groupEditorIds.includes(eid)) config.groupEditorIds.push(eid);
    });
    config.currentDeg = savedDeg;
    applyTiltConfig(config);
}

function detachPartsFromTilt(config, parts) {
    const savedDeg = config.currentDeg;
    config.currentDeg = 0;
    applyTiltConfig(config);
    config.wrapperGroup.updateMatrixWorld(true);
    parts.forEach(obj => {
        if (obj.parent !== config.wrapperGroup) return;
        const parent = animOriginalParents.get(obj) || loadedModel;
        parent.attach(obj);
        animOriginalParents.delete(obj);
        rejoinLift(obj);
        const i = config.groupEditorIds.indexOf(obj.userData.editorId);
        if (i > -1) config.groupEditorIds.splice(i, 1);
    });
    config.currentDeg = savedDeg;
    applyTiltConfig(config);
}

function addSelectedToTiltConfig(idx) {
    const config = tiltConfigs[idx];
    if (!config || movingObjects.length === 0) return;
    // Release any parts held by the transform gizmo first
    if (transformControl) transformControl.detach();
    [...transformProxy.children].forEach(child => {
        const p = proxyOriginalParents.get(child);
        if (p) { p.attach(child); proxyOriginalParents.delete(child); }
        else scene.attach(child);
    });
    const parts = movingObjects
        .map(item => item.obj)
        .filter(obj => {
            if (telescopingObjects.some(t => t.obj === obj)) {
                console.warn('[ErgoFlex] Skipping telescoping part "' + obj.name + '" — it cannot join a tilt group.');
                return false;
            }
            return !isInTiltWrapper(obj);
        });
    if (parts.length === 0) return;
    attachPartsToTilt(config, parts);
    transaction({ type: 'tilt-parts', name: config.name, editorIds: parts.map(o => o.userData.editorId).filter(Boolean), added: true });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

function removeSelectedFromTiltConfig(idx) {
    const config = tiltConfigs[idx];
    if (!config) return;
    const parts = movingObjects.map(item => item.obj).filter(obj => obj.parent === config.wrapperGroup);
    if (parts.length === 0) {
        console.warn('[ErgoFlex] No selected parts belong to "' + config.name + '" — click-select the parts to remove first.');
        return;
    }
    detachPartsFromTilt(config, parts);
    transaction({ type: 'tilt-parts', name: config.name, editorIds: parts.map(o => o.userData.editorId).filter(Boolean), added: false });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

// Builds the tilt rig: a wrapper group parented into the model (so it shares the
// model's units/scale), positioned at the pivot, with the parts attached to it.
function createTiltConfig({ name, axis, minDeg, maxDeg, parts, pivotLocal, groupEditorIds }) {
    const liftOffset = currentLift - LIFT_MIN;

    const wrapper = new THREE.Group();
    wrapper.name = 'tiltWrapper_' + name;
    wrapper.userData.isTiltWrapper = true;
    wrapper.position.set(pivotLocal.x, pivotLocal.y + liftOffset, pivotLocal.z);
    loadedModel.add(wrapper);
    wrapper.updateMatrixWorld(true);

    parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        wrapper.attach(obj);
    });

    const config = {
        name, axis, minDeg, maxDeg,
        currentDeg: 0,
        groupEditorIds,
        wrapperGroup: wrapper,
        wrapperBaseY: pivotLocal.y,
        pivotLocal: { x: pivotLocal.x, y: pivotLocal.y, z: pivotLocal.z }
    };
    tiltConfigs.push(config);
    return config;
}

function serializeTiltConfigs() {
    return tiltConfigs.map(c => ({
        name: c.name,
        axis: c.axis,
        minDeg: c.minDeg,
        maxDeg: c.maxDeg,
        pivotLocal: c.pivotLocal,
        groupEditorIds: c.groupEditorIds
    }));
}

function persistTiltConfigs() {
    try { localStorage.setItem('ergoflexTiltConfigs', JSON.stringify(serializeTiltConfigs())); } catch (e) {}
}

function restoreTiltConfigs() {
    // A baked default that the user deleted stays deleted; without this the
    // deletion silently undoes itself on the next load.
    const isDeleted = name => deletedBakedRigs.tilt.has(name);
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('ergoflexTiltConfigs') || '[]'); } catch (e) {}
    // Locally-saved configs FIRST so your latest edits (added/removed parts)
    // override the baked version of the same name; baked fills in the rest.
    const bakedTiltNames = new Set(BAKED_TILT_CONFIGS.map(c => c.name));
    const shadowedTilts = saved.filter(c => c && bakedTiltNames.has(c.name)).map(c => c.name);
    if (shadowedTilts.length) {
        console.warn('[ErgoFlex] Using this browser\'s saved copy of tilt config(s): ' + shadowedTilts.join(', ') +
            '. Edits to the baked definition in index.html are ignored until you click ' +
            '"Reset saved animation data" in the Actuator Rigs panel.');
    }
    const all = [...saved, ...BAKED_TILT_CONFIGS];
    all.forEach(baked => {
        if (!baked || !baked.name || isDeleted(baked.name) || tiltConfigs.some(c => c.name === baked.name)) return;
        const parts = (baked.groupEditorIds || [])
            .map(eid => {
                const entry = partRegistry.get(eid);
                if (!entry) console.warn('[ErgoFlex] Tilt config "' + baked.name + '": part [' + eid + '] not found in model.');
                return entry ? entry.obj : null;
            })
            .filter(obj => obj && !isInTiltWrapper(obj));
        if (parts.length === 0) return;
        createTiltConfig({
            name: baked.name,
            axis: baked.axis || 'z',
            minDeg: typeof baked.minDeg === 'number' ? baked.minDeg : -15,
            maxDeg: typeof baked.maxDeg === 'number' ? baked.maxDeg : 15,
            parts: parts,
            pivotLocal: baked.pivotLocal || { x: 0, y: 0, z: 0 },
            groupEditorIds: baked.groupEditorIds || []
        });
    });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    if (tiltConfigs.length > 0) rebuildTiltUI();
    // Report only on the rigs that were actually built. Warning inside the
    // restore loop cried wolf: a saved copy whose ids no longer resolve is
    // skipped and the baked definition takes over, leaving a sound rig.
    tiltConfigs.forEach(config => {
        const missing = (config.groupEditorIds || []).filter(eid => !partRegistry.get(eid));
        if (missing.length) {
            reportSceneWarning('tilt-parts-missing',
                `Tilt rig "${config.name}" is missing ${missing.length} of its ${config.groupEditorIds.length} parts.`,
                missing);
        }
    });
}

function setPivotPart(editorId) {
    clearPivotHighlight();
    tiltPivotEditorId = editorId;
    const entry = partRegistry.get(editorId);
    if (entry) {
        const helper = new THREE.BoxHelper(entry.obj, 0xff8800);
        scene.add(helper);
        pivotHighlightHelper = helper;
        const status = document.getElementById('pivot-status');
        if (status) status.textContent = 'Pivot: ' + entry.name;
        const clearBtn = document.getElementById('clear-pivot-btn');
        if (clearBtn) clearBtn.classList.remove('hidden');
        updateTransformProxy(); // re-anchor the gizmo onto the pivot
    }
}

function clearPivotHighlight() {
    if (pivotHighlightHelper) {
        scene.remove(pivotHighlightHelper);
        pivotHighlightHelper = null;
    }
}

function clearPivotSelection() {
    clearPivotHighlight();
    tiltPivotEditorId = null;
    const status = document.getElementById('pivot-status');
    if (status) status.textContent = 'Pivot: None (center)';
    const clearBtn = document.getElementById('clear-pivot-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    updateTransformProxy(); // back to selection-center anchoring
}

function updatePickPivotBtnState() {
    const btn = document.getElementById('pick-pivot-btn');
    if (!btn) return;
    if (isPickingPivot) {
        btn.textContent = 'Click a part...';
        btn.classList.add('bg-orange-100', 'ring-2', 'ring-orange-400');
    } else {
        btn.textContent = 'Pick Pivot';
        btn.classList.remove('bg-orange-100', 'ring-2', 'ring-orange-400');
    }
}

function saveTiltConfig() {
    const name = document.getElementById('tilt-name-input')?.value?.trim();
    if (!name || movingObjects.length === 0 || !loadedModel) { notifyUser('Name your tilt and select its parts first.'); return; }
    if (tiltConfigs.some(c => c.name === name)) {
        console.warn('[ErgoFlex] A tilt config named "' + name + '" already exists — remove it first or pick another name.');
        return;
    }

    const axisRadio = document.querySelector('input[name="tilt_axis"]:checked');
    const axis = axisRadio ? axisRadio.value : 'z';
    const minDeg = Number(document.getElementById('tilt-min-deg').value);
    const maxDeg = Number(document.getElementById('tilt-max-deg').value);
    if (!Number.isFinite(minDeg) || !Number.isFinite(maxDeg) || minDeg >= maxDeg || minDeg < -90 || maxDeg > 90) { notifyUser('Enter a tilt range between −90° and 90°, with minimum below maximum.'); return; }

    // Release any parts held by the transform gizmo so world transforms are clean
    if (transformControl) transformControl.detach();
    [...transformProxy.children].forEach(child => {
        const p = proxyOriginalParents.get(child);
        if (p) {
            p.attach(child);
            proxyOriginalParents.delete(child);
        } else {
            scene.attach(child);
        }
    });

    // Telescoping columns move at a different lift ratio — they can't ride a tilt rig.
    // Parts already inside another tilt wrapper are skipped too.
    const parts = movingObjects
        .map(item => item.obj)
        .filter(obj => {
            if (telescopingObjects.some(t => t.obj === obj)) {
                console.warn('[ErgoFlex] Skipping telescoping part "' + obj.name + '" — it cannot join a tilt group.');
                return false;
            }
            return !isInTiltWrapper(obj);
        });
    if (parts.length === 0) return;

    const groupEditorIds = parts.map(obj => obj.userData.editorId).filter(Boolean);

    // Resolve pivot: designated part's origin, or center of the selection
    let pivotWorld = new THREE.Vector3();
    let pivotResolved = false;
    if (tiltPivotEditorId) {
        const pivotEntry = partRegistry.get(tiltPivotEditorId);
        if (pivotEntry) {
            // Use the part's visible geometry center, NOT obj.getWorldPosition().
            // CAD-exported GLBs often give every mesh the same origin (the CAD
            // world origin), so the origin says nothing about where the part is.
            pivotEntry.obj.updateMatrixWorld(true);
            const pivotBox = new THREE.Box3().setFromObject(pivotEntry.obj);
            pivotBox.getCenter(pivotWorld);
            pivotResolved = true;
        }
    }
    if (!pivotResolved) {
        const box = new THREE.Box3();
        parts.forEach(obj => {
            obj.updateMatrixWorld(true);
            box.expandByObject(obj);
        });
        box.getCenter(pivotWorld);
    }

    // Store the pivot in model-local space, normalized to the 28" reference height
    loadedModel.updateMatrixWorld(true);
    const pivotLocal = loadedModel.worldToLocal(pivotWorld.clone());
    pivotLocal.y -= (currentLift - LIFT_MIN);

    createTiltConfig({ name, axis, minDeg, maxDeg, parts, pivotLocal, groupEditorIds });
    transaction({ type: 'tilt-save', name: name });

    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    clearPivotSelection();
    const nameInput = document.getElementById('tilt-name-input');
    if (nameInput) nameInput.value = '';
    persistTiltConfigs();
    rebuildTiltUI();
}

function rebuildTiltUI() {
    const list = document.getElementById('tilt-configs-list');
    const overlay = document.getElementById('tilt-sliders-overlay');
    if (list) list.innerHTML = '';
    if (overlay) {
        overlay.innerHTML = '';
        overlay.classList.toggle('hidden', tiltConfigs.length === 0);
    }
    tiltConfigs.forEach((config, idx) => {
        // Debug panel slider
        const div = document.createElement('div');
        div.className = 'bg-orange-50 border border-orange-200 p-2 rounded-lg';
        div.innerHTML =
            '<div class="flex justify-between items-center mb-1">' +
            '<span class="font-medium text-orange-800">' + config.name + ' (' + config.axis.toUpperCase() + ', ' + config.wrapperGroup.children.length + ' parts)</span>' +
            '<div class="flex items-center gap-2">' +
            '<span class="text-xs text-orange-600" id="tilt-val-' + idx + '">' + config.currentDeg.toFixed(1) + ' deg</span>' +
            '<button class="text-red-400 hover:text-red-600 text-sm font-bold leading-none" data-remove-tilt="' + idx + '" title="Remove tilt config">✕</button>' +
            '</div></div>' +
            '<input type="range" min="' + config.minDeg + '" max="' + config.maxDeg + '" step="0.1" value="' + config.currentDeg + '" class="w-full" data-tilt-idx="' + idx + '">' +
            '<div class="flex gap-2 mt-1.5">' +
            '<button data-add-parts-tilt="' + idx + '" class="text-xs bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 px-2 py-1 rounded font-medium transition-colors" title="Attach the currently selected parts to this tilt group">+ Add selected</button>' +
            '<button data-del-parts-tilt="' + idx + '" class="text-xs bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 px-2 py-1 rounded font-medium transition-colors" title="Detach the currently selected parts from this tilt group">− Remove selected</button>' +
            '</div>';
        if (list) list.appendChild(div);

        // Overlay slider below height slider
        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'bg-white/80 backdrop-blur-xl px-6 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 flex items-center gap-5';
        overlayDiv.innerHTML =
            '<div class="flex flex-col items-center min-w-[50px]">' +
            '<span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-0.5">' + config.name + '</span>' +
            '<span class="text-lg font-bold text-gray-900 heading-font" id="tilt-overlay-val-' + idx + '">' + config.currentDeg.toFixed(1) + '°</span>' +
            '</div>' +
            '<input type="range" min="' + config.minDeg + '" max="' + config.maxDeg + '" step="0.1" value="' + config.currentDeg + '" class="height-slider flex-1" data-tilt-idx="' + idx + '">' +
            '<button class="tilt-reset" data-reset-tilt="' + idx + '" title="Reset tilt">↺</button>';
        if (overlay) overlay.appendChild(overlayDiv);

        // Sync both sliders
        const panelSlider = div.querySelector('input[type="range"]');
        const overlaySlider = overlayDiv.querySelector('input[type="range"]');

        function onTiltInput(deg, source) {
            config.currentDeg = THREE.MathUtils.clamp(Number(deg) || 0, config.minDeg, config.maxDeg);
            const valSpan = document.getElementById('tilt-val-' + idx);
            if (valSpan) valSpan.textContent = deg.toFixed(1) + ' deg';
            const overlayVal = document.getElementById('tilt-overlay-val-' + idx);
            if (overlayVal) overlayVal.textContent = deg.toFixed(1) + '°';
            if (source !== panelSlider) panelSlider.value = deg;
            if (source !== overlaySlider) overlaySlider.value = deg;
            applyTiltConfig(config);
        }

        panelSlider.addEventListener('input', (e) => onTiltInput(parseFloat(e.target.value), panelSlider));
        overlaySlider.addEventListener('input', (e) => onTiltInput(parseFloat(e.target.value), overlaySlider));

        // Delete buttons
        div.querySelector('[data-remove-tilt]')?.addEventListener('click', () => removeTiltConfig(idx));
        overlayDiv.querySelector('[data-reset-tilt]')?.addEventListener('click', () => onTiltInput(THREE.MathUtils.clamp(0, config.minDeg, config.maxDeg), null));
        overlaySlider.setAttribute('aria-label', config.name + ' angle in degrees');
        panelSlider.setAttribute('aria-label', config.name + ' angle in degrees');

        // Add/remove selected parts on the existing rig
        div.querySelector('[data-add-parts-tilt]')?.addEventListener('click', () => addSelectedToTiltConfig(idx));
        div.querySelector('[data-del-parts-tilt]')?.addEventListener('click', () => removeSelectedFromTiltConfig(idx));
    });
    // The remote's primary tilt control reads from these rigs, and at first build
    // there were none to read.
    syncTiltUI();
}

function removeTiltConfig(idx, { recordUndo = true } = {}) {
    const config = tiltConfigs[idx];
    if (!config) return;
    // Deleting a rig used to be unrecoverable. Capture the serialized definition
    // first so undo can rebuild it. recordUndo is false when performUndo itself is
    // the caller, so undoing a tilt-save does not push a new entry.
    if (recordUndo) {
        writeAutosave('before deleting tilt rig ' + config.name);
        transaction({ type: 'rig-restore', kind: 'tilt', definition: serializeTiltConfigs()[idx] });
        deletedBakedRigs.tilt.add(config.name);
    }
    // Reset rotation so world transforms are clean before re-parenting
    config.wrapperGroup.rotation.set(0, 0, 0);
    config.wrapperGroup.updateMatrixWorld(true);
    // Hand each part back to its original parent and to the lift system
    [...config.wrapperGroup.children].forEach(child => {
        const parent = animOriginalParents.get(child) || loadedModel;
        parent.attach(child);
        animOriginalParents.delete(child);
        rejoinLift(child); // fresh baseY at the current height
    });
    if (config.wrapperGroup.parent) config.wrapperGroup.parent.remove(config.wrapperGroup);
    tiltConfigs.splice(idx, 1);
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

function applyTiltConfig(config) {
    if (!config.wrapperGroup) return;
    const rad = THREE.MathUtils.degToRad(config.currentDeg);
    config.wrapperGroup.rotation.set(0, 0, 0);
    if (config.axis === 'x') config.wrapperGroup.rotation.x = rad;
    else if (config.axis === 'y') config.wrapperGroup.rotation.y = rad;
    else config.wrapperGroup.rotation.z = rad;
    config.wrapperGroup.updateMatrixWorld(true);
    updateActuatorRigs();
}

// --- Phase 4: Actuator Rigs ---
//
// A rig makes actuator geometry FOLLOW a tilt automatically, as an exact
// two-point linkage: the cylinder rotates around a fixed base point B so it
// always aims at a target point A riding on the tilting assembly; the rod
// gets the same rotation plus a slide along the axis by |BA| - restLength,
// so it telescopes in and out of the cylinder. No ratios to tune.
// baseLocal is model-local at the 28" reference height; both B and A ride
// the lift equally, so rigs are lift-invariant by construction.
const BAKED_ACTUATOR_RIGS = [
    // Paste exported actuator rig payloads here (from "Export Animations").
    //
    // The two lift actuators, measured off full.glb (Sep 9, 2026). Each aims at a
    // top clevis pin that belongs to the "tilting" group, so both actuators swing
    // and telescope automatically whenever the desktop tilt slider moves — no
    // separate keyframes.
    //
    //   cylinder = body + base clevis + pin (swings about the base pivot)
    //   rod      = the shaft that also slides in/out as the throw changes
    //   baseLocal = centre of the Plates_Hardware base pin, model-local at 28"
    //               (i.e. LIFT_MIN — the raw glTF Y minus 19.25, which is how the
    //               base picker reports it; do not paste raw model coordinates here)
    //
    // Rest throw is 28.23 units on both sides. If a pivot looks off in the
    // viewer, hit "Pivot" on the rig and nudge it — no need to rebuild by hand.
    {
        name: "actuator_rear",
        baseLocal: { x: -173.1007, y: 13.382, z: -346.3278 },
        // The long top clevis pin, mirror of L_A_Hardware_Top_3_35 on the front rig.
        // (L_A_Hardware_Top_7_258 is the block around it — same spot to within 0.2
        // units, but the pin is the actual hinge and keeps both sides symmetric.)
        targetEditorId: "L_A_Hardware_Top_4_255",
        cylinderEditorIds: [
            "Linear_Actuators_2_38", "Linear_Actuators_5_41",
            "Linear_Actuators_6_42", "Linear_Actuators_8_44"
        ],
        rodEditorIds: ["Linear_Actuators_36"]
    },
    {
        name: "actuator_front",
        baseLocal: { x: -173.1002, y: 13.3808, z: -307.9656 },
        targetEditorId: "L_A_Hardware_Top_3_35",
        cylinderEditorIds: [
            "Linear_Actuators_3_39", "Linear_Actuators_4_40",
            "Linear_Actuators_7_43", "Linear_Actuators_9_45"
        ],
        rodEditorIds: ["Linear_Actuators_1_37"]
    }
];

const actuatorRigs = [];
const _rigA = new THREE.Vector3();
const _rigBase = new THREE.Vector3();
const _rigDir = new THREE.Vector3();
const _rigQ = new THREE.Quaternion();

function updateActuatorRigs() {
    if (actuatorRigs.length === 0 || !loadedModel) return;
    const liftOffset = currentLift - LIFT_MIN;
    actuatorRigs.forEach(rig => {
        _rigBase.set(rig.baseLocal.x, rig.baseLocal.y + liftOffset, rig.baseLocal.z);
        rig.targetObj.updateWorldMatrix(true, false);
        _rigA.copy(rig.targetLocalCenter);
        rig.targetObj.localToWorld(_rigA);
        loadedModel.worldToLocal(_rigA);
        _rigDir.copy(_rigA).sub(_rigBase);
        const curLen = _rigDir.length();
        if (curLen < 1e-6) return;
        _rigDir.normalize();
        _rigQ.setFromUnitVectors(rig.restDir, _rigDir);
        rig.cylWrapper.position.copy(_rigBase);
        rig.cylWrapper.quaternion.copy(_rigQ);
        rig.rodWrapper.quaternion.copy(_rigQ);
        rig.rodWrapper.position.copy(_rigBase).addScaledVector(_rigDir, curLen - rig.restLen);
    });
}

// Builds a rig from serialized data. Rest state (direction + length) is captured
// with every tilt zeroed, then the current angles are restored.
function buildActuatorRig({ name, baseLocal, targetEditorId, cylinderEditorIds, rodEditorIds }) {
    if (!loadedModel || !name || actuatorRigs.some(r => r.name === name)) return null;
    const targetEntry = partRegistry.get(targetEditorId);
    if (!targetEntry) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": target part [' + targetEditorId + '] not found.');
        reportSceneWarning('rig-target-missing', `Actuator rig \"${name}\" cannot find its target part.`, [targetEditorId]);
        return null;
    }
    // A part can only live in one animation wrapper, so whichever rig builds first
    // wins it. Saved rigs build before baked ones, which means a stale rig left in
    // localStorage can silently strip parts out of a baked definition — the failure
    // then looks like "half the actuator doesn't move". Report it instead of hiding it.
    const skipped = [];
    const reclaimedFromTilt = [];
    const wrapperOwning = obj => {
        let cur = obj.parent;
        while (cur) {
            if (cur.userData && cur.userData.isTiltWrapper) return cur.name || 'another rig';
            cur = cur.parent;
        }
        return 'another rig';
    };
    // A part explicitly named as this rig's cylinder or rod belongs to the rig. Tilt
    // configs are restored first, so a part added to a tilt group by hand during setup
    // would otherwise be swallowed and silently dropped from the rig — which reads as
    // "only one bit of the actuator moves". Take it back instead.
    const reclaimFromTilt = obj => {
        const owner = tiltConfigs.find(c => c.wrapperGroup === obj.parent);
        if (!owner) return false; // nested deeper, or held by another rig — leave it
        detachPartsFromTilt(owner, [obj]);
        reclaimedFromTilt.push(obj.userData.editorId + ' from tilt "' + owner.name + '"');
        return true;
    };
    const resolveParts = ids => (ids || []).map(eid => {
        const obj = partRegistry.get(eid)?.obj;
        if (!obj) { skipped.push(eid + ' — no such part'); return null; }
        if (isInTiltWrapper(obj) && !reclaimFromTilt(obj)) {
            skipped.push(eid + ' — already held by ' + wrapperOwning(obj));
            return null;
        }
        if (telescopingObjects.some(t => t.obj === obj)) { skipped.push(eid + ' — telescoping column'); return null; }
        return obj;
    }).filter(Boolean);
    const cylParts = resolveParts(cylinderEditorIds);
    const rodParts = resolveParts(rodEditorIds);
    if (reclaimedFromTilt.length) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '" reclaimed ' + reclaimedFromTilt.length +
            ' part(s) a tilt group was holding:\n  ' + reclaimedFromTilt.join('\n  ') +
            '\n  They now follow the actuator instead of tilting with the desktop. The tilt ' +
            'group has been saved without them; re-add them there if that was intentional.');
        // Save here so the same conflict is not re-fought on the next load, and so
        // this works identically whether the rig came from BAKED_ACTUATOR_RIGS or the UI.
        persistTiltConfigs();
        rebuildTiltUI();
    }
    if (skipped.length) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '" could not take ' + skipped.length +
            ' part(s):\n  ' + skipped.join('\n  ') +
            '\n  If these are held by another rig, it is probably stale data saved in this browser. ' +
            'Use "Reset saved animation data" in the Actuator Rigs panel to drop local overrides ' +
            'and rebuild from the baked definitions.');
    }
    if (cylParts.length === 0 && rodParts.length === 0) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": no cylinder or rod parts resolve.');
        return null;
    }

    // Capture rest geometry with all tilts at zero
    const savedDegs = tiltConfigs.map(c => c.currentDeg);
    tiltConfigs.forEach(c => {
        c.currentDeg = 0;
        c.wrapperGroup.rotation.set(0, 0, 0);
        c.wrapperGroup.updateMatrixWorld(true);
    });

    const liftOffset = currentLift - LIFT_MIN;
    const basePos = new THREE.Vector3(baseLocal.x, baseLocal.y + liftOffset, baseLocal.z);

    targetEntry.obj.geometry.computeBoundingBox();
    const targetLocalCenter = targetEntry.obj.geometry.boundingBox.getCenter(new THREE.Vector3());
    targetEntry.obj.updateWorldMatrix(true, false);
    const A = targetEntry.obj.localToWorld(targetLocalCenter.clone());
    loadedModel.updateMatrixWorld(true);
    loadedModel.worldToLocal(A);

    const rest = A.sub(basePos);
    const restLen = rest.length();
    if (restLen < 1e-6) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": base and target coincide.');
        tiltConfigs.forEach((c, i) => { c.currentDeg = savedDegs[i]; applyTiltConfig(c); });
        return null;
    }
    const restDir = rest.clone().normalize();

    const makeWrapper = suffix => {
        const w = new THREE.Group();
        w.name = 'rigWrapper_' + name + '_' + suffix;
        w.userData.isTiltWrapper = true; // lift/selection guards treat rig wrappers like tilt wrappers
        w.position.copy(basePos);
        loadedModel.add(w);
        w.updateMatrixWorld(true);
        return w;
    };
    const cylWrapper = makeWrapper('cyl');
    const rodWrapper = makeWrapper('rod');

    const adopt = (parts, wrapper) => parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        wrapper.attach(obj);
    });
    adopt(cylParts, cylWrapper);
    adopt(rodParts, rodWrapper);

    const rig = {
        name,
        baseLocal: { x: baseLocal.x, y: baseLocal.y, z: baseLocal.z },
        targetEditorId,
        targetObj: targetEntry.obj,
        targetLocalCenter,
        cylinderEditorIds: cylParts.map(o => o.userData.editorId).filter(Boolean),
        rodEditorIds: rodParts.map(o => o.userData.editorId).filter(Boolean),
        cylWrapper, rodWrapper, restDir, restLen
    };
    actuatorRigs.push(rig);

    // Restore tilt angles (this also triggers a rig update)
    tiltConfigs.forEach((c, i) => { c.currentDeg = savedDegs[i]; applyTiltConfig(c); });
    if (tiltConfigs.length === 0) updateActuatorRigs();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    return rig;
}

function removeActuatorRig(idx, { recordUndo = true } = {}) {
    const rig = actuatorRigs[idx];
    if (!rig) return;
    if (recordUndo) {
        writeAutosave('before deleting actuator rig ' + rig.name);
        transaction({ type: 'rig-restore', kind: 'actuator', definition: serializeActuatorRigs()[idx] });
        deletedBakedRigs.actuator.add(rig.name);
    }
    // Reset wrappers to rest pose so parts land cleanly
    const liftOffset = currentLift - LIFT_MIN;
    [rig.cylWrapper, rig.rodWrapper].forEach(w => {
        w.quaternion.identity();
        w.position.set(rig.baseLocal.x, rig.baseLocal.y + liftOffset, rig.baseLocal.z);
        w.updateMatrixWorld(true);
        [...w.children].forEach(child => {
            const parent = animOriginalParents.get(child) || loadedModel;
            parent.attach(child);
            animOriginalParents.delete(child);
            rejoinLift(child);
        });
        if (w.parent) w.parent.remove(w);
    });
    actuatorRigs.splice(idx, 1);
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    persistActuatorRigs();
    rebuildRigUI();
}

function serializeActuatorRigs() {
    return actuatorRigs.map(r => ({
        name: r.name,
        baseLocal: r.baseLocal,
        targetEditorId: r.targetEditorId,
        cylinderEditorIds: r.cylinderEditorIds,
        rodEditorIds: r.rodEditorIds
    }));
}

function persistActuatorRigs() {
    try { localStorage.setItem('ergoflexActuatorRigs', JSON.stringify(serializeActuatorRigs())); } catch (e) {}
}

function restoreActuatorRigs() {
    const isDeleted = name => deletedBakedRigs.actuator.has(name);
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('ergoflexActuatorRigs') || '[]'); } catch (e) {}
    // Local edits first, baked fills in the rest (same policy as tilt configs)
    const bakedRigNames = new Set(BAKED_ACTUATOR_RIGS.map(r => r.name));
    const shadowedRigs = saved.filter(r => r && bakedRigNames.has(r.name)).map(r => r.name);
    if (shadowedRigs.length) {
        console.warn('[ErgoFlex] Using this browser\'s saved copy of rig(s): ' + shadowedRigs.join(', ') +
            '. Edits to the baked definition in index.html are ignored until you click ' +
            '"Reset saved animation data" in the Actuator Rigs panel.');
    }
    [...saved, ...BAKED_ACTUATOR_RIGS].forEach(data => {
        if (!data || !data.name || isDeleted(data.name) || actuatorRigs.some(r => r.name === data.name)) return;
        buildActuatorRig(data);
    });
    if (actuatorRigs.length > 0) rebuildRigUI();
}

// --- Phase 5: Wheels & Glide Demo ---
// Wheel assemblies auto-rig from part naming (Wheel_F_L / F_R / R_L / R_R).
// The desk glides along a closed figure-eight; each mecanum wheel spins per
// its diagonal pairing: omega = (vx + latSign * vz) / radius. The figure-eight
// covers forward, lateral, and diagonal travel, so all four spin patterns show.
const WHEEL_GROUPS = [
    { prefix: 'Wheel_F_L', latSign: +1 },
    { prefix: 'Wheel_F_R', latSign: -1 },
    { prefix: 'Wheel_R_L', latSign: -1 },
    { prefix: 'Wheel_R_R', latSign: +1 }
];
const wheelRigs = [];
const glideBase = new THREE.Vector3();
const GLIDE_DURATION = 9;      // seconds for one loop
const GLIDE_AX = 0.55, GLIDE_AZ = 0.4; // path amplitude (world units)
let glideActive = false;
let glideT = 0;
const _glidePos = new THREE.Vector3();
const clock = new THREE.Clock();

function buildWheelRigs() {
    wheelRigs.length = 0;
    WHEEL_GROUPS.forEach(spec => {
        const parts = [];
        partRegistry.forEach(e => {
            if (e.name === spec.prefix || e.name.startsWith(spec.prefix + '_')) parts.push(e.obj);
        });
        if (parts.length === 0) return;

        // Hub = center of the largest mesh (the wheel disc), radius from its height
        let hubMesh = parts[0], hubArea = 0;
        parts.forEach(obj => {
            obj.geometry.computeBoundingBox();
            const bb = obj.geometry.boundingBox;
            const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
            if (area > hubArea) { hubArea = area; hubMesh = obj; }
        });
        hubMesh.updateWorldMatrix(true, false);
        const hubBox = new THREE.Box3().setFromObject(hubMesh);
        const hubWorld = hubBox.getCenter(new THREE.Vector3());
        const radius = Math.max(0.02, (hubBox.max.y - hubBox.min.y) / 2);

        const wrapper = new THREE.Group();
        wrapper.name = 'wheelRig_' + spec.prefix;
        wrapper.userData.isTiltWrapper = true; // same lift/selection guards as tilt wrappers
        loadedModel.updateMatrixWorld(true);
        wrapper.position.copy(loadedModel.worldToLocal(hubWorld.clone()));
        loadedModel.add(wrapper);
        wrapper.updateMatrixWorld(true);
        parts.forEach(obj => {
            removeFromLift(obj);
            obj.updateMatrixWorld(true);
            wrapper.attach(obj);
        });
        wheelRigs.push({ prefix: spec.prefix, latSign: spec.latSign, wrapper: wrapper, radius: radius, spin: 0, yawArm: null });
        // Measured now rather than on the first turn: the speed of a turn is
        // derived from these, and a half-populated set gives the wrong answer.
        wheelYawArm(wheelRigs[wheelRigs.length - 1]);
    });
    if (wheelRigs.length > 0) {
        console.log('[ErgoFlex] Wheel rigs: ' + wheelRigs.map(r => r.prefix + ' (r=' + r.radius.toFixed(3) + ')').join(', '));
    }
}

// Figure-eight with a smooth amplitude envelope: starts and ends at rest,
// at the home position, with zero velocity.
function glidePath(u, out) {
    const edge = 0.12;
    const ss = t => t * t * (3 - 2 * t);
    const env = ss(Math.min(u / edge, 1)) * ss(Math.min((1 - u) / edge, 1));
    out.set(
        GLIDE_AX * Math.sin(2 * Math.PI * u) * env,
        0,
        GLIDE_AZ * Math.sin(4 * Math.PI * u) * env
    );
    return out;
}

const glideOffset = new THREE.Vector3();
const glideTarget = new THREE.Vector3();
const glideInput = new THREE.Vector2();
const glideDemoOrigin = new THREE.Vector3();
const glideKeys = new Set();
let glidePointer = null;
let glideSpeed = 0.51;
let glideUIPrev = '';
function releaseGlideInput() {
    glideKeys.clear(); glideInput.set(0, 0); glidePointer = null;
    const knob = document.getElementById('glide-knob'); if (knob) knob.style.transform = 'translate(-50%, -50%)';
}
function manualGlideReady() {
    if (!loadedModel) { notifyUser('Wait for the desk to finish loading.'); return false; }
    if (transformControl?.object || isDraggingTransform) {
        notifyUser('Set Transform Tool to Off before moving the entire desk.'); return false;
    }
    glideActive = false; controls.autoRotate = false; return true;
}
function setGlidePosition(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !manualGlideReady()) return false;
    releaseGlideInput();
    glideTarget.set(THREE.MathUtils.clamp(x, -1, 1), 0, THREE.MathUtils.clamp(z, -1, 1));
    syncGlideUI(); return true;
}
function setupGlideControls() {
    const pad = document.getElementById('glide-pad');
    const updatePointer = e => {
        const rect = pad.getBoundingClientRect();
        glideInput.set((e.clientX - rect.left - rect.width / 2) / (rect.width * 0.35), (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.35));
        if (glideInput.length() > 1) glideInput.normalize();
        document.getElementById('glide-knob').style.transform = `translate(calc(-50% + ${glideInput.x * 30}px), calc(-50% + ${glideInput.y * 30}px))`;
    };
    // The compass is two controls in one. A press inside the dish steers the
    // glide; a press on the outer ring turns the desk in place. The band is the
    // app's: 0.62 to 1.02 of the outer radius, wide enough to catch the visible
    // capsules without swallowing the dish (movement_and_rotation_joystick.dart:507-528).
    let ringPointer = null, ringStartAngle = 0;
    const padAngle = e => {
        const box = pad.getBoundingClientRect();
        return {
            deg: Math.atan2(e.clientY - (box.top + box.height / 2),
                            e.clientX - (box.left + box.width / 2)) * 180 / Math.PI,
            radius: Math.hypot(e.clientX - (box.left + box.width / 2),
                               e.clientY - (box.top + box.height / 2)) / (box.width / 2)
        };
    };
    const endRing = () => {
        if (ringPointer === null) return;
        ringPointer = null;
        setYawCommand(0);
        applyRingAngle(0);   // springs back, as it does on the phone
    };

    pad.onpointerdown = e => {
        if (e.button !== 0 || !manualGlideReady()) return;
        e.preventDefault(); pad.focus();
        const { deg, radius } = padAngle(e);
        if (radius >= 0.62 && radius <= 1.02) {
            ringPointer = e.pointerId;
            ringStartAngle = deg;
            try { pad.setPointerCapture(e.pointerId); } catch {}
            return;
        }
        glideTarget.copy(glideOffset); glidePointer = e.pointerId;
        try { pad.setPointerCapture(e.pointerId); } catch {}
        updatePointer(e);
    };
    pad.onpointermove = e => {
        if (ringPointer === e.pointerId) {
            // Relative to where the twist started, wrapped so crossing the
            // -180/180 seam does not read as a full turn the other way.
            let delta = padAngle(e).deg - ringStartAngle;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            applyRingAngle(delta);
            setYawCommand(delta > 5 ? 1 : delta < -5 ? -1 : 0);
            return;
        }
        if (glidePointer === e.pointerId) updatePointer(e);
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
        pad.addEventListener(type, e => { endRing(); releaseGlideInput(e); }));
    pad.onkeydown = e => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault(); if (!manualGlideReady()) return;
        glideTarget.copy(glideOffset); glideKeys.add(e.key);
        glideInput.set(Number(glideKeys.has('ArrowRight')) - Number(glideKeys.has('ArrowLeft')), Number(glideKeys.has('ArrowDown')) - Number(glideKeys.has('ArrowUp')));
        if (glideInput.length() > 1) glideInput.normalize();
    };
    pad.onkeyup = e => {
        glideKeys.delete(e.key);
        glideInput.set(Number(glideKeys.has('ArrowRight')) - Number(glideKeys.has('ArrowLeft')), Number(glideKeys.has('ArrowDown')) - Number(glideKeys.has('ArrowUp')));
        if (glideInput.length() > 1) glideInput.normalize();
    };
    pad.onblur = releaseGlideInput;
    window.addEventListener('blur', () => { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); syncGlideUI(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); } });
    document.getElementById('glide-speed').onchange = e => glideSpeed = Number(e.target.value) || 0.51;
    document.getElementById('glide-home').onclick = () => setGlidePosition(0, 0);
    document.getElementById('glide-demo').onclick = () => {
        if (glideActive) { glideActive = false; glideTarget.copy(glideOffset); syncGlideUI(); }
        else startGlide();
    };
}
// Lift and tilt speeds, in real units per second rather than per-frame
// fractions. 'auto' is the app's default: the speed the desk picks for itself.
let liftSpeed = 'auto';
let tiltSpeed = 'auto';
let tiltTarget = null;
const LIFT_SPEEDS = { auto: 2.6, slow: 1.3, medium: 2.6, fast: 5.2 };
const TILT_SPEEDS = { auto: 14, slow: 7, medium: 14, fast: 28 };
function liftUnitsPerSecond() { return LIFT_SPEEDS[liftSpeed] ?? LIFT_SPEEDS.auto; }
function tiltDegreesPerSecond() { return TILT_SPEEDS[tiltSpeed] ?? TILT_SPEEDS.auto; }

// The desktop tilt, by name. Never tiltConfigs[0]: restoreTiltConfigs loads saved
// rigs before the baked one, so index 0 is whatever happened to load first and
// changes between sessions.
// Rotating the desk in place. The app's outer ring is a momentary jog, not a
// position dial: twist past a threshold and the desk turns for as long as you
// hold it, release and it stops and the ring springs back to zero
// (movement_and_rotation_joystick.dart:361-383, 588-598). Nothing wrote the
// model's yaw before this, so the movement itself is new.
// The desk turns about its wheel centre, which is the part named Base_Panels_3,
// not about the model's own origin. Setting rotation.y alone swings the whole
// desk around a point somewhere off in the assembly, so it orbits instead of
// turning on the spot.
const YAW_PIVOT_PART = 'Base_Panels_3';
let yawPivotLocal = null;   // the pivot in the model's local frame, measured once
function yawPivotOffset() {
    if (yawPivotLocal) return yawPivotLocal;
    if (!loadedModel) return null;
    let found = null;
    loadedModel.traverse(child => { if (!found && child.isMesh && child.name === YAW_PIVOT_PART) found = child; });
    if (!found) {
        reportSceneWarning('yaw-pivot',
            `Rotation pivot part "${YAW_PIVOT_PART}" is not in this model, so the desk turns about the model origin instead of its wheel centre.`);
        yawPivotLocal = new THREE.Vector3();
        return yawPivotLocal;
    }
    const centre = new THREE.Box3().setFromObject(found).getCenter(new THREE.Vector3());
    // Local to the model, so it survives the glide moving the model around.
    yawPivotLocal = loadedModel.worldToLocal(centre);
    yawPivotLocal.y = 0;    // turning is about the vertical axis through that point
    return yawPivotLocal;
}

// Turning on the spot still rolls the wheels, and mecanum wheels roll
// differently depending where they sit: each contact point travels tangentially
// about the pivot, so the near and far sides run opposite ways. The existing
// spin model already projects a displacement onto the roller axis
// (spin -= (dx + latSign * dz) / radius), so this only has to supply the right
// displacement - the rotational one - rather than invent a second model.
//
// The arm is measured in the desk's own frame, so it does not change as the desk
// turns, and is worked out once per wheel.
function wheelYawArm(rig) {
    if (rig.yawArm) return rig.yawArm;
    const pivot = yawPivotOffset();
    if (!pivot || !rig.wrapper) return null;
    const world = rig.wrapper.getWorldPosition(new THREE.Vector3());
    const local = loadedModel.worldToLocal(world.clone());
    const scale = loadedModel.scale.x;
    const rx = (local.x - pivot.x) * scale, rz = (local.z - pivot.z) * scale;
    // d/dtheta of rotating (rx, rz) about Y.
    rig.yawArm = { ax: rz, az: -rx };
    return rig.yawArm;
}

function spinWheelsForYaw(dTheta) {
    if (!dTheta) return;
    wheelRigs.forEach(rig => {
        const arm = wheelYawArm(rig);
        if (!arm || !rig.radius) return;
        rig.spin -= (arm.ax + rig.latSign * arm.az) * dTheta / rig.radius;
        rig.wrapper.rotation.z = rig.spin;
    });
}

// Position and yaw are one transform: rotating about a pivot that is not the
// origin means the position has to absorb the difference, or the pivot slides.
function applyDeskTransform() {
    if (!loadedModel) return;
    const pivot = yawPivotOffset();
    const scale = loadedModel.scale.x;
    const rest = pivot ? pivot.clone().multiplyScalar(scale) : new THREE.Vector3();
    const turned = rest.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deskYaw);
    loadedModel.rotation.y = deskYaw;
    loadedModel.position.x = glideBase.x + glideOffset.x + rest.x - turned.x;
    loadedModel.position.z = glideBase.z + glideOffset.z + rest.z - turned.z;
}

let deskYaw = 0;          // radians actually applied to the model
let yawCommand = 0;       // -1 left, 0 stop, +1 right
let ringAngle = 0;        // degrees the ring is twisted, for the visual only
// Derived from the glide speed rather than tabled separately, so the wheels turn
// at the same rate whichever way the desk is moving. glideSpeed is world units
// per second of travel; a wheel sitting `arm` from the pivot covers arm * omega
// per second while turning, so matching the two means omega = glideSpeed / arm.
// A separate table of angular speeds could only coincide with that by accident.
// What actually drives a wheel's spin is the mecanum projection
// (dx + latSign * dz), not the wheel's distance from the pivot - the roller
// angle means those differ by a large factor. Matching on distance left the
// wheels turning about eight times faster than the same speed setting produces
// while gliding.
function meanYawProjection() {
    let sum = 0, count = 0;
    wheelRigs.forEach(rig => {
        const arm = wheelYawArm(rig);
        if (!arm) return;
        const projection = Math.abs(arm.ax + rig.latSign * arm.az);
        if (projection > 1e-6) { sum += projection; count++; }
    });
    return count ? sum / count : 0;
}
function meanWheelRadius() {
    const radii = wheelRigs.map(rig => rig.radius).filter(r => r > 1e-6);
    return radii.length ? radii.reduce((a, b) => a + b, 0) / radii.length : 0.074;
}

// Gliding spins a wheel at glideSpeed / radius. Turning spins it at
// projection * omega / radius. Setting those equal gives omega = glideSpeed /
// projection, so the same speed word means the same wheel speed either way.
//
// The projection has to be measured before it is used. Reading it lazily meant
// the first frames fell back to a guess while the spin already used the real
// arms, and the two disagreed by more than an order of magnitude.
function yawRadiansPerSecond() {
    const projection = meanYawProjection();
    if (!projection) return glideSpeed / Math.max(0.02, meanWheelRadius() * 4);
    return glideSpeed / projection;
}
function setYawCommand(direction) {
    yawCommand = direction;
    const status = document.getElementById('glide-status');
    if (status) status.textContent = direction ? (direction > 0 ? 'Turning right' : 'Turning left') : 'Ready to move';
}
function applyRingAngle(deg) {
    ringAngle = deg;
    const ring = document.querySelector('#glide-pad .compass-ring');
    if (ring) ring.style.transform = `rotate(${deg}deg)`;
}

function primaryTiltConfig() {
    return tiltConfigs.find(c => c.name === 'tilting') || tiltConfigs[0] || null;
}

// Re-resolves the slider and re-attaches its handler. The element is rebuilt
// with the panel, so caching it once at startup left both this listener and
// showHeight() writing to a detached input - the slider did nothing and the
// readout silently stopped tracking.
function wireHeightSlider() {
    deskHeightSlider = document.getElementById('desk-height-slider');
    if (!deskHeightSlider) return;
    deskHeightSlider.addEventListener('input', (e) => {
        manualLiftOverride = true;
        isStanding = false;
        if (toggleHeightBtn) {
            toggleHeightBtn.style.color = '#374151';
            toggleHeightBtn.style.borderColor = '#e5e7eb';
        }
        const h = parseFloat(e.target.value);
        showHeight(h);
        currentLift = targetLift = heightToLift(h);
        updateMovingObjectsPosition();
    });
}

function showHeight(inches) {
    if (deskHeightSlider) deskHeightSlider.value = inches;
    const readout = document.getElementById('desk-height-display');
    if (readout && document.activeElement !== readout) {
        if ('value' in readout) readout.value = inches.toFixed(2);
        else readout.innerText = inches.toFixed(2) + '"';
    }
}

function syncTiltUI() {
    const config = primaryTiltConfig();
    const readout = document.getElementById('tilt-value');
    const slider = document.getElementById('tilt-slider');
    if (!config) return;
    if (readout && document.activeElement !== readout) readout.value = config.currentDeg.toFixed(2);
    if (slider && document.activeElement !== slider) {
        slider.min = config.minDeg; slider.max = config.maxDeg; slider.value = config.currentDeg;
    }
    positionArcThumb();
}

// Emergency stop: hold everything exactly where it is. stopGlide() is not this -
// it sends the desk back to its home position, which is the opposite of what a
// stop button must do.
function haltAllMotion() {
    glideActive = false;
    releaseGlideInput();
    glideTarget.copy(glideOffset);
    targetLift = currentLift;
    manualLiftOverride = false;
    tiltTarget = null;
    setYawCommand(0);
    applyRingAngle(0);
    const status = document.getElementById('glide-status');
    if (status) status.textContent = 'Stopped';
}

// ── The motion remote ────────────────────────────────────────────────────────
//
// A port of the ErgoFlex Desk app's motion surface: Glide, Height, Tilt, their
// speeds and preset banks, Ergo Forms, and a stop. Geometry and colour come from
// the Flutter source rather than from a screenshot - see app-remote.css.
//
// The phone stacks these vertically because it is a phone. Transcribing that
// here would make the panel taller, which is the opposite of what it is for, so
// the same blocks are laid out wide and fall back to the phone's order only when
// the viewer is genuinely narrow.

const SPEED_WORDS = [['auto', 'Auto'], ['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']];

// Versioned and validated. A key written by a future build, hand-edited, or
// truncated must not take the panel down with it.
function readStore(key, version, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || parsed.v !== version) return fallback;
        return parsed;
    } catch { return fallback; }
}
// Reported, not swallowed. A quota or private-mode failure here means a preset
// the user thought they saved is gone on reload, and the existing save paths in
// this app already say so rather than claiming a save that did not happen. Once
// per session, because a full quota fails on every write.
let storageWarned = false;
function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        if (!storageWarned) {
            storageWarned = true;
            notifyUser('Browser storage is unavailable, so presets will not survive a reload.');
        }
        return false;
    }
}

const LIFT_PRESET_KEY = 'ergoflex.liftPresetsV1';
const TILT_PRESET_KEY = 'ergoflex.tiltPresetsV1';
const ERGO_FORMS_KEY  = 'ergoflex.ergoFormsV1';
const DOCK_POS_KEY    = 'ergoflex.dockPosV1';

const numberOrNull = (value, lo, hi) =>
    (typeof value === 'number' && isFinite(value) && value >= lo && value <= hi) ? value : null;

function loadLiftPresets() {
    const stored = readStore(LIFT_PRESET_KEY, 1, null);
    const slots = Array.isArray(stored?.slots) ? stored.slots : [];
    return [0, 1, 2].map(i => numberOrNull(slots[i], HEIGHT_MIN, HEIGHT_MAX));
}
function loadTiltPresets() {
    const stored = readStore(TILT_PRESET_KEY, 1, null);
    const slots = Array.isArray(stored?.slots) ? stored.slots : [];
    return [0, 1, 2].map(i => numberOrNull(slots[i], -90, 90));
}
function loadErgoForms() {
    const fallback = [
        { name: 'Sitting', lift: 28, tilt: 0 },
        { name: 'Stool', lift: 40, tilt: -5 },
        { name: 'Standing', lift: 48, tilt: 0 }
    ];
    const stored = readStore(ERGO_FORMS_KEY, 1, null);
    if (!Array.isArray(stored?.forms) || stored.forms.length !== 3) return fallback;
    return stored.forms.map((form, i) => ({
        name: typeof form?.name === 'string' && form.name.trim() ? form.name.slice(0, 24) : fallback[i].name,
        lift: numberOrNull(form?.lift, HEIGHT_MIN, HEIGHT_MAX),
        tilt: numberOrNull(form?.tilt, -90, 90)
    }));
}

let liftPresets = [null, null, null];
let tiltPresets = [null, null, null];
let ergoForms = [];

// The compass, drawn to the app's numbers: 8 capsule ticks at R*0.915 spanning
// 19 degrees with round caps, an inner dish, and an eight-point star.
function compassSvg() {
    const R = 66, C = 66;
    const at = (r, a) => [C + r * Math.cos(a), C - r * Math.sin(a)];
    const tickR = R * 0.915, half = 9.5 * Math.PI / 180;
    let ticks = '';
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const [x1, y1] = at(tickR, a - half), [x2, y2] = at(tickR, a + half);
        ticks += `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${tickR.toFixed(2)} ${tickR.toFixed(2)} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="#2F55D4" stroke-width="${(R * 0.115).toFixed(2)}" stroke-linecap="round"/>`;
    }
    const Rin = 40, base = Rin * 0.40, len = Rin * 0.26, wide = Rin * 0.12;
    let star = '';
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const dx = Math.cos(a), dy = -Math.sin(a);
        const tip = [C + dx * (base + len), C + dy * (base + len)];
        const p1 = [C + dx * base - dy * wide, C + dy * base + dx * wide];
        const p2 = [C + dx * base + dy * wide, C + dy * base - dx * wide];
        star += `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="#2F55D4" fill-opacity=".92"/>`;
    }
    return `<svg viewBox="0 0 132 132" aria-hidden="true" focusable="false">
      <defs><radialGradient id="glide-dish" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#C8D2F1"/><stop offset=".55" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D0D9F2"/>
      </radialGradient></defs>
      <circle cx="66" cy="66" r="64" fill="#fff"/>
      <circle cx="66" cy="66" r="${(R * 0.82).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${(R * 0.055).toFixed(1)}"/>
      <circle cx="66" cy="66" r="${(R * 0.745).toFixed(1)}" fill="none" stroke="#2F55D4" stroke-opacity=".16" stroke-width="${(R * 0.008).toFixed(2)}"/>
      <g class="compass-ring" style="transform-origin:66px 66px">${ticks}</g>
      <circle cx="66" cy="66" r="${Rin}" fill="url(#glide-dish)"/>
      <circle cx="66" cy="66" r="${Rin - 1}" fill="none" stroke="#2F55D4" stroke-opacity=".42" stroke-width="1.6"/>
      <g class="compass-star">${star}</g>
    </svg>`;
}

// The tilt track is a crescent opening to the LEFT: 120 degrees centred on the
// horizontal, so it bulges right the way it does on the phone. Drawing it as a
// top arc was a misreading of the portrait screenshot.
const ARC = { cx: 26, cy: 95, r: 68, from: 60, to: -60, vw: 120, vh: 190 };
function arcPoint(deg) {
    return [ARC.cx + ARC.r * Math.cos(deg * Math.PI / 180),
            ARC.cy - ARC.r * Math.sin(deg * Math.PI / 180)];
}
function arcSvg() {
    const [x1, y1] = arcPoint(ARC.from), [x2, y2] = arcPoint(ARC.to);
    // sweep 1: from the upper end, round the right, down to the lower one.
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${ARC.r} ${ARC.r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    const [mx, my] = arcPoint(0);
    const arrow = (deg, flip) => {
        const [x, y] = arcPoint(deg);
        return `<polygon points="${x - 5},${y - flip * 3} ${x + 5},${y - flip * 3} ${x},${y + flip * 5}"
                 fill="#2F55D4" fill-opacity=".75"/>`;
    };
    return `<svg viewBox="0 0 ${ARC.vw} ${ARC.vh}" aria-hidden="true" focusable="false">
      <path class="arc-rim" d="${d}" stroke-width="35.2"/>
      <path class="arc-face" d="${d}" stroke-width="32"/>
      ${arrow(44, 1)}${arrow(24, 1)}${arrow(-24, -1)}${arrow(-44, -1)}
      <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" fill="#2F55D4" fill-opacity=".55"/>
    </svg>`;
}

function positionArcThumb() {
    const box = document.querySelector('.remote-arc');
    const slider = document.getElementById('tilt-slider');
    const thumb = box?.querySelector('.remote-sphere');
    if (!box || !slider || !thumb) return;
    const min = Number(slider.min), max = Number(slider.max);
    const t = max === min ? 0.5 : (Number(slider.value) - min) / (max - min);
    // t = 0 at the bottom of the crescent: the slider is rotated so up is its
    // maximum, and the thumb has to travel the same way or the two disagree.
    const deg = ARC.to + (ARC.from - ARC.to) * t;
    const [x, y] = arcPoint(deg);
    thumb.style.left = (x / ARC.vw * 100) + '%';
    thumb.style.top = (y / ARC.vh * 100) + '%';
}

function speedSelect(id, label, value) {
    const options = SPEED_WORDS.map(([v, text]) =>
        `<option value="${v}"${v === value ? ' selected' : ''}>${text}</option>`).join('');
    return `<div class="remote-speed"><select id="${id}" aria-label="${label}">${options}</select></div>`;
}

function chipRow(kind) {
    return `<div class="remote-chips" data-preset-bank="${kind}">` +
        [1, 2, 3].map(n => `<button class="remote-chip" data-slot="${n - 1}" type="button">${n}<span class="caret">&#94;</span></button>`).join('') +
        `</div>`;
}

function buildMotionRemote() {
    const dock = document.getElementById('motion-dock');
    if (!dock) return;
    liftPresets = loadLiftPresets();
    tiltPresets = loadTiltPresets();
    ergoForms = loadErgoForms();

    const tiltOverlay = document.getElementById('tilt-sliders-overlay');
    dock.className = 'app-remote';
    dock.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'remote-header';
    // The app's bar, in its order. The icons that belong to the physical desk -
    // microphone, collision shield, session logout - are drawn because they are
    // part of this design, and disabled because there is no desk behind them
    // here. A control that looks live and does nothing is worse than one that
    // says it is unavailable.
    const inert = (file, label) =>
        `<button class="remote-chrome" type="button" disabled aria-label="${label}"
                 title="${label} — hardware control, not connected in the preview"><img src="./assets/app-icons/${file}" alt=""></button>`;
    header.innerHTML = `<span class="remote-grip" aria-hidden="true"></span>
        <button class="remote-chrome remote-menu" type="button" disabled aria-label="Menu"
                title="Menu — not part of the preview"><span></span><span></span><span></span></button>
        <img class="remote-logo" src="./assets/app-icons/ergoflexwidelogonoslogan.svg" alt="ErgoFlex Desk">
        <span class="remote-status" role="img" aria-label="Preview — not connected to a desk"
              title="Preview only: this panel drives the 3D model, not a desk"></span>
        <span class="remote-spacer"></span>
        ${inert('help.svg', 'Info')}
        ${inert('MicOn.svg', 'Voice')}
        ${inert('pre_collision_on.svg', 'Collision guard')}
        <button id="remote-stop" type="button" title="Stop all movement" aria-label="Stop all movement"><img src="./assets/app-icons/e-stop.svg" alt=""></button>
        ${inert('quick_logout.svg', 'Sign out')}
        <button id="motion-dock-toggle" class="motion-dock-toggle" type="button" aria-controls="motion-dock-content" title="Collapse the movement panel">▼</button>`;
    dock.append(header);

    const body = document.createElement('div');
    body.id = 'motion-dock-content';
    body.className = 'motion-dock-body';
    body.innerHTML = `<div class="remote-body">
      <div class="remote-grid">

        <div class="remote-half remote-half-left">
          <div class="remote-glide-row" data-motion-panel="glide">
            <h3 class="remote-heading">Glide</h3>
            <div id="glide-pad" class="remote-compass" tabindex="0" role="group"
                 aria-label="Glide joystick. Drag the dish to move, twist the outer ring to turn in place, or use arrow keys."
                 aria-describedby="glide-help">${compassSvg()}<span id="glide-knob" class="remote-sphere"></span></div>
            <div class="remote-speed">
              <select id="glide-speed" aria-label="Glide speed">
                <option value="0.17">Crawl</option><option value="0.34">Ninja</option>
                <option value="0.51" selected>Slow</option><option value="0.68">Medium</option>
                <option value="0.85">Fast</option>
              </select>
            </div>
          </div>
          <div class="remote-forms">
            <h3 class="remote-heading">Ergo Forms <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <div class="remote-forms-row"></div>
          </div>
          <div class="glide-actions">
            <span id="glide-status">Ready to move</span>
            <button id="glide-demo" type="button" aria-pressed="false">Play demo</button>
            <button id="glide-home" type="button">Recenter</button>
          </div>
        </div>

        <div class="remote-half remote-half-right">
          <div class="remote-col" data-motion-panel="lift">
            <h3 class="remote-heading">Height <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <label class="remote-readout"><span class="sr-only">Desk height in inches</span>
              <input id="desk-height-display" type="number" inputmode="decimal"
                     min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="0.01" value="${HEIGHT_MIN.toFixed(2)}">
              <span class="unit">in</span>
              <svg class="pencil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </label>
            <div class="remote-vslider">
              <div class="vs-arrows"><span class="up u1"></span><span class="up u2"></span><span class="down d1"></span><span class="down d2"></span></div>
              <input type="range" id="desk-height-slider" min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="0.1" value="${HEIGHT_MIN}" aria-label="Desk height">
            </div>
            ${speedSelect('lift-speed', 'Lift speed', 'medium')}
            ${chipRow('lift')}
          </div>
          <div class="remote-col" data-motion-panel="tilt">
            <h3 class="remote-heading">Tilt <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <label class="remote-readout"><span class="sr-only">Desktop tilt in degrees</span>
              <input id="tilt-value" type="number" inputmode="decimal" step="0.01" value="0.00">
              <span class="unit">&deg;</span>
              <svg class="pencil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </label>
            <div class="remote-arc">${arcSvg()}
              <input type="range" id="tilt-slider" min="-30" max="30" step="0.1" value="0" aria-label="Desktop tilt">
              <span class="remote-sphere"></span>
            </div>
            ${speedSelect('tilt-speed', 'Tilt speed', 'medium')}
            ${chipRow('tilt')}
          </div>
        </div>

      </div>
      <p id="glide-help" class="remote-hint">Drag the dish to glide, twist the outer ring to turn in place. Tap a preset to recall it, press and hold to save.</p>
    </div>`;
    dock.append(body);
    if (tiltOverlay) body.querySelector('.remote-body').append(tiltOverlay);

    renderErgoForms();
    renderPresetChips();
    wireRemote(dock, header);
    // The glide compass, demo and recenter buttons are part of this panel, so
    // they are re-wired here. Wiring them once at startup left them pointing at
    // elements a rebuild had already replaced.
    setupGlideControls();
    wireHeightSlider();
    syncTiltUI();
}

function renderErgoForms() {
    const row = document.querySelector('.remote-forms-row');
    if (!row) return;
    row.innerHTML = ergoForms.map((form, i) =>
        `<button class="remote-form" type="button" data-form="${i}" data-set="${form.lift !== null && form.tilt !== null}"
                 title="Tap to recall. Press and hold to save the current pose. Double-click to rename.">${form.name}</button>`).join('');
}

function renderPresetChips() {
    for (const [kind, bank] of [['lift', liftPresets], ['tilt', tiltPresets]]) {
        document.querySelectorAll(`[data-preset-bank="${kind}"] .remote-chip`).forEach(chip => {
            const value = bank[Number(chip.dataset.slot)];
            chip.dataset.saved = String(value !== null);
            chip.title = value === null
                ? 'Empty. Press and hold to save the current ' + (kind === 'lift' ? 'height' : 'tilt') + '.'
                : (kind === 'lift' ? value.toFixed(1) + '"' : value.toFixed(1) + '°') + ' — tap to recall, hold to overwrite.';
        });
    }
}

// Tap recalls, press-and-hold saves - the app's gesture, and the reason the two
// banks are separate: lift and tilt are stored independently there.
function bindHold(el, onTap, onHold) {
    let timer = null, held = false;
    const start = () => { held = false; timer = setTimeout(() => { held = true; onHold(); }, 550); };
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', () => { cancel(); if (!held) onTap(); });
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (e.shiftKey) onHold(); else onTap();   // Shift+Enter is the keyboard's "hold"
    });
}

function goToHeight(inches) {
    if (!loadedModel) return;
    manualLiftOverride = false;
    targetLift = heightToLift(THREE.MathUtils.clamp(inches, HEIGHT_MIN, HEIGHT_MAX));
}
function goToTilt(deg) {
    const config = primaryTiltConfig();
    if (!config) return;
    tiltTarget = THREE.MathUtils.clamp(deg, config.minDeg, config.maxDeg);
}

// Keep the panel inside the canvas's usable rectangle, not merely the viewer:
// a position saved at one window size, in one layout, must not strand it.
function clampDockPosition() {
    const dock = document.getElementById('motion-dock');
    const container = canvas?.parentElement;
    if (!dock || !container || dock.dataset.floating !== 'true') return;
    const pad = 8;
    const top = parseFloat(canvas.style.top) || 0;
    const maxX = Math.max(pad, container.clientWidth - dock.offsetWidth - pad);
    const maxY = Math.max(top + pad, container.clientHeight - dock.offsetHeight - pad);
    const x = THREE.MathUtils.clamp(parseFloat(dock.style.left) || 0, pad, maxX);
    const y = THREE.MathUtils.clamp(parseFloat(dock.style.top) || 0, top + pad, maxY);
    dock.style.left = x + 'px';
    dock.style.top = y + 'px';
    return { x, y };
}

// Where the panel lives depends on the mode.
//
// In the studio it floats inside the viewer and can be dragged anywhere, which
// is right for a tool: the editor wants it over the model and out of the way on
// demand. On the storefront a panel sitting on top of the desk is just covering
// the product, so there it drops DOWN, in normal flow beneath the viewer, and
// takes no space at all until you open it.
function placeRemoteForMode() {
    const dock = document.getElementById('motion-dock');
    const viewer = document.getElementById('viewer-shell');
    if (!dock || !viewer) return;
    const studio = document.body.classList.contains('setup-layout');
    dock.dataset.mode = studio ? 'floating' : 'docked';

    if (studio) {
        const stage = canvas?.parentElement;
        if (stage && dock.parentElement !== stage) stage.append(dock);
        placeDockFromStorage();
        return;
    }
    // Storefront: a sibling after the viewer, in flow. Clear anything the drag
    // left behind or it would still be positioned against the old parent.
    if (dock.parentElement !== viewer.parentElement) viewer.after(dock);
    dock.dataset.floating = '';
    dock.style.left = dock.style.top = dock.style.bottom = dock.style.transform = '';
}

function placeDockFromStorage() {
    const dock = document.getElementById('motion-dock');
    const container = canvas?.parentElement;
    if (!dock || !container) return;
    const stored = readStore(DOCK_POS_KEY, 1, null);
    const x = numberOrNull(stored?.x, -1e4, 1e4);
    const y = numberOrNull(stored?.y, -1e4, 1e4);
    if (x === null || y === null) return;   // never moved: leave it parked by CSS
    dock.dataset.floating = 'true';
    dock.style.left = x + 'px';
    dock.style.top = y + 'px';
    dock.style.bottom = 'auto';
    dock.style.transform = 'none';
    clampDockPosition();
}

function wireRemote(dock, header) {
    // ---- drag ----
    let dragging = null;
    header.addEventListener('pointerdown', e => {
        // Only the bare strip drags. A pointerdown on the stop button, the
        // collapse toggle, or anything else operable belongs to that control.
        if (e.button !== 0 || e.target.closest('button, a, input, select, [tabindex]')) return;
        if (dock.dataset.mode !== 'floating') return;   // docked below the viewer: nothing to drag
        const rect = dock.getBoundingClientRect();
        const container = canvas.parentElement.getBoundingClientRect();
        dragging = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        dock.dataset.floating = 'true';
        dock.style.bottom = 'auto';
        dock.style.transform = 'none';
        dock.style.left = (rect.left - container.left) + 'px';
        dock.style.top = (rect.top - container.top) + 'px';
        header.classList.add('dragging');
        try { header.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    });
    header.addEventListener('pointermove', e => {
        if (!dragging) return;
        const container = canvas.parentElement.getBoundingClientRect();
        dock.style.left = (e.clientX - container.left - dragging.dx) + 'px';
        dock.style.top = (e.clientY - container.top - dragging.dy) + 'px';
        clampDockPosition();
    });
    const endDrag = e => {
        if (!dragging) return;
        dragging = null;
        header.classList.remove('dragging');
        try { header.releasePointerCapture(e.pointerId); } catch {}
        const at = clampDockPosition();
        if (at) writeStore(DOCK_POS_KEY, { v: 1, x: at.x, y: at.y });
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);

    // ---- collapse ----
    const dockToggle = document.getElementById('motion-dock-toggle');
    const toggleDock = makeCollapsible('motion-dock', {
        mode: 'display',
        storageKey: 'ergoflex.motionDockCollapsed',
        onToggle: collapsed => {
            dock.classList.toggle('collapsed', collapsed);
            dockToggle.textContent = collapsed ? '▲' : '▼';
            dockToggle.setAttribute('aria-label', collapsed ? 'Expand movement panel' : 'Collapse movement panel');
            // The canvas is not involved; only the panel's own footprint changed.
            clampDockPosition();
        }
    });
    dockToggle.onclick = toggleDock;
    // Docked below the viewer, the whole header is the affordance: the panel is
    // closed until you ask for it, and the bar is what you press.
    header.addEventListener('click', e => {
        if (dock.dataset.mode === 'floating') return;
        if (e.target.closest('button, a, input, select')) return;
        toggleDock();
    });

    // ---- stop ----
    document.getElementById('remote-stop').onclick = () => { haltAllMotion(); notifyUser('Movement stopped.'); };

    // ---- height ----
    const heightField = document.getElementById('desk-height-display');
    const commitHeight = () => {
        const value = Number(heightField.value);
        if (!isFinite(value)) { showHeight(liftToHeight(currentLift)); return; }
        const clamped = THREE.MathUtils.clamp(value, HEIGHT_MIN, HEIGHT_MAX);
        heightField.value = clamped.toFixed(2);
        goToHeight(clamped);
    };
    heightField.addEventListener('change', commitHeight);
    heightField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitHeight(); heightField.blur(); } });
    document.getElementById('lift-speed').onchange = e => { liftSpeed = e.target.value; };

    // ---- tilt ----
    const tiltField = document.getElementById('tilt-value');
    const tiltSlider = document.getElementById('tilt-slider');
    const commitTilt = () => {
        const config = primaryTiltConfig();
        if (!config) return;
        const value = Number(tiltField.value);
        if (!isFinite(value)) { syncTiltUI(); return; }
        const clamped = THREE.MathUtils.clamp(value, config.minDeg, config.maxDeg);
        tiltField.value = clamped.toFixed(2);
        goToTilt(clamped);
    };
    tiltField.addEventListener('change', commitTilt);
    tiltField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitTilt(); tiltField.blur(); } });
    tiltSlider.addEventListener('input', () => {
        const config = primaryTiltConfig();
        if (!config) return;
        tiltTarget = null;                     // dragging is direct, not eased
        config.currentDeg = Number(tiltSlider.value);
        applyTiltConfig(config);
        tiltField.value = config.currentDeg.toFixed(2);
        positionArcThumb();
    });
    document.getElementById('tilt-speed').onchange = e => { tiltSpeed = e.target.value; };

    // ---- preset banks ----
    document.querySelectorAll('[data-preset-bank] .remote-chip').forEach(chip => {
        const kind = chip.closest('[data-preset-bank]').dataset.presetBank;
        const slot = Number(chip.dataset.slot);
        bindHold(chip,
            () => {
                const value = (kind === 'lift' ? liftPresets : tiltPresets)[slot];
                if (value === null) { notifyUser('That preset is empty. Press and hold to save the current position.'); return; }
                if (kind === 'lift') goToHeight(value); else goToTilt(value);
            },
            () => {
                if (kind === 'lift') {
                    liftPresets[slot] = Number(liftToHeight(currentLift).toFixed(1));
                    writeStore(LIFT_PRESET_KEY, { v: 1, slots: liftPresets });
                    notifyUser('Height ' + liftPresets[slot].toFixed(1) + '" saved to preset ' + (slot + 1) + '.');
                } else {
                    const config = primaryTiltConfig();
                    if (!config) { notifyUser('No tilt rig in this model to save.'); return; }
                    tiltPresets[slot] = Number(config.currentDeg.toFixed(1));
                    writeStore(TILT_PRESET_KEY, { v: 1, slots: tiltPresets });
                    notifyUser('Tilt ' + tiltPresets[slot].toFixed(1) + '° saved to preset ' + (slot + 1) + '.');
                }
                renderPresetChips();
            });
    });

    // ---- ergo forms ----
    document.querySelector('.remote-forms-row').addEventListener('dblclick', e => {
        const button = e.target.closest('[data-form]');
        if (!button) return;
        const form = ergoForms[Number(button.dataset.form)];
        const name = prompt('Name this Ergo Form', form.name);
        if (name && name.trim()) {
            form.name = name.trim().slice(0, 24);
            writeStore(ERGO_FORMS_KEY, { v: 1, forms: ergoForms });
            renderErgoForms();
            wireErgoForms();
        }
    });
    wireErgoForms();
}

// Re-bound whenever the row is re-rendered, since renaming replaces the buttons.
function wireErgoForms() {
    document.querySelectorAll('.remote-form').forEach(button => {
        const form = ergoForms[Number(button.dataset.form)];
        bindHold(button,
            () => {
                if (form.lift === null || form.tilt === null) { notifyUser('That form is empty. Press and hold to save the current pose.'); return; }
                goToHeight(form.lift);
                goToTilt(form.tilt);
            },
            () => {
                form.lift = Number(liftToHeight(currentLift).toFixed(1));
                const config = primaryTiltConfig();
                form.tilt = config ? Number(config.currentDeg.toFixed(1)) : 0;
                writeStore(ERGO_FORMS_KEY, { v: 1, forms: ergoForms });
                renderErgoForms();
                wireErgoForms();
                notifyUser(form.name + ' saved: ' + form.lift.toFixed(1) + '" at ' + form.tilt.toFixed(1) + '°.');
            });
    });
}

function syncGlideUI() {
    const state = `${glideOffset.x.toFixed(2)},${glideOffset.z.toFixed(2)},${glideActive},${glideInput.lengthSq() > 0}`;
    if (state === glideUIPrev) return; glideUIPrev = state;
    const demo = document.getElementById('glide-demo');
    if (demo) { demo.textContent = glideActive ? 'Pause demo' : 'Play demo'; demo.setAttribute('aria-pressed', String(glideActive)); }
    const status = document.getElementById('glide-status');
    if (status) status.textContent = glideActive ? 'Demo playing' : glideInput.lengthSq() > 0 ? 'Gliding' : glideOffset.distanceTo(glideTarget) > 0.005 ? 'Moving to position' : 'Ready to move';
}
function startGlide() {
    if (!manualGlideReady()) return false;
    releaseGlideInput(); glideDemoOrigin.copy(glideOffset); glideActive = true; glideT = 0;
    syncGlideUI(); return true;
}
// Export uses an immediate home reset; customer Recenter uses setGlidePosition.
function stopGlide() {
    glideActive = false; releaseGlideInput(); glideTarget.set(0, 0, 0);
    applyGlideOffset(glideTarget); syncGlideUI();
}
function applyGlideOffset(next) {
    if (!loadedModel) return;
    const dx = next.x - glideOffset.x, dz = next.z - glideOffset.z;
    wheelRigs.forEach(rig => {
        rig.spin -= (dx + rig.latSign * dz) / rig.radius;
        rig.wrapper.rotation.z = rig.spin;
    });
    glideOffset.copy(next);
    applyDeskTransform();
    loadedModel.updateMatrixWorld(true);
    if (isSelectionMode) boxHelpers.forEach(helper => helper.update());
}
function updateGlide(dt) {
    if (!loadedModel) return;
    dt = Math.min(Math.max(dt, 0), 0.05);
    if (transformControl?.object || isDraggingTransform) { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); return; }
    if (glideActive) {
        glideT = Math.min(1, glideT + dt / GLIDE_DURATION);
        glidePath(glideT, _glidePos).add(glideDemoOrigin);
        _glidePos.x = THREE.MathUtils.clamp(_glidePos.x, -1, 1); _glidePos.z = THREE.MathUtils.clamp(_glidePos.z, -1, 1);
        applyGlideOffset(_glidePos); glideTarget.copy(glideOffset);
        if (glideT >= 1) glideActive = false;
    } else {
        if (glideInput.lengthSq() > 0) {
            // Camera-relative floor motion keeps the pad intuitive after orbiting.
            const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            glideTarget.copy(glideOffset).addScaledVector(right, glideInput.x * glideSpeed * dt).addScaledVector(forward, -glideInput.y * glideSpeed * dt);
            glideTarget.x = THREE.MathUtils.clamp(glideTarget.x, -1, 1); glideTarget.z = THREE.MathUtils.clamp(glideTarget.z, -1, 1);
            applyGlideOffset(glideTarget);
        } else if (glideOffset.distanceToSquared(glideTarget) > 0.000001) {
            _glidePos.copy(glideTarget).sub(glideOffset);
            const step = Math.min(_glidePos.length(), glideSpeed * dt);
            _glidePos.setLength(step).add(glideOffset); applyGlideOffset(_glidePos);
        }
    }
    syncGlideUI();
}

// --- Phase 6: AR "See in your space" ---
// Exports the CURRENT configured desk (finishes, height, tilt pose) to a GLB
// at true physical scale and hands it to <model-viewer> for the AR handoff:
//   iOS / iPadOS -> AR Quick Look (USDZ generated on the fly)
//   Android      -> WebXR AR session in the browser
// The meters-per-world-unit factor is derived from the lift math: the lift
// travel spans exactly HEIGHT_MAX - HEIGHT_MIN real inches.
// NOTE: WebXR needs a secure context (https), so Android AR requires the
// production site — it won't trigger from a plain-http LAN dev URL.
let arBusy = false;
let lastARBlobUrl = null;

function isMobileARDevice() {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    return isIOS || /Android/i.test(ua);
}

async function prepareARModel() {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    if (!customElements.get('model-viewer')) {
        await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js');
    }
    stopGlide(); // desk must be at its home position for a clean export

    // Clone shares geometries/materials — cheap even at 830 meshes
    const clone = loadedModel.clone(true);
    clone.position.x = glideBase.x;
    clone.position.z = glideBase.z;

    const inchesPerWorld = (HEIGHT_MAX - HEIGHT_MIN) / ((LIFT_MAX - LIFT_MIN) * loadedModel.scale.x);
    const exportRoot = new THREE.Group();
    exportRoot.scale.setScalar(0.0254 * inchesPerWorld); // glTF units are meters
    exportRoot.add(clone);
    for (const group of workspaceAccessories?.exportGroups() || []) {
        group.matrix.elements[12] -= glideOffset.x;
        group.matrix.elements[14] -= glideOffset.z;
        exportRoot.add(group);
    }

    const glb = await new Promise((resolve, reject) =>
        new GLTFExporter().parse(exportRoot, resolve, reject, { binary: true }));
    const blob = new Blob([glb], { type: 'model/gltf-binary' });
    if (lastARBlobUrl) URL.revokeObjectURL(lastARBlobUrl);
    lastARBlobUrl = URL.createObjectURL(blob);

    let mv = document.getElementById('ar-model-viewer');
    if (!mv) {
        mv = document.createElement('model-viewer');
        mv.id = 'ar-model-viewer';
        mv.setAttribute('ar', '');
        mv.setAttribute('ar-modes', 'webxr quick-look');
        mv.setAttribute('ar-scale', 'fixed'); // true size in the room
        mv.style.cssText = 'position:fixed;bottom:0;left:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
        document.body.appendChild(mv);
    }
    mv.src = lastARBlobUrl;
    await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('model-viewer load timeout')), 30000);
        mv.addEventListener('load', () => { clearTimeout(to); resolve(); }, { once: true });
        mv.addEventListener('error', () => { clearTimeout(to); reject(new Error('model-viewer failed to parse GLB')); }, { once: true });
    });
    return { modelViewer: mv, bytes: blob.size };
}

async function launchAR() {
    if (arBusy || !loadedModel) return;
    if (!isMobileARDevice()) {
        showARHelpModal();
        return;
    }
    const btn = document.getElementById('ar-btn');
    arBusy = true;
    if (btn) btn.classList.add('animate-pulse');
    try {
        const { modelViewer } = await prepareARModel();
        await modelViewer.activateAR();
    } catch (err) {
        console.error('[ErgoFlex] AR launch failed:', err);
        showARHelpModal('AR could not start on this device. Make sure you are on a recent iPhone, iPad, or ARCore-capable Android phone, over https.');
    } finally {
        arBusy = false;
        if (btn) btn.classList.remove('animate-pulse');
    }
}

function showARHelpModal(message) {
    let modal = document.getElementById('ar-help-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'ar-help-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-25 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">See it in your space</h3>
            <p class="text-gray-600 text-sm leading-relaxed mb-4">${message ||
                'Open this page on your <b>phone or tablet</b> and tap the cube button to place the ErgoFlex desk in your room — at true size, in your exact configuration.'}</p>
            <p class="text-xs text-gray-400 break-all mb-6">${window.location.href}</p>
            <button class="btn-primary w-full py-3" id="ar-help-close">Got it</button>
        </div>
    `;
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'ar-help-close') modal.remove();
    });
    document.body.appendChild(modal);
}

// --- Rig setup UI (draft state + buttons) ---
let rigPickMode = null; // 'base' | 'target'
let rigDraft = { baseLocal: null, baseName: null, targetEditorId: null, targetName: null, cylinderEditorIds: [], rodEditorIds: [] };


// --- Pick feedback -------------------------------------------------------------
// "Pick base / target / pivot" used to be a blind click: nothing lit up under the
// cursor and nothing stayed marked afterwards, so on a model this dense you could
// not tell which of a dozen overlapping parts you had just grabbed. A hover
// highlight plus a name label answers "what am I about to pick?", and the picked
// parts keep a coloured box until the rig is saved.
const PICK_COLOR = { base: 0xa855f7, target: 0x14b8a6, hover: 0xffd60a };
let hoverHelper = null;
let hoverObj = null;
const rigPickHelpers = { base: null, target: null };

function isPickModeActive() { return !!rigPickMode || isPickingPivot; }

function clearHoverHighlight() {
    if (hoverHelper) { scene.remove(hoverHelper); hoverHelper = null; }
    hoverObj = null;
    const label = document.getElementById('pick-hover-label');
    if (label) label.classList.add('hidden');
}

function updatePickHover(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactableObjects, false);

    if (hits.length === 0) { clearHoverHighlight(); return; }

    const obj = hits[0].object;
    if (obj !== hoverObj) {
        if (hoverHelper) scene.remove(hoverHelper);
        hoverHelper = new THREE.BoxHelper(obj, PICK_COLOR.hover);
        hoverHelper.material.depthTest = false;
        hoverHelper.renderOrder = 998;
        scene.add(hoverHelper);
        hoverObj = obj;
    }

    const label = document.getElementById('pick-hover-label');
    if (label) {
        const eid = obj.userData.editorId;
        const custom = partLabels.get(eid);
        label.textContent = custom ? custom + '  ·  ' + eid : (eid || obj.name);
        label.classList.remove('hidden');
        label.style.left = (event.clientX - rect.left + canvas.offsetLeft + 14) + 'px';
        label.style.top = (event.clientY - rect.top + canvas.offsetTop + 14) + 'px';
    }
}

function setRigPickHelper(kind, obj) {
    if (rigPickHelpers[kind]) { scene.remove(rigPickHelpers[kind]); rigPickHelpers[kind] = null; }
    if (!obj) return;
    const helper = new THREE.BoxHelper(obj, PICK_COLOR[kind]);
    helper.material.depthTest = false;
    helper.renderOrder = 997;
    scene.add(helper);
    rigPickHelpers[kind] = helper;
}

function clearRigPickHelpers() {
    setRigPickHelper('base', null);
    setRigPickHelper('target', null);
}

// --- Rig base pivot ------------------------------------------------------------
// The base pick seeds the pivot with the clicked part's bounding-box centre, which
// is almost never the real hinge. The marker below makes that point visible and
// movable — by gizmo, by number, or by snapping to a selection's centre.
let pivotMarker = null;
let pivotEditRigIdx = -1;   // >= 0 while editing a saved rig, -1 while drafting
let pivotGizmoOn = false;

function currentLiftOffset() { return currentLift - LIFT_MIN; }

function showPivotMarker(baseLocal) {
    if (!loadedModel || !baseLocal) return;
    if (!pivotMarker) {
        const mat = new THREE.MeshBasicMaterial({
            color: PICK_COLOR.base, depthTest: false, transparent: true, opacity: 0.85
        });
        pivotMarker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), mat);
        pivotMarker.renderOrder = 999;
        pivotMarker.name = 'rigPivotMarker';
        pivotMarker.userData.isPivotMarker = true;
    }
    // Parented to the model so it tracks glide/lift in model-local coordinates
    if (pivotMarker.parent !== loadedModel) loadedModel.add(pivotMarker);
    pivotMarker.position.set(baseLocal.x, baseLocal.y + currentLiftOffset(), baseLocal.z);
    pivotMarker.updateMatrixWorld(true);
}

function hidePivotMarker() {
    setPivotGizmo(false);
    // Fully detached rather than just hidden — exporters and scene walks would
    // otherwise pick up an editor-only helper.
    if (pivotMarker && pivotMarker.parent) pivotMarker.parent.remove(pivotMarker);
}

function setPivotGizmo(on) {
    if (!transformControl) return;
    if (on && pivotMarker && pivotMarker.parent) {
        pivotGizmoOn = true;
        transformControl.setMode('translate');
        transformControl.attach(pivotMarker);
    } else {
        if (pivotGizmoOn) {
            pivotGizmoOn = false;
            transformControl.detach();
            // Restore whatever mode the Transform Tool radios were on
            const tMode = document.querySelector('input[name="transform_mode"]:checked');
            if (tMode && tMode.value !== 'none') transformControl.setMode(tMode.value);
            updateTransformProxy(); // hand the gizmo back to the part selection
        }
    }
    const btn = document.getElementById('rig-pivot-gizmo-btn');
    if (btn) {
        btn.classList.toggle('bg-purple-200', pivotGizmoOn);
        btn.textContent = pivotGizmoOn ? 'Stop dragging' : 'Drag in 3D';
    }
}

function readPivotInputs() {
    const num = id => parseFloat(document.getElementById(id)?.value);
    const x = num('rig-pivot-x'), y = num('rig-pivot-y'), z = num('rig-pivot-z');
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x, y, z };
}

function syncPivotInputs(baseLocal) {
    if (!baseLocal) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v.toFixed(3); };
    set('rig-pivot-x', baseLocal.x);
    set('rig-pivot-y', baseLocal.y);
    set('rig-pivot-z', baseLocal.z);
}

function pivotFromMarker() {
    if (!pivotMarker) return null;
    return {
        x: pivotMarker.position.x,
        y: pivotMarker.position.y - currentLiftOffset(),
        z: pivotMarker.position.z
    };
}

function openPivotEditor(rigIdx = -1) {
    const base = rigIdx >= 0 ? actuatorRigs[rigIdx]?.baseLocal : rigDraft.baseLocal;
    if (!base) return;
    pivotEditRigIdx = rigIdx;
    showPivotMarker(base);
    syncPivotInputs(base);
    const panel = document.getElementById('rig-pivot-editor');
    if (panel) panel.classList.remove('hidden');
    const title = document.getElementById('rig-pivot-title');
    if (title) title.textContent = rigIdx >= 0
        ? 'Base pivot — ' + actuatorRigs[rigIdx].name
        : 'Base pivot (new rig)';
}

function closePivotEditor() {
    hidePivotMarker();
    pivotEditRigIdx = -1;
    const panel = document.getElementById('rig-pivot-editor');
    if (panel) panel.classList.add('hidden');
}

// Applying to a saved rig rebuilds it: the wrappers bake rest direction and length
// from the pivot, so moving the pivot means re-deriving both.
function applyPivotEdit() {
    const pivot = readPivotInputs();
    if (!pivot) return;

    if (pivotEditRigIdx >= 0) {
        const rig = actuatorRigs[pivotEditRigIdx];
        if (!rig) return;
        const data = {
            name: rig.name,
            baseLocal: pivot,
            targetEditorId: rig.targetEditorId,
            cylinderEditorIds: [...rig.cylinderEditorIds],
            rodEditorIds: [...rig.rodEditorIds]
        };
        removeActuatorRig(pivotEditRigIdx);
        buildActuatorRig(data);
        persistActuatorRigs();
        rebuildRigUI();
        pivotEditRigIdx = actuatorRigs.findIndex(r => r.name === data.name);
    } else {
        rigDraft.baseLocal = pivot;
        updateRigStatus();
    }
    showPivotMarker(pivot);
}

// Model-local centre of the current selection, for snapping the pivot to a part
// (or a couple of parts) rather than typing coordinates.
function selectionCenterLocal() {
    if (movingObjects.length === 0 || !loadedModel) return null;
    const box = new THREE.Box3();
    movingObjects.forEach(item => {
        item.obj.updateWorldMatrix(true, false);
        box.expandByObject(item.obj);
    });
    if (box.isEmpty()) return null;
    const c = box.getCenter(new THREE.Vector3());
    loadedModel.updateMatrixWorld(true);
    loadedModel.worldToLocal(c);
    c.y -= currentLiftOffset(); // normalise to the 28" reference height
    return { x: c.x, y: c.y, z: c.z };
}

function updateRigStatus() {
    const el = document.getElementById('rig-status');
    if (!el) return;
    const p = rigDraft.baseLocal;
    el.innerHTML = 'Base: ' + (rigDraft.baseName ? '<b>' + rigDraft.baseName + '</b>' : '—') +
        (p ? ' <span class="text-purple-600">pivot ' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ', ' + p.z.toFixed(2) + '</span>' : '') +
        ' &nbsp;·&nbsp; Target: ' + (rigDraft.targetName ? '<b>' + rigDraft.targetName + '</b>' : '—') +
        ' &nbsp;·&nbsp; Cylinder: <b>' + rigDraft.cylinderEditorIds.length + '</b> parts' +
        ' &nbsp;·&nbsp; Rod: <b>' + rigDraft.rodEditorIds.length + '</b> parts';
}

function updateRigPickButtons() {
    const baseBtn = document.getElementById('rig-pick-base-btn');
    const targetBtn = document.getElementById('rig-pick-target-btn');
    if (baseBtn) {
        baseBtn.textContent = rigPickMode === 'base' ? 'Click a part...' : '1. Pick Base Part';
        baseBtn.classList.toggle('bg-purple-100', rigPickMode === 'base');
    }
    if (targetBtn) {
        targetBtn.textContent = rigPickMode === 'target' ? 'Click a part...' : '2. Pick Target Part';
        targetBtn.classList.toggle('bg-purple-100', rigPickMode === 'target');
    }
}

function selectedEditorIds() {
    return movingObjects
        .map(item => item.obj)
        .filter(obj => !isInTiltWrapper(obj) && !telescopingObjects.some(t => t.obj === obj))
        .map(obj => obj.userData.editorId)
        .filter(Boolean);
}

function saveActuatorRigFromUI() {
    const name = document.getElementById('rig-name-input')?.value?.trim();
    if (!name) return console.warn('[ErgoFlex] Give the rig a name first.');
    if (!rigDraft.baseLocal) return console.warn('[ErgoFlex] Pick a base part first.');
    if (!rigDraft.targetEditorId) return console.warn('[ErgoFlex] Pick a target part first.');
    if (rigDraft.cylinderEditorIds.length === 0 && rigDraft.rodEditorIds.length === 0)
        return console.warn('[ErgoFlex] Capture cylinder and/or rod parts first.');
    const rig = buildActuatorRig({
        name,
        baseLocal: rigDraft.baseLocal,
        targetEditorId: rigDraft.targetEditorId,
        cylinderEditorIds: rigDraft.cylinderEditorIds,
        rodEditorIds: rigDraft.rodEditorIds
    });
    if (!rig) return;
    transaction({ type: 'rig-save', name: name });
    persistActuatorRigs();
    clearRigPickHelpers();
    closePivotEditor();
    rigDraft = { baseLocal: null, baseName: null, targetEditorId: null, targetName: null, cylinderEditorIds: [], rodEditorIds: [] };
    const nameInput = document.getElementById('rig-name-input');
    if (nameInput) nameInput.value = '';
    updateRigStatus();
    rebuildRigUI();
}

function rebuildRigUI() {
    const list = document.getElementById('rig-list');
    if (!list) return;
    list.innerHTML = '';
    actuatorRigs.forEach((rig, idx) => {
        const div = document.createElement('div');
        div.className = 'bg-purple-50 border border-purple-200 p-2 rounded-lg flex justify-between items-center';
        div.innerHTML =
            '<span class="text-purple-800 text-xs font-medium">' + rig.name +
            ' <span class="font-normal text-purple-500">(cyl ' + rig.cylinderEditorIds.length + ' · rod ' + rig.rodEditorIds.length + ' → ' + (partRegistry.get(rig.targetEditorId)?.name || rig.targetEditorId) + ')</span></span>' +
            '<span class="flex items-center gap-2">' +
            '<button class="border border-purple-300 text-purple-600 hover:bg-purple-100 px-2 py-0.5 rounded text-[11px] font-medium" data-pivot-rig="' + idx + '" title="Show and move this rig\'s base pivot">Pivot</button>' +
            '<button class="text-red-400 hover:text-red-600 text-sm font-bold leading-none" data-remove-rig="' + idx + '" title="Remove rig">✕</button>' +
            '</span>';
        div.querySelector('[data-pivot-rig]').addEventListener('click', () => openPivotEditor(idx));
        div.querySelector('[data-remove-rig]').addEventListener('click', () => removeActuatorRig(idx));
        list.appendChild(div);
    });
}

// Re-fits the renderer to whatever size the viewer container currently is.
// Called on window resize, on ResizeObserver ticks, and after layout switches.
function syncViewerSize() {
    if (!renderer || !camera || !canvas.parentElement) return;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const viewerControls = container.querySelector('.viewer-controls');
    const top = viewerControls ? viewerControls.offsetTop + viewerControls.offsetHeight + 12 : (w < 500 ? 188 : 168);
    // The movement panel floats over the canvas rather than displacing it, so its
    // size no longer reaches the camera at all. Coupling them is what made the
    // panel cost the desk ~283px of height, and what forced every tab to reserve
    // the tallest panel's height so switching tabs would not move the camera.
    const h = Math.max(160, container.clientHeight - top);
    if (w === 0 || container.clientHeight === 0) return;
    canvas.style.position = 'absolute'; canvas.style.top = top + 'px';
    camera.aspect = w / h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// Temp instrumentation: track if we've logged max height
let _loggedMaxHeight = false;

function animate() {
    requestAnimationFrame(animate);

    // withNeutralPose sets motionPaused while it captures or applies geometry, so
    // a frame cannot advance the lift or the glide mid-capture. Rendering still
    // runs, so the viewer does not freeze.
    const dt = clock.getDelta();
    if (!motionPaused) updateGlide(dt);

    // Handle smooth animation if not manually scrubbing
    if (loadedModel && !manualLiftOverride && !motionPaused) {
        if (Math.abs(targetLift - currentLift) > 0.001) {
            // Units per second, integrated against the real frame time. The old
            // `* 0.08` was a per-frame fraction, so the desk genuinely moved at
            // different speeds on different displays and stalled under load.
            const step = liftUnitsPerSecond() * dt;
            const remaining = targetLift - currentLift;
            currentLift += Math.abs(remaining) <= step ? remaining : Math.sign(remaining) * step;
            updateMovingObjectsPosition();
            showHeight(liftToHeight(currentLift));

            // Temp instrumentation: log column positions at max height once
            if (!_loggedMaxHeight && Math.abs(currentLift - LIFT_MAX) < 0.05) {
                _loggedMaxHeight = true;
                console.log('[ErgoFlex] Reached max height (' + HEIGHT_MAX + '"). Telescoping column positions:');
                telescopingObjects.forEach(item => {
                    const wp = new THREE.Vector3();
                    item.obj.getWorldPosition(wp);
                    console.log('  ' + item.obj.name + ' localY=' + item.obj.position.y.toFixed(6) + ' worldY=' + wp.y.toFixed(6));
                });
            }
            if (currentLift < LIFT_MIN + 1) {
                _loggedMaxHeight = false; // reset when back near min
            }
        }
    }

    // The desk turns for as long as the ring is held over.
    if (loadedModel && !motionPaused && yawCommand) {
        // The same per-frame ceiling updateGlide applies. Without it a long frame
        // advances the turn by that whole gap - the desk jumps, and on a slow
        // machine turning outruns gliding at the same speed setting because only
        // one of them is throttled.
        const turnDt = Math.min(Math.max(dt, 0), 0.05);
        const step = yawCommand * yawRadiansPerSecond() * turnDt;
        deskYaw += step;
        spinWheelsForYaw(step);
        applyDeskTransform();
        loadedModel.updateMatrixWorld(true);
    }

    // Tilt eases toward its target the same way. applyTiltConfig is immediate, so
    // without this a speed control would have nothing to act on.
    if (loadedModel && !motionPaused && tiltTarget !== null) {
        const config = primaryTiltConfig();
        if (!config) tiltTarget = null;
        else if (Math.abs(tiltTarget - config.currentDeg) <= 0.01) {
            config.currentDeg = tiltTarget; applyTiltConfig(config); tiltTarget = null; syncTiltUI();
        } else {
            const step = tiltDegreesPerSecond() * dt;
            const remaining = tiltTarget - config.currentDeg;
            config.currentDeg += Math.abs(remaining) <= step ? remaining : Math.sign(remaining) * step;
            applyTiltConfig(config); syncTiltUI();
        }
    }

    // Constantly update box helpers if we are dragging the transform proxy
    if (isSelectionMode && isDraggingTransform) {
        boxHelpers.forEach(helper => helper.update());
    }

    if (controls) {
        updateCameraTween(dt);
        controls.update();
        const orbitButton = document.getElementById('rotate-scene');
        if (orbitButton && orbitButton.getAttribute('aria-pressed') !== String(controls.autoRotate)) orbitButton.setAttribute('aria-pressed', String(controls.autoRotate));
    }
    workspaceAccessories?.update();
    if (camera) workspaceRoom?.update(camera);
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Studio presentation, customer configuration, and accessible controls.
const speciesPhotos = new Map(); // image path -> THREE.Texture (undefined while loading)
let surfaceFinish = 'satin';
let grainEnabled = true;
let studioGrid = null;
let isolatedVisibility = null;
let dialogReturnFocus = null;
let toastTimer;
function applyRoomLighting() {
    const profile = ROOM_ATMOSPHERES[selectedRoomScene];
    const settings = roomLightSettings[selectedRoomScene] || {};
    const exposure = settings.exposure ?? profile.exposure;
    const daylight = settings.daylight ?? 1;
    const accent = settings.accent ?? 1;
    if (renderer) renderer.toneMappingExposure = exposure;
    if (scene) scene.environmentIntensity = profile.bounce;
    if (sceneLights) {
        sceneLights.key.color.set(profile.key); sceneLights.key.intensity = profile.power * daylight;
        sceneLights.key.position.set(selectedRoomScene === 'home' || selectedRoomScene === 'lounge' ? -5 : -3, 7, 5);
        if (selectedRoomScene === 'product') sceneLights.key.position.set(4.5, 8, 5.5);
        sceneLights.fill.color.set(profile.fill); sceneLights.fill.intensity = .45 * daylight;
        sceneLights.rim.color.set(profile.accent); sceneLights.rim.intensity = .8 * accent;
        sceneLights.hemi.color.set(profile.fill); sceneLights.hemi.groundColor.set('#746b61'); sceneLights.hemi.intensity = profile.ambient;
    }
    for (const [id, value] of [['studio-exposure', exposure], ['studio-daylight', daylight], ['studio-accent', accent]]) {
        const input = document.getElementById(id); if (input) input.value = value;
        const output = document.getElementById(`${id}-value`); if (output) output.textContent = `${Number(value).toFixed(2)}×`;
    }
    const label = document.getElementById('scene-light-name'); if (label) label.textContent = profile.label;
}

function setRoomScene(id, persist = true) {
    const choice = ROOM_SCENES.find(s => s.id === id) || ROOM_SCENES[0];
    const hydrationToken = ++sceneAssetHydrationToken;
    if (choice.id !== selectedRoomScene || sceneAssetRegistry.size) {
        persistSceneAssetStates();
        discardSceneAssetUndoEntries();
        clearSceneAssetRegistration();
    }
    selectedRoomScene = choice.id;
    workspaceRoom?.set(choice.id);
    // Room props and desk dressing load over the network. A failure leaves the
    // procedural room standing and is reported in Build checks rather than
    // only in the console.
    const roomReady = workspaceRoom?.ready || Promise.resolve();
    const dressReady = workspaceAccessories?.dress(choice.id) || Promise.resolve();
    const assetsReady = Promise.allSettled([roomReady, dressReady]).then(results => {
        if (results[0].status === 'rejected') {
            reportSceneWarning('room-props', `Scene props for ${choice.name} could not be loaded (${results[0].reason.message}). The room is shown without them.`);
        }
        if (results[1].status === 'rejected') {
            reportSceneWarning('desk-dressing', `Desk dressing for ${choice.name} could not be loaded (${results[1].reason.message}).`);
        }
        return hydrateSceneAssets(choice.id, hydrationToken);
    });
    if (workspaceRoom) workspaceRoom.ready = assetsReady;
    if (floorMesh) floorMesh.visible = choice.id === 'product';
    const shell = document.getElementById('viewer-shell');
    if (shell) shell.dataset.roomScene = choice.id;
    document.querySelectorAll('[data-room-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.roomScene === choice.id)));
    const caption = document.getElementById('room-scene-caption');
    if (caption) {
        const [wide, rear, front] = ROOM_ATMOSPHERES[choice.id].space;
        caption.textContent = choice.id === 'product' ? 'Explore your desk from every angle.' : `${((4200 + wide * 2) / 1000).toFixed(1)} × ${((4000 + rear + front) / 1000).toFixed(1)} m · ${ROOM_ATMOSPHERES[choice.id].label} · Furnishings for inspiration`;
    }
    const heading = document.querySelector('.viewer-heading h2');
    if (heading) heading.textContent = choice.id === 'product' ? 'Designed to move you.' : choice.caption;
    const environment = document.getElementById('studio-environment');
    if (environment) environment.value = choice.tone;
    if (shell) shell.dataset.environment = choice.tone;
    applyRoomLighting();
    updateSceneLibraryStatus();
    if (persist) {
        try { localStorage.setItem('ergoflex.roomScene', choice.id); } catch {}
    }
    // The camera is deliberately left alone. Changing the room used to fire a
    // change on #camera-view, which snapped to a preset - so every scene switch
    // threw away wherever you had orbited to. Swapping the backdrop is not a
    // reason to move the viewer.
    requestAnimationFrame(syncViewerSize);
}
function notifyUser(message) {
    const toast = document.getElementById('studio-toast');
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 4500);
}
function persistCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); }
    catch { notifyUser('Build list is available for this visit. Browser storage is unavailable.'); }
    updateCartUI();
}
function syncBuildSummary() {
    const el = document.getElementById('build-summary');
    if (el) el.textContent = `${currentConfig.woodFinish} / ${currentConfig.baseFinish}`;
    const size = document.getElementById('size-preview-note');
    if (size) size.textContent = `Selected: ${PRODUCT_CONFIG.sizes[currentConfig.size].name}. 3D shows the reference assembly; size options update your estimate.`;
}
// Applies the current sheen to every material role, and derives each wood
// surface's texture repeat from its own size in inches so grain scale stays
// physically constant as the desk changes size.
function applySurfaceFinish() {
    const treatment = key => SURFACE_TREATMENTS[key][surfaceFinish] || SURFACE_TREATMENTS[key].satin;
    const species = woodSpecies(currentConfig.woodFinish);

    woodMaterials.forEach((material, role) => {
        const { roughness, clearcoat } = treatment('wood');
        material.roughness = roughness;
        material.clearcoat = clearcoat;
        const texture = grainEnabled ? woodTextureFor(currentConfig.woodFinish, role) : null;
        if (texture) applyGrainScale(texture, role, species);
        material.map = texture;
        material.bumpMap = texture;
        // Species may raise their own relief, and drive roughness from the same
        // image. A near-black finish has its albedo variation scaled away with
        // everything else, so its grain has to be carried by shading and by
        // varying gloss - which is how black-stained timber reads in the first place.
        material.bumpScale = role === 'edge' ? 0.0016 : (species.bumpScale || 0.0006);
        material.roughnessMap = (species.grainSheen && role !== 'edge') ? texture : null;
        material.needsUpdate = true;
    });

    if (sharedBasePaintMaterial) {
        const { roughness, clearcoat } = treatment('powder');
        sharedBasePaintMaterial.roughness = roughness;
        sharedBasePaintMaterial.clearcoat = clearcoat;
        sharedBasePaintMaterial.needsUpdate = true;
    }
    if (sharedPolishedAluminumMaterial) {
        const { roughness } = treatment('aluminium');
        sharedPolishedAluminumMaterial.roughness = roughness;
        sharedPolishedAluminumMaterial.metalness = 1.0;
        sharedPolishedAluminumMaterial.needsUpdate = true;
    }
    if (sharedBlackPlasticMaterial) {
        const { roughness, clearcoat } = treatment('plastic');
        sharedBlackPlasticMaterial.roughness = roughness;
        sharedBlackPlasticMaterial.clearcoat = clearcoat;
        sharedBlackPlasticMaterial.needsUpdate = true;
    }
}

// A species change swaps the map on every wood role and retints. Natural Birch
// keeps its photographic albedo unmodulated; the generated species already carry
// their own colour, so they are tinted only lightly to preserve the swatch
// relationship without washing the grain out.
// The photograph carries the grain; the tint carries the species. Multiplying a
// light birch surface by a near-black tint is what makes Black Birch read as satin
// black wood while keeping the grain visible in it.
function applyWoodSpecies(finish) {
    const tint = woodSpecies(finish.name).tint || '#ffffff';
    woodMaterials.forEach(material => material.color.set(tint));
    applySurfaceFinish();
}

// A duplicate of the photograph, processed for a finish that the original tone
// would fight. Two problems, both from tinting a warm cream surface toward black:
//
//   grayscale - the photograph's own colour survives the tint and the result
//               reads as dark brown. Reducing the duplicate to luminance first
//               leaves a neutral base, so the tint alone decides the colour.
//   boost     - multiplying down scales the grain variation down with it, and on
//               a surface this pale there was nothing left to see. Stretching
//               contrast about the image's own mean keeps the grain legible.
//
// The source photograph is untouched; light finishes still use it at full tone.
function processGrainPhoto(base, { grayscale = false, boost = 1 } = {}) {
    const image = base.image;
    if (!image || !image.width) return base;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    if (grayscale) {
        for (let i = 0; i < px.length; i += 4) {
            const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = luma;
        }
    }
    if (boost !== 1) {
        let mean = 0;
        for (let i = 0; i < px.length; i += 4) mean += (px[i] + px[i + 1] + px[i + 2]) / 3;
        mean /= (px.length / 4);
        for (let i = 0; i < px.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                px[i + c] = Math.max(0, Math.min(255, mean + (px[i + c] - mean) * boost));
            }
        }
    }
    context.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = base.anisotropy;
    return texture;
}

// Face veneer is photographic for every species. The edge stays generated: it is
// stacked plywood laminations, which is not what a face photograph shows.
function woodTextureFor(name, role) {
    const spec = woodSpecies(name);
    if (spec.photo && role !== 'edge') {
        const base = loadSpeciesPhoto(spec.photo);
        if (!base) return generateGrainTexture(name, role);
        // One Texture carries one repeat, so each role needs its own view of the
        // image or whichever role ran last would set the grain scale for all of
        // them and the physical scaling would silently not hold. Keyed by path,
        // so finishes sharing an image share these clones too.
        const boost = spec.contrastBoost || 1;
        const grayscale = !!spec.grayscale;
        const key = spec.photo + '|photo|' + boost + (grayscale ? '|bw' : '') + '|' + role;
        if (!speciesTextures.has(key)) {
            const source = (boost === 1 && !grayscale)
                ? base
                : processGrainPhoto(base, { grayscale, boost });
            const perRole = source.clone();
            perRole.needsUpdate = true;
            speciesTextures.set(key, perRole);
        }
        return speciesTextures.get(key);
    }
    return generateGrainTexture(name, role);
}

// Grain scale is physical: a 72in top gets 1.5x the repeats of a 48in top, so
// the grain stays the same size rather than stretching with the surface.
function applyGrainScale(texture, role, species) {
    const size = surfaceInches(role);
    texture.repeat.set(Math.max(0.25, size.w * species.repeatsPerInch),
                       Math.max(0.25, size.d * species.repeatsPerInch));
    texture.needsUpdate = true;
}

// The measured dimensions of each wood surface, in inches. Falls back to the
// reference assembly's numbers before the model has loaded.
function surfaceInches(role) {
    const fallback = { desktop: { w: 44, d: 32 }, shelf: { w: 43, d: 15 }, edge: { w: 44, d: 3.5 },
                       wing: { w: 35, d: 18 } }[role]
        || { w: 44, d: 32 };
    if (!loadedModel) return fallback;
    const names = { desktop: ['Desktop_3'], shelf: ['Top_Shelf_3'], edge: ['Desktop'],
                    wing: ['Desktop_1'] }[role] || [];
    const box = new THREE.Box3();
    let found = false;
    partRegistry.forEach(entry => {
        if (!names.includes(entry.name)) return;
        box.expandByObject(entry.obj);
        found = true;
    });
    if (!found || box.isEmpty()) return fallback;
    const size = box.getSize(new THREE.Vector3());
    const perWorld = worldToInches();
    // The side panels stand upright, so their visible face is spanned by Z and Y.
    // Measuring them on the horizontal Z-by-X plane would read the 0.7in
    // thickness as the depth and smear the grain up the panel.
    if (role === 'wing') return { w: size.z * perWorld, d: size.y * perWorld };
    // Z is the width axis in this asset and X the depth (docs/sizing-gate.md).
    return { w: size.z * perWorld, d: size.x * perWorld };
}

// Inches per world unit, derived from the lift calibration the rest of the app
// already trusts.
function worldToInches() {
    const scale = loadedModel ? loadedModel.scale.x : 1;
    return (HEIGHT_MAX - HEIGHT_MIN) / ((LIFT_MAX - LIFT_MIN) * scale);
}
function downloadFile(name, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadEstimate(items) {
    const lines = ['ERGOFLEX — CUSTOM SHOP', 'Configuration estimate · ' + new Date().toLocaleDateString(), ''];
    items.forEach((item, i) => {
        lines.push(`${i + 1}. ErgoFlex · ${PRODUCT_CONFIG.sizes[item.size].name}`, `   ${item.woodFinish} desktop / ${item.baseFinish} frame`);
        for (const line of priceBreakdown(item)) lines.push(`   ${line.label}${line.provisional ? '*' : ''}: ${money(line.price)}`);
        lines.push(`   Quantity ${item.quantity} × ${money(item.price)} = ${money(item.quantity * item.price)}`, '');
    });
    if (items.some(item => item.accessories?.length)) lines.push('* Accessory prices are provisional estimates per desk; availability and mounting fit need confirmation.', '');
    lines.push('Estimated total: ' + money(items.reduce((sum, i) => sum + i.price * i.quantity, 0)), '', 'Design preview only. Taxes, delivery, availability, and final specifications require confirmation.');
    downloadFile('ErgoFlex-estimate.txt', lines.join('\n'));
    notifyUser('Your configuration estimate has been downloaded.');
}
function openDialog(modal) {
    if (modal.classList.contains('hidden')) dialogReturnFocus = document.activeElement;
    modal.classList.remove('hidden'); modal.focus();
}
function closeDialog(modal) {
    modal.classList.add('hidden'); dialogReturnFocus?.focus();
}
function showAllParts() {
    if (isolatedVisibility) isolatedVisibility.forEach((visible, obj) => obj.visible = visible);
    isolatedVisibility = null;
    document.getElementById('isolate-parts')?.setAttribute('aria-pressed', 'false');
}
// A short eased move instead of a jump. The presets and every shortcut go
// through this, so framing is consistent wherever it is triggered from.
const cameraTween = { active: false, t: 0, duration: 0.4, fallback: null,
    fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };

function startCameraTween(toPos, toTarget) {
    cameraTween.fromPos.copy(camera.position);
    cameraTween.fromTarget.copy(controls.target);
    cameraTween.toPos.copy(toPos);
    cameraTween.toTarget.copy(toTarget);
    cameraTween.t = 0;
    cameraTween.active = true;
    // The tween advances in the render loop. A throttled or hidden tab stops
    // delivering frames, and the camera would simply never arrive — so promise
    // the end state on a timer, which keeps running, and snap to it if the
    // animation has not finished on its own.
    clearTimeout(cameraTween.fallback);
    cameraTween.fallback = setTimeout(() => {
        if (!cameraTween.active) return;
        cameraTween.active = false;
        camera.position.copy(cameraTween.toPos);
        controls.target.copy(cameraTween.toTarget);
        controls.update();
    }, cameraTween.duration * 1000 + 250);
}

function updateCameraTween(dt) {
    if (!cameraTween.active) return;
    cameraTween.t = Math.min(1, cameraTween.t + dt / cameraTween.duration);
    const e = cameraTween.t < 0.5
        ? 4 * cameraTween.t ** 3
        : 1 - Math.pow(-2 * cameraTween.t + 2, 3) / 2;   // ease-in-out cubic
    camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
    controls.update();
    if (cameraTween.t >= 1) cameraTween.active = false;
}

// The named sub-assemblies a viewer actually wants to look at. Resolved live,
// because rigs reparent their parts and the wrappers are the right thing to
// frame once they exist.
const DEFAULT_MIN_DISTANCE = 2;
const CLOSEUP_MIN_DISTANCE = 0.35;

function cameraShortcutTargets(key) {
    if (!loadedModel) return [];
    const byPrefix = prefixes => {
        const out = [];
        partRegistry.forEach(entry => {
            if (prefixes.some(p => entry.name === p || entry.name.startsWith(p))) out.push(entry.obj);
        });
        return out;
    };
    switch (key) {
        case 'desk': return [loadedModel];
        case 'desktop': {
            const tilt = tiltConfigs.find(c => c.wrapperGroup);
            return tilt ? [tilt.wrapperGroup] : byPrefix(['Desktop', 'Top_Shelf']);
        }
        case 'wheels': return wheelRigs.length ? wheelRigs.map(r => r.wrapper) : byPrefix(['Wheel_']);
        case 'actuators': return actuatorRigs.length
            ? actuatorRigs.flatMap(r => [r.cylWrapper, r.rodWrapper, r.targetObj].filter(Boolean))
            : byPrefix(['Linear_Actuators', 'L_A_Hardware_Top']);
        case 'columns': return byPrefix(['Lift_Column']);
        default: return [loadedModel];
    }
}

// Sub-assemblies are small. OrbitControls clamps to minDistance 2 and
// focusObjects respects that clamp, so a wheel or a clevis would be framed no
// closer than 2 world units — not a close-up at all. Drop the floor while a
// close-up is active and restore it on reset.
function focusCameraShortcut(key) {
    const objects = cameraShortcutTargets(key);
    if (!objects.length) return notifyUser('That assembly is not in the current model.');
    controls.minDistance = key === 'desk' ? DEFAULT_MIN_DISTANCE : CLOSEUP_MIN_DISTANCE;
    focusObjects(objects, { animate: true });
}

function focusObjects(objects, { animate = false } = {}) {
    if (!camera || !controls || !objects.length) return;
    if (loadedModel && objects.includes(loadedModel)) objects = [...objects, ...(workspaceAccessories?.objects() || [])];
    const box = new THREE.Box3(); objects.forEach(obj => box.expandByObject(obj));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const direction = camera.position.clone().sub(controls.target).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = controls.minDistance;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).sub(center);
        const depth = point.dot(direction);
        distance = Math.max(distance, depth + Math.abs(point.dot(up)) / tanV, depth + Math.abs(point.dot(right)) / tanH);
    }
    distance = Math.min(controls.maxDistance, distance * 1.12);
    const position = center.clone().addScaledVector(direction, distance);
    controls.autoRotate = false;
    if (animate) {
        startCameraTween(position, center);
    } else {
        cameraTween.active = false;
        controls.target.copy(center); camera.position.copy(position); controls.update();
    }
}

// Every section is visible at once now, so there is nothing to switch between.
// Kept because the viewer's Glide button and the debug surface both ask for a
// section by name: bring it into view and focus it instead.
function setMotionTab(tab) {
    const dock = document.getElementById('motion-dock');
    if (dock?.classList.contains('collapsed')) document.getElementById('motion-dock-toggle')?.click();
    const panel = document.querySelector(`[data-motion-panel="${tab}"]`);
    if (!panel) return;
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (tab === 'glide') document.getElementById('glide-pad')?.focus();
    if (tab !== 'glide') releaseGlideInput();
}
function initStudio() {
    const toast = document.createElement('div'); toast.id = 'studio-toast'; toast.role = 'status'; toast.hidden = true; document.body.append(toast);
    // V2 adds the accessories axis. A V1 payload is a valid V2 with an empty
    // accessory list, so migration is a read of the old key when the new one is
    // absent — no separate conversion step, and V1 data is left untouched.
    const readStored = (v2Key, v1Key) => {
        try {
            const raw = localStorage.getItem(v2Key) ?? localStorage.getItem(v1Key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };
    try {
        const shared = new URLSearchParams(location.search).get('build');
        const stored = shared ? JSON.parse(shared) : readStored(SAVED_BUILD_KEY, 'ergoflexSavedBuildV1');
        if (validConfig(stored)) currentConfig = cleanConfig(stored);
        if (shared && !validConfig(stored)) notifyUser('This build link is invalid. Showing the default configuration.');
    } catch { notifyUser('Saved configuration could not be read. Showing the default build.'); }
    try {
        const saved = readStored(CART_KEY, 'ergoflexCartV1') || [];
        if (Array.isArray(saved)) cartItems = saved.filter(validConfig).slice(0, 100).map((item, index) => ({ ...cleanConfig(item), id: `restored-${index}`, quantity: Math.max(1, Math.min(20, Math.round(Number(item.quantity) || 1))), price: configurationPrice(cleanConfig(item)) }));
    } catch {}
    // An accessory can become incompatible if the stored size no longer suits it.
    const dropped = incompatibleAccessories(currentConfig);
    if (dropped.length) {
        currentConfig.accessories = currentConfig.accessories.filter(id => accessoryFits(id, currentConfig.size));
        notifyUser(`${dropped.map(a => a.name).join(', ')} removed: not available for this size.`);
    }
    populateSizeOptions();
    applyConfigToUI();
    buildGuidedConfiguration();
    updateCartUI();
    document.getElementById('open-editor').onclick = () => setSetupLayout(true);
    document.getElementById('cart-btn').onclick = showCartModal;
    document.getElementById('export-cart').onclick = () => cartItems.length ? downloadEstimate(cartItems) : notifyUser('Add a configuration first.');
    document.getElementById('download-quote').onclick = () => downloadEstimate([{ ...currentConfig, price: configurationPrice(currentConfig), quantity: 1 }]);
    document.getElementById('save-build').onclick = () => {
        try { localStorage.setItem(SAVED_BUILD_KEY, JSON.stringify(currentConfig)); notifyUser('Build saved with your finishes, size and accessories.'); }
        catch { notifyUser('Browser storage is unavailable. Download an estimate to keep your build.'); }
    };
    // A saved build outranks the catalog default on every later visit, and there
    // was no way to take that back from the page - clearing it meant editing
    // localStorage by hand.
    document.getElementById('reset-build').onclick = () => {
        try { localStorage.removeItem(SAVED_BUILD_KEY); localStorage.removeItem('ergoflexSavedBuildV1'); } catch {}
        currentConfig = defaultConfig();
        applyConfigToUI();
        applyAccessoryVisibility();
        renderAccessories();
        updatePrice();
        notifyUser('Back to the standard build: ' + currentConfig.woodFinish + ' on ' + currentConfig.baseFinish + '.');
    };
    document.getElementById('share-build').onclick = async () => {
        const url = new URL(location.href); url.search = ''; url.searchParams.set('build', JSON.stringify(currentConfig));
        try { await navigator.clipboard.writeText(url.href); notifyUser('Configuration link copied.'); }
        catch { downloadFile('ErgoFlex-build-link.txt', url.href); notifyUser('Configuration link downloaded.'); }
    };
    const sizeNote = document.createElement('p'); sizeNote.id = 'size-preview-note'; sizeNote.className = 'studio-note'; sizeSelect.after(sizeNote);
    const materialOptions = document.createElement('div'); materialOptions.className = 'material-options';
    materialOptions.innerHTML = `<label>Surface sheen <select id="surface-finish"><option value="matte">Matte</option><option value="satin" selected>Satin</option><option value="gloss">Gloss</option></select></label><label class="check-label"><input id="wood-grain" type="checkbox" checked> Show wood grain</label><p class="studio-note">Wood tones preview stains on the reference birch surface. Sheen is a visualization setting.</p>`;
    document.getElementById('selected-wood-name').after(materialOptions);
    document.getElementById('surface-finish').onchange = e => { surfaceFinish = e.target.value; applySurfaceFinish(); };
    document.getElementById('wood-grain').onchange = e => { grainEnabled = e.target.checked; applySurfaceFinish(); };
    const looks = document.createElement('div'); looks.className = 'look-presets';
    looks.innerHTML = `<div class="eyebrow">A LITTLE INSPIRATION</div><div><button data-look="Natural Birch|White">Light & natural</button><button data-look="Walnut|Forest">Warm & grounded</button><button data-look="Black Birch|Black">All in black</button></div>`;
    document.getElementById('config-column').children[0].after(looks);
    looks.querySelectorAll('[data-look]').forEach(b => b.onclick = () => b.dataset.look.split('|').forEach((name, i) => {
        const type = i ? 'base' : 'wood';
        const finish = PRODUCT_CONFIG[i ? 'baseFinishes' : 'woodFinishes'].find(f => f.name === name);
        const swatch = [...document.querySelectorAll(`[data-material="${type}"]`)].find(el => el.dataset.finish === name);
        selectFinish(finish, type, swatch);
    }));
    const viewer = canvas.parentElement;
    const top = document.createElement('div'); top.className = 'viewer-heading';
    top.innerHTML = `<div class="eyebrow" id="scene-status">LOADING YOUR WORKSPACE</div><h2>Designed to move you.</h2><p id="build-summary"></p>`; viewer.append(top);
    const toolbar = document.createElement('div'); toolbar.className = 'studio-toolbar';
    toolbar.innerHTML = `<label><span>Backdrop</span><select id="studio-environment"><option value="gallery">Gallery</option><option value="warm">Warm studio</option><option value="slate" selected>Slate studio</option></select></label><label><span>Camera</span><select id="camera-view"><option value="hero">Perspective</option><option value="room">Whole room</option><option value="front">Front</option><option value="side">Side</option><option value="top">Top</option></select></label><button id="fit-view" title="Fit the whole desk in view">Fit</button><span class="camera-shortcuts" role="group" aria-label="Camera shortcuts"><button data-camera-focus="desktop" title="Frame the desktop and shelf">Desktop</button><button data-camera-focus="wheels" title="Frame the omni wheels">Wheels</button><button data-camera-focus="actuators" title="Frame the linear actuators">Actuators</button><button data-camera-focus="columns" title="Frame the lift columns">Columns</button></span><button id="rotate-scene" aria-pressed="false">Orbit</button><button id="grid-toggle" aria-pressed="false">Grid</button><button id="capture-view">Capture ↗</button><details class="render-settings"><summary>Light & quality</summary><div><p id="scene-light-name"></p><label>Exposure <output id="studio-exposure-value"></output><input id="studio-exposure" type="range" min="0.6" max="1.6" step="0.05" value="1.02"></label><label>Main light <output id="studio-daylight-value"></output><input id="studio-daylight" type="range" min="0.2" max="2" step="0.05" value="1"></label><label>Accent light <output id="studio-accent-value"></output><input id="studio-accent" type="range" min="0" max="2" step="0.05" value="1"></label><button id="reset-scene-light" type="button">Reset scene lighting</button><label>Quality<select id="render-quality"><option value="1">Balanced</option><option value="2" selected>High</option></select></label></div></details>`;
    const viewerControls = document.createElement('div'); viewerControls.className = 'viewer-controls';
    viewerControls.append(toolbar);
    const scenes = document.createElement('div'); scenes.className = 'scene-switcher';
    scenes.innerHTML = `<span class="scenes-label">Scenes</span><div class="scene-options" role="group" aria-label="Workspace scenes">${ROOM_SCENES.map(s => `<button type="button" data-room-scene="${s.id}" aria-pressed="${s.id === 'product'}"><span class="scene-dot scene-${s.id}" aria-hidden="true"></span>${s.name}</button>`).join('')}</div>`;
    const roomCaption = document.createElement('p'); roomCaption.id = 'room-scene-caption'; roomCaption.setAttribute('aria-live', 'polite');
    viewerControls.append(scenes, roomCaption); viewer.append(viewerControls);
    scenes.querySelectorAll('button').forEach(button => button.onclick = () => setRoomScene(button.dataset.roomScene));
    new ResizeObserver(syncViewerSize).observe(viewerControls);
    try { selectedRoomScene = localStorage.getItem('ergoflex.roomScene') || 'product'; } catch {}
    setRoomScene(selectedRoomScene, false);
    const applyEnvironment = (value) => {
        document.getElementById('viewer-shell').dataset.environment = value;
        if (floorMesh) floorMesh.material.opacity = value === 'slate' ? .36 : .24;
    };
    document.getElementById('studio-environment').onchange = e => applyEnvironment(e.target.value);
    document.getElementById('studio-environment').value = (ROOM_SCENES.find(s => s.id === selectedRoomScene) || ROOM_SCENES[0]).tone;
    applyEnvironment(document.getElementById('studio-environment').value);
    try {
        const saved = JSON.parse(localStorage.getItem('ergoflex.sceneLights') || '{}');
        for (const id of Object.keys(ROOM_ATMOSPHERES)) {
            const settings = saved?.[id]; if (!settings) continue;
            roomLightSettings[id] = {};
            for (const [key, min, max] of [['exposure', .6, 1.6], ['daylight', .2, 2], ['accent', 0, 2]]) {
                if (Number.isFinite(settings[key])) roomLightSettings[id][key] = Math.max(min, Math.min(max, settings[key]));
            }
        }
    } catch {}
    const saveLighting = () => { try { localStorage.setItem('ergoflex.sceneLights', JSON.stringify(roomLightSettings)); } catch {} };
    for (const key of ['exposure', 'daylight', 'accent']) document.getElementById(`studio-${key}`).oninput = e => {
        (roomLightSettings[selectedRoomScene] ||= {})[key] = Number(e.target.value);
        applyRoomLighting(); saveLighting();
    };
    document.getElementById('reset-scene-light').onclick = () => { delete roomLightSettings[selectedRoomScene]; applyRoomLighting(); saveLighting(); };
    applyRoomLighting();
    document.getElementById('render-quality').onchange = e => {
        if (!renderer) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, Number(e.target.value))); syncViewerSize();
    };
    document.getElementById('fit-view').onclick = () => { controls.minDistance = DEFAULT_MIN_DISTANCE; if (loadedModel) focusObjects([loadedModel], { animate: true }); };
    document.querySelectorAll('[data-camera-focus]').forEach(button => {
        button.onclick = () => focusCameraShortcut(button.dataset.cameraFocus);
    });
    document.getElementById('camera-view').onchange = e => {
        if (!camera || !loadedModel) return;
        if (e.target.value === 'room') {
            const dock = document.getElementById('motion-dock');
            if (dock && !dock.classList.contains('collapsed')) document.getElementById('motion-dock-toggle')?.click();
            controls.minDistance = DEFAULT_MIN_DISTANCE;
            camera.position.copy(controls.target).add(new THREE.Vector3(5, 4, 5));
            focusObjects(workspaceRoom?.root ? [loadedModel, workspaceRoom.root] : [loadedModel], { animate: true });
            return;
        }
        const direction = { hero: [4.8, 2.3, 4.2], front: [6, 0.2, 0], side: [0, 0.2, 6], top: [0, 6, 0.001] }[e.target.value];
        controls.minDistance = DEFAULT_MIN_DISTANCE;
        camera.position.copy(controls.target).add(new THREE.Vector3(...direction)); focusObjects([loadedModel], { animate: true });
    };
    document.getElementById('rotate-scene').onclick = e => {
        if (!controls) return;
        controls.autoRotate = !controls.autoRotate; e.target.setAttribute('aria-pressed', String(controls.autoRotate));
    };
    document.getElementById('grid-toggle').onclick = e => {
        if (!scene) return;
        if (!studioGrid) { studioGrid = new THREE.GridHelper(12, 48, 0x9aa9a2, 0xc6ceca); studioGrid.position.y = 0.002; studioGrid.material.transparent = true; studioGrid.material.opacity = 0.35; studioGrid.visible = false; scene.add(studioGrid); }
        studioGrid.visible = !studioGrid.visible; e.target.setAttribute('aria-pressed', String(studioGrid.visible));
    };
    document.getElementById('capture-view').onclick = () => {
        if (!renderer || !loadedModel) return notifyUser('Wait for the desk to finish loading.');
        workspaceAccessories?.update();
        renderer.render(scene, camera);
        try { canvas.toBlob(blob => {
            if (!blob) return notifyUser('Capture is unavailable in this browser.');
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ErgoFlex-design.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            notifyUser(selectedRoomScene === 'product' ? 'Desk image downloaded with a transparent background.' : 'Workspace scene image downloaded.');
        }); } catch { notifyUser('Image capture is unavailable. Try serving the project with npm run dev.'); }
    };
    document.querySelectorAll('#viewer-shell button[title]').forEach(b => b.setAttribute('aria-label', b.title));
    buildMotionRemote();
    placeRemoteForMode();
    // The storefront opens with the panel closed, so the desk is unobstructed
    // until the controls are actually asked for.
    if (!document.body.classList.contains('setup-layout') && localStorage.getItem('ergoflex.motionDockCollapsed') === null) {
        document.getElementById('motion-dock-toggle')?.click();
    }
    // A saved position is only valid against the layout it was saved in, so
    // re-check it whenever the box it lives in could have changed shape.
    window.addEventListener('resize', clampDockPosition);
    if (document.fonts?.ready) document.fonts.ready.then(clampDockPosition).catch(() => {});
    const editorTools = document.createElement('div'); editorTools.className = 'precision-tools';
    editorTools.innerHTML = `<div class="eyebrow">PRECISION & VISIBILITY</div><div><button id="focus-selected">Focus selection <kbd>F</kbd></button><button id="isolate-parts" aria-pressed="false">Isolate</button><button id="show-all-parts">Show all</button></div><div><label>Coordinates <select id="transform-space"><option value="world">World</option><option value="local">Local</option></select></label><label class="check-label"><input type="checkbox" id="transform-snap"> Snap transforms</label></div><p class="studio-note">G Gumball · Q Hide · F Focus<br>Arrows move · rings rotate · squares scale<br>Snap: 0.05 scene units / 15° / 10% scale</p>`;
    document.getElementById('part-search-input').parentElement.after(editorTools);
    const liftTools = document.createElement('div'); liftTools.className = 'precision-tools';
    liftTools.innerHTML = `<div class="eyebrow">LIFT ASSEMBLY</div><div><button id="assign-lift">Assign selected</button><button id="unassign-lift">Remove selected</button></div><p class="studio-note">Selection is independent of animation. Assign unrigged parts here to make them follow the lift. Changes apply to this session.</p>`;
    document.getElementById('clone-parts-btn').parentElement.after(liftTools);
    document.getElementById('assign-lift').onclick = () => {
        if (transformControl?.object) return notifyUser('Set Transform Tool to Off before assigning lift parts.');
        const added = [];
        movingObjects.forEach(({ obj }) => {
            if (isInTiltWrapper(obj) || TELESCOPING_PARTS.includes(obj.name) || liftObjects.has(obj)) return;
            // baseY comes from the canonical transform, not obj.position, because the
            // part may still be parented to the transform proxy.
            const canon = canonicalTransform(obj);
            liftObjects.set(obj, { obj, baseY: (canon ? canon.p.y : obj.position.y) - (currentLift - LIFT_MIN) });
            added.push(obj);
        });
        if (added.length) transaction({ type: 'lift-membership', objects: added, added: true });
        notifyUser(added.length ? `${added.length} parts assigned to lift for this session.` : 'Select unrigged parts first. Tilt, actuator, and wheel rigs keep their own motion.');
    };
    document.getElementById('unassign-lift').onclick = () => {
        const removed = [];
        movingObjects.forEach(({ obj }) => {
            const entry = liftObjects.get(obj);
            if (!entry) return;
            removed.push({ obj, baseY: entry.baseY });
            liftObjects.delete(obj);
        });
        if (removed.length) transaction({ type: 'lift-membership', objects: removed, added: false });
        notifyUser(`${removed.length} parts removed from lift for this session.`);
    };
    document.getElementById('focus-selected').onclick = () => movingObjects.length ? focusObjects(movingObjects.map(i => i.obj), { animate: true }) : notifyUser('Select objects to focus on them.');
    document.getElementById('isolate-parts').onclick = e => {
        if (isolatedVisibility) return showAllParts();
        if (!movingObjects.length) return notifyUser('Select parts to isolate first.');
        const selected = new Set(movingObjects.map(i => i.obj)); isolatedVisibility = new Map();
        interactableObjects.forEach(obj => { isolatedVisibility.set(obj, obj.visible); obj.visible = selected.has(selectionTarget(obj)); });
        e.target.setAttribute('aria-pressed', 'true');
    };
    document.getElementById('show-all-parts').onclick = showAllParts;
    document.getElementById('transform-space').onchange = e => transformControl?.setSpace(e.target.value);
    document.getElementById('transform-snap').onchange = e => {
        transformControl?.setTranslationSnap(e.target.checked ? 0.05 : null);
        transformControl?.setRotationSnap(e.target.checked ? Math.PI / 12 : null);
        transformControl?.setScaleSnap(e.target.checked ? 0.1 : null);
    };
    document.querySelectorAll('.config-header').forEach(header => {
        const id = header.nextElementSibling.id; header.role = 'button'; header.tabIndex = 0;
        header.setAttribute('aria-controls', id); header.setAttribute('aria-expanded', String(header.nextElementSibling.classList.contains('expanded')));
        header.addEventListener('click', () => header.setAttribute('aria-expanded', String(header.nextElementSibling.classList.contains('expanded'))));
        header.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); header.click(); } };
    });
    document.addEventListener('keydown', e => {
        const modal = document.getElementById('cart-modal');
        if (!modal.classList.contains('hidden')) {
            if (e.key === 'Escape') { e.preventDefault(); closeDialog(modal); }
            if (e.key === 'Tab') {
                const elements = [...modal.querySelectorAll('button,input')].filter(el => !el.disabled);
                if (e.shiftKey && (document.activeElement === elements[0] || document.activeElement === modal)) { e.preventDefault(); elements.at(-1).focus(); }
                else if (!e.shiftKey && document.activeElement === elements.at(-1)) { e.preventDefault(); elements[0].focus(); }
            }
            return;
        }
        if (e.key === 'Escape') { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); syncGlideUI(); }
        if (!setupLayoutOn || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,select,textarea,[contenteditable],#glide-pad')) return;
        const mode = { q: 'none', g: 'unified' }[e.key.toLowerCase()];
        if (mode) { e.preventDefault(); document.querySelector(`input[name="transform_mode"][value="${mode}"]`).click(); }
        if (e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('focus-selected').click(); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const hasSceneAssets = movingObjects.some(item => item.obj.userData?.sceneAsset);
            if (hasSceneAssets) { e.preventDefault(); deleteSelectedSceneAssets(); }
        }
    });
}

// Small console API for setup & testing (open DevTools and type `ErgoFlex.`)
window.ErgoFlex = {
    get workspaceAccessories() { return workspaceAccessories; },
    get workspaceRoom() { return workspaceRoom; },
    get roomScene() { return selectedRoomScene; },
    roomScenes: ROOM_SCENES,
    setRoomScene,
    addSceneAsset,
    deleteSelectedSceneAssets,
    get tiltConfigs() { return tiltConfigs; },
    get partRegistry() { return partRegistry; },
    get sceneAssetRegistry() { return sceneAssetRegistry; },
    get sceneAssetStates() { return sceneAssetStates; },
    get movingObjects() { return movingObjects; },
    get liftObjects() { return [...liftObjects.values()]; },
    selectByNames(names) {
        const set = new Set(names);
        let count = 0;
        partRegistry.forEach(entry => {
            if (set.has(entry.name)) {
                toggleMovingObject(entry.obj, true, true);
                count++;
            }
        });
        updateTransformProxy();
        if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        return count;
    },
    setHeight(h) {
        manualLiftOverride = true;
        h = THREE.MathUtils.clamp(Number(h) || HEIGHT_MIN, HEIGHT_MIN, HEIGHT_MAX);
        currentLift = targetLift = heightToLift(h);
        updateMovingObjectsPosition();
        showHeight(h);
    },
    setTilt(name, deg) {
        const config = tiltConfigs.find(c => c.name === name);
        if (!config) return false;
        config.currentDeg = THREE.MathUtils.clamp(Number(deg) || 0, config.minDeg, config.maxDeg);
        applyTiltConfig(config);
        rebuildTiltUI(); // keep sliders/labels in sync
        return true;
    },
    setAutoRotate(v) { if (controls) controls.autoRotate = !!v; },
    setMotionTab,
    haltAllMotion,
    get deskYaw() { return deskYaw; },
    // Drives the ring's command directly: the gesture is a pointer path, and the
    // behaviour worth asserting is what the command does to the desk.
    jogYaw: setYawCommand,
    get yawRate() { return yawRadiansPerSecond(); },
    get yawProjection() { return meanYawProjection(); },
    get glideSpeed() { return glideSpeed; },
    get yawCommand() { return yawCommand; },
    get heightInches() { return liftToHeight(currentLift); },
    placeDockFromStorage,
    // Rebuilding is how the panel is exercised against corrupt storage without
    // a full page reload.
    rebuildMotionRemote() { buildMotionRemote(); placeRemoteForMode(); },
    resetView() { const btn = document.getElementById('reset-view'); if (btn) btn.click(); },
    setPivotByName(name) {
        let done = false;
        partRegistry.forEach(e => { if (!done && e.name === name) { setPivotPart(e.editorId); done = true; } });
        return done;
    },
    undo: performUndo,
    get undoCount() { return undoStack.length; },
    get transformControl() { return transformControl; },
    get transformProxy() { return transformProxy; },
    exportTiltConfigs: serializeTiltConfigs,
    saveTiltConfig,
    removeTiltConfig,
    addSelectedToTiltConfig,
    removeSelectedFromTiltConfig,
    get actuatorRigs() { return actuatorRigs; },
    buildActuatorRig,
    removeActuatorRig,
    persistActuatorRigs,
    exportActuatorRigs: serializeActuatorRigs,
    get wheelRigs() { return wheelRigs; },
    get glideActive() { return glideActive; },
    startGlide,
    stopGlide,
    setGlidePosition,
    get glidePosition() { return { x: glideOffset.x, z: glideOffset.z }; },
    get currentConfig() { return { ...currentConfig }; },
    get renderer() { return renderer; },
    get loadedModel() { return loadedModel; },
    // Edit machinery. Exposed because it is scene state with no DOM
    // representation — there is no element whose value reflects a part's
    // canonical transform or the lift baseline derived from it.
    get editRevision() { return editRevision; },
    get undoCount2() { return undoStack.length; },
    get redoCount() { return redoStack.length; },
    redo: performRedo,
    get deskHeight() { return liftToHeight(currentLift); },
    commitTransform,
    canonicalTransform,
    withNeutralPose,
    get modelFingerprint() { return modelFingerprint; },
    get lockedParts() { return [...lockedParts]; },
    get deletedBakedRigs() { return { tilt: [...deletedBakedRigs.tilt], actuator: [...deletedBakedRigs.actuator] }; },
    focusCameraShortcut,
    applyPreset,
    toggleAccessory,
    get priceLines() { return priceBreakdown(currentConfig); },
    runValidation,
    reportSceneWarning,
    validConfigForTest: validConfig,
    alignSelection,
    distributeSelection,
    setLocked,
    isLocked,
    refreshTransformInspector,
    get inspectedPart() { return inspectorTarget(); },
    get woodMaterials() { return Object.fromEntries([...woodMaterials].map(([role, m]) => [role, {
        roughness: m.roughness, clearcoat: m.clearcoat, metalness: m.metalness,
        color: '#' + m.color.getHexString(),
        bumpScale: m.bumpScale, roughnessMapped: !!m.roughnessMap,
        mapId: m.map ? m.map.uuid : null,
        repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null
    }])); },
    get frameMaterial() { return sharedBasePaintMaterial && { roughness: sharedBasePaintMaterial.roughness, clearcoat: sharedBasePaintMaterial.clearcoat, metalness: sharedBasePaintMaterial.metalness }; },
    get metalMaterial() { return sharedPolishedAluminumMaterial && { roughness: sharedPolishedAluminumMaterial.roughness, metalness: sharedPolishedAluminumMaterial.metalness }; },
    get plasticMaterial() { return sharedBlackPlasticMaterial && { roughness: sharedBlackPlasticMaterial.roughness, clearcoat: sharedBlackPlasticMaterial.clearcoat }; },
    setSurfaceFinish(value) { surfaceFinish = value; applySurfaceFinish(); },
    focusCameraShortcutTargets: cameraShortcutTargets,
    get cameraState() { return { position: camera.position.toArray(), target: controls.target.toArray(), minDistance: controls.minDistance }; },
    serializeProject,
    applyProject,
    readAutosaveRing,
    writeAutosave,
    prepareARModel,
    launchAR
};

// --- Feature-module context ---
//
// studio.js owns every piece of mutable scene state. Feature modules never
// import studio.js (that would be a cycle); they receive this object and read
// through it.
//
// The distinction that matters: scene, renderer, controls and loadedModel are
// REASSIGNED (loadedModel on every model load, the renderer on context
// recovery), so they must be getters — a module that captured the value would
// be holding a stale reference the moment the model reloads. The Map and array
// containers below are only ever mutated in place, never reassigned, so plain
// references stay valid. Anything that clears one of those containers must use
// `.length = 0` or `.clear()` for exactly that reason.
const ctx = {
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get controls() { return controls; },
    get loadedModel() { return loadedModel; },
    get transformProxy() { return transformProxy; },
    get currentLift() { return currentLift; },
    get currentConfig() { return currentConfig; },

    partRegistry,
    partLabels,
    liftObjects,
    tiltConfigs,
    actuatorRigs,
    wheelRigs,
    proxyOriginalParents,
    animOriginalParents,

    notifyUser,
    pushUndo,
    LIFT_MIN, LIFT_MAX, HEIGHT_MIN, HEIGHT_MAX
};

// Populate the configurator UI first so it works even if 3D init fails
initStudio();
populateFinishOptions();
updatePrice();
initThreeJS();
